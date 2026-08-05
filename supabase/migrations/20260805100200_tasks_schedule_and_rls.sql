-- Cronograma + alcance del rol Analista de Tecnología.
--
-- 1. `tasks.start_date`: hasta ahora una tarea solo tenía fecha límite, que
--    define un punto, no una barra. El Gantt del cronograma necesita el
--    rango completo.
-- 2. Políticas RLS que acotan tareas, celdas y actividades a "lo propio"
--    cuando quien consulta es un Analista de Tecnología.

alter table public.tasks
  add column start_date date,
  add constraint tasks_dates_ordered
    check (start_date is null or due_date is null or start_date <= due_date);

create index tasks_month_dates_idx on public.tasks (month_id, start_date, due_date);

-- ---------------------------------------------------------------------------
-- tasks: el Analista de Tecnología solo ve y gestiona lo asignado a él.
-- ---------------------------------------------------------------------------

-- Lectura acotada. `is_own_person(null)` es false, así que una tarea sin
-- asignar tampoco le aparece: si nadie la tiene, no es suya.
drop policy "tasks_select_authenticated" on public.tasks;

create policy "tasks_select_scoped" on public.tasks
  for select to authenticated
  using (
    not public.is_analista_tecnologia()
    or public.is_own_person(assigned_person_id)
  );

-- Escritura: gestor/admin como antes, más el analista sobre sus propias
-- tareas mientras el mes siga abierto. El `with check` obliga a que la tarea
-- quede asignada a él — no puede crear trabajo para otra persona ni
-- "regalar" una tarea suya asignándosela a un tercero.
drop policy "tasks_insert_write" on public.tasks;
drop policy "tasks_update_write" on public.tasks;
drop policy "tasks_delete_write" on public.tasks;

create policy "tasks_insert_write" on public.tasks
  for insert to authenticated
  with check (
    public.can_write_month(month_id)
    or public.can_write_own_work(month_id, assigned_person_id)
  );

create policy "tasks_update_write" on public.tasks
  for update to authenticated
  using (
    public.can_write_month(month_id)
    or public.can_write_own_work(month_id, assigned_person_id)
  )
  with check (
    public.can_write_month(month_id)
    or public.can_write_own_work(month_id, assigned_person_id)
  );

create policy "tasks_delete_write" on public.tasks
  for delete to authenticated
  using (
    public.can_write_month(month_id)
    or public.can_write_own_work(month_id, assigned_person_id)
  );

-- ---------------------------------------------------------------------------
-- allocations: las horas del mes son dato personal — un analista ve las
-- suyas, no las del resto del equipo.
-- ---------------------------------------------------------------------------
drop policy "allocations_select_authenticated" on public.allocations;

create policy "allocations_select_scoped" on public.allocations
  for select to authenticated
  using (
    not public.is_analista_tecnologia()
    or public.is_own_person(person_id)
  );

-- El insert en 0 horas ya estaba abierto (ancla de comentarios, ver
-- *_allocations_allow_comment_anchor.sql) y es justo lo que necesita el
-- calendario del cronograma para registrar tiempo en una celda que todavía
-- no existe. No se toca: sigue sin poder fijar horas > 0 directamente.

-- ---------------------------------------------------------------------------
-- activities: el registro de tiempo del calendario del cronograma.
--
-- Consecuencia deliberada: como el trigger sync_allocation_hours_from_
-- activities mantiene allocations.hours = suma de sus actividades, permitir
-- que el analista registre actividades en sus propias celdas equivale a
-- dejar que auto-reporte sus horas del mes. Es el punto del módulo ("que
-- gestione su tiempo"), y queda acotado a sus celdas, al mes abierto y
-- registrado en auditoría como cualquier otro cambio.
-- ---------------------------------------------------------------------------
drop policy "activities_select_authenticated" on public.activities;
drop policy "activities_insert_write" on public.activities;
drop policy "activities_update_write" on public.activities;
drop policy "activities_delete_write" on public.activities;

create policy "activities_select_scoped" on public.activities
  for select to authenticated
  using (
    not public.is_analista_tecnologia()
    or public.is_own_allocation(allocation_id)
  );

create policy "activities_insert_write" on public.activities
  for insert to authenticated
  with check (
    public.can_write_month(month_id)
    or (
      public.is_analista_tecnologia()
      and not public.is_month_locked(month_id)
      and public.is_own_allocation(allocation_id)
    )
  );

create policy "activities_update_write" on public.activities
  for update to authenticated
  using (
    public.can_write_month(month_id)
    or (
      public.is_analista_tecnologia()
      and not public.is_month_locked(month_id)
      and public.is_own_allocation(allocation_id)
    )
  )
  with check (
    public.can_write_month(month_id)
    or (
      public.is_analista_tecnologia()
      and not public.is_month_locked(month_id)
      and public.is_own_allocation(allocation_id)
    )
  );

create policy "activities_delete_write" on public.activities
  for delete to authenticated
  using (
    public.can_write_month(month_id)
    or (
      public.is_analista_tecnologia()
      and not public.is_month_locked(month_id)
      and public.is_own_allocation(allocation_id)
    )
  );

-- ---------------------------------------------------------------------------
-- people: el roster lleva las horas disponibles de cada quien. Un Analista
-- de Tecnología solo ve su propia fila — es lo que necesita la UI (resolver
-- "yo" en el mes activo) y nada más.
--
-- `projects` en cambio sigue siendo legible por todos: son los proyectos del
-- portafolio, no datos personales, y sin ellos no se puede ni pintar el
-- nombre del proyecto de una tarea propia.
-- ---------------------------------------------------------------------------
drop policy "people_select_authenticated" on public.people;

create policy "people_select_scoped" on public.people
  for select to authenticated
  using (
    not public.is_analista_tecnologia()
    or profile_id = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- comments: discusión sobre celdas de la grilla. Mismo criterio — solo las
-- de las celdas propias. (Hoy el Analista de Tecnología no tiene UI de
-- comentarios; la política cierra el acceso por API de todos modos.)
-- ---------------------------------------------------------------------------
drop policy "comments_select_authenticated" on public.comments;

create policy "comments_select_scoped" on public.comments
  for select to authenticated
  using (
    not public.is_analista_tecnologia()
    or public.is_own_allocation(allocation_id)
  );

-- ---------------------------------------------------------------------------
-- create_month_from_previous: copia `people.profile_id` (para que el
-- analista conserve el acceso a su trabajo en el mes nuevo) y
-- `tasks.start_date` (para que el Gantt del mes duplicado no pierda el
-- rango). `create or replace` no admite parches parciales, así que se
-- reescribe la función completa.
-- ---------------------------------------------------------------------------
create or replace function public.create_month_from_previous(
  p_source_month_id uuid,
  p_new_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_month_id uuid;
  v_source public.months%rowtype;
begin
  if not public.is_gestor_or_admin() then
    raise exception 'No tiene permisos para crear un mes';
  end if;

  select * into v_source from public.months where id = p_source_month_id;
  if not found then
    raise exception 'El mes de origen no existe';
  end if;

  insert into public.months (name, status, default_hours, working_days, notes, source_month_id, created_by)
  values (p_new_name, 'abierto', v_source.default_hours, v_source.working_days, v_source.notes, p_source_month_id, auth.uid())
  returning id into v_new_month_id;

  create temporary table _people_map (old_id uuid primary key, new_id uuid not null) on commit drop;
  create temporary table _project_map (old_id uuid primary key, new_id uuid not null) on commit drop;

  insert into _people_map (old_id, new_id)
  select id, gen_random_uuid() from public.people where month_id = p_source_month_id;

  insert into public.people (id, month_id, name, job_title, available_hours, status, notes, profile_id, cloned_from_id, created_by)
  select m.new_id, v_new_month_id, p.name, p.job_title, p.available_hours, p.status, p.notes, p.profile_id, p.id, auth.uid()
  from public.people p
  join _people_map m on m.old_id = p.id
  where p.month_id = p_source_month_id;

  insert into _project_map (old_id, new_id)
  select id, gen_random_uuid() from public.projects where month_id = p_source_month_id;

  insert into public.projects (id, month_id, name, color, status, description, category, cloned_from_id, created_by)
  select m.new_id, v_new_month_id, pr.name, pr.color, pr.status, pr.description, pr.category, pr.id, auth.uid()
  from public.projects pr
  join _project_map m on m.old_id = pr.id
  where pr.month_id = p_source_month_id;

  insert into public.project_managers (month_id, project_id, person_id, is_primary)
  select v_new_month_id, prm.new_id, pem.new_id, pm.is_primary
  from public.project_managers pm
  join _project_map prm on prm.old_id = pm.project_id
  join _people_map pem on pem.old_id = pm.person_id
  where pm.month_id = p_source_month_id;

  insert into public.tasks (
    month_id, project_id, title, description, status, assigned_person_id, due_date,
    work_item_type, priority, board_order, tags, estimated_hours, start_date, created_by
  )
  select
    v_new_month_id, prm.new_id, t.title, t.description, t.status, pem.new_id, t.due_date,
    t.work_item_type, t.priority, t.board_order, t.tags, t.estimated_hours, t.start_date, auth.uid()
  from public.tasks t
  join _project_map prm on prm.old_id = t.project_id
  left join _people_map pem on pem.old_id = t.assigned_person_id
  where t.month_id = p_source_month_id;

  insert into public.allocations (month_id, person_id, project_id, hours, updated_by)
  select v_new_month_id, pem.new_id, prm.new_id, a.hours, auth.uid()
  from public.allocations a
  join _people_map pem on pem.old_id = a.person_id
  join _project_map prm on prm.old_id = a.project_id
  where a.month_id = p_source_month_id;

  return v_new_month_id;
end;
$$;

revoke all on function public.create_month_from_previous(uuid, text) from public;
grant execute on function public.create_month_from_previous(uuid, text) to authenticated;

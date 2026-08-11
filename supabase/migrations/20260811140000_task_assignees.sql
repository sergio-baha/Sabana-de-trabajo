-- Una tarea puede tener varias personas asignadas por igual (sin "principal"
-- ni "colaborador") — reemplaza tasks.assigned_person_id (una sola persona)
-- por una tabla puente, igual que project_members. Cronograma y horas no
-- dependen de assigned_person_id (las horas viven en allocations/activities,
-- ajenas a la asignación de tareas), así que este cambio no las toca.
-- `month_id` queda denormalizado (igual que en project_members/
-- project_managers) para poder filtrar "los asignados del mes activo" con
-- un solo `eq`, en vez de un join contra `tasks` en cada consulta.
create table public.task_assignees (
  id uuid primary key default gen_random_uuid(),
  month_id uuid not null references public.months (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (task_id, person_id)
);

create index task_assignees_month_idx on public.task_assignees (month_id);
create index task_assignees_task_idx on public.task_assignees (task_id);
create index task_assignees_person_idx on public.task_assignees (person_id);

insert into public.task_assignees (month_id, task_id, person_id)
select month_id, id, assigned_person_id from public.tasks where assigned_person_id is not null;

-- Las políticas viejas de tasks leen assigned_person_id en su USING/CHECK:
-- hay que soltarlas antes de poder tumbar la columna. Las nuevas (sin esa
-- columna) se crean más abajo, junto con is_project_team_member.
drop policy "tasks_select_scoped" on public.tasks;
drop policy "tasks_insert_write" on public.tasks;
drop policy "tasks_update_write" on public.tasks;
drop policy "tasks_delete_write" on public.tasks;

alter table public.tasks drop column assigned_person_id;

alter table public.task_assignees enable row level security;

revoke all on public.task_assignees from anon;
grant select, insert, update, delete on public.task_assignees to authenticated;

create policy "task_assignees_select_authenticated" on public.task_assignees
  for select to authenticated using (true);

-- Mismo criterio que ya decide si alguien puede escribir la tarea: gestor/
-- admin, o un analista miembro/gerente del proyecto con el mes abierto —
-- ver tasks_insert_write más abajo. Se repite la condición vía join a
-- `tasks` porque quien inserta un asignado no necesariamente trae consigo
-- el month_id/project_id; se leen de la tarea misma.
create policy "task_assignees_insert_write" on public.task_assignees
  for insert to authenticated
  with check (
    exists (
      select 1 from public.tasks t
      where t.id = task_assignees.task_id
        and (
          public.can_write_month(t.month_id)
          or (
            public.is_analista_role()
            and not public.is_month_locked(t.month_id)
            and public.is_project_team_member(t.project_id)
          )
        )
    )
  );

create policy "task_assignees_delete_write" on public.task_assignees
  for delete to authenticated
  using (
    exists (
      select 1 from public.tasks t
      where t.id = task_assignees.task_id
        and (
          public.can_write_month(t.month_id)
          or (
            public.is_analista_role()
            and not public.is_month_locked(t.month_id)
            and public.is_project_team_member(t.project_id)
          )
        )
    )
  );

-- Ampliación de is_project_team_member: además de miembro/gerente, cuenta
-- quien creó la fila mensual del proyecto. Sin esto, un analista que crea un
-- proyecto nuevo y olvida agregarse como miembro se queda sin poder crear
-- tareas en el proyecto que acaba de abrir — un candado que no protege nada,
-- solo estorba.
create or replace function public.is_project_team_member(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1 from public.projects pr
      where pr.id = p_project_id and pr.created_by = auth.uid()
    )
    or exists (
      select 1
      from public.people pe
      where pe.profile_id = auth.uid()
        and (
          exists (
            select 1 from public.project_members mem
            where mem.project_id = p_project_id and mem.person_id = pe.id
          )
          or exists (
            select 1 from public.project_managers mgr
            where mgr.project_id = p_project_id and mgr.person_id = pe.id
          )
        )
    );
$$;

-- ---------------------------------------------------------------------------
-- tasks: las políticas nuevas, ya sin assigned_person_id (las viejas se
-- soltaron arriba, antes del drop column). La lectura/escritura de una
-- tarea ya no depende de a quién esté asignada (eso vive en task_assignees)
-- sino de si quien consulta es del proyecto — lo mismo que ya dejó
-- *_tasks_visible_to_project_team.sql. Sin asignados no hay "es mía" que
-- revisar: el criterio queda en dos vías, no tres.
-- ---------------------------------------------------------------------------
create policy "tasks_select_scoped" on public.tasks
  for select to authenticated
  using (
    not public.is_analista_role()
    or public.is_project_team_member(project_id)
  );

create policy "tasks_insert_write" on public.tasks
  for insert to authenticated
  with check (
    public.can_write_month(month_id)
    or (
      public.is_analista_role()
      and not public.is_month_locked(month_id)
      and public.is_project_team_member(project_id)
    )
  );

create policy "tasks_update_write" on public.tasks
  for update to authenticated
  using (
    public.can_write_month(month_id)
    or (
      public.is_analista_role()
      and not public.is_month_locked(month_id)
      and public.is_project_team_member(project_id)
    )
  )
  with check (
    public.can_write_month(month_id)
    or (
      public.is_analista_role()
      and not public.is_month_locked(month_id)
      and public.is_project_team_member(project_id)
    )
  );

create policy "tasks_delete_write" on public.tasks
  for delete to authenticated
  using (
    public.can_write_month(month_id)
    or (
      public.is_analista_role()
      and not public.is_month_locked(month_id)
      and public.is_project_team_member(project_id)
    )
  );

-- ---------------------------------------------------------------------------
-- create_month_from_previous: se reescribe completa (no admite parches
-- parciales) para arrastrar tres cosas que hasta ahora se perdían al
-- duplicar un mes:
--   1. project_members — el equipo del proyecto es por mes; sin copiarlo,
--      cada mes nuevo arrancaba sin nadie y había que rearmarlo a mano.
--   2. task_assignees — reemplaza el viejo assigned_person_id remapeado.
--   3. tasks.parent_task_id — la jerarquía épica/historia/tarea se perdía en
--      cada clonado (omisión de antes, no algo que este cambio introduzca);
--      se resuelve con un UPDATE posterior al insert porque el hijo puede
--      insertarse antes que su padre en el recorrido.
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
  create temporary table _task_map (old_id uuid primary key, new_id uuid not null) on commit drop;

  insert into _people_map (old_id, new_id)
  select id, gen_random_uuid() from public.people where month_id = p_source_month_id;

  insert into public.people (id, month_id, name, job_title, available_hours, status, notes, profile_id, cloned_from_id, created_by)
  select m.new_id, v_new_month_id, p.name, p.job_title, p.available_hours, p.status, p.notes, p.profile_id, p.id, auth.uid()
  from public.people p
  join _people_map m on m.old_id = p.id
  where p.month_id = p_source_month_id;

  insert into public.person_rates (person_id, month_id, hourly_rate, updated_by)
  select pem.new_id, v_new_month_id, r.hourly_rate, auth.uid()
  from public.person_rates r
  join _people_map pem on pem.old_id = r.person_id
  where r.month_id = p_source_month_id;

  insert into _project_map (old_id, new_id)
  select id, gen_random_uuid() from public.projects where month_id = p_source_month_id;

  insert into public.projects (
    id, month_id, name, color, status, description, category,
    portfolio_project_id, cloned_from_id, created_by
  )
  select
    m.new_id, v_new_month_id, pr.name, pr.color, pr.status, pr.description, pr.category,
    pr.portfolio_project_id, pr.id, auth.uid()
  from public.projects pr
  join _project_map m on m.old_id = pr.id
  where pr.month_id = p_source_month_id;

  insert into public.project_managers (month_id, project_id, person_id, is_primary)
  select v_new_month_id, prm.new_id, pem.new_id, pm.is_primary
  from public.project_managers pm
  join _project_map prm on prm.old_id = pm.project_id
  join _people_map pem on pem.old_id = pm.person_id
  where pm.month_id = p_source_month_id;

  insert into public.project_members (month_id, project_id, person_id, created_by)
  select v_new_month_id, prm.new_id, pem.new_id, auth.uid()
  from public.project_members mm
  join _project_map prm on prm.old_id = mm.project_id
  join _people_map pem on pem.old_id = mm.person_id
  where mm.month_id = p_source_month_id;

  insert into _task_map (old_id, new_id)
  select id, gen_random_uuid() from public.tasks where month_id = p_source_month_id;

  insert into public.tasks (
    id, month_id, project_id, title, description, status, due_date,
    work_item_type, priority, board_order, tags, estimated_hours, start_date, phase_id, created_by
  )
  select
    tm.new_id, v_new_month_id, prm.new_id, t.title, t.description, t.status, t.due_date,
    t.work_item_type, t.priority, t.board_order, t.tags, t.estimated_hours, t.start_date,
    t.phase_id, auth.uid()
  from public.tasks t
  join _task_map tm on tm.old_id = t.id
  join _project_map prm on prm.old_id = t.project_id
  where t.month_id = p_source_month_id;

  -- El padre puede haberse insertado con cualquier id nuevo, sin importar el
  -- orden del recorrido: se resuelve todo junto después del insert.
  update public.tasks child
  set parent_task_id = pmap.new_id
  from _task_map cmap
  join public.tasks src on src.id = cmap.old_id
  join _task_map pmap on pmap.old_id = src.parent_task_id
  where child.id = cmap.new_id and src.parent_task_id is not null;

  insert into public.task_assignees (month_id, task_id, person_id)
  select v_new_month_id, tm.new_id, pem.new_id
  from public.task_assignees ta
  join _task_map tm on tm.old_id = ta.task_id
  join _people_map pem on pem.old_id = ta.person_id;

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

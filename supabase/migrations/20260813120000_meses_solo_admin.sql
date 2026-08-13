-- Administrar meses pasa a ser tarea exclusiva del Administrador.
--
-- Antes: crear, duplicar, editar y abrir/cerrar un mes era de Gestor+Admin, y
-- el módulo era visible además para el Analista (que solo podía mirar, porque
-- ninguna política se lo permitía — veía botones que siempre fallaban).
--
-- Ahora hay una sola regla: el ciclo de vida del mes lo maneja el
-- Administrador. Lo que NO cambia:
--   · `months_select_authenticated` sigue igual — todos necesitan leer los
--     meses para el selector del encabezado y para saber en qué mes trabajan.
--   · `can_write_month()` sigue igual: un Gestor sigue editando horas,
--     personas, proyectos y tareas DENTRO de un mes abierto. Lo que ya no
--     puede es crear el mes, cerrarlo ni duplicarlo.
--   · El guardado de estado (`guard_month_status_transition`) se endurece:
--     cualquier cambio de estado, no solo archivar, exige Administrador.

-- ── Políticas de escritura de months ────────────────────────────────────
drop policy if exists "months_insert_gestor_admin" on public.months;
drop policy if exists "months_update_gestor_admin" on public.months;

create policy "months_insert_admin" on public.months
  for insert to authenticated with check (public.is_admin());

create policy "months_update_admin" on public.months
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- `months_delete_admin` ya era solo Admin: se deja como está.

-- ── Transiciones de estado ──────────────────────────────────────────────
-- El trigger es la segunda barrera (la política de update ya exige Admin),
-- pero se mantiene explícito porque es el que da el mensaje de error legible.
create or replace function public.guard_month_status_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status and not public.is_admin() then
    raise exception 'Solo un administrador puede cambiar el estado de un mes';
  end if;
  return new;
end;
$$;

-- ── Duplicar mes ────────────────────────────────────────────────────────
-- La función es SECURITY DEFINER: su guardia interna ES la barrera, porque
-- corriendo como definer se salta las políticas de arriba. Por eso hay que
-- reescribirla completa (create or replace no admite parches parciales); el
-- cuerpo es idéntico al de *_clone_month_portfolio.sql salvo la guardia.
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
  if not public.is_admin() then
    raise exception 'Solo un administrador puede crear un mes';
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

  -- Tarifas del roster nuevo, heredadas de la persona equivalente del mes
  -- anterior. Un aumento se registra editando el mes nuevo; los meses ya
  -- cerrados conservan la suya.
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

  insert into public.tasks (
    month_id, project_id, title, description, status, assigned_person_id, due_date,
    work_item_type, priority, board_order, tags, estimated_hours, start_date, phase_id, created_by
  )
  select
    v_new_month_id, prm.new_id, t.title, t.description, t.status, pem.new_id, t.due_date,
    t.work_item_type, t.priority, t.board_order, t.tags, t.estimated_hours, t.start_date,
    t.phase_id, auth.uid()
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

-- ── Versiones (snapshots) de un mes ─────────────────────────────────────
-- Se llegan a ellas únicamente desde el módulo Meses, que ahora es de
-- Administrador; restaurar ya lo era. Crear y consultar lo acompañan para
-- que no quede una puerta lateral abierta.
create or replace function public.create_month_snapshot(p_month_id uuid, p_label text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_snapshot_id uuid;
  v_snapshot jsonb;
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede crear una versión de un mes';
  end if;

  select jsonb_build_object(
    'people', (select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb) from public.people p where p.month_id = p_month_id),
    'projects', (select coalesce(jsonb_agg(to_jsonb(pr)), '[]'::jsonb) from public.projects pr where pr.month_id = p_month_id),
    'project_managers', (select coalesce(jsonb_agg(to_jsonb(pm)), '[]'::jsonb) from public.project_managers pm where pm.month_id = p_month_id),
    'allocations', (select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) from public.allocations a where a.month_id = p_month_id)
  ) into v_snapshot;

  insert into public.month_snapshots (month_id, label, snapshot, created_by)
  values (p_month_id, p_label, v_snapshot, auth.uid())
  returning id into v_snapshot_id;

  return v_snapshot_id;
end;
$$;

drop policy if exists "month_snapshots_select_gestor_admin" on public.month_snapshots;

create policy "month_snapshots_select_admin" on public.month_snapshots
  for select to authenticated using (public.is_admin());

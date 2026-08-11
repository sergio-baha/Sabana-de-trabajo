-- create_month_from_previous: al duplicar un mes ahora hay que arrastrar dos
-- cosas nuevas.
--
-- 1. `projects.portfolio_project_id` — sin esto, el proyecto del mes nuevo
--    abriría un portafolio propio (vía el trigger project_ensure_portfolio)
--    y sus horas dejarían de sumar contra el presupuesto del proyecto real.
--    Se pasa explícito en vez de confiar en que el trigger lo deduzca de
--    `cloned_from_id`: el resultado es el mismo, pero acá el vínculo queda a
--    la vista de quien lea la función.
--
-- 2. `person_rates` — la tarifa es por persona-mes, y el roster del mes
--    nuevo son personas nuevas (ids nuevos). Si no se copia, el costo del
--    mes duplicado arranca en cero y parece que el proyecto no gasta.
--    Copiarlas acá es además la única vía para un Gestor, que no puede leer
--    ni escribir person_rates directamente — la función es SECURITY DEFINER
--    y lo hace por él sin exponerle los valores.
--
-- 3. `tasks.phase_id` — las fases cuelgan del portafolio, no del mes, así
--    que el id sigue siendo válido en el mes nuevo y no hay que remapearlo.
--
-- `create or replace` no admite parches parciales: se reescribe completa.
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

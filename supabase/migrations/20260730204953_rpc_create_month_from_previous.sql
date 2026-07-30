-- create_month_from_previous: "Duplicar mes" (módulo Gestión de meses).
-- Corre como una sola función SECURITY DEFINER en vez de varios inserts desde
-- el cliente porque hay que remapear IDs entre 4+ tablas (people/projects
-- referenciados por project_managers/allocations) de forma atómica — si el
-- cliente hiciera esto en varios round-trips y la conexión se cortara a
-- mitad de camino, quedaría un mes a medio copiar.
--
-- Copia personas, proyectos, gerentes y tareas del mes origen. NO copia
-- comments ni audit_logs (son discusión/historial atados a asignaciones del
-- mes anterior, ya superadas por las nuevas filas).
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

  insert into public.people (id, month_id, name, job_title, available_hours, status, notes, cloned_from_id, created_by)
  select m.new_id, v_new_month_id, p.name, p.job_title, p.available_hours, p.status, p.notes, p.id, auth.uid()
  from public.people p
  join _people_map m on m.old_id = p.id
  where p.month_id = p_source_month_id;

  insert into _project_map (old_id, new_id)
  select id, gen_random_uuid() from public.projects where month_id = p_source_month_id;

  insert into public.projects (id, month_id, name, color, status, description, cloned_from_id, created_by)
  select m.new_id, v_new_month_id, pr.name, pr.color, pr.status, pr.description, pr.id, auth.uid()
  from public.projects pr
  join _project_map m on m.old_id = pr.id
  where pr.month_id = p_source_month_id;

  insert into public.project_managers (month_id, project_id, person_id, is_primary)
  select v_new_month_id, prm.new_id, pem.new_id, pm.is_primary
  from public.project_managers pm
  join _project_map prm on prm.old_id = pm.project_id
  join _people_map pem on pem.old_id = pm.person_id
  where pm.month_id = p_source_month_id;

  insert into public.tasks (month_id, project_id, title, description, status, assigned_person_id, due_date, created_by)
  select v_new_month_id, prm.new_id, t.title, t.description, t.status, pem.new_id, t.due_date, auth.uid()
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

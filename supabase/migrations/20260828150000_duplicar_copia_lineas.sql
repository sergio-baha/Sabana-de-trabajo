-- Duplicar un mes copiaba `allocations` sin su `line_id` (la columna no
-- existía todavía cuando se escribió por última vez, ver
-- *_duplicar_respeta_default_hours.sql). Sin este ajuste, duplicar un mes con
-- proyectos divididos en líneas fusionaría todas las líneas de un proyecto
-- en una sola fila del mes nuevo — y si ya existía la fila base (línea nula)
-- para ese proyecto/persona, el insert habría chocado contra la restricción
-- única nueva.
--
-- Las líneas en sí NO se duplican: son del proyecto (durable, compartido
-- entre meses), no del mes — el mismo `project_lines.id` sigue existiendo y
-- solo hace falta que la copia de `allocations` lo referencie tal cual.
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

  insert into _people_map (old_id, new_id)
  select id, gen_random_uuid() from public.people where month_id = p_source_month_id;

  insert into public.people (id, month_id, name, job_title, available_hours, status, notes, profile_id, cloned_from_id, created_by)
  select m.new_id, v_new_month_id, p.name, p.job_title, v_source.default_hours, p.status, p.notes, p.profile_id, p.id, auth.uid()
  from public.people p
  join _people_map m on m.old_id = p.id
  where p.month_id = p_source_month_id;

  insert into public.person_rates (person_id, month_id, hourly_rate, updated_by)
  select pem.new_id, v_new_month_id, r.hourly_rate, auth.uid()
  from public.person_rates r
  join _people_map pem on pem.old_id = r.person_id
  where r.month_id = p_source_month_id;

  -- El reparto se copia tal cual, línea incluida: mismos proyectos (ya
  -- durables), mismas líneas (también durables), personas nuevas del roster
  -- del mes. El trigger `allocation_implies_membership` rearma de paso el
  -- equipo de cada proyecto con el roster nuevo.
  insert into public.allocations (month_id, person_id, project_id, line_id, hours, updated_by)
  select v_new_month_id, pem.new_id, a.project_id, a.line_id, a.hours, auth.uid()
  from public.allocations a
  join _people_map pem on pem.old_id = a.person_id
  where a.month_id = p_source_month_id;

  return v_new_month_id;
end;
$$;

revoke all on function public.create_month_from_previous(uuid, text) from public;
grant execute on function public.create_month_from_previous(uuid, text) to authenticated;

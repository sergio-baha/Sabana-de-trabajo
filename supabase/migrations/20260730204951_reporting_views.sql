-- Vistas de reporte usadas por Dashboard/Reportes/la grilla. security_invoker
-- hace que cada vista respete el RLS del usuario que consulta (no el del
-- dueño de la vista), así que no necesitan políticas propias.

create view public.v_person_month_totals
with (security_invoker = true) as
select
  p.month_id,
  p.id as person_id,
  p.name,
  p.job_title,
  p.status,
  p.available_hours,
  coalesce(sum(a.hours), 0) as allocated_hours,
  p.available_hours - coalesce(sum(a.hours), 0) as difference_hours,
  case
    when coalesce(sum(a.hours), 0) > p.available_hours then 'rojo'
    when coalesce(sum(a.hours), 0) < p.available_hours then 'amarillo'
    else 'verde'
  end as status_color
from public.people p
left join public.allocations a on a.person_id = p.id
group by p.month_id, p.id, p.name, p.job_title, p.status, p.available_hours;

create view public.v_project_month_totals
with (security_invoker = true) as
select
  pr.month_id,
  pr.id as project_id,
  pr.name,
  pr.color,
  pr.status,
  coalesce(sum(a.hours), 0) as allocated_hours,
  count(distinct a.person_id) as people_count
from public.projects pr
left join public.allocations a on a.project_id = pr.id
group by pr.month_id, pr.id, pr.name, pr.color, pr.status;

create view public.v_manager_month_totals
with (security_invoker = true) as
select
  pm.month_id,
  pm.person_id as manager_id,
  mgr.name as manager_name,
  coalesce(sum(a.hours), 0) as allocated_hours,
  count(distinct pm.project_id) as projects_count
from public.project_managers pm
join public.people mgr on mgr.id = pm.person_id
left join public.allocations a on a.project_id = pm.project_id
group by pm.month_id, pm.person_id, mgr.name;

grant select on public.v_person_month_totals to authenticated;
grant select on public.v_project_month_totals to authenticated;
grant select on public.v_manager_month_totals to authenticated;

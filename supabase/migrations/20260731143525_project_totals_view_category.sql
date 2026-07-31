-- Agrega projects.category a la vista de reporte, para poder filtrar/
-- agrupar en Reportes los proyectos institucionales ("Emergentes -...")
-- aparte de los proyectos reales sin otro cambio (ver *_projects_category.sql).
create or replace view public.v_project_month_totals
with (security_invoker = true) as
select
  pr.month_id,
  pr.id as project_id,
  pr.name,
  pr.color,
  pr.status,
  coalesce(sum(a.hours), 0) as allocated_hours,
  count(distinct a.person_id) as people_count,
  pr.category
from public.projects pr
left join public.allocations a on a.project_id = pr.id
group by pr.month_id, pr.id, pr.name, pr.color, pr.status, pr.category;

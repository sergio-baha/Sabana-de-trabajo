-- Repone `category` en v_project_month_totals.
--
-- La vista original no la traía; se agregó después en
-- *_project_totals_view_category.sql para que el Dashboard pudiera separar
-- los proyectos reales del "tiempo institucional". Al reconstruir la vista
-- sobre el modelo unificado se perdió esa columna, y con ella el filtro.
-- Se recrea en vez de `create or replace`: reemplazar una vista solo admite
-- añadir columnas AL FINAL, y `category` va en medio del listado.
drop view public.v_project_month_totals;

create view public.v_project_month_totals
with (security_invoker = true) as
select
  a.month_id,
  pr.id as project_id,
  pr.name,
  pr.color,
  pr.status,
  pr.category,
  coalesce(sum(a.hours), 0) as allocated_hours,
  count(distinct a.person_id) as people_count
from public.projects pr
join public.allocations a on a.project_id = pr.id
group by a.month_id, pr.id, pr.name, pr.color, pr.status, pr.category;

-- Recrear la vista descarta sus permisos, así que hay que volver a darlos.
grant select on public.v_project_month_totals to authenticated;

-- Solo lectura — todo lo que tiene Edicson en Uppie HSE (Fase II).
select
  pl.name as subproyecto,
  a.description,
  a.activity_date,
  a.hours,
  al.id as allocation_id,
  a.id as activity_id,
  a.task_id
from public.activities a
join public.allocations al on al.id = a.allocation_id
join public.project_lines pl on pl.id = al.line_id
join public.people pe on pe.id = al.person_id
join public.projects p on p.id = al.project_id
where al.month_id = (select id from public.months where name = 'Septiembre 1 - 30')
  and lower(btrim(p.name)) = lower('Uppie HSE (Fase II)')
  and pe.name ilike 'Edicson%'
order by pl.name, a.description;

-- Solo lectura. Todo lo que alimenta el panel "Planeado vs Real" de Sergio:
-- sus tareas con horas reales reportadas, y cada reporte individual.
select
  t.id as task_id,
  t.title,
  t.status,
  t.estimated_hours,
  t.completed_hours,
  t.returned_count,
  r.id as report_id,
  r.round,
  r.hours as horas_reportadas,
  r.note,
  r.created_at as reportado_en
from public.tasks t
join public.task_assignees ta on ta.task_id = t.id
join public.people pe on pe.id = ta.person_id
left join public.task_time_reports r on r.task_id = t.id
where pe.name ilike 'Sergio%'
  and t.completed_hours is not null
order by t.created_at desc, r.round;

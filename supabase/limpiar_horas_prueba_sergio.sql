-- Limpia el rastro de las pruebas del circuito de revisión hechas en esta
-- sesión sobre las tareas de Sergio: borra los reportes de horas reales,
-- deja completed_hours en null otra vez, y devuelve a "pendiente" las que
-- quedaron en 'en_revision'/'completada' solo por las pruebas — como si
-- nunca se hubieran entregado.
--
-- OJO: esto corre desde el SQL Editor, sin sesión de usuario (auth.uid() es
-- null ahí), así que el trigger del circuito de revisión no dispara su
-- lógica normal (esa es justo la razón por la que este script limpia a mano
-- current_reviewer_person_id/submitted_at/reviewed_at/returned_count en vez
-- de dejar que el trigger lo haga: en este contexto no lo haría).
--
-- Se ejecuta UNA VEZ, a mano, por el SQL Editor.

begin;

do $$
declare
  v_task_ids uuid[];
  v_deleted_reports integer;
  v_reset_status integer;
  v_deleted_hops integer;
begin
  select array_agg(distinct t.id) into v_task_ids
  from public.tasks t
  join public.task_assignees ta on ta.task_id = t.id
  join public.people pe on pe.id = ta.person_id
  where pe.name ilike 'Sergio%'
    and t.completed_hours is not null;

  if v_task_ids is null then
    raise notice 'No hay tareas de Sergio con horas reales reportadas — nada que limpiar.';
    return;
  end if;

  delete from public.task_time_reports where task_id = any(v_task_ids);
  get diagnostics v_deleted_reports = row_count;

  delete from public.task_review_hops where task_id = any(v_task_ids);
  get diagnostics v_deleted_hops = row_count;

  update public.tasks
  set
    completed_hours = null,
    status = case when status in ('en_revision', 'completada') then 'pendiente' else status end,
    current_reviewer_person_id = null,
    submitted_at = null,
    submitted_by = null,
    reviewed_at = null,
    reviewed_by = null,
    returned_count = 0
  where id = any(v_task_ids);
  get diagnostics v_reset_status = row_count;

  raise notice 'Tareas limpiadas: % — Reportes de horas borrados: % — Saltos de historial borrados: %',
    v_reset_status, v_deleted_reports, v_deleted_hops;
end $$;

-- -----------------------------------------------------------------------
-- Verificación antes de confirmar
-- -----------------------------------------------------------------------
select t.id, t.title, t.status, t.completed_hours, t.current_reviewer_person_id
from public.tasks t
join public.task_assignees ta on ta.task_id = t.id
join public.people pe on pe.id = ta.person_id
where pe.name ilike 'Sergio%'
order by t.updated_at desc
limit 20;

-- Revisa que las tareas de la lista de arriba queden con completed_hours en
-- null y, si estaban en revisión/completadas, en "pendiente". Si algo no
-- cuadra, ejecuta ROLLBACK en vez de COMMIT.
commit;   -- o rollback;

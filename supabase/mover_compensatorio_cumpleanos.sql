-- Mueve la actividad "Compensatorio cumpleaños" (Sebastián, 8h) de
-- "Emergentes - Desafío" a "Emergentes" (el emergente normal) — no es
-- trabajo del Desafío, es tiempo compensatorio. No se toca ninguna otra
-- actividad de Sebastián en Emergentes - Desafío (p. ej. "Ecosistema MP"
-- sigue donde está).
--
-- Se ejecuta UNA VEZ, a mano, por el SQL Editor.

begin;

do $$
declare
  v_month_id uuid;
  v_source_project_id uuid;
  v_target_project_id uuid;
  v_target_line_id uuid;
  v_target_phase_id uuid;
  v_person_id uuid;
  v_activity_id uuid;
  v_source_alloc_id uuid;
  v_target_alloc_id uuid;
begin
  select id into v_month_id from public.months where name = 'Septiembre 1 - 30';
  if v_month_id is null then
    raise exception 'No existe el mes "Septiembre 1 - 30".';
  end if;

  select id into v_source_project_id from public.projects
  where lower(btrim(name)) = lower('Emergentes - Desafío');
  select id into v_target_project_id from public.projects
  where lower(btrim(name)) = lower('Emergentes');

  if v_source_project_id is null or v_target_project_id is null then
    raise exception 'No encontré "Emergentes - Desafío" o "Emergentes".';
  end if;

  -- Subproyecto por defecto de "Emergentes": el que se llama igual al
  -- proyecto; si no, el de menor posición.
  select id into v_target_line_id from public.project_lines
  where project_id = v_target_project_id and lower(btrim(name)) = lower('Emergentes');
  if v_target_line_id is null then
    select id into v_target_line_id from public.project_lines
    where project_id = v_target_project_id order by position asc limit 1;
  end if;
  if v_target_line_id is null then
    raise exception 'No encontré ningún subproyecto para "Emergentes".';
  end if;

  select id into v_target_phase_id from public.project_phases
  where project_id = v_target_project_id and phase_key = 'producto';
  if v_target_phase_id is null then
    raise exception 'No encontré la fase "producto" en "Emergentes".';
  end if;

  select id into v_person_id from public.people
  where month_id = v_month_id and name ilike 'Sebastian%';
  if v_person_id is null then
    raise exception 'No encontré a Sebastián en el roster de septiembre.';
  end if;

  -- Se ubica la actividad por su contenido, sin asumir en qué subproyecto
  -- de "Emergentes - Desafío" quedó.
  select a.id, a.allocation_id into v_activity_id, v_source_alloc_id
  from public.activities a
  join public.allocations al on al.id = a.allocation_id
  where al.month_id = v_month_id
    and al.person_id = v_person_id
    and al.project_id = v_source_project_id
    and a.description = 'Compensatorio cumpleaños'
    and a.hours = 8
  limit 1;

  if v_activity_id is null then
    raise exception 'No encontré la actividad "Compensatorio cumpleaños" de Sebastián en Emergentes - Desafío — ¿ya se movió?';
  end if;

  select id into v_target_alloc_id from public.allocations
  where month_id = v_month_id and person_id = v_person_id
    and project_id = v_target_project_id and line_id = v_target_line_id;

  if v_target_alloc_id is null then
    insert into public.allocations (month_id, person_id, project_id, line_id, hours)
    values (v_month_id, v_person_id, v_target_project_id, v_target_line_id, 0)
    returning id into v_target_alloc_id;
  end if;

  -- Mueve la actividad y, con ella, la tarea que generó (proyecto y fase).
  update public.activities
  set allocation_id = v_target_alloc_id,
      phase_id = v_target_phase_id
  where id = v_activity_id;

  update public.tasks t
  set project_id = v_target_project_id,
      phase_id = v_target_phase_id
  from public.activities a
  where a.id = v_activity_id and t.id = a.task_id;

  -- El trigger sync_allocation_hours, en un UPDATE de allocation_id, solo
  -- recalcula el destino — el origen se recalcula a mano.
  update public.allocations
  set hours = coalesce((select sum(a.hours) from public.activities a where a.allocation_id = v_source_alloc_id), 0)
  where id = v_source_alloc_id;

  raise notice 'Actividad movida de "Emergentes - Desafío" a "Emergentes".';
end $$;

-- -----------------------------------------------------------------------
-- Verificación antes de confirmar
-- -----------------------------------------------------------------------
select p.name as proyecto, pe.name as persona, a.description, a.hours
from public.activities a
join public.allocations al on al.id = a.allocation_id
join public.projects p on p.id = al.project_id
join public.people pe on pe.id = al.person_id
where a.description = 'Compensatorio cumpleaños';

-- Esperado: una sola fila, proyecto "Emergentes", persona Sebastián, 8h.
-- Si algo no cuadra, ejecuta ROLLBACK en vez de COMMIT.
commit;   -- o rollback;

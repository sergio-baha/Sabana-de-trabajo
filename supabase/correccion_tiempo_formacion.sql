-- =============================================================================
-- CORRECCIÓN — falta la fila "Emergentes - Tiempo disponible para formación"
-- =============================================================================
-- No estaba en Cargue_septiembre.md (el documento original de esta carga) ni
-- en la carga que se hizo. Confirmado contra la sábana completa: 15h para
-- cada una de las 7 personas del equipo, sin fecha, dentro del proyecto
-- "Emergentes" (fila base, mismo subproyecto que las demás filas de
-- Emergentes sin línea explícita).
--
-- Solo agrega — no borra ni mueve nada existente. Si alguna de estas 7 ya
-- existiera con esta descripción/horas exactas (no debería, se confirmó que
-- faltaba por completo), no la duplica.
--
-- Se ejecuta UNA VEZ, a mano, por el SQL Editor.

begin;

do $$
declare
  v_month_id uuid;
  v_project_id uuid;
  v_line_id uuid;
  v_phase_id uuid;
  v_person_id uuid;
  v_allocation_id uuid;
  v_existing_activity_id uuid;
  v_person_prefix text;
  v_inserted integer := 0;
  v_skipped integer := 0;
begin
  select id into v_month_id from public.months where name = 'Septiembre 1 - 30';
  if v_month_id is null then
    raise exception 'No existe un mes llamado "Septiembre 1 - 30".';
  end if;

  select id into v_project_id from public.projects
  where lower(btrim(name)) = lower('Emergentes');
  if v_project_id is null then
    raise exception 'No existe el proyecto "Emergentes".';
  end if;

  -- Línea base: la del mismo nombre del proyecto; si no, la de menor posición.
  select id into v_line_id from public.project_lines
  where project_id = v_project_id and lower(btrim(name)) = lower('Emergentes');
  if v_line_id is null then
    select id into v_line_id from public.project_lines
    where project_id = v_project_id order by position asc limit 1;
  end if;
  if v_line_id is null then
    raise exception 'No encontré ningún subproyecto para "Emergentes".';
  end if;

  select id into v_phase_id from public.project_phases
  where project_id = v_project_id and phase_key = 'producto';
  if v_phase_id is null then
    raise exception 'No encontré la fase "producto" en "Emergentes".';
  end if;

  foreach v_person_prefix in array array['Edicson', 'Fernando', 'Andrea Albornoz', 'Sebas', 'Maria', 'Sergio', 'Natalia']
  loop
    select id into v_person_id from public.people
    where month_id = v_month_id and name ilike v_person_prefix || '%';
    if v_person_id is null then
      raise exception 'No encontré a nadie que empiece por "%" en el roster de septiembre.', v_person_prefix;
    end if;

    select a.id into v_existing_activity_id
    from public.activities a
    join public.allocations al on al.id = a.allocation_id
    where al.month_id = v_month_id
      and al.person_id = v_person_id
      and al.project_id = v_project_id
      and al.line_id = v_line_id
      and a.description = 'Tiempo disponible para formación'
      and a.hours = 15
    limit 1;

    if v_existing_activity_id is not null then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    select id into v_allocation_id from public.allocations
    where month_id = v_month_id and person_id = v_person_id
      and project_id = v_project_id and line_id = v_line_id;

    if v_allocation_id is null then
      insert into public.allocations (month_id, person_id, project_id, line_id, hours)
      values (v_month_id, v_person_id, v_project_id, v_line_id, 0)
      returning id into v_allocation_id;
    end if;

    insert into public.activities (allocation_id, month_id, description, phase_id, activity_date, hours)
    values (v_allocation_id, v_month_id, 'Tiempo disponible para formación', v_phase_id, null, 15);

    v_inserted := v_inserted + 1;
  end loop;

  raise notice 'Insertadas: % — Ya existían (no duplicadas): %', v_inserted, v_skipped;
end $$;

-- -----------------------------------------------------------------------
-- Verificación antes de confirmar
-- -----------------------------------------------------------------------
select
  pe.name as persona,
  a.hours
from public.activities a
join public.allocations al on al.id = a.allocation_id
join public.people pe on pe.id = al.person_id
where al.month_id = (select id from public.months where name = 'Septiembre 1 - 30')
  and a.description = 'Tiempo disponible para formación'
order by pe.name;

-- Esperado: 7 filas, una por persona, todas en 15h.
-- Si algo no cuadra, ejecuta ROLLBACK en vez de COMMIT.
commit;   -- o rollback;

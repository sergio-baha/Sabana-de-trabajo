-- =============================================================================
-- CORRECCIÓN (v2, por IDs exactos) — Uppie HSE (Fase II) → subproyecto "Colegios"
-- =============================================================================
-- Diagnóstico confirmado con diagnostico_uppie.sql:
--   · 5 actividades de "base" (Fernando ×2, Natalia ×3) quedaron mezcladas
--     dentro del subproyecto "Formación" — se mueven a "Colegios" por su
--     activity_id exacto.
--   · Las 3 actividades de "base" de Edicson nunca se llegaron a crear — se
--     insertan directo en "Colegios".
-- No se borra ni se toca ninguna tarjeta ya existente del Analista de
-- Tecnología: las 5 que se mueven conservan su task_id (moverlas de línea no
-- cambia proyecto ni descripción, así que la tarjeta ligada sigue igual);
-- las 3 nuevas de Edicson crean tarjeta nueva, como cualquier actividad
-- nueva de la sábana.
--
-- Se ejecuta UNA VEZ, a mano, por el SQL Editor.

begin;

do $$
declare
  v_month_id uuid;
  v_project_id uuid;
  v_colegios_line_id uuid;
  v_fernando_id uuid;
  v_natalia_id uuid;
  v_edicson_id uuid;
  v_alloc_fernando uuid;
  v_alloc_natalia uuid;
  v_alloc_edicson uuid;
  v_phase_descubrir uuid;
  v_phase_definir uuid;
  v_formacion_fernando_alloc uuid;
  v_formacion_natalia_alloc uuid;
begin
  select id into v_month_id from public.months where name = 'Septiembre 1 - 30';
  select id into v_project_id from public.projects
  where lower(btrim(name)) = lower('Uppie HSE (Fase II)');

  select id into v_colegios_line_id from public.project_lines
  where project_id = v_project_id and lower(btrim(name)) = lower('Colegios');
  if v_colegios_line_id is null then
    insert into public.project_lines (project_id, name, position)
    values (v_project_id, 'Colegios', 0)
    returning id into v_colegios_line_id;
  end if;

  select id into v_phase_descubrir from public.project_phases
  where project_id = v_project_id and phase_key = 'descubrir';
  select id into v_phase_definir from public.project_phases
  where project_id = v_project_id and phase_key = 'definir';

  select id into v_fernando_id from public.people where month_id = v_month_id and name ilike 'Fernando%';
  select id into v_natalia_id from public.people where month_id = v_month_id and name ilike 'Natalia%';
  select id into v_edicson_id from public.people where month_id = v_month_id and name ilike 'Edicson%';

  -- Allocation destino (Colegios) por persona: reutiliza o crea.
  select id into v_alloc_fernando from public.allocations
  where month_id = v_month_id and person_id = v_fernando_id and project_id = v_project_id and line_id = v_colegios_line_id;
  if v_alloc_fernando is null then
    insert into public.allocations (month_id, person_id, project_id, line_id, hours)
    values (v_month_id, v_fernando_id, v_project_id, v_colegios_line_id, 0)
    returning id into v_alloc_fernando;
  end if;

  select id into v_alloc_natalia from public.allocations
  where month_id = v_month_id and person_id = v_natalia_id and project_id = v_project_id and line_id = v_colegios_line_id;
  if v_alloc_natalia is null then
    insert into public.allocations (month_id, person_id, project_id, line_id, hours)
    values (v_month_id, v_natalia_id, v_project_id, v_colegios_line_id, 0)
    returning id into v_alloc_natalia;
  end if;

  select id into v_alloc_edicson from public.allocations
  where month_id = v_month_id and person_id = v_edicson_id and project_id = v_project_id and line_id = v_colegios_line_id;
  if v_alloc_edicson is null then
    insert into public.allocations (month_id, person_id, project_id, line_id, hours)
    values (v_month_id, v_edicson_id, v_project_id, v_colegios_line_id, 0)
    returning id into v_alloc_edicson;
  end if;

  -- Allocations de origen (Formación) para Fernando/Natalia, para recalcular
  -- sus horas a mano después de sacarles actividades.
  select allocation_id into v_formacion_fernando_alloc
  from public.activities where id = 'fad23f1b-d16e-4016-a6b0-abd86bc87b92';
  select allocation_id into v_formacion_natalia_alloc
  from public.activities where id = '8d2f2b00-5a16-458c-bd3f-fb0b72e1c89d';

  -- 1) Mover las 2 de Fernando (id validado contra diagnostico_uppie.sql)
  update public.activities set allocation_id = v_alloc_fernando
  where id in ('fad23f1b-d16e-4016-a6b0-abd86bc87b92', '91758924-4ed8-437d-82c8-aa25c74913af');

  -- 2) Mover las 3 de Natalia
  update public.activities set allocation_id = v_alloc_natalia
  where id in ('8d2f2b00-5a16-458c-bd3f-fb0b72e1c89d', 'e0203295-b376-45e9-ae65-b4aee635176c', '2c2667b5-f667-4f87-8477-9e99a6e11140');

  -- 3) Recalcular a mano las horas de origen (Formación de Fernando y de
  --    Natalia): el trigger sync_allocation_hours en un UPDATE de
  --    allocation_id solo recalcula el destino, no el origen.
  update public.allocations
  set hours = coalesce((select sum(a.hours) from public.activities a where a.allocation_id = v_formacion_fernando_alloc), 0)
  where id = v_formacion_fernando_alloc;

  update public.allocations
  set hours = coalesce((select sum(a.hours) from public.activities a where a.allocation_id = v_formacion_natalia_alloc), 0)
  where id = v_formacion_natalia_alloc;

  -- 4) Insertar las 3 de Edicson que nunca se crearon (si Edicson ya movió
  --    o comentó alguna tarjeta con este mismo título, esto crearía una
  --    tarjeta nueva y separada — no debería pasar porque confirmamos que
  --    no existen en absoluto en la base).
  insert into public.activities (allocation_id, month_id, description, phase_id, activity_date, hours)
  values
    (v_alloc_edicson, v_month_id, 'Validación digitalización AP4 Estudiantes', v_phase_descubrir, null, 2),
    (v_alloc_edicson, v_month_id, 'Validación digitalización AP2 Docentes', v_phase_definir, null, 2),
    (v_alloc_edicson, v_month_id, 'Digitalización AP2 Docentes', v_phase_definir, null, 8);

  raise notice 'Corrección aplicada.';
end $$;

-- -----------------------------------------------------------------------
-- Verificación antes de confirmar
-- -----------------------------------------------------------------------
select
  pl.name as subproyecto,
  pe.name as persona,
  count(a.id) as actividades,
  sum(a.hours) as horas
from public.activities a
join public.allocations al on al.id = a.allocation_id
join public.project_lines pl on pl.id = al.line_id
join public.people pe on pe.id = al.person_id
join public.projects p on p.id = al.project_id
where al.month_id = (select id from public.months where name = 'Septiembre 1 - 30')
  and lower(btrim(p.name)) = lower('Uppie HSE (Fase II)')
group by pl.name, pe.name
order by pl.name, pe.name;

-- Esperado en "Colegios": Edicson 3 actividades/12h, Fernando 2/25h,
-- Natalia 3/49h (total 8 actividades/86h, cuadra con las 8 filas base
-- originales). En "Formación": Fernando baja a 4 actividades/20h, Natalia
-- baja a 4 actividades/20h (quedan solo sus actividades reales de
-- Formación). Empresarial sin cambios.
-- Si algo no cuadra, ejecuta ROLLBACK en vez de COMMIT.
commit;   -- o rollback;

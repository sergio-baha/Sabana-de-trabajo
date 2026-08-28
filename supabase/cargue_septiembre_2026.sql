-- =============================================================================
-- CARGA MANUAL — Septiembre 2026, tomada de Cargue_septiembre.md
-- =============================================================================
-- NO ES UNA MIGRACIÓN: es carga de datos operativa de un mes concreto, no un
-- cambio de esquema. Por eso vive fuera de supabase/migrations/ — `supabase
-- db push` no la toca, y correrla no forma parte del historial de esquema.
-- Se ejecuta UNA VEZ, a mano, por el SQL Editor.
--
-- QUÉ HACE, EN ORDEN:
--   1. Ubica el mes de Septiembre por nombre.
--   2. Vuelca las 104 filas de la hoja en una tabla temporal (_cargue).
--   3. Crea los proyectos que falten (por nombre, sin distinguir mayúsculas).
--      La mayoría YA EXISTEN en producción — el script los reutiliza; solo
--      crea "GenIA Impulsa", que es el único de la hoja que no aparecía.
--   4. Crea las líneas que falten SOLO para Uppie HSE (Fase II) →
--      Formación/Empresarial: es el MISMO proyecto en tres filas de la
--      sábana, decisión tomada explícitamente con el usuario. "Desafío" NO
--      es una línea — ya existe como proyecto propio ("Emergentes -
--      Desafío") en producción, así que sus 8 filas van directo ahí.
--   5. Crea las fases que falten por proyecto (Descubrir/Definir/
--      Desarrollar/Producto), del catálogo canónico de 5 fases.
--   6. Resuelve cada nombre de pila contra el roster de Septiembre —
--      SI UN NOMBRE NO APARECE O ES AMBIGUO, EL SCRIPT SE DETIENE AHÍ MISMO
--      con un error que dice cuál nombre falló. No sigue adivinando.
--      ("Mafe" = María Fernanda, "Paola" (de la hoja) = Andrea en el
--      sistema — corrección confirmada por el usuario, no un supuesto mío.)
--   7. Por cada fila: crea (o reutiliza) la asignación de horas
--      (persona × proyecto × línea) y le inserta su actividad. Las horas de
--      la celda las termina calculando solas el trigger que suma actividades
--      — no se escribe `allocations.hours` a mano en ningún punto de acá.
--
-- SOBRE LAS FECHAS DE LA HOJA ORIGINAL
-- Casi todas parsean limpio a un día de septiembre de 2026. Tres no eran
-- fechas de verdad — eran una nota que quedó en la columna equivocada
-- ("Incluye estructuración de estándares", "artículos", "21 de agosto y 28")
-- — quedan sin fecha (NULL) y el texto se conserva entre paréntesis al final
-- de la descripción, para no perder la información. "Por cronograma" /
-- "según cronograma" / vacío también quedan en NULL: es una fecha aún sin
-- decidir, no un dato que falte.
--
-- ANTES DE CORRERLO: cambia 'Septiembre 1 - 30' si tu mes se llama distinto.
-- =============================================================================

begin;

do $$
declare
  v_month_id uuid;
  v_row record;
  v_project_id uuid;
  v_line_id uuid;
  v_phase_id uuid;
  v_person_id uuid;
  v_allocation_id uuid;
  v_match_count integer;
  v_match_ids uuid[];
  v_inserted_activities integer := 0;
begin
  -- -----------------------------------------------------------------------
  -- 0. El mes
  -- -----------------------------------------------------------------------
  select id into v_month_id from public.months where name = 'Septiembre 1 - 30';
  if v_month_id is null then
    raise exception 'No existe un mes llamado "Septiembre 1 - 30". Ajusta el nombre en este script (sección 0) y vuelve a correrlo.';
  end if;

  -- -----------------------------------------------------------------------
  -- 1. Los datos crudos de la hoja, tal cual, en una tabla temporal
  -- -----------------------------------------------------------------------
  create temporary table _cargue (
    project_name text not null,
    line_name text,                 -- null = fila base del proyecto
    phase_key public.activity_phase not null,
    person_prefix text not null,    -- prefijo suficiente del nombre completo
    description text not null,
    activity_date date,             -- null = sin fecha (por cronograma / vacío / nota)
    hours numeric(6, 2) not null
  ) on commit drop;

  insert into _cargue (project_name, line_name, phase_key, person_prefix, description, activity_date, hours) values
    -- GenIA Impulsa
    ('GenIA Impulsa', null, 'definir', 'Andrea Albornoz', 'Ajustes Sharepoint', '2026-09-03', 10),

    -- GenIA Construye
    ('GenIA Construye', null, 'desarrollar', 'Edicson', 'Sistematización y afinamiento curso de entrenamiento docente en Nebulosa', '2026-09-25', 4),
    ('GenIA Construye', null, 'desarrollar', 'Andrea Albornoz', 'Afinamiento de módulos financiero, académico y operativo', '2026-09-30', 15),
    ('GenIA Construye', null, 'desarrollar', 'Sebas', 'Afinamiento de módulos financiero, académico y operativo', '2026-09-30', 15),
    ('GenIA Construye', null, 'desarrollar', 'Sergio', 'Afinamiento de módulos financiero, académico y operativo', '2026-09-30', 22),
    ('GenIA Construye', null, 'desarrollar', 'Edicson', 'Sistematización de atributos preguntas libro Saberes Plata en Nebulosa', '2026-09-18', 12),

    -- GenIA Trasciende
    ('GenIA Trasciende', null, 'desarrollar', 'Edicson', 'Sistematización y afinamiento curso de entrenamiento docente en Nebulosa', '2026-09-30', 6),
    ('GenIA Trasciende', null, 'desarrollar', 'Fernando', 'Revisión y definición de test de orientación vocacional', '2026-09-16', 8),
    ('GenIA Trasciende', null, 'desarrollar', 'Natalia', 'Revisión y definición de test de orientación vocacional', '2026-09-16', 8),
    ('GenIA Trasciende', null, 'desarrollar', 'Fernando', 'Definición base de universidades', '2026-09-22', 5),
    ('GenIA Trasciende', null, 'desarrollar', 'Natalia', 'Definición base de universidades', '2026-09-22', 5),
    ('GenIA Trasciende', null, 'desarrollar', 'Fernando', 'Componentes HSE para taller', '2026-09-25', 4),
    ('GenIA Trasciende', null, 'desarrollar', 'Natalia', 'Componentes HSE para taller', '2026-09-25', 4),
    ('GenIA Trasciende', null, 'desarrollar', 'Fernando', 'Estructuración y diseño del curso de formación docente (nueva secuencia didáctica)', '2026-09-28', 15),
    ('GenIA Trasciende', null, 'desarrollar', 'Maria', 'Estructuración y diseño del curso de formación docente (nueva secuencia didáctica)', '2026-09-28', 15),
    ('GenIA Trasciende', null, 'desarrollar', 'Sergio', 'Estructuración y diseño del curso de formación docente (nueva secuencia didáctica)', '2026-09-28', 10),

    -- Uppie HSE (Fase II) — fila base
    ('Uppie HSE (Fase II)', null, 'descubrir', 'Edicson', 'Validación digitalización AP4 Estudiantes', null, 2),
    ('Uppie HSE (Fase II)', null, 'descubrir', 'Natalia', 'Exploración plataforma RIEBB', '2026-09-14', 20),
    ('Uppie HSE (Fase II)', null, 'definir', 'Edicson', 'Validación digitalización AP2 Docentes', null, 2),
    ('Uppie HSE (Fase II)', null, 'definir', 'Fernando', 'Recomendaciones Estudiantes Aplicación 4', null, 20),
    ('Uppie HSE (Fase II)', null, 'definir', 'Natalia', 'Digitalización AP4 Estudiantes', null, 24),
    ('Uppie HSE (Fase II)', null, 'definir', 'Edicson', 'Digitalización AP2 Docentes', null, 8),
    ('Uppie HSE (Fase II)', null, 'definir', 'Fernando', 'Consultorías', null, 5),
    ('Uppie HSE (Fase II)', null, 'definir', 'Natalia', 'Consultorías', null, 5),

    -- Uppie HSE (Fase II) — línea "Formación"
    ('Uppie HSE (Fase II)', 'Formación', 'definir', 'Edicson', 'Estructuración de juego', '2026-09-04', 3),
    ('Uppie HSE (Fase II)', 'Formación', 'definir', 'Fernando', 'Estructuración de juego', '2026-09-04', 3),
    ('Uppie HSE (Fase II)', 'Formación', 'definir', 'Andrea Albornoz', 'Estructuración de juego', '2026-09-04', 3),
    ('Uppie HSE (Fase II)', 'Formación', 'definir', 'Sebas', 'Estructuración de juego', '2026-09-04', 3),
    ('Uppie HSE (Fase II)', 'Formación', 'definir', 'Maria', 'Estructuración de juego', '2026-09-04', 3),
    ('Uppie HSE (Fase II)', 'Formación', 'definir', 'Sergio', 'Estructuración de juego', '2026-09-04', 3),
    ('Uppie HSE (Fase II)', 'Formación', 'definir', 'Natalia', 'Estructuración de juego', '2026-09-04', 3),
    ('Uppie HSE (Fase II)', 'Formación', 'definir', 'Fernando', 'Estructuración taller de Dimensiones', '2026-09-09', 3),
    ('Uppie HSE (Fase II)', 'Formación', 'definir', 'Sebas', 'Estructuración taller de Dimensiones', '2026-09-09', 3),
    ('Uppie HSE (Fase II)', 'Formación', 'definir', 'Natalia', 'Estructuración taller de Dimensiones', '2026-09-09', 3),
    ('Uppie HSE (Fase II)', 'Formación', 'definir', 'Fernando', 'Taller a docentes HSE dimensión 1', '2026-09-23', 8),
    ('Uppie HSE (Fase II)', 'Formación', 'definir', 'Sebas', 'Taller a docentes HSE dimensión 2', '2026-09-23', 8),
    ('Uppie HSE (Fase II)', 'Formación', 'definir', 'Natalia', 'Taller a docentes HSE dimensión 3', '2026-09-23', 8),
    ('Uppie HSE (Fase II)', 'Formación', 'definir', 'Fernando', 'Ajustes talleres padres y docentes', '2026-09-21', 6),
    ('Uppie HSE (Fase II)', 'Formación', 'definir', 'Sebas', 'Ajustes talleres padres y docentes', '2026-09-21', 6),
    ('Uppie HSE (Fase II)', 'Formación', 'definir', 'Natalia', 'Ajustes talleres padres y docentes', '2026-09-21', 6),

    -- Uppie HSE (Fase II) — línea "Empresarial"
    ('Uppie HSE (Fase II)', 'Empresarial', 'definir', 'Edicson', 'Validación del instrumento de caracterización del entorno laboral', '2026-09-04', 8),
    ('Uppie HSE (Fase II)', 'Empresarial', 'definir', 'Andrea Albornoz', 'Validación del instrumento de caracterización del entorno laboral', '2026-09-04', 8),
    ('Uppie HSE (Fase II)', 'Empresarial', 'definir', 'Sebas', 'Validación del instrumento de caracterización del entorno laboral', '2026-09-04', 8),
    ('Uppie HSE (Fase II)', 'Empresarial', 'definir', 'Edicson', 'Aplicación y análisis del instrumento', '2026-09-28', 10),
    ('Uppie HSE (Fase II)', 'Empresarial', 'definir', 'Andrea Albornoz', 'Aplicación y análisis del instrumento', '2026-09-28', 10),
    ('Uppie HSE (Fase II)', 'Empresarial', 'definir', 'Sebas', 'Aplicación y análisis del instrumento', '2026-09-28', 10),
    ('Uppie HSE (Fase II)', 'Empresarial', 'definir', 'Edicson', 'Reunión indicación de matriz', '2026-09-07', 2),
    ('Uppie HSE (Fase II)', 'Empresarial', 'definir', 'Fernando', 'Reunión indicación de matriz', '2026-09-07', 2),
    ('Uppie HSE (Fase II)', 'Empresarial', 'definir', 'Andrea Albornoz', 'Reunión indicación de matriz', '2026-09-07', 2),
    ('Uppie HSE (Fase II)', 'Empresarial', 'definir', 'Sebas', 'Reunión indicación de matriz', '2026-09-07', 2),
    ('Uppie HSE (Fase II)', 'Empresarial', 'definir', 'Edicson', 'Construcción matriz habilidades', '2026-09-23', 3),
    ('Uppie HSE (Fase II)', 'Empresarial', 'definir', 'Fernando', 'Construcción matriz habilidades', '2026-09-23', 3),
    ('Uppie HSE (Fase II)', 'Empresarial', 'definir', 'Andrea Albornoz', 'Construcción matriz habilidades', '2026-09-23', 3),
    ('Uppie HSE (Fase II)', 'Empresarial', 'definir', 'Sebas', 'Construcción matriz habilidades', '2026-09-23', 3),

    -- Actualización docente
    ('Actualización docente', null, 'descubrir', 'Sergio', 'Construcción de taller para docentes sobre uso de IA en el aula (actividades de clase).', '2026-09-18', 8),
    ('Actualización docente', null, 'descubrir', 'Sergio', 'Requerimiento generación plataforma actualización docente', '2026-09-11', 5),
    ('Actualización docente', null, 'descubrir', 'Sebas', 'Implementación taller DCE (pilotaje)', '2026-09-30', 15),
    ('Actualización docente', null, 'descubrir', 'Maria', 'Implementación taller DCE (pilotaje)', '2026-09-30', 15),

    -- Pensamiento ciudadano
    ('Pensamiento ciudadano', null, 'descubrir', 'Andrea Albornoz', 'Construcción juego sobre habilidades de pensamiento ciudadano', '2026-09-29', 15),
    ('Pensamiento ciudadano', null, 'descubrir', 'Maria', 'Construcción juego sobre habilidades de pensamiento ciudadano', '2026-09-29', 15),
    ('Pensamiento ciudadano', null, 'descubrir', 'Sebas', 'Pilotaje aplicación 1 colegios . Competencias ciudadanas', '2026-09-21', 6),
    ('Pensamiento ciudadano', null, 'descubrir', 'Maria', 'Pilotaje aplicación 1 colegios . Competencias ciudadanas', '2026-09-21', 6),
    ('Pensamiento ciudadano', null, 'descubrir', 'Edicson', 'Cargue y análisis de resultados piloto competencias ciudadanas', '2026-09-30', 5),
    ('Pensamiento ciudadano', null, 'descubrir', 'Natalia', 'Cargue y análisis de resultados piloto competencias ciudadanas', '2026-09-30', 5),

    -- IME (dos "fechas" de la hoja eran en realidad notas — se conservan en la descripción)
    ('IME', null, 'descubrir', 'Sebas', 'Benchmarking tableros educación Colombia', null, 5),
    ('IME', null, 'descubrir', 'Sergio', 'Ajuste estrategia IME (Incluye estructuración de estándares)', null, 10),
    ('IME', null, 'descubrir', 'Natalia', 'Benchmarking tableros educación Colombia', null, 5),

    -- Grupo de investigación
    ('Grupo de investigación', null, 'producto', 'Fernando', 'Construcción e ideación de productos de investigación', null, 5),
    ('Grupo de investigación', null, 'producto', 'Andrea Albornoz', 'Construcción e ideación de productos de investigación', null, 5),
    ('Grupo de investigación', null, 'producto', 'Sebas', 'Construcción e ideación de productos de investigación', null, 5),
    ('Grupo de investigación', null, 'producto', 'Maria', 'Construcción e ideación de productos de investigación', null, 5),
    ('Grupo de investigación', null, 'producto', 'Sergio', 'Tablero de fuentes de información (artículos)', null, 8),
    ('Grupo de investigación', null, 'producto', 'Edicson', 'Versión final Radiografía bienestar', null, 8),
    ('Grupo de investigación', null, 'producto', 'Fernando', 'Versión final Radiografía bienestar', null, 8),
    ('Grupo de investigación', null, 'producto', 'Sergio', 'Tableros Saber 11 y Pro', null, 10),
    ('Grupo de investigación', null, 'producto', 'Andrea Albornoz', 'Reuniones de seguimiento de artículo de Fondecun', null, 3),
    ('Grupo de investigación', null, 'producto', 'Maria', 'Reuniones de seguimiento de artículo de Fondecun', null, 3),
    ('Grupo de investigación', null, 'producto', 'Andrea Albornoz', 'Construcción de artículo Fondecun', null, 10),
    ('Grupo de investigación', null, 'producto', 'Maria', 'Construcción de artículo Fondecun', null, 10),

    -- Escuela de padres
    ('Escuela de padres', null, 'producto', 'Fernando', 'Ideación de producto', null, 3),
    ('Escuela de padres', null, 'producto', 'Sebas', 'Ideación de producto', null, 3),
    ('Escuela de padres', null, 'producto', 'Natalia', 'Ideación de producto', null, 3),

    -- Iniciativa cuidadores
    ('Iniciativa cuidadores', null, 'producto', 'Fernando', 'Ideación de producto', null, 3),
    ('Iniciativa cuidadores', null, 'producto', 'Andrea Albornoz', 'Ideación de producto', null, 3),
    ('Iniciativa cuidadores', null, 'producto', 'Sebas', 'Ideación de producto', null, 3),
    ('Iniciativa cuidadores', null, 'producto', 'Natalia', 'Ideación de producto', null, 3),

    -- "Emergentes - Desafío" ya existe como proyecto propio en producción
    -- (no como línea de Emergentes) — sus horas van directo ahí.
    ('Emergentes - Desafío', null, 'producto', 'Edicson', 'Semana de capacitación', null, 50),
    ('Emergentes - Desafío', null, 'producto', 'Fernando', 'Módulo de orientación vocacional', null, 50),
    ('Emergentes - Desafío', null, 'producto', 'Andrea Albornoz', 'Semana de capacitación', null, 50),
    ('Emergentes - Desafío', null, 'producto', 'Sebas', 'Ecosistema MP', null, 50),
    ('Emergentes - Desafío', null, 'producto', 'Maria', 'Ecosistema MP', null, 50),
    ('Emergentes - Desafío', null, 'producto', 'Sergio', 'Semana de capacitación', null, 50),
    ('Emergentes - Desafío', null, 'producto', 'Natalia', 'Módulo de orientación vocacional', null, 50),
    ('Emergentes - Desafío', null, 'producto', 'Sebas', 'Compensatorio cumpleaños', null, 8),

    -- Emergentes — fila base (la "fecha" del análisis de mercado era en realidad agosto; se deja sin fecha y la nota se conserva)
    ('Emergentes', null, 'producto', 'Sergio', 'Seguimiento Deicy/transición al equipo', null, 15),
    ('Emergentes', null, 'producto', 'Andrea Albornoz', 'Desafío "Pensiones"', null, 10),
    ('Emergentes', null, 'producto', 'Sergio', 'Ajustes de herramienta de gestión de gestores', null, 2),
    ('Emergentes', null, 'producto', 'Fernando', 'Análisis de mercado "Sector educación preescolar" (Fecha original: 21 de agosto y 28)', null, 6),
    ('Emergentes', null, 'producto', 'Fernando', 'Taller cumbres de la educación', null, 3),
    ('Emergentes', null, 'producto', 'Sebas', 'Ajustes Pestel plan de gobierno', null, 3),
    ('Emergentes', null, 'producto', 'Sergio', 'Ajustes Pestel plan de gobierno', null, 3),
    ('Emergentes', null, 'producto', 'Sergio', 'Apoyo desarrollo plataforma Desafío MP', null, 20),
    ('Emergentes', null, 'producto', 'Sebas', 'Comité facilitadores de la comunicación', null, 2),
    ('Emergentes', null, 'producto', 'Sebas', 'Coppast', null, 2);

  raise notice 'Filas cargadas en la tabla temporal: %', (select count(*) from _cargue);

  -- -----------------------------------------------------------------------
  -- 2. Proyectos que falten
  -- -----------------------------------------------------------------------
  insert into public.projects (name, color, status, category)
  select distinct
    c.project_name,
    '#3A5BA7',
    'activo'::public.project_status,
    case when c.project_name = 'Emergentes' then 'emergente' else 'proyecto' end::public.project_category
  from _cargue c
  where not exists (
    select 1 from public.projects p
    where lower(btrim(p.name)) = lower(btrim(c.project_name))
  );

  -- -----------------------------------------------------------------------
  -- 3. Líneas que falten (solo Uppie HSE → Formación/Empresarial; ninguna
  --    fila de _cargue trae line_name para "Emergentes - Desafío", así que
  --    esta sección no le crea nada — ya es un proyecto aparte).
  -- -----------------------------------------------------------------------
  insert into public.project_lines (project_id, name, position)
  select distinct
    p.id,
    c.line_name,
    0
  from _cargue c
  join public.projects p on lower(btrim(p.name)) = lower(btrim(c.project_name))
  where c.line_name is not null
    and not exists (
      select 1 from public.project_lines pl
      where pl.project_id = p.id and lower(btrim(pl.name)) = lower(btrim(c.line_name))
    );

  -- -----------------------------------------------------------------------
  -- 4. Fases que falten, del catálogo canónico
  -- -----------------------------------------------------------------------
  insert into public.project_phases (project_id, name, phase_key, position)
  select distinct
    p.id,
    initcap(c.phase_key::text),
    c.phase_key,
    case c.phase_key
      when 'descubrir' then 1 when 'definir' then 2 when 'desarrollar' then 3
      when 'producto' then 4 when 'entregar' then 5
    end
  from _cargue c
  join public.projects p on lower(btrim(p.name)) = lower(btrim(c.project_name))
  where not exists (
    select 1 from public.project_phases ph
    where ph.project_id = p.id and ph.phase_key = c.phase_key
  );

  -- -----------------------------------------------------------------------
  -- 5. Cada fila: resolver persona/proyecto/línea/fase, crear la asignación
  --    si falta, e insertar la actividad.
  -- -----------------------------------------------------------------------
  for v_row in select * from _cargue loop
    -- Persona: por prefijo del nombre, DENTRO del roster de septiembre.
    -- Si no hay exactamente una, el script se detiene acá — no adivina.
    -- uuid no tiene MAX/MIN de fábrica en Postgres — se juntan los ids en un
    -- arreglo y se cuentan sus elementos, en vez de agregarlos con max().
    select array_agg(pe.id) into v_match_ids
    from public.people pe
    where pe.month_id = v_month_id
      and pe.name ilike v_row.person_prefix || '%';

    v_match_count := coalesce(array_length(v_match_ids, 1), 0);

    if v_match_count = 0 then
      raise exception 'No encontré a nadie en el roster de septiembre cuyo nombre empiece por "%". Fila: % / %',
        v_row.person_prefix, v_row.project_name, v_row.description;
    elsif v_match_count > 1 then
      raise exception 'El prefijo "%" es ambiguo: hay % personas en el roster de septiembre que empiezan así. Usa un prefijo más largo en el script.',
        v_row.person_prefix, v_match_count;
    end if;

    v_person_id := v_match_ids[1];

    select id into v_project_id from public.projects
    where lower(btrim(name)) = lower(btrim(v_row.project_name));

    v_line_id := null;
    if v_row.line_name is not null then
      select id into v_line_id from public.project_lines
      where project_id = v_project_id and lower(btrim(name)) = lower(btrim(v_row.line_name));
    end if;

    select id into v_phase_id from public.project_phases
    where project_id = v_project_id and phase_key = v_row.phase_key;

    -- Asignación: la misma llave (mes, persona, proyecto, línea) que usa la
    -- sábana. Se reutiliza si ya existe (por ejemplo, si el script se corre
    -- dos veces sobre el mismo mes).
    select id into v_allocation_id from public.allocations
    where month_id = v_month_id
      and person_id = v_person_id
      and project_id = v_project_id
      and line_id is not distinct from v_line_id;

    if v_allocation_id is null then
      insert into public.allocations (month_id, person_id, project_id, line_id, hours)
      values (v_month_id, v_person_id, v_project_id, v_line_id, 0)
      returning id into v_allocation_id;
    end if;

    insert into public.activities (allocation_id, month_id, description, phase_id, activity_date, hours)
    values (v_allocation_id, v_month_id, v_row.description, v_phase_id, v_row.activity_date, v_row.hours);

    v_inserted_activities := v_inserted_activities + 1;
  end loop;

  raise notice 'Actividades insertadas: %', v_inserted_activities;
end $$;

-- -----------------------------------------------------------------------
-- Verificación antes de confirmar
-- -----------------------------------------------------------------------
select
  (select count(*) from public.activities a
     join public.allocations al on al.id = a.allocation_id
    where al.month_id = (select id from public.months where name = 'Septiembre 1 - 30')
  ) as actividades_en_septiembre,          -- debería dar 104
  (select count(*) from public.projects) as total_proyectos,
  (select count(*) from public.project_lines) as total_lineas;

-- Revisa el resultado de arriba. Si "actividades_en_septiembre" no da 104,
-- o algo se ve raro, ejecuta ROLLBACK en vez de COMMIT.
commit;   -- o rollback;

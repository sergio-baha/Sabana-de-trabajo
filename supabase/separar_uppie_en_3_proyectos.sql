-- Separa "Uppie HSE (Fase II)" (con subproyectos Colegios/Empresarial/
-- Formación) en TRES proyectos independientes: "Uppie HSE Colegios",
-- "Uppie HSE Empresarial", "Uppie HSE Formación" — cada uno con un
-- subproyecto del mismo nombre (el que crea solo el trigger
-- project_creates_default_line al insertar el proyecto).
--
-- Sin afectar las tareas ya agendadas: NO se borra ni se recrea ninguna
-- activity/task. Se reubica la asignación (allocations) de proyecto+línea,
-- y como las actividades cuelgan de allocation_id (no de project_id), las
-- siguen automáticamente. Las tareas SÍ guardan su propio project_id/
-- phase_id (no lo heredan en vivo de la actividad), así que esos dos campos
-- se actualizan a mano para que coincidan con el proyecto nuevo — el resto
-- de la tarjeta (título, estado, asignados, comentarios, historial de
-- revisión) no se toca.
--
-- Las fases (Descubrir/Definir/...) se replican en cada proyecto nuevo
-- según lo que ya usaban sus actividades, para que ninguna quede apuntando
-- a una fase de OTRO proyecto.
--
-- Lo que este script DELIBERADAMENTE NO hace (avísame si lo quieres):
--   · No borra ni archiva "Uppie HSE (Fase II)" — queda como proyecto
--     vacío (sus 3 subproyectos sin ninguna asignación). Se puede archivar
--     después desde Proyectos si ya no hace falta.
--   · No copia gerente/equipo (project_managers/project_members) de Uppie
--     HSE (Fase II) a los 3 proyectos nuevos — si alguno tenía gestor o
--     miembros asignados a nivel de proyecto, hay que volver a
--     configurarlo en cada uno desde "Gestionar equipo".
--
-- Se ejecuta UNA VEZ, a mano, por el SQL Editor.

begin;

do $$
declare
  v_uppie_project_id uuid;
  v_pair record;
  v_old_line_id uuid;
  v_new_project_id uuid;
  v_new_line_id uuid;
  v_phase record;
  v_moved_allocations integer;
  v_moved_activities integer;
  v_moved_tasks integer;
begin
  select id into v_uppie_project_id from public.projects
  where lower(btrim(name)) = lower('Uppie HSE (Fase II)');
  if v_uppie_project_id is null then
    raise exception 'No existe el proyecto "Uppie HSE (Fase II)".';
  end if;

  for v_pair in
    select * from (values
      ('Colegios', 'Uppie HSE Colegios'),
      ('Empresarial', 'Uppie HSE Empresarial'),
      ('Formación', 'Uppie HSE Formación')
    ) as t(old_line_name, new_project_name)
  loop
    select id into v_old_line_id from public.project_lines
    where project_id = v_uppie_project_id and lower(btrim(name)) = lower(v_pair.old_line_name);

    if v_old_line_id is null then
      raise exception 'No encontré el subproyecto "%" en Uppie HSE (Fase II).', v_pair.old_line_name;
    end if;

    -- Proyecto nuevo: se crea si no existe (mismo color/estado/categoría
    -- que Uppie HSE, para no tener que recolorear a mano). El trigger
    -- project_creates_default_line le agrega solo su subproyecto por
    -- defecto, con su mismo nombre — justo lo que se pidió.
    select id into v_new_project_id from public.projects
    where lower(btrim(name)) = lower(v_pair.new_project_name);

    if v_new_project_id is null then
      insert into public.projects (name, color, status, category)
      select v_pair.new_project_name, p.color, p.status, p.category
      from public.projects p where p.id = v_uppie_project_id
      returning id into v_new_project_id;
    end if;

    select id into v_new_line_id from public.project_lines
    where project_id = v_new_project_id and lower(btrim(name)) = lower(v_pair.new_project_name);

    if v_new_line_id is null then
      raise exception 'El proyecto nuevo "%" no tiene su subproyecto por defecto — revisa el trigger project_creates_default_line.',
        v_pair.new_project_name;
    end if;

    -- Fases: se replican en el proyecto nuevo las que ya usan las
    -- actividades de esta línea, para no dejar phase_id apuntando a la fase
    -- de otro proyecto.
    for v_phase in
      select distinct ph.phase_key, ph.name, ph.position
      from public.project_phases ph
      join public.activities a on a.phase_id = ph.id
      join public.allocations al on al.id = a.allocation_id
      where al.project_id = v_uppie_project_id and al.line_id = v_old_line_id
    loop
      if not exists (
        select 1 from public.project_phases
        where project_id = v_new_project_id and phase_key = v_phase.phase_key
      ) then
        insert into public.project_phases (project_id, name, phase_key, position)
        values (v_new_project_id, v_phase.name, v_phase.phase_key, v_phase.position);
      end if;
    end loop;

    -- Actividades de esta línea: se remapea su phase_id a la fase
    -- equivalente del proyecto nuevo. Va ANTES de mover la asignación,
    -- mientras todavía se pueden ubicar por su allocation vieja.
    update public.activities a
    set phase_id = (
      select new_ph.id from public.project_phases new_ph
      join public.project_phases old_ph on old_ph.phase_key = new_ph.phase_key
      where old_ph.id = a.phase_id and new_ph.project_id = v_new_project_id
    )
    from public.allocations al
    where a.allocation_id = al.id
      and al.project_id = v_uppie_project_id
      and al.line_id = v_old_line_id
      and a.phase_id is not null;
    get diagnostics v_moved_activities = row_count;

    -- Tareas generadas por esas actividades: proyecto y fase pasan al
    -- nuevo (la fase ya quedó remapeada en el paso de arriba). Título,
    -- estado, asignados, comentarios e historial de revisión no se tocan.
    update public.tasks t
    set project_id = v_new_project_id,
        phase_id = a.phase_id
    from public.activities a
    join public.allocations al on al.id = a.allocation_id
    where t.id = a.task_id
      and al.project_id = v_uppie_project_id
      and al.line_id = v_old_line_id;
    get diagnostics v_moved_tasks = row_count;

    -- La asignación en sí: cambia de proyecto y de línea. No toca
    -- allocation_id, así que las actividades (y por lo tanto sus tareas)
    -- la siguen automáticamente sin tener que tocarlas una por una.
    update public.allocations
    set project_id = v_new_project_id,
        line_id = v_new_line_id
    where project_id = v_uppie_project_id and line_id = v_old_line_id;
    get diagnostics v_moved_allocations = row_count;

    raise notice '% → "%": % asignaciones movidas, % actividades con fase reubicada, % tareas actualizadas.',
      v_pair.old_line_name, v_pair.new_project_name, v_moved_allocations, v_moved_activities, v_moved_tasks;
  end loop;
end $$;

-- -----------------------------------------------------------------------
-- Verificación antes de confirmar
-- -----------------------------------------------------------------------
select
  p.name as proyecto,
  pe.name as persona,
  count(a.id) as actividades,
  sum(a.hours) as horas
from public.activities a
join public.allocations al on al.id = a.allocation_id
join public.projects p on p.id = al.project_id
join public.people pe on pe.id = al.person_id
where p.name in ('Uppie HSE Colegios', 'Uppie HSE Empresarial', 'Uppie HSE Formación', 'Uppie HSE (Fase II)')
group by p.name, pe.name
order by p.name, pe.name;

-- Compara este resultado contra lo que se veía antes bajo Uppie HSE (Fase
-- II) → Colegios/Empresarial/Formación (misma cuenta de horas, ahora bajo
-- cada proyecto nuevo). "Uppie HSE (Fase II)" no debería aparecer en absoluto
-- (se quedó sin actividades). Si algo no cuadra, ejecuta ROLLBACK en vez de
-- COMMIT.
commit;   -- o rollback;

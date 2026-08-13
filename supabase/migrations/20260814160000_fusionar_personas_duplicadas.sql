-- Fusiona las filas del roster que quedaron por duplicado.
--
-- Al automatizar el alta desde las cuentas (*_roster_desde_las_cuentas.sql),
-- toda cuenta activa recibió su fila en los meses abiertos. Donde ya existía
-- una fila cargada a mano CON el mismo nombre, se enlazó y no hubo problema;
-- donde el nombre estaba escrito distinto, quedaron dos columnas para la
-- misma persona en la grilla: la vieja (con las horas) y la nueva (vacía).
--
-- NO se borra a ciegas: la fila vieja es la que tiene el trabajo colgado
-- (horas, tareas asignadas, equipos, tarifa). Primero se le pasa todo a la
-- fila enlazada —que es la que va a sobrevivir, porque es la que la
-- plataforma sabe mantener— y solo entonces se borra la vieja.
--
-- Criterio para emparejar, en este orden:
--   1. Mismo nombre normalizado (sin may/min ni espacios sobrantes).
--   2. Mismo mes.
--   3. Una con `profile_id` y la otra sin él.
-- Si dos filas no se parecen ni por el nombre, se dejan en paz: fusionar por
-- corazonada mueve las horas de una persona a otra.

-- Normaliza para comparar: sin mayúsculas, sin tildes y sin espacios de
-- sobra. "María Muñoz" y "Maria Munoz" son la misma persona escrita por dos
-- manos distintas, y es justo el caso que dejó los duplicados.
create or replace function public.normalize_person_name(p_name text)
returns text
language sql
immutable
as $$
  select translate(lower(btrim(coalesce(p_name, ''))), 'áéíóúüñ', 'aeiouun');
$$;

do $$
declare
  d record;
  v_merged integer := 0;
  v_left integer;
begin
  for d in
    select vieja.id as old_id, nueva.id as new_id, vieja.name as old_name
    from public.people vieja
    join public.people nueva
      on nueva.month_id = vieja.month_id
     and nueva.profile_id is not null
     and vieja.profile_id is null
     and public.normalize_person_name(vieja.name)
         = public.normalize_person_name(nueva.name)
  loop
    raise notice 'Fusionando duplicado: %', d.old_name;
    v_merged := v_merged + 1;
    -- Horas repartidas. Si la fila nueva ya tenía celda para ese proyecto
    -- (no debería: nace vacía), se queda con el valor mayor y se descarta la
    -- otra, en vez de sumarlas — sumar inventaría horas que nadie repartió.
    update public.allocations a
    set person_id = d.new_id
    where a.person_id = d.old_id
      and not exists (
        select 1 from public.allocations b
        where b.month_id = a.month_id
          and b.person_id = d.new_id
          and b.project_id = a.project_id
      );

    update public.allocations b
    set hours = greatest(b.hours, a.hours)
    from public.allocations a
    where a.person_id = d.old_id
      and b.person_id = d.new_id
      and b.month_id = a.month_id
      and b.project_id = a.project_id;

    delete from public.allocations where person_id = d.old_id;

    -- Tareas asignadas.
    update public.task_assignees t
    set person_id = d.new_id
    where t.person_id = d.old_id
      and not exists (
        select 1 from public.task_assignees u
        where u.task_id = t.task_id and u.person_id = d.new_id
      );
    delete from public.task_assignees where person_id = d.old_id;

    -- Equipos y gerencias de proyecto.
    update public.project_members m
    set person_id = d.new_id
    where m.person_id = d.old_id
      and not exists (
        select 1 from public.project_members n
        where n.project_id = m.project_id and n.person_id = d.new_id
      );
    delete from public.project_members where person_id = d.old_id;

    update public.project_managers m
    set person_id = d.new_id
    where m.person_id = d.old_id
      and not exists (
        select 1 from public.project_managers n
        where n.project_id = m.project_id and n.person_id = d.new_id
      );
    delete from public.project_managers where person_id = d.old_id;

    -- Tarifa (una por persona-mes): solo si la nueva no tiene.
    update public.person_rates r
    set person_id = d.new_id
    where r.person_id = d.old_id
      and not exists (
        select 1 from public.person_rates s where s.person_id = d.new_id
      );
    delete from public.person_rates where person_id = d.old_id;

    -- Las horas disponibles del mes las tenía la fila vieja: se conservan.
    update public.people nueva
    set available_hours = vieja.available_hours,
        notes = coalesce(nueva.notes, vieja.notes)
    from public.people vieja
    where nueva.id = d.new_id and vieja.id = d.old_id;

    delete from public.people where id = d.old_id;
  end loop;

  raise notice 'Duplicados fusionados: %', v_merged;

  -- Lo que quede sin cuenta vinculada en un mes abierto es un candidato a
  -- duplicado que NO se pudo emparejar por nombre. Se listan para revisarlos
  -- a mano: es preferible a fusionar a ciegas y mover las horas de alguien.
  select count(*) into v_left
  from public.people p
  join public.months m on m.id = p.month_id
  where p.profile_id is null and m.status = 'abierto';

  if v_left > 0 then
    raise notice 'Quedan % fila(s) del roster sin cuenta vinculada — revísalas:', v_left;
    for d in
      select p.name, m.name as month_name
      from public.people p
      join public.months m on m.id = p.month_id
      where p.profile_id is null and m.status = 'abierto'
      order by m.name, p.name
    loop
      raise notice '  · % (mes %)', d.name, d.month_name;
    end loop;
  end if;
end;
$$;

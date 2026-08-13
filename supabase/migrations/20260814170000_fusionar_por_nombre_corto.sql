-- Segunda pasada de fusión: los duplicados que quedaron son filas viejas del
-- roster escritas con nombre corto ("Fernando", "Natalia", "Sergio") contra
-- la fila nueva creada desde la cuenta, que trae el nombre completo
-- ("Fernando Bogota", "Natalia Fuentes", "sergio.bahamon").
--
-- La comparación por nombre completo no las empareja, así que acá se compara
-- el nombre corto contra dos candidatos de la cuenta:
--   · el primer token del nombre completo ("Fernando Bogota" → "fernando");
--   · el primer tramo del correo ("sergio.bahamon@…" → "sergio"), que es lo
--     que resuelve las cuentas nombradas como usuario y no como persona.
--
-- Y solo si el emparejamiento es ÚNICO en las dos direcciones: si dos filas
-- viejas apuntan al mismo candidato, o una vieja encaja con dos cuentas, se
-- deja intacta y se reporta. Fusionar por corazonada mueve las horas de una
-- persona a otra, que es peor que dejar un duplicado a la vista.
--
-- Sigue el mismo orden que la pasada anterior: primero se le pasa el trabajo
-- a la fila que sobrevive (la enlazada), después se borra la vieja.

create or replace function public.person_name_candidates(p_full_name text, p_email text)
returns text[]
language sql
immutable
as $$
  select array_remove(array[
    public.normalize_person_name(split_part(btrim(coalesce(p_full_name, '')), ' ', 1)),
    public.normalize_person_name(split_part(split_part(coalesce(p_email, ''), '@', 1), '.', 1))
  ], '');
$$;

do $$
declare
  d record;
  v_merged integer := 0;
begin
  for d in
    with pares as (
      select
        vieja.id as old_id,
        vieja.name as old_name,
        nueva.id as new_id,
        nueva.name as new_name
      from public.people vieja
      join public.months m on m.id = vieja.month_id
      join public.people nueva on nueva.month_id = vieja.month_id
      join public.profiles pr on pr.id = nueva.profile_id
      where vieja.profile_id is null
        and nueva.profile_id is not null
        and m.status = 'abierto'
        and public.normalize_person_name(vieja.name)
            = any (public.person_name_candidates(pr.full_name, pr.email))
    )
    select p.*
    from pares p
    where (select count(*) from pares q where q.old_id = p.old_id) = 1
      and (select count(*) from pares q where q.new_id = p.new_id) = 1
  loop
    raise notice 'Fusionando "%" → "%"', d.old_name, d.new_name;
    v_merged := v_merged + 1;

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

    update public.task_assignees t
    set person_id = d.new_id
    where t.person_id = d.old_id
      and not exists (
        select 1 from public.task_assignees u
        where u.task_id = t.task_id and u.person_id = d.new_id
      );
    delete from public.task_assignees where person_id = d.old_id;

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

    update public.person_rates r
    set person_id = d.new_id
    where r.person_id = d.old_id
      and not exists (
        select 1 from public.person_rates s where s.person_id = d.new_id
      );
    delete from public.person_rates where person_id = d.old_id;

    -- Las horas disponibles del mes las tenía la fila vieja.
    update public.people nueva
    set available_hours = vieja.available_hours,
        notes = coalesce(nueva.notes, vieja.notes)
    from public.people vieja
    where nueva.id = d.new_id and vieja.id = d.old_id;

    delete from public.people where id = d.old_id;
  end loop;

  raise notice 'Duplicados fusionados en esta pasada: %', v_merged;

  for d in
    select p.name, m.name as month_name,
           (select count(*) from public.allocations a where a.person_id = p.id) as celdas
    from public.people p
    join public.months m on m.id = p.month_id
    where p.profile_id is null and m.status = 'abierto'
    order by m.name, p.name
  loop
    raise notice 'SIN EMPAREJAR: "%" (mes %, % celdas con horas)',
      d.name, d.month_name, d.celdas;
  end loop;
end;
$$;

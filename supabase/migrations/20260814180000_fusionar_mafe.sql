-- Último duplicado: "Mafe" (Julio 10-31, 11 celdas con horas) es la cuenta de
-- María Muñoz, confirmado con el equipo. No lo emparejó ninguna de las dos
-- pasadas automáticas porque "Mafe" no es ni el primer nombre ni el primer
-- tramo del correo: es un apodo, y eso no se adivina desde la base.
--
-- De paso, la fusión deja de estar copiada tres veces: se extrae a
-- `merge_person_rows`, que es lo que había que haber hecho desde la primera
-- pasada. Sirve para el próximo roster que llegue escrito a mano.

-- Pasa TODO el trabajo de una fila del roster a otra del mismo mes y borra la
-- vieja. El orden importa: primero se mueve lo que cuelga (que tiene llaves
-- únicas por persona), después se borra la fila — al revés, la cascada se
-- llevaría las horas por delante.
create or replace function public.merge_person_rows(p_old_id uuid, p_new_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_old_id = p_new_id then
    return;
  end if;

  if not exists (
    select 1 from public.people a join public.people b on b.month_id = a.month_id
    where a.id = p_old_id and b.id = p_new_id
  ) then
    raise exception 'Solo se fusionan dos filas del mismo mes';
  end if;

  -- Horas repartidas. Si ambas tenían celda para el mismo proyecto se queda
  -- la mayor, en vez de sumarlas: sumar inventaría horas que nadie repartió.
  update public.allocations a
  set person_id = p_new_id
  where a.person_id = p_old_id
    and not exists (
      select 1 from public.allocations b
      where b.month_id = a.month_id
        and b.person_id = p_new_id
        and b.project_id = a.project_id
    );

  update public.allocations b
  set hours = greatest(b.hours, a.hours)
  from public.allocations a
  where a.person_id = p_old_id
    and b.person_id = p_new_id
    and b.month_id = a.month_id
    and b.project_id = a.project_id;

  delete from public.allocations where person_id = p_old_id;

  update public.task_assignees t
  set person_id = p_new_id
  where t.person_id = p_old_id
    and not exists (
      select 1 from public.task_assignees u
      where u.task_id = t.task_id and u.person_id = p_new_id
    );
  delete from public.task_assignees where person_id = p_old_id;

  update public.project_members m
  set person_id = p_new_id
  where m.person_id = p_old_id
    and not exists (
      select 1 from public.project_members n
      where n.project_id = m.project_id and n.person_id = p_new_id
    );
  delete from public.project_members where person_id = p_old_id;

  update public.project_managers m
  set person_id = p_new_id
  where m.person_id = p_old_id
    and not exists (
      select 1 from public.project_managers n
      where n.project_id = m.project_id and n.person_id = p_new_id
    );
  delete from public.project_managers where person_id = p_old_id;

  update public.person_rates r
  set person_id = p_new_id
  where r.person_id = p_old_id
    and not exists (select 1 from public.person_rates s where s.person_id = p_new_id);
  delete from public.person_rates where person_id = p_old_id;

  -- Las horas disponibles del mes las tenía la fila vieja.
  update public.people nueva
  set available_hours = vieja.available_hours,
      notes = coalesce(nueva.notes, vieja.notes)
  from public.people vieja
  where nueva.id = p_new_id and vieja.id = p_old_id;

  delete from public.people where id = p_old_id;
end;
$$;

revoke all on function public.merge_person_rows(uuid, uuid) from public;

do $$
declare
  v_old_id uuid;
  v_new_id uuid;
  v_month text;
begin
  select vieja.id, nueva.id, m.name
  into v_old_id, v_new_id, v_month
  from public.people vieja
  join public.months m on m.id = vieja.month_id
  join public.people nueva on nueva.month_id = vieja.month_id
  join public.profiles pr on pr.id = nueva.profile_id
  where vieja.profile_id is null
    and public.normalize_person_name(vieja.name) = 'mafe'
    and public.normalize_person_name(pr.full_name) = 'maria munoz';

  if v_old_id is null then
    raise notice 'No se encontró el par "Mafe" ↔ "Maria Muñoz": nada que fusionar.';
    return;
  end if;

  raise notice 'Fusionando "Mafe" → "Maria Muñoz" (mes %)', v_month;
  perform public.merge_person_rows(v_old_id, v_new_id);
end;
$$;

-- Dónde aterriza un ticket: el proyecto contenedor y el mes.
--
-- La decisión vive acá y no en la Edge Function a propósito. Es una regla de
-- negocio —qué mes está vigente, cómo se llama el proyecto de soporte— y
-- cambiarla no debería exigir redesplegar una función ni tocar un secreto.
--
-- EL MES: la regla robusta NO es "el mes abierto". Es el mes donde el equipo
-- de soporte TENGA FILA DE ROSTER, prefiriendo el abierto y, entre varios, el
-- más reciente. El motivo es concreto: `task_assignees.person_id` apunta a
-- `people`, que es por mes, así que un ticket en un mes donde el analista no
-- tiene fila es un ticket que NADIE puede tomar. Se vería en la bandeja y
-- fallaría al asignarlo, que es la peor forma de fallar.
--
-- El alta automática desde las cuentas (*_roster_desde_las_cuentas.sql) le
-- crea fila a toda cuenta activa en los meses abiertos, así que en la
-- operación normal esto se resuelve solo.

-- El proyecto contenedor se crea una sola vez y queda apuntado en `settings`.
-- Es idempotente: si ya existe, no se duplica.
do $$
declare
  v_project_id uuid;
begin
  select support_project_id into v_project_id from public.settings where id = 1;

  if v_project_id is null or not exists (
    select 1 from public.projects where id = v_project_id
  ) then
    select id into v_project_id
    from public.projects
    where name = 'Soporte Tecnología'
    limit 1;

    if v_project_id is null then
      insert into public.projects (name, color, status, category, description)
      values (
        'Soporte Tecnología',
        '#5B7FBF',
        'activo',
        'emergente',
        'Contenedor de los tickets que llegan por correo a la mesa de ayuda. '
        'No se reparte en horas: existe porque toda tarea necesita un '
        'proyecto, y el trabajo de soporte no pertenece a ninguno.'
      )
      returning id into v_project_id;

      raise notice 'Proyecto de soporte creado.';
    end if;

    update public.settings set support_project_id = v_project_id where id = 1;
  end if;
end;
$$;

create or replace function public.resolve_ticket_target()
returns table (month_id uuid, project_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select m.id, s.support_project_id
  from public.months m
  cross join public.settings s
  where s.id = 1
    and s.support_project_id is not null
    -- Que haya alguien capaz de tomarlo en ese mes.
    and exists (
      select 1
      from public.people pe
      join public.profiles pr on pr.id = pe.profile_id
      where pe.month_id = m.id
        and pr.role = 'analista_tecnologia'
        and pr.is_active
    )
  order by (m.status = 'abierto') desc, m.created_at desc
  limit 1;
$$;

revoke all on function public.resolve_ticket_target() from public;
grant execute on function public.resolve_ticket_target() to service_role;

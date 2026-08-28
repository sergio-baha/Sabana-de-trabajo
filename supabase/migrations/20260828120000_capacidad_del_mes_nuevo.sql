-- Un mes NUEVO (en blanco, no duplicado) debe arrancar con la capacidad que
-- el Administrador declaró al crearlo (`months.default_hours`), no con lo
-- que haya quedado guardado en el mes anterior.
--
-- EL PROBLEMA
-- `seed_month_people` (ver *_sembrar_roster_del_mes.sql y
-- *_roster_desde_las_cuentas.sql) copiaba `available_hours` PERSONA POR
-- PERSONA del mes más reciente que tuviera gente, sin condición. La idea
-- original era conservar ajustes reales entre un mes y el siguiente
-- (vacaciones, medio tiempo) sin que el Administrador tuviera que
-- reescribirlos cada vez. En la práctica esto encadena cualquier mes nuevo a
-- lo que haya en el mes anterior MÁS RECIENTE POR FECHA DE CREACIÓN — que no
-- necesariamente es un mes de operación real: puede ser un mes de prueba con
-- una cifra que no significa nada, y entonces el mes nuevo hereda ese
-- número sin que el `default_hours` que el Administrador acaba de fijar
-- tenga ningún efecto. Es exactamente lo que pasó: un mes se creó con su
-- propio `default_hours`, pero las seis personas del roster salieron con
-- 119 h — el valor que había quedado en el mes de prueba anterior.
--
-- EL ARREGLO
-- La capacidad de cada fila nueva sale SIEMPRE de `default_hours` del mes
-- que se está sembrando. El resto del roster —quién está activo, su cargo,
-- su tarifa— se sigue copiando del mes anterior, porque eso sí es
-- continuidad real del equipo y no algo que dependa de un valor que pudo
-- quedar mal en cualquier mes de prueba.
--
-- Esto NO toca `create_month_from_previous` (el RPC de "Duplicar mes"): ahí
-- copiar las horas es el propósito explícito de la acción, no un efecto
-- secundario — sigue copiando el reparto de horas tal cual, como siempre.
create or replace function public.seed_month_people(p_month_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source_month_id uuid;
  v_default_hours smallint;
  v_inserted integer;
begin
  if not public.can_write_month(p_month_id) then
    raise exception 'No tiene permisos para armar el equipo de este mes';
  end if;

  -- Nunca duplicar: sembrar es para un mes vacío.
  if exists (select 1 from public.people where month_id = p_month_id) then
    return 0;
  end if;

  select default_hours into v_default_hours from public.months where id = p_month_id;

  -- El mes más reciente que sí tenga gente, por fecha de creación. No se usa
  -- el nombre porque es texto libre ("Agosto 1-31") y no ordena.
  select p.month_id into v_source_month_id
  from public.people p
  join public.months m on m.id = p.month_id
  where p.month_id <> p_month_id
  group by p.month_id, m.created_at
  order by m.created_at desc
  limit 1;

  if v_source_month_id is not null then
    -- Solo los activos: quien ya no está en el equipo no reaparece.
    -- `cloned_from_id` deja el rastro de quién es quién entre meses.
    insert into public.people (
      month_id, name, job_title, available_hours, status, notes,
      profile_id, cloned_from_id, created_by
    )
    select
      p_month_id, p.name, p.job_title, v_default_hours, p.status, p.notes,
      p.profile_id, p.id, auth.uid()
    from public.people p
    where p.month_id = v_source_month_id
      and p.status = 'activo';

    -- La tarifa acompaña a la persona: si no se copia, el costo del mes
    -- nuevo arranca en cero y parece que ningún proyecto gasta.
    insert into public.person_rates (person_id, month_id, hourly_rate, updated_by)
    select np.id, p_month_id, r.hourly_rate, auth.uid()
    from public.people np
    join public.person_rates r
      on r.person_id = np.cloned_from_id
     and r.month_id = v_source_month_id
    where np.month_id = p_month_id;
  end if;

  -- Cuentas activas que todavía no tienen fila en este mes (el caso del que
  -- entró después de crearse el mes de origen). Mismo valor de capacidad.
  insert into public.people (month_id, name, job_title, available_hours, status, profile_id)
  select
    p_month_id,
    pr.full_name,
    pr.job_title,
    v_default_hours,
    'activo',
    pr.id
  from public.profiles pr
  where pr.is_active
    and not exists (
      select 1 from public.people p
      where p.month_id = p_month_id and p.profile_id = pr.id
    );

  select count(*) into v_inserted from public.people where month_id = p_month_id;
  return v_inserted;
end;
$$;

revoke all on function public.seed_month_people(uuid) from public;
grant execute on function public.seed_month_people(uuid) to authenticated;

-- El roster deja de mantenerse a mano: lo dictan las cuentas.
--
-- El equipo casi no cambia y todo el mundo tiene cuenta, así que "Personas"
-- era una segunda lista de las mismas personas: dar de alta a alguien exigía
-- invitar la cuenta Y agregarlo al roster Y vincular ambas cosas. Nada las
-- conectaba, y como pasa dos veces al año, siempre se olvidaba el segundo
-- paso — el síntoma eran los gestores que no aparecían al asignar.
--
-- Ahora: activar una cuenta crea su fila del mes; desactivarla la marca
-- inactiva. La tabla `people` NO desaparece (cada hora, tarea, tarifa y
-- equipo cuelga de ella, y es lo que conserva el histórico "en agosto éramos
-- 12"): lo que desaparece es tener que mantenerla.
--
-- Alcance: los meses ABIERTOS. Un mes cerrado o archivado es contabilidad
-- congelada; que entre alguien nuevo hoy no cambia quién trabajó en julio.

-- ---------------------------------------------------------------------------
-- 0. Enlazar lo que ya está, antes de automatizar nada
-- ---------------------------------------------------------------------------
-- Una fila del roster sin `profile_id` es, para la automatización de abajo,
-- una persona que "no existe": le crearía una fila nueva al lado y quedarían
-- dos columnas para el mismo humano en la grilla. Así que primero se enlazan
-- por nombre las que se puedan.
--
-- Solo cuando la correspondencia es INEQUÍVOCA: un único perfil con ese
-- nombre y ninguna otra fila del mismo mes ya enlazada a él. Si hay dos
-- "Juan Pérez", se deja sin enlazar y se resuelve a mano — es preferible a
-- adivinar y colgarle las horas de uno al otro.
update public.people p
set profile_id = pr.id
from public.profiles pr
where p.profile_id is null
  and lower(btrim(p.name)) = lower(btrim(pr.full_name))
  and (
    select count(*) from public.profiles pr2
    where lower(btrim(pr2.full_name)) = lower(btrim(p.name))
  ) = 1
  and not exists (
    select 1 from public.people p2
    where p2.month_id = p.month_id and p2.profile_id = pr.id
  );

-- ---------------------------------------------------------------------------
-- 1. El cargo es de la persona, no del mes
-- ---------------------------------------------------------------------------
-- Se edita en Usuarios (una vez) y baja a las filas del roster de los meses
-- abiertos. `people.job_title` se conserva —las vistas de reporte y los
-- snapshots lo leen de ahí, y los meses cerrados deben conservar el cargo que
-- la persona tenía entonces— pero pasa a ser una copia, no la fuente.
alter table public.profiles add column job_title text;

update public.profiles pr
set job_title = sub.job_title
from (
  select distinct on (p.profile_id) p.profile_id, p.job_title
  from public.people p
  join public.months m on m.id = p.month_id
  where p.profile_id is not null and p.job_title is not null
  order by p.profile_id, m.created_at desc
) sub
where pr.id = sub.profile_id;

-- ---------------------------------------------------------------------------
-- 2. Alta / baja / sincronización
-- ---------------------------------------------------------------------------
create or replace function public.sync_person_from_profile(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
begin
  select * into v_profile from public.profiles where id = p_profile_id;
  if not found then
    return;
  end if;

  if v_profile.is_active then
    -- Alta en los meses abiertos donde todavía no exista.
    insert into public.people (month_id, name, job_title, available_hours, status, profile_id)
    select m.id, v_profile.full_name, v_profile.job_title, m.default_hours, 'activo', v_profile.id
    from public.months m
    where m.status = 'abierto'
      and not exists (
        select 1 from public.people p
        where p.month_id = m.id and p.profile_id = v_profile.id
      );
  end if;

  -- Y el resto de los datos, al día en esos mismos meses. El nombre y el
  -- cargo bajan de la cuenta; las horas disponibles NO se tocan: son del mes
  -- y se ajustan en la grilla (vacaciones, medio tiempo).
  update public.people p
  set name = v_profile.full_name,
      job_title = coalesce(v_profile.job_title, p.job_title),
      status = (case when v_profile.is_active then 'activo' else 'inactivo' end)::public.person_status
  from public.months m
  where m.id = p.month_id
    and m.status = 'abierto'
    and p.profile_id = v_profile.id;
end;
$$;

revoke all on function public.sync_person_from_profile(uuid) from public;
grant execute on function public.sync_person_from_profile(uuid) to authenticated;

create or replace function public.tg_profile_syncs_person()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_person_from_profile(new.id);
  return null;
end;
$$;

drop trigger if exists profile_syncs_person on public.profiles;

create trigger profile_syncs_person
  after insert or update of is_active, full_name, job_title on public.profiles
  for each row execute function public.tg_profile_syncs_person();

-- ---------------------------------------------------------------------------
-- 3. Un mes nuevo también arranca con todas las cuentas activas
-- ---------------------------------------------------------------------------
-- `seed_month_people` copiaba el roster del mes anterior. Ahora, además, suma
-- las cuentas activas que no tengan fila — el caso del que entró después de
-- crearse el mes anterior. Se reescribe completa (create or replace no admite
-- parches); el resto del cuerpo es el de *_sembrar_roster_del_mes.sql.
create or replace function public.seed_month_people(p_month_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source_month_id uuid;
  v_inserted integer;
begin
  if not public.can_write_month(p_month_id) then
    raise exception 'No tiene permisos para armar el equipo de este mes';
  end if;

  if exists (select 1 from public.people where month_id = p_month_id) then
    return 0;
  end if;

  select p.month_id into v_source_month_id
  from public.people p
  join public.months m on m.id = p.month_id
  where p.month_id <> p_month_id
  group by p.month_id, m.created_at
  order by m.created_at desc
  limit 1;

  if v_source_month_id is not null then
    insert into public.people (
      month_id, name, job_title, available_hours, status, notes,
      profile_id, cloned_from_id, created_by
    )
    select
      p_month_id, p.name, p.job_title, p.available_hours, p.status, p.notes,
      p.profile_id, p.id, auth.uid()
    from public.people p
    where p.month_id = v_source_month_id
      and p.status = 'activo';

    insert into public.person_rates (person_id, month_id, hourly_rate, updated_by)
    select np.id, p_month_id, r.hourly_rate, auth.uid()
    from public.people np
    join public.person_rates r
      on r.person_id = np.cloned_from_id
     and r.month_id = v_source_month_id
    where np.month_id = p_month_id;
  end if;

  -- Cuentas activas que todavía no tienen fila en este mes.
  insert into public.people (month_id, name, job_title, available_hours, status, profile_id)
  select
    p_month_id,
    pr.full_name,
    pr.job_title,
    (select default_hours from public.months where id = p_month_id),
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

-- ---------------------------------------------------------------------------
-- 4. Poner al día lo que ya existe
-- ---------------------------------------------------------------------------
-- Toda cuenta activa queda con su fila en los meses abiertos, vinculada. Es
-- exactamente el paso que se venía olvidando a mano.
do $$
declare
  r record;
begin
  for r in select id from public.profiles where is_active loop
    perform public.sync_person_from_profile(r.id);
  end loop;
end;
$$;

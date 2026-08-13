-- El equipo no cambia mes a mes: un mes nuevo debe arrancar con la misma
-- gente activa, sin que nadie la vuelva a cargar a mano.
--
-- Por qué sembrar y no volver `people` durable: las horas disponibles SÍ son
-- del mes (vacaciones, medio tiempo, ingresos a mitad de mes) y cada mes
-- conserva la foto del equipo que tuvo. Un roster único obligaría a una tabla
-- de horas por persona-mes igual, y encima reescribiría la historia: quien
-- entró en septiembre aparecería como columna de agosto.
--
-- `seed_month_people` es idempotente por diseño: si el mes ya tiene gente, no
-- hace nada y devuelve 0. Así se puede llamar desde el trigger de alta y
-- también desde el botón "Traer el equipo" de un mes que quedó vacío.
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

  -- Nunca duplicar: sembrar es para un mes vacío.
  if exists (select 1 from public.people where month_id = p_month_id) then
    return 0;
  end if;

  -- El mes más reciente que sí tenga gente, por fecha de creación. No se usa
  -- el nombre porque es texto libre ("Agosto 1-31") y no ordena.
  select p.month_id into v_source_month_id
  from public.people p
  join public.months m on m.id = p.month_id
  where p.month_id <> p_month_id
  group by p.month_id, m.created_at
  order by m.created_at desc
  limit 1;

  if v_source_month_id is null then
    return 0;
  end if;

  -- Solo los activos: quien ya no está en el equipo no reaparece.
  -- `cloned_from_id` deja el rastro de quién es quién entre meses.
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

  get diagnostics v_inserted = row_count;

  -- La tarifa acompaña a la persona: si no se copia, el costo del mes nuevo
  -- arranca en cero y parece que ningún proyecto gasta. Es la misma copia que
  -- hace duplicar un mes (ver *_clone_month_portfolio.sql).
  insert into public.person_rates (person_id, month_id, hourly_rate, updated_by)
  select np.id, p_month_id, r.hourly_rate, auth.uid()
  from public.people np
  join public.person_rates r
    on r.person_id = np.cloned_from_id
   and r.month_id = v_source_month_id
  where np.month_id = p_month_id;

  return v_inserted;
end;
$$;

revoke all on function public.seed_month_people(uuid) from public;
grant execute on function public.seed_month_people(uuid) to authenticated;

-- Alta de un mes en blanco: el equipo viene solo.
--
-- `source_month_id is null` distingue el mes en blanco del duplicado:
-- `create_month_from_previous` graba el origen y copia el roster él mismo, así
-- que sembrar ahí duplicaría a todo el mundo.
create or replace function public.tg_month_seed_people()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.source_month_id is null then
    perform public.seed_month_people(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists month_seed_people on public.months;

create trigger month_seed_people
  after insert on public.months
  for each row execute function public.tg_month_seed_people();

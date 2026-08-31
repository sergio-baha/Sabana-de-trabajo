-- Reemplaza la marca única "Planeación lista" (*_planeacion_lista.sql) —
-- que cualquier Gestor ponía por TODO el mes — por una casilla POR GESTOR:
-- cada uno marca la suya, y el Administrador ve en Meses quién ya confirmó
-- y quién falta, en vez de un sí/no colectivo que no decía de quién era la
-- parte pendiente.
--
-- "Cada gestor" = toda cuenta activa con rol 'gestor', sin importar si tiene
-- o no un proyecto asignado ese mes en particular (decisión del usuario).

-- ---------------------------------------------------------------------------
-- 1. La casilla de cada gestor, por mes
-- ---------------------------------------------------------------------------
create table public.month_gestor_checks (
  id uuid primary key default gen_random_uuid(),
  month_id uuid not null references public.months (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  checked_at timestamptz not null default now(),
  unique (month_id, profile_id)
);

create index month_gestor_checks_month_idx on public.month_gestor_checks (month_id);

alter table public.month_gestor_checks enable row level security;
revoke all on public.month_gestor_checks from anon;
-- Sin insert/delete para `authenticated`: solo se escribe vía
-- set_gestor_check (definer), que valida mes abierto/no liberado y que cada
-- quien marque únicamente la suya.
grant select on public.month_gestor_checks to authenticated;

create policy "month_gestor_checks_select" on public.month_gestor_checks
  for select to authenticated using (public.is_gestor_or_admin());

-- ---------------------------------------------------------------------------
-- 2. Marcar/desmarcar la propia casilla
-- ---------------------------------------------------------------------------
create or replace function public.set_gestor_check(
  p_month_id uuid,
  p_checked boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month public.months%rowtype;
begin
  if not public.is_gestor_or_admin() then
    raise exception 'Solo un Gestor o el Administrador pueden marcar esto';
  end if;

  select * into v_month from public.months where id = p_month_id;
  if not found then
    raise exception 'El mes no existe';
  end if;

  if public.is_month_locked(p_month_id) then
    raise exception 'El mes "%" está cerrado: ya no se puede marcar', v_month.name;
  end if;

  if v_month.released_at is not null then
    raise exception 'El mes "%" ya está liberado al equipo', v_month.name;
  end if;

  if p_checked then
    insert into public.month_gestor_checks (month_id, profile_id)
    values (p_month_id, auth.uid())
    on conflict (month_id, profile_id) do nothing;
  else
    delete from public.month_gestor_checks
    where month_id = p_month_id and profile_id = auth.uid();
  end if;
end;
$$;

revoke all on function public.set_gestor_check(uuid, boolean) from public;
grant execute on function public.set_gestor_check(uuid, boolean) to authenticated;

-- Al liberar el mes las casillas se limpian: cumplieron su función, y
-- dejarlas puestas haría que un mes ya liberado siguiera mostrando
-- confirmaciones de una preparación que ya terminó. Si el mes vuelve a
-- preparación más adelante, arranca en blanco.
create or replace function public.tg_month_clear_gestor_checks()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.released_at is not null and old.released_at is null then
    delete from public.month_gestor_checks where month_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists month_clear_gestor_checks on public.months;
create trigger month_clear_gestor_checks
  after update on public.months
  for each row execute function public.tg_month_clear_gestor_checks();

-- ---------------------------------------------------------------------------
-- 3. Se retira el mecanismo viejo (marca única) — reemplazado, no una
--    segunda vía en paralelo.
-- ---------------------------------------------------------------------------
drop trigger if exists month_clear_planning_ready on public.months;
drop function if exists public.tg_month_clear_planning_ready();
drop function if exists public.set_planning_ready(uuid, boolean);

alter table public.months
  drop column if exists planning_ready_at,
  drop column if exists planning_ready_by;

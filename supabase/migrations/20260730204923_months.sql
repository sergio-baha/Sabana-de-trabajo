-- months: cada mes es una planificación independiente. Personas y proyectos
-- están "scoped" por mes (ver 0004/0005) y se duplican al crear un mes desde
-- otro (ver rpc_create_month_from_previous), en vez de ser catálogos globales.
create table public.months (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  status public.month_status not null default 'abierto',
  default_hours smallint not null default 160,
  working_days smallint,
  notes text,
  source_month_id uuid references public.months (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index months_status_idx on public.months (status);

create trigger set_updated_at
  before update on public.months
  for each row execute function public.tg_set_updated_at();

alter table public.months enable row level security;

revoke all on public.months from anon;
grant select, insert, update, delete on public.months to authenticated;

-- true si el mes no está 'abierto' (bloquea ediciones de Gestor, no de Admin).
create or replace function public.is_month_locked(p_month_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select status <> 'abierto' from public.months where id = p_month_id),
    false
  );
$$;

-- Predicado compartido por people/projects/project_managers/tasks/allocations:
-- Admin siempre puede escribir; Gestor solo si el mes sigue abierto.
create or replace function public.can_write_month(p_month_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin()
    or (public.is_gestor_or_admin() and not public.is_month_locked(p_month_id));
$$;

-- Gestor puede abrir/cerrar; solo Admin puede archivar o restaurar desde archivado.
create or replace function public.guard_month_status_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'archivado' or old.status = 'archivado' then
      if not public.is_admin() then
        raise exception 'Solo un administrador puede archivar o restaurar un mes';
      end if;
    elsif not public.is_gestor_or_admin() then
      raise exception 'No tiene permisos para cambiar el estado del mes';
    end if;
  end if;
  return new;
end;
$$;

create trigger guard_month_status_transition
  before update on public.months
  for each row execute function public.guard_month_status_transition();

create policy "months_select_authenticated" on public.months
  for select to authenticated using (true);

create policy "months_insert_gestor_admin" on public.months
  for insert to authenticated with check (public.is_gestor_or_admin());

create policy "months_update_gestor_admin" on public.months
  for update to authenticated
  using (public.is_gestor_or_admin())
  with check (public.is_gestor_or_admin());

create policy "months_delete_admin" on public.months
  for delete to authenticated using (public.is_admin());

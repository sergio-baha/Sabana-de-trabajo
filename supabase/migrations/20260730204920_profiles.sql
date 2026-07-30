-- profiles: extiende auth.users con rol de aplicación.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  full_name text not null,
  role public.app_role not null default 'analista',
  is_active boolean not null default true,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_role_idx on public.profiles (role);

create trigger set_updated_at
  before update on public.profiles
  for each row execute function public.tg_set_updated_at();

alter table public.profiles enable row level security;

revoke all on public.profiles from anon;
grant select, update on public.profiles to authenticated;

-- Funciones security definer usadas por las políticas RLS de todo el esquema.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'administrador' and is_active
  );
$$;

create or replace function public.is_gestor_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('administrador', 'gestor') and is_active
  );
$$;

-- Crea automáticamente el perfil al registrarse un usuario en auth.users.
-- El rol SIEMPRE se crea como 'analista', sin importar qué venga en
-- raw_user_meta_data: el rol es dato sensible y el payload de metadata es
-- controlado por quien se registra, así que nunca se confía en él para
-- asignar privilegios. La promoción de rol solo ocurre después, vía UPDATE
-- de un administrador o vía el Edge Function de invitación (con
-- service_role, que sí puede fijar el rol tras crear la cuenta).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1)),
    'analista'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Bloquea que un usuario no-administrador se auto-escale rol o reactive su
-- propia cuenta. auth.uid() es null en contextos de servicio (service_role,
-- migraciones), donde no aplica esta restricción.
create or replace function public.guard_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if (new.role is distinct from old.role or new.is_active is distinct from old.is_active)
     and not public.is_admin() then
    raise exception 'Solo un administrador puede modificar el rol o el estado de una cuenta';
  end if;

  return new;
end;
$$;

create trigger guard_profile_privileged_columns
  before update on public.profiles
  for each row execute function public.guard_profile_privileged_columns();

create policy "profiles_select_authenticated" on public.profiles
  for select to authenticated using (true);

create policy "profiles_update_self_or_admin" on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

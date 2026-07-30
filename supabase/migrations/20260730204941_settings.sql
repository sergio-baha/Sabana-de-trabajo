-- settings: singleton global (una sola empresa, ver ambigüedad #11 del plan).
create table public.settings (
  id smallint primary key default 1,
  company_name text not null default 'Mi Empresa',
  logo_url text,
  default_hours smallint not null default 160,
  default_hours_options smallint[] not null default '{160,168,176,184}',
  default_working_days smallint not null default 22,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint settings_singleton check (id = 1)
);

insert into public.settings (id) values (1);

create trigger set_updated_at
  before update on public.settings
  for each row execute function public.tg_set_updated_at();

alter table public.settings enable row level security;

revoke all on public.settings from anon;
grant select, update on public.settings to authenticated;

create policy "settings_select_authenticated" on public.settings
  for select to authenticated using (true);

create policy "settings_update_admin" on public.settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

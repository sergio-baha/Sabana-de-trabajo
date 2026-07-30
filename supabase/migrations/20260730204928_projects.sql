-- projects: scoped por mes, igual que people (ver 0003/0004).
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  month_id uuid not null references public.months (id) on delete cascade,
  name text not null,
  color text not null default '#3A5BA7',
  status public.project_status not null default 'activo',
  description text,
  cloned_from_id uuid references public.projects (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index projects_month_idx on public.projects (month_id);
create index projects_month_status_idx on public.projects (month_id, status);

create trigger set_updated_at
  before update on public.projects
  for each row execute function public.tg_set_updated_at();

alter table public.projects enable row level security;

revoke all on public.projects from anon;
grant select, insert, update, delete on public.projects to authenticated;

create policy "projects_select_authenticated" on public.projects
  for select to authenticated using (true);

create policy "projects_insert_write" on public.projects
  for insert to authenticated with check (public.can_write_month(month_id));

create policy "projects_update_write" on public.projects
  for update to authenticated
  using (public.can_write_month(month_id))
  with check (public.can_write_month(month_id));

create policy "projects_delete_write" on public.projects
  for delete to authenticated using (public.can_write_month(month_id));

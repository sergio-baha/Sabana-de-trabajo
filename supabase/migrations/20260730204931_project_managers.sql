-- project_managers: el "gerente responsable" de un proyecto es una fila más
-- del roster (people), no necesariamente un usuario del sistema — así los
-- reportes por gerente funcionan aunque el gerente no tenga cuenta propia.
create table public.project_managers (
  id uuid primary key default gen_random_uuid(),
  month_id uuid not null references public.months (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete cascade,
  is_primary boolean not null default true,
  created_at timestamptz not null default now(),
  unique (project_id, person_id)
);

create index project_managers_month_idx on public.project_managers (month_id);
create index project_managers_project_idx on public.project_managers (project_id);
create index project_managers_person_idx on public.project_managers (person_id);

alter table public.project_managers enable row level security;

revoke all on public.project_managers from anon;
grant select, insert, update, delete on public.project_managers to authenticated;

create policy "project_managers_select_authenticated" on public.project_managers
  for select to authenticated using (true);

create policy "project_managers_insert_write" on public.project_managers
  for insert to authenticated with check (public.can_write_month(month_id));

create policy "project_managers_update_write" on public.project_managers
  for update to authenticated
  using (public.can_write_month(month_id))
  with check (public.can_write_month(month_id));

create policy "project_managers_delete_write" on public.project_managers
  for delete to authenticated using (public.can_write_month(month_id));

-- people: roster de un mes concreto (no es un catálogo global, ver 0003).
create table public.people (
  id uuid primary key default gen_random_uuid(),
  month_id uuid not null references public.months (id) on delete cascade,
  name text not null,
  job_title text,
  available_hours numeric(6, 2) not null default 0 check (available_hours >= 0),
  status public.person_status not null default 'activo',
  notes text,
  cloned_from_id uuid references public.people (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index people_month_idx on public.people (month_id);
create index people_month_status_idx on public.people (month_id, status);

create trigger set_updated_at
  before update on public.people
  for each row execute function public.tg_set_updated_at();

alter table public.people enable row level security;

revoke all on public.people from anon;
grant select, insert, update, delete on public.people to authenticated;

create policy "people_select_authenticated" on public.people
  for select to authenticated using (true);

create policy "people_insert_write" on public.people
  for insert to authenticated with check (public.can_write_month(month_id));

create policy "people_update_write" on public.people
  for update to authenticated
  using (public.can_write_month(month_id))
  with check (public.can_write_month(month_id));

create policy "people_delete_write" on public.people
  for delete to authenticated using (public.can_write_month(month_id));

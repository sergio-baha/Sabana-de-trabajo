-- allocations: la celda de la grilla persona × proyecto = horas asignadas.
create table public.allocations (
  id uuid primary key default gen_random_uuid(),
  month_id uuid not null references public.months (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  hours numeric(6, 2) not null default 0 check (hours >= 0),
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (month_id, person_id, project_id)
);

create index allocations_month_idx on public.allocations (month_id);
create index allocations_person_idx on public.allocations (person_id);
create index allocations_project_idx on public.allocations (project_id);

create trigger set_updated_at
  before update on public.allocations
  for each row execute function public.tg_set_updated_at();

create or replace function public.tg_set_updated_by()
returns trigger
language plpgsql
as $$
begin
  new.updated_by = auth.uid();
  return new;
end;
$$;

create trigger set_updated_by
  before insert or update on public.allocations
  for each row execute function public.tg_set_updated_by();

alter table public.allocations enable row level security;

revoke all on public.allocations from anon;
grant select, insert, update, delete on public.allocations to authenticated;

create policy "allocations_select_authenticated" on public.allocations
  for select to authenticated using (true);

create policy "allocations_insert_write" on public.allocations
  for insert to authenticated with check (public.can_write_month(month_id));

create policy "allocations_update_write" on public.allocations
  for update to authenticated
  using (public.can_write_month(month_id))
  with check (public.can_write_month(month_id));

create policy "allocations_delete_write" on public.allocations
  for delete to authenticated using (public.can_write_month(month_id));

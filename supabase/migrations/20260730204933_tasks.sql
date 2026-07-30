-- tasks: seguimiento ligero de tareas por proyecto (lo que el Gestor "puede
-- crear" además de horas). No participa en el cálculo de horas asignadas.
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  month_id uuid not null references public.months (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null,
  description text,
  status public.task_status not null default 'pendiente',
  assigned_person_id uuid references public.people (id) on delete set null,
  due_date date,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tasks_month_idx on public.tasks (month_id);
create index tasks_project_idx on public.tasks (project_id);

create trigger set_updated_at
  before update on public.tasks
  for each row execute function public.tg_set_updated_at();

alter table public.tasks enable row level security;

revoke all on public.tasks from anon;
grant select, insert, update, delete on public.tasks to authenticated;

create policy "tasks_select_authenticated" on public.tasks
  for select to authenticated using (true);

create policy "tasks_insert_write" on public.tasks
  for insert to authenticated with check (public.can_write_month(month_id));

create policy "tasks_update_write" on public.tasks
  for update to authenticated
  using (public.can_write_month(month_id))
  with check (public.can_write_month(month_id));

create policy "tasks_delete_write" on public.tasks
  for delete to authenticated using (public.can_write_month(month_id));

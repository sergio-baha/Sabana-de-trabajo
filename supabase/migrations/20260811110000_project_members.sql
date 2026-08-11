-- project_members: quién trabaja en un proyecto, aparte de quién lo
-- gestiona. `project_managers` ya cubre el "responsable" (una fila del
-- roster, no necesariamente un usuario); esta tabla es la lista de
-- colaboradores del proyecto — cualquier persona del roster, cualquier rol —
-- para que asignarle una tarea de ese proyecto sea elegir de una lista corta
-- en vez de buscar entre todo el mes.
--
-- Deliberadamente sin efecto en RLS de `tasks`/`allocations`: ser miembro no
-- amplía lo que alguien ve o escribe (eso lo sigue decidiendo
-- assigned_person_id vía is_own_person, como hoy). Es una lista de
-- pertenencia, no un permiso nuevo.
create table public.project_members (
  id uuid primary key default gen_random_uuid(),
  month_id uuid not null references public.months (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (project_id, person_id)
);

create index project_members_month_idx on public.project_members (month_id);
create index project_members_project_idx on public.project_members (project_id);
create index project_members_person_idx on public.project_members (person_id);

alter table public.project_members enable row level security;

revoke all on public.project_members from anon;
grant select, insert, update, delete on public.project_members to authenticated;

create policy "project_members_select_authenticated" on public.project_members
  for select to authenticated using (true);

-- Mismo criterio que crear el proyecto en sí (*_analyst_task_and_project_
-- creation.sql): gestor/admin siempre, o cualquier analista mientras el mes
-- siga abierto. No se exige ser el creador del proyecto — es la misma
-- válvula de escape que ya existe para crear proyectos y tareas, aplicada a
-- gestionar sus colaboradores.
create policy "project_members_insert_write" on public.project_members
  for insert to authenticated
  with check (
    public.can_write_month(month_id)
    or (public.is_analista_role() and not public.is_month_locked(month_id))
  );

create policy "project_members_delete_write" on public.project_members
  for delete to authenticated
  using (
    public.can_write_month(month_id)
    or (public.is_analista_role() and not public.is_month_locked(month_id))
  );

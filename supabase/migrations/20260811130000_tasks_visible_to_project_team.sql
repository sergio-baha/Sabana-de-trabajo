-- Ser miembro o gerente de un proyecto (project_members/project_managers)
-- ahora también da acceso a TODAS sus tareas del mes, no solo a las propias
-- — hasta ahora un analista agregado a un proyecto no veía nada si no tenía
-- una tarea asignada a él mismo, lo que dejaba la lista de "Equipo" sin
-- ningún efecto práctico. Sigue sin ver tareas de proyectos de los que no
-- es parte: el criterio de acceso es el proyecto, no el rol en general.
create or replace function public.is_project_team_member(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.people pe
    where pe.profile_id = auth.uid()
      and (
        exists (
          select 1 from public.project_members mem
          where mem.project_id = p_project_id and mem.person_id = pe.id
        )
        or exists (
          select 1 from public.project_managers mgr
          where mgr.project_id = p_project_id and mgr.person_id = pe.id
        )
      )
  );
$$;

revoke all on function public.is_project_team_member(uuid) from public;
grant execute on function public.is_project_team_member(uuid) to authenticated;

-- Lectura: se agrega la tercera vía, además de "no soy analista acotado" y
-- "es mía".
drop policy "tasks_select_scoped" on public.tasks;

create policy "tasks_select_scoped" on public.tasks
  for select to authenticated
  using (
    not public.is_analista_role()
    or public.is_own_person(assigned_person_id)
    or public.is_project_team_member(project_id)
  );

-- Escritura: un miembro del equipo puede crear/editar/borrar cualquier
-- tarea del proyecto (asignársela a un compañero incluido), no solo la
-- suya — es justo lo que la UI de "Gestionar equipo" ya asumía que podía
-- hacer.
drop policy "tasks_insert_write" on public.tasks;
drop policy "tasks_update_write" on public.tasks;
drop policy "tasks_delete_write" on public.tasks;

create policy "tasks_insert_write" on public.tasks
  for insert to authenticated
  with check (
    public.can_write_month(month_id)
    or public.can_write_own_work(month_id, assigned_person_id)
    or (
      public.is_analista_role()
      and not public.is_month_locked(month_id)
      and public.is_project_team_member(project_id)
    )
  );

create policy "tasks_update_write" on public.tasks
  for update to authenticated
  using (
    public.can_write_month(month_id)
    or public.can_write_own_work(month_id, assigned_person_id)
    or (
      public.is_analista_role()
      and not public.is_month_locked(month_id)
      and public.is_project_team_member(project_id)
    )
  )
  with check (
    public.can_write_month(month_id)
    or public.can_write_own_work(month_id, assigned_person_id)
    or (
      public.is_analista_role()
      and not public.is_month_locked(month_id)
      and public.is_project_team_member(project_id)
    )
  );

create policy "tasks_delete_write" on public.tasks
  for delete to authenticated
  using (
    public.can_write_month(month_id)
    or public.can_write_own_work(month_id, assigned_person_id)
    or (
      public.is_analista_role()
      and not public.is_month_locked(month_id)
      and public.is_project_team_member(project_id)
    )
  );

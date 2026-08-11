-- Corrige una regresión de *_task_assignees.sql: al mover la asignación de
-- `tasks.assigned_person_id` a la tabla `task_assignees`, las políticas de
-- `tasks` quedaron dependiendo SOLO de la pertenencia al proyecto. El
-- razonamiento de entonces ("sin la columna no hay 'es mía' que revisar")
-- estaba mal: la asignación no desapareció, cambió de tabla.
--
-- Efecto real: alguien con ocho tareas asignadas, pero que no figura como
-- miembro ni gerente de esos proyectos, dejó de ver su propio trabajo — que
-- es justo el caso del Analista de Tecnología, cuyo flujo es "solo lo mío"
-- y que nunca se agrega a los equipos.
create or replace function public.is_task_assignee(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.task_assignees ta
    join public.people pe on pe.id = ta.person_id
    where ta.task_id = p_task_id
      and pe.profile_id = auth.uid()
  );
$$;

revoke all on function public.is_task_assignee(uuid) from public;
grant execute on function public.is_task_assignee(uuid) to authenticated;

drop policy "tasks_select_scoped" on public.tasks;
drop policy "tasks_insert_write" on public.tasks;
drop policy "tasks_update_write" on public.tasks;
drop policy "tasks_delete_write" on public.tasks;

-- Lectura: no ser analista acotado, ser del equipo del proyecto, o tener la
-- tarea asignada. La tercera vía es la que se había perdido.
create policy "tasks_select_scoped" on public.tasks
  for select to authenticated
  using (
    not public.is_analista_role()
    or public.is_project_team_member(project_id)
    or public.is_task_assignee(id)
  );

-- Alta: al insertar todavía no hay filas en task_assignees (se crean justo
-- después), así que no se puede exigir "asignada a mí" acá. Se recupera el
-- criterio previo a la migración: un analista puede crear trabajo mientras
-- el mes siga abierto — el mismo permiso que ya tiene para crear proyectos.
create policy "tasks_insert_write" on public.tasks
  for insert to authenticated
  with check (
    public.can_write_month(month_id)
    or (public.is_analista_role() and not public.is_month_locked(month_id))
  );

-- Edición y borrado: además del equipo del proyecto, quien la tenga
-- asignada. Sin esto podría ver su tarea pero no moverla de columna.
create policy "tasks_update_write" on public.tasks
  for update to authenticated
  using (
    public.can_write_month(month_id)
    or (
      public.is_analista_role()
      and not public.is_month_locked(month_id)
      and (public.is_project_team_member(project_id) or public.is_task_assignee(id))
    )
  )
  with check (
    public.can_write_month(month_id)
    or (
      public.is_analista_role()
      and not public.is_month_locked(month_id)
      and (public.is_project_team_member(project_id) or public.is_task_assignee(id))
    )
  );

create policy "tasks_delete_write" on public.tasks
  for delete to authenticated
  using (
    public.can_write_month(month_id)
    or (
      public.is_analista_role()
      and not public.is_month_locked(month_id)
      and (public.is_project_team_member(project_id) or public.is_task_assignee(id))
    )
  );

-- task_assignees seguía el mismo criterio que `tasks`, así que arrastraba el
-- mismo hueco: quien tiene la tarea asignada debe poder tocar la lista de
-- asignados (sumar a un compañero, o quitarse a sí mismo).
drop policy "task_assignees_insert_write" on public.task_assignees;
drop policy "task_assignees_delete_write" on public.task_assignees;

-- El alta NO puede exigir "ya eres del equipo o ya estás asignado": al
-- crear una tarea, el primer asignado se inserta cuando la lista todavía
-- está vacía, así que esa condición se rechazaría a sí misma y nadie podría
-- asignarse su propia tarea recién creada. Se replica el criterio de
-- tasks_insert_write, que ya deja a un analista crear trabajo con el mes
-- abierto: ser más estricto acá no protegería nada que la otra política no
-- permita igual.
create policy "task_assignees_insert_write" on public.task_assignees
  for insert to authenticated
  with check (
    exists (
      select 1 from public.tasks t
      where t.id = task_assignees.task_id
        and (
          public.can_write_month(t.month_id)
          or (public.is_analista_role() and not public.is_month_locked(t.month_id))
        )
    )
  );

create policy "task_assignees_delete_write" on public.task_assignees
  for delete to authenticated
  using (
    exists (
      select 1 from public.tasks t
      where t.id = task_assignees.task_id
        and (
          public.can_write_month(t.month_id)
          or (
            public.is_analista_role()
            and not public.is_month_locked(t.month_id)
            and (public.is_project_team_member(t.project_id) or public.is_task_assignee(t.id))
          )
        )
    )
  );

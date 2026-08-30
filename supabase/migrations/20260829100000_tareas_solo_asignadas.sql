-- Revierte la visibilidad "todo el proyecto" que se agregó en
-- *_task_creator_can_see.sql para que la vista "Gestionar equipo" tuviera
-- sentido. Decisión explícita del usuario: prefiere que ambos roles de
-- analista (Analista y Analista de Tecnología) vean y puedan tocar
-- únicamente lo que tienen asignado (task_assignees) o lo que ellos mismos
-- crearon, aunque eso deje "Gestionar equipo" sin poder mostrar/editar
-- tareas de compañeros para estos roles.
--
-- Se quita is_project_team_member() de las cuatro políticas de tasks
-- (select/insert/update/delete) para que lectura y escritura queden
-- consistentes entre sí — dejar la escritura abierta a "todo el proyecto"
-- mientras la lectura se acota habría permitido editar a ciegas tareas que
-- ya no se pueden ver.
--
-- NO se usa can_write_own_work(month_id, assigned_person_id): esa columna
-- se borró en *_task_assignees.sql al pasar a task_assignees (una tarea
-- puede tener varios asignados). El criterio "es mía" ahora es
-- is_task_assignee(id), igual que ya usa la política de lectura vigente.
-- Al crear una tarea todavía no hay filas en task_assignees para su id, así
-- que el INSERT se autoriza por ser quien la crea (created_by, que ya tiene
-- default auth.uid() desde *_task_creator_can_see.sql).

drop policy "tasks_select_scoped" on public.tasks;
drop policy "tasks_insert_write" on public.tasks;
drop policy "tasks_update_write" on public.tasks;
drop policy "tasks_delete_write" on public.tasks;

create policy "tasks_select_scoped" on public.tasks
  for select to authenticated
  using (
    not public.is_analista_role()
    or (
      public.is_month_released(month_id)
      and (
        public.is_task_assignee(id)
        or created_by = auth.uid()
      )
    )
  );

create policy "tasks_insert_write" on public.tasks
  for insert to authenticated
  with check (
    public.can_write_month(month_id)
    or (
      public.is_analista_role()
      and not public.is_month_locked(month_id)
      and created_by = auth.uid()
    )
  );

create policy "tasks_update_write" on public.tasks
  for update to authenticated
  using (
    public.can_write_month(month_id)
    or (
      public.is_analista_role()
      and not public.is_month_locked(month_id)
      and (public.is_task_assignee(id) or created_by = auth.uid())
    )
  )
  with check (
    public.can_write_month(month_id)
    or (
      public.is_analista_role()
      and not public.is_month_locked(month_id)
      and (public.is_task_assignee(id) or created_by = auth.uid())
    )
  );

create policy "tasks_delete_write" on public.tasks
  for delete to authenticated using (
    public.can_write_month(month_id)
    or (
      public.is_analista_role()
      and not public.is_month_locked(month_id)
      and (public.is_task_assignee(id) or created_by = auth.uid())
    )
  );

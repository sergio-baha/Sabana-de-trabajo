-- Las tareas dejan de depender del estado del mes.
--
-- Cerrar o archivar un mes existe para congelar la CONTABILIDAD: las horas
-- repartidas en la grilla y las actividades registradas contra ellas. Eso
-- sigue igual. Pero arrastrar esa regla hasta las tareas producía algo que
-- nadie quería: al cerrar el mes, una persona ya no podía mover su tarjeta
-- ni marcar terminado su propio trabajo, aunque el trabajo siguiera vivo.
--
-- El trabajo no se acaba porque se cierre un período contable. A partir de
-- acá, `tasks` y `task_assignees` se rigen solo por rol y pertenencia al
-- proyecto; `allocations` y `activities` conservan intacto el candado.
drop policy "tasks_insert_write" on public.tasks;
drop policy "tasks_update_write" on public.tasks;
drop policy "tasks_delete_write" on public.tasks;

-- Alta: al insertar todavía no hay asignados ni forma de saber si la tarea
-- "es suya", así que se mantiene el criterio amplio que ya existía —
-- equivalente al de crear proyectos— pero sin la condición del mes.
create policy "tasks_insert_write" on public.tasks
  for insert to authenticated
  with check (public.is_gestor_or_admin() or public.is_analista_role());

create policy "tasks_update_write" on public.tasks
  for update to authenticated
  using (
    public.is_gestor_or_admin()
    or (
      public.is_analista_role()
      and (public.is_project_team_member(project_id) or public.is_task_assignee(id))
    )
  )
  with check (
    public.is_gestor_or_admin()
    or (
      public.is_analista_role()
      and (public.is_project_team_member(project_id) or public.is_task_assignee(id))
    )
  );

create policy "tasks_delete_write" on public.tasks
  for delete to authenticated
  using (
    public.is_gestor_or_admin()
    or (
      public.is_analista_role()
      and (public.is_project_team_member(project_id) or public.is_task_assignee(id))
    )
  );

-- La lista de asignados acompaña a la tarea: si la tarea se puede tocar en
-- un mes cerrado, su lista de responsables también.
drop policy "task_assignees_insert_write" on public.task_assignees;
drop policy "task_assignees_delete_write" on public.task_assignees;

create policy "task_assignees_insert_write" on public.task_assignees
  for insert to authenticated
  with check (
    exists (
      select 1 from public.tasks t
      where t.id = task_assignees.task_id
        and (public.is_gestor_or_admin() or public.is_analista_role())
    )
  );

create policy "task_assignees_delete_write" on public.task_assignees
  for delete to authenticated
  using (
    exists (
      select 1 from public.tasks t
      where t.id = task_assignees.task_id
        and (
          public.is_gestor_or_admin()
          or (
            public.is_analista_role()
            and (public.is_project_team_member(t.project_id) or public.is_task_assignee(t.id))
          )
        )
    )
  );

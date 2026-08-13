-- Quién puede borrar una tarea.
--
-- Antes: Gestor y Administrador borraban cualquier tarea del mes, y un
-- Analista podía borrar cualquiera que tuviera asignada — incluida la que le
-- encargó su gestor, que es justo la que no debería poder desaparecer.
--
-- Ahora manda la autoría, con el alcance del rol encima:
--   · Analista → solo lo que él creó.
--   · Gestor   → lo que él creó y lo de los proyectos que gerencia.
--   · Admin    → cualquiera.
--
-- Tener la tarea asignada deja de habilitar el borrado: se entrega o se
-- comenta, no se hace desaparecer.
drop policy "tasks_delete_write" on public.tasks;

create policy "tasks_delete_write" on public.tasks
  for delete to authenticated
  using (
    public.is_admin()
    -- Lo que uno creó es suyo, sea gestor o analista.
    or created_by = auth.uid()
    -- El gestor manda en sus proyectos, los haya creado él o no.
    or (not public.is_analista_role() and public.is_project_manager(project_id))
  );

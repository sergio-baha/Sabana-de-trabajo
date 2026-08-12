-- Corrige un bloqueo al CREAR tareas: "new row violates row-level security
-- policy for table tasks".
--
-- El diagnóstico obvio era el WITH CHECK del INSERT, y era falso. Se
-- reprodujo contra la base y el resultado fue claro:
--   INSERT sin RETURNING  -> OK
--   INSERT ... RETURNING  -> falla
--
-- Postgres aplica la política de SELECT también a la fila que devuelve
-- RETURNING, y usa EL MISMO mensaje de error para los dos casos, que es lo
-- que despista. El cliente (PostgREST) siempre pide la fila de vuelta para
-- devolver el id, así que siempre pasa por ahí.
--
-- El problema de fondo es un círculo: un Analista crea una tarea en un
-- proyecto donde no es miembro; en ese instante la tarea todavía no tiene
-- asignados (se agregan justo después, con el id que devuelve el insert),
-- así que no cumple ninguna de las vías de visibilidad y se vuelve invisible
-- para su propio autor. La transacción entera se revierte.
--
-- Solución: quien crea una tarea puede verla. Es coherente por sí mismo
-- —nadie debería perder de vista algo que acaba de crear— y rompe el
-- círculo sin abrir el acceso a nadie más.

-- `created_by` existía pero nadie lo llenaba: la app no lo envía y la
-- columna no tenía valor por defecto, así que estaba en null en todas las
-- filas. Sin esto, "yo la creé" no se puede evaluar.
alter table public.tasks
  alter column created_by set default auth.uid();

drop policy "tasks_select_scoped" on public.tasks;

create policy "tasks_select_scoped" on public.tasks
  for select to authenticated
  using (
    not public.is_analista_role()
    or public.is_project_team_member(project_id)
    or public.is_task_assignee(id)
    or created_by = auth.uid()
  );

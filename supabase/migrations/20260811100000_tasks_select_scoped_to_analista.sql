-- tasks_select_scoped acotaba la lectura solo para el Analista de
-- Tecnología (is_analista_tecnologia). El Analista (a secas) ya estaba
-- acotado en escritura desde *_analyst_task_and_project_creation.sql
-- (can_write_own_work usa is_analista_role, que cubre ambos roles), pero en
-- lectura seguía viendo el tablero completo: podía ver tarjetas de todo el
-- equipo aunque solo pudiera tocar las suyas. Se cierra ese hueco con el
-- mismo helper que ya usa la escritura, is_analista_role(), para que los dos
-- roles de analista queden equivalentes en Tareas — que es la única
-- diferencia pendiente, según *_analyst_task_and_project_creation.sql.
drop policy "tasks_select_scoped" on public.tasks;

create policy "tasks_select_scoped" on public.tasks
  for select to authenticated
  using (
    not public.is_analista_role()
    or public.is_own_person(assigned_person_id)
  );

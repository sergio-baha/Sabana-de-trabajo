-- Segunda parte del arreglo de "Aprobar" (la primera, *_fix_aprobar_revision.sql
-- y *_revisor_cualquier_rol_puede_escribir.sql, solo tocó ESCRITURA).
--
-- Postgres revisa el WITH CHECK de UPDATE, pero cuando el cliente pide la
-- fila de vuelta (`.select()` después del update — PostgREST siempre lo
-- hace), esa fila se vuelve a filtrar por la política de SELECT. Si no pasa,
-- Postgres deshace el UPDATE ENTERO y lanza el mismo "new row violates
-- row-level security policy" — el mismo mecanismo que ya se documentó en
-- *_task_creator_can_see.sql para el INSERT ("INSERT sin RETURNING -> OK,
-- INSERT ... RETURNING -> falla").
--
-- El trigger del circuito limpia `current_reviewer_person_id` apenas la
-- tarea sale de 'en_revision' (correcto: nadie "tiene la revisión" ya). El
-- problema es que quien acaba de revisarla —si no es además la asignada, la
-- creadora o gerente de ESE proyecto puntual— se queda sin ninguna vía para
-- verla en tasks_select_scoped, y esa relectura forzada tumba el cambio
-- completo. Le pasa a CUALQUIER revisor (Analista incluido, no solo a
-- roles como Coordinador): basta con que no sea también asignado/creador.
--
-- Arreglo: se agrega `reviewed_by = auth.uid()` a tasks_select_scoped,
-- igual que ya se hizo en tasks_update_write — el trigger sella
-- `reviewed_by` en la misma transacción, así que quien acaba de cerrar o
-- devolver una revisión conserva la vista de esa fila.

drop policy if exists "tasks_select_scoped" on public.tasks;

create policy "tasks_select_scoped" on public.tasks
  for select to authenticated
  using (
    public.is_admin()
    or (
      not public.is_analista_role()
      and (
        public.is_project_manager(project_id)
        or created_by = auth.uid()
        or public.is_task_assignee(id)
        or public.is_own_person(current_reviewer_person_id)
        or reviewed_by = auth.uid()
      )
    )
    or (
      public.is_analista_role()
      and public.is_month_released(month_id)
      and (
        public.is_task_assignee(id)
        or created_by = auth.uid()
        or public.is_own_person(current_reviewer_person_id)
        or reviewed_by = auth.uid()
      )
    )
  );

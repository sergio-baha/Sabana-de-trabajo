-- Corrige "No se pudo actualizar la tarea — new row violates row-level
-- security policy" al hacer clic en "Aprobar".
--
-- La causa: tg_task_review_flow (ver *_revisor_elegido.sql) limpia
-- `current_reviewer_person_id` (lo deja en null) apenas la tarea sale de
-- 'en_revision' — es correcto, nadie "tiene la revisión" una vez cerrada.
-- El problema es de ORDEN: en un UPDATE, Postgres corre primero los
-- triggers BEFORE ROW (que modifican `new.*`) y RECIÉN DESPUÉS evalúa el
-- WITH CHECK de la política RLS, contra esa fila YA MODIFICADA — no contra
-- la que el cliente mandó. La política de tasks_update_write exigía
-- `is_own_person(current_reviewer_person_id)` para que un Analista pudiera
-- escribir la fila; como el trigger ya la dejó en null, el WITH CHECK
-- rechazaba la escritura aunque el trigger, mirando el valor ANTERIOR (con
-- acceso a OLD, que RLS no tiene), ya había autorizado la transición
-- correctamente.
--
-- Arreglo: se agrega `reviewed_by = auth.uid()` como vía adicional del WITH
-- CHECK (no de USING). El trigger sella `reviewed_by := auth.uid()`
-- exactamente en esa misma transición (salir de 'en_revision'), y SOLO
-- después de que su propia comprobación de autorización (is_admin /
-- is_project_manager / is_own_person(OLD.current_reviewer_person_id)) ya
-- pasó — si no pasó, el trigger lanza una excepción antes de que el WITH
-- CHECK llegue a evaluarse. No se toca USING: quién puede intentar tocar la
-- fila sigue dependiendo únicamente de la relación con el estado ANTERIOR.

drop policy if exists "tasks_update_write" on public.tasks;

create policy "tasks_update_write" on public.tasks
  for update to authenticated
  using (
    public.can_write_month(month_id)
    or (
      public.is_analista_role()
      and not public.is_month_locked(month_id)
      and (
        public.is_task_assignee(id)
        or created_by = auth.uid()
        or public.is_own_person(current_reviewer_person_id)
      )
    )
  )
  with check (
    public.can_write_month(month_id)
    or (
      public.is_analista_role()
      and not public.is_month_locked(month_id)
      and (
        public.is_task_assignee(id)
        or created_by = auth.uid()
        or public.is_own_person(current_reviewer_person_id)
        or reviewed_by = auth.uid()
      )
    )
  );

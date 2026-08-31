-- El selector de revisor (ver *_revisor_elegido.sql) muestra TODO el
-- roster, sin importar el rol de cuenta — ya no está acotado a Gestor o al
-- equipo del proyecto. Pero tasks_update_write solo tenía dos vías de
-- escritura: Gestor/Administrador (can_write_month) o Analista actuando
-- sobre lo suyo (is_analista_role). A alguien con OTRO rol de cuenta
-- (Coordinador, Estratega) elegido como revisor, esa tarea le aparecía en
-- su tablero y podía ABRIRLA (tasks_select_scoped sí lo cubre, tiene su
-- propia rama para "no soy analista"), pero al hacer clic en "Aprobar" /
-- "Devolver" / "Reasignar" chocaba con "new row violates row-level
-- security policy" — ninguna de las dos vías de escritura lo cubría.
--
-- Se agrega una tercera vía, sin importar el rol: si sos el revisor actual
-- (o si el trigger acaba de sellarte como reviewed_by, mismo caso que
-- *_fix_aprobar_revision.sql) y el mes no está cerrado, podés escribir la
-- fila. No depende de is_month_released: eso es una barrera de VISIBILIDAD
-- para el rol Analista durante la preparación del mes, no aplica a
-- escritura ni a otros roles.

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
    or (
      not public.is_month_locked(month_id)
      and public.is_own_person(current_reviewer_person_id)
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
    or (
      not public.is_month_locked(month_id)
      and (public.is_own_person(current_reviewer_person_id) or reviewed_by = auth.uid())
    )
  );

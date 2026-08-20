-- `task_assignees` entra al historial.
--
-- Cuando se perdieron 68 tarjetas al borrar dos meses (mes → proyectos →
-- tareas, todo en cadena), `audit_logs` permitió recuperarlas enteras:
-- título, estado, fechas, fase, horas estimadas. Todo menos lo único que
-- hacía falta para devolverlas a su dueño — de quién era cada una.
--
-- La razón: hasta *_task_assignees.sql el responsable era una columna de la
-- propia tarea (`tasks.assigned_person_id`), y por eso viajaba dentro de la
-- fila auditada. Al pasar a varios responsables por tarea, el dato se mudó a
-- una tabla puente que nadie auditó, y desde entonces el historial guardaba
-- la tarjeta pero no a quién le pertenecía. Se notó justo cuando se necesitó.
--
-- El trigger es el genérico de *_audit_logs.sql, que sirve tal cual:
-- `task_assignees` tiene `id` y `month_id`, que es todo lo que lee.
--
-- Un efecto secundario que vale la pena: como estas filas se borran por
-- cascade al borrar una tarea, una persona o un mes, el historial va a
-- registrar también esas desasignaciones indirectas — que son precisamente
-- las que nadie ve venir.
-- Reejecutable a propósito: estas migraciones se han tenido que pegar a mano
-- en el SQL Editor cuando el CLI no tenía sesión, y ahí es fácil correr dos
-- veces la misma. Sin el drop previo, el segundo intento aborta con 42710.
drop trigger if exists audit_task_assignees on public.task_assignees;

create trigger audit_task_assignees
  after insert or update or delete on public.task_assignees
  for each row execute function public.audit_row_change();

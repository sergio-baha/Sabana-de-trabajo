-- Borrar una actividad dejaba de funcionar cuando su tarjeta seguía intacta.
--
-- EL CHOQUE
-- `activity_deletes_task` era un trigger BEFORE DELETE sobre `activities` que
-- borra la tarjeta del tablero. Pero `activities.task_id` apunta a `tasks`
-- con ON DELETE SET NULL (ver *_actividad_genera_tarea.sql), así que borrar
-- la tarjeta dispara un UPDATE sobre la MISMA fila de actividad que está en
-- medio de su propio borrado. Postgres corta con:
--
--   ERROR 27000: tuple to be deleted was already modified by an operation
--   triggered by the current command
--
-- Se dispara por los dos caminos que borran una actividad:
--   · borrarla desde el detalle de la celda, y
--   · borrar la asignación que la contiene (la cascada llega a la actividad).
-- En ambos casos solo falla si la tarjeta todavía califica para borrarse
-- —sigue en 'pendiente' y sin comentarios—, que es justo el caso normal de
-- una planeación recién armada que se corrige. Si alguien ya la trabajó, el
-- `delete` interno no encuentra fila, no hay UPDATE de vuelta, y pasa: por
-- eso el fallo parecía intermitente.
--
-- EL ARREGLO
-- Pasarlo a AFTER DELETE, que es lo que sugiere el propio HINT de Postgres.
-- En AFTER la fila de la actividad ya no existe, así que el SET NULL de la
-- llave foránea no tiene a quién tocar y la cadena se corta sola.
--
-- La función no cambia: sigue borrando la tarjeta solo si nadie la trabajó.
-- Devolver `old` en un trigger AFTER es inocuo — el valor se ignora.
--
-- Reejecutable, como *_borrar_mes_no_arrasa_el_tablero.sql.
drop trigger if exists activity_deletes_task on public.activities;

create trigger activity_deletes_task
  after delete on public.activities
  for each row execute function public.tg_activity_deletes_task();

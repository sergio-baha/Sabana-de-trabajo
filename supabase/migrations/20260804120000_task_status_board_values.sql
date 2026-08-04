-- Amplía task_status a las columnas de un tablero tipo Azure DevOps Boards.
-- Los tres valores originales (pendiente/en_progreso/completada) se
-- conservan y mapean a "Por hacer"/"En progreso"/"Completada"; se agregan
-- las dos columnas que faltaban para reflejar el flujo real: una tarea
-- terminada que espera revisión de un gerente, y una tarea detenida por un
-- bloqueo externo.
--
-- Va en su propia migración a propósito: Postgres no permite usar un valor
-- de enum recién agregado (en un default, un check o un insert) dentro de la
-- misma transacción que lo crea. La migración siguiente
-- (*_tasks_board.sql) ya puede usarlos con normalidad.
alter type public.task_status add value if not exists 'en_revision' after 'en_progreso';
alter type public.task_status add value if not exists 'bloqueada' after 'en_revision';

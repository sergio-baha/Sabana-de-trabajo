-- Vuelve a poner Septiembre "en preparación": los Analistas dejan de verlo
-- (mes, tareas, actividades, horas) hasta que se libere de nuevo a mano
-- desde la app (Administrador). Gestor y Administrador lo siguen viendo
-- igual que siempre.
--
-- Se ejecuta UNA VEZ, a mano, por el SQL Editor.
update public.months
set released_at = null
where name = 'Septiembre 1 - 30';

select name, released_at, released_by
from public.months
where name = 'Septiembre 1 - 30';
 
-- Borrar un mes deja de poder vaciar un tablero en silencio.
--
-- Es la operación que más daño ha hecho en esta base: el 11 y el 12 de agosto
-- de 2026 se borraron dos meses y con ellos 68 tarjetas. En ese momento la
-- cadena era mes → proyectos → tareas, porque `projects.month_id` todavía
-- existía y era ON DELETE CASCADE. *_proyecto_durable.sql cortó ese tramo,
-- pero NO el que importa: `tasks.month_id` sigue siendo ON DELETE CASCADE,
-- así que borrar un mes hoy se sigue llevando todas sus tarjetas. El daño es
-- el mismo; solo se acortó el camino.
--
-- Lo que hace destructivo a este borrado no es el volumen, es el silencio:
-- las tarjetas no viven en la pantalla desde donde se borra. El Administrador
-- está en Meses viendo una fila de una tabla; el trabajo que desaparece está
-- en el tablero, en otro módulo, y suele ser de otras personas. Se entera
-- quien lo pierde, días después.
--
-- POR QUÉ UN TRIGGER Y NO CAMBIAR LA LLAVE A RESTRICT:
-- un ON DELETE RESTRICT también frenaría el borrado, pero el error que llega
-- al usuario es el de Postgres, que nombra una restricción y no dice cuántas
-- tarjetas hay ni qué hacer en su lugar. Acá el mensaje puede contar las dos
-- cosas, y esa diferencia es todo el punto.
--
-- POR QUÉ NO SE OFRECE UN "BORRAR IGUAL":
-- porque existe `archivado`, que ya hace lo que de verdad se busca al borrar
-- un mes viejo — sacarlo de en medio — sin destruir nada. Un mes que se
-- quiere borrar de verdad se puede vaciar primero desde el tablero, donde las
-- tarjetas se ven una por una y borrarlas es una decisión consciente.
create or replace function public.tg_month_delete_guard()
returns trigger
language plpgsql
as $$
declare
  v_tareas integer;
begin
  select count(*) into v_tareas from public.tasks where month_id = old.id;

  if v_tareas > 0 then
    raise exception
      'No se puede eliminar el mes "%": tiene % tarjeta(s) en el tablero y se borrarían todas.',
      old.name, v_tareas
      using hint =
        'Archiva el mes para sacarlo de en medio sin perder nada. Si de verdad hay que eliminarlo, borra antes sus tarjetas desde el tablero.';
  end if;

  return old;
end;
$$;

-- Reejecutable, por lo mismo que *_auditar_responsables_de_tarea.sql.
drop trigger if exists month_delete_guard on public.months;

create trigger month_delete_guard
  before delete on public.months
  for each row execute function public.tg_month_delete_guard();

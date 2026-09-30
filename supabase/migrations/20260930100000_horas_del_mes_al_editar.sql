-- Cambiar `months.default_hours` no movía ni una hora de la sábana.
--
-- EL AGUJERO QUE TAPA: `default_hours` solo se leía al NACER el roster de un
-- mes —`seed_month_people` para el mes en blanco (ver
-- *_capacidad_del_mes_nuevo.sql) y `create_month_from_previous` al duplicar
-- (ver *_duplicar_respeta_default_hours.sql)—. Después de eso nadie lo
-- volvía a mirar: la sábana pinta la fila "Disponible" desde
-- `people.available_hours`, persona por persona, y `default_hours` no vuelve
-- a aparecer en toda la aplicación (solo se muestra como número en la tabla
-- de Meses). El resultado es que editar las horas del mes cambiaba una cifra
-- decorativa: el Administrador parametrizaba 168 h, la sábana seguía
-- mostrando las 160 h con las que nació el roster, y no había ninguna forma
-- de cerrar esa distancia salvo reescribir el campo "Disponible" de cada
-- persona a mano.
--
-- POR QUÉ SOLO SE ARREGLA AHORA: las dos migraciones anteriores atacaron el
-- mismo síntoma en el momento de la creación, que era donde dolía primero.
-- Ninguna de las dos se preguntó qué pasa cuando el número se corrige DESPUÉS
-- —y corregirlo después es lo normal: las horas del mes se ajustan cuando ya
-- se sabe cuántos festivos cayeron.
--
-- LO QUE NO SE PISA: una capacidad que ya no es igual al `default_hours`
-- viejo se dejó distinta A PROPÓSITO (vacaciones, medio tiempo, una
-- incorporación a mitad de mes). Propagar sobre esas filas borraría trabajo
-- deliberado del Administrador, y sería peor que el problema que se arregla.
-- Por eso la propagación automática solo alcanza a las filas que seguían en
-- el valor anterior del mes, que son justo las que nadie tocó. Para el caso
-- en que sí se quiera igualar a todo el mundo existe
-- `aplicar_horas_del_mes`, que es explícita y la pide una persona.
create or replace function public.propagar_default_hours()
returns trigger
language plpgsql
-- security definer para que la propagación no dependa de las políticas de
-- `people`: quien llega hasta acá ya pasó por la escritura de `months`, que
-- es exclusiva del Administrador (ver *_meses_solo_admin.sql). Sin esto, un
-- mes cerrado o liberado haría fallar el UPDATE de people y con él la simple
-- edición del nombre del mes.
security definer
set search_path = public
as $$
declare
  v_tocadas integer;
begin
  update public.people
     set available_hours = new.default_hours
   where month_id = new.id
     and available_hours = old.default_hours;

  get diagnostics v_tocadas = row_count;

  -- Queda en el log del servidor y no como excepción: que una persona tenga
  -- una capacidad propia no es un error, y la edición del mes no debe fallar
  -- por eso. El conteo lo devuelve la UI por su cuenta.
  raise notice 'propagar_default_hours: % filas de people actualizadas a % h',
    v_tocadas, new.default_hours;

  return new;
end;
$$;

-- `of default_hours` y no un trigger a secas: editar el nombre o las notas de
-- un mes no tiene por qué recorrer el roster.
drop trigger if exists propagar_default_hours on public.months;
create trigger propagar_default_hours
  after update of default_hours on public.months
  for each row
  when (new.default_hours is distinct from old.default_hours)
  execute function public.propagar_default_hours();

-- ---------------------------------------------------------------------------
-- Igualar a TODO el equipo, incluidas las excepciones
-- ---------------------------------------------------------------------------
-- La contraparte manual del trigger, para dos casos que el trigger no puede
-- resolver solo:
--
--   · los meses que YA quedaron descuadrados antes de esta migración, donde
--     nadie sabe cuál era el `default_hours` viejo con el que comparar;
--   · el borrón y cuenta nueva deliberado ("todos a 168 h, sin excepciones").
--
-- Devuelve cuántas filas cambió, para que la UI pueda decir qué hizo en vez
-- de un "listo" a ciegas. No toca a quien ya estaba en el valor correcto, así
-- que el conteo es de cambios reales y no del tamaño del equipo.
create or replace function public.aplicar_horas_del_mes(p_month_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_default smallint;
  v_tocadas integer;
begin
  if not public.can_write_month(p_month_id) then
    raise exception 'No tiene permisos para cambiar las horas de este mes';
  end if;

  select default_hours into v_default from public.months where id = p_month_id;
  if not found then
    raise exception 'El mes no existe';
  end if;

  update public.people
     set available_hours = v_default
   where month_id = p_month_id
     and available_hours <> v_default;

  get diagnostics v_tocadas = row_count;
  return v_tocadas;
end;
$$;

revoke all on function public.aplicar_horas_del_mes(uuid) from public;
revoke all on function public.aplicar_horas_del_mes(uuid) from anon;
grant execute on function public.aplicar_horas_del_mes(uuid) to authenticated;

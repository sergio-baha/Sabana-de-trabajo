-- "Planeación lista": la señal que el Gestor le manda al Administrador.
--
-- EL FLUJO QUE FALTABA CERRAR
-- El Administrador crea el mes, los Gestores reparten las horas y desglosan
-- las actividades, y recién cuando eso está armado el mes se libera al
-- equipo. El paso del medio no tenía forma de comunicarse: el Administrador
-- tenía que adivinar cuándo terminaron los Gestores, o preguntar por fuera.
--
-- POR QUÉ NO ES UN ESTADO DEL MES
-- `month_status` dice si el mes está CONGELADO (cerrado/archivado) y
-- `released_at` dice si el equipo lo ve. Este es un tercer eje —si la
-- planeación está terminada— y mezclarlo con los otros dos obligaría a
-- inventar combinaciones que no significan nada ("cerrado y sin planear").
-- Mismo criterio que tomó *_liberacion_del_mes.sql al no meter "en
-- preparación" dentro del enum.
--
-- POR QUÉ UN RPC Y NO UNA POLÍTICA
-- `months` es de escritura exclusiva del Administrador desde
-- *_meses_solo_admin.sql, y así debe seguir: el ciclo de vida del mes es
-- suyo. Pero esta marca la tiene que poner el Gestor. Abrirle un UPDATE a
-- `months` le daría de paso el poder de cerrar meses y cambiar las horas por
-- defecto, porque RLS no distingue columnas. El RPC deja pasar exactamente
-- esta operación y nada más.

alter table public.months
  add column if not exists planning_ready_at timestamptz,
  add column if not exists planning_ready_by uuid references public.profiles (id) on delete set null;

comment on column public.months.planning_ready_at is
  'Cuándo un Gestor marcó la planeación del mes como terminada. Es una señal para el Administrador, no un permiso: liberar sigue siendo solo suyo.';

create or replace function public.set_planning_ready(
  p_month_id uuid,
  p_ready boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month public.months%rowtype;
begin
  if not public.is_gestor_or_admin() then
    raise exception 'Solo un Gestor o el Administrador pueden marcar la planeación';
  end if;

  select * into v_month from public.months where id = p_month_id;
  if not found then
    raise exception 'El mes no existe';
  end if;

  -- Un mes congelado ya no se planea. Sin esta guarda, la marca se podría
  -- poner y quitar sobre meses cerrados, donde no significa nada.
  if public.is_month_locked(p_month_id) then
    raise exception 'El mes "%" está cerrado: su planeación ya no se puede cambiar', v_month.name;
  end if;

  -- La marca es de la etapa de preparación. Después de liberado el mes, el
  -- equipo ya está trabajando sobre él y "listo para liberar" no dice nada.
  if v_month.released_at is not null then
    raise exception 'El mes "%" ya está liberado al equipo', v_month.name;
  end if;

  update public.months
     set planning_ready_at = case when p_ready then now() else null end,
         planning_ready_by = case when p_ready then auth.uid() else null end
   where id = p_month_id;
end;
$$;

revoke all on function public.set_planning_ready(uuid, boolean) from public;
grant execute on function public.set_planning_ready(uuid, boolean) to authenticated;

-- Al liberar el mes la marca se apaga: cumplió su función y dejarla puesta
-- haría que el mes liberado siguiera anunciándose como "pendiente de
-- revisar". Va en el mismo trigger que ya sella la liberación.
create or replace function public.tg_month_clear_planning_ready()
returns trigger
language plpgsql
as $$
begin
  if new.released_at is not null and old.released_at is null then
    new.planning_ready_at := null;
    new.planning_ready_by := null;
  end if;
  return new;
end;
$$;

drop trigger if exists month_clear_planning_ready on public.months;
create trigger month_clear_planning_ready
  before update on public.months
  for each row execute function public.tg_month_clear_planning_ready();

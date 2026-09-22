-- A quién NO se le pide el registro diario.
--
-- EL PROBLEMA: desde *_roster_desde_las_cuentas.sql el roster lo dictan las
-- cuentas —activar una cuenta crea su fila del mes—, así que "todo el roster
-- activo" es, en la práctica, "toda la organización con cuenta". El
-- recordatorio le habría llegado también a quien no reparte su día entre
-- proyectos de la sábana: la administración y el Estratega, cuyo módulo es
-- Gobernanza y no tiene horas que registrar.
--
-- POR QUÉ IMPORTA MÁS DE LO QUE PARECE: un recordatorio diario que le llega a
-- quien no tiene nada que registrar es la forma más rápida de que la
-- herramienta se gane fama de ruido antes de demostrar que sirve. Y el que
-- aprende a ignorar el correo es el mismo que lo va a ignorar cuando sí le
-- toque.
--
-- POR QUÉ ES UN PARÁMETRO Y NO UNA LISTA EN EL CÓDIGO: misma razón que la
-- hora. Quién debe reportar es una decisión de la organización, no del
-- repositorio, y cambia sin que cambie nada más. Vive en `settings` y se
-- edita desde Configuración -> Registro de tiempos.
--
-- Arranca excluyendo Administrador y Estratega. Ojo con el primero: mientras
-- esté marcado, la cuenta del administrador tampoco recibe el correo de
-- prueba. Para probar con la propia cuenta, se desmarca.

alter table public.settings
  add column if not exists time_request_excluded_roles public.app_role[]
  not null default '{administrador,estratega}';

-- ---------------------------------------------------------------------------
-- A quién hay que pedirle (ahora con el filtro de rol)
-- ---------------------------------------------------------------------------
-- Se devuelve también el rol: es lo que permite que la pantalla de
-- Configuración muestre a quién le va a llegar ANTES de encender el
-- recordatorio, en vez de averiguarlo mandando correos.
--
-- Va con DROP y no con CREATE OR REPLACE porque cambia la firma de retorno
-- (una columna más), y Postgres no deja reemplazar eso en sitio.
drop function if exists public.time_request_targets(date);

create function public.time_request_targets(p_date date)
returns table (
  person_id uuid,
  profile_id uuid,
  email text,
  full_name text,
  role public.app_role,
  available_hours numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    pe.id,
    pe.profile_id,
    pr.email,
    pr.full_name,
    pr.role,
    pe.available_hours
  from public.people pe
  join public.profiles pr on pr.id = pe.profile_id
  cross join public.settings s
  where s.id = 1
    and pe.month_id = public.current_work_month()
    and pe.status = 'activo'
    and pr.is_active
    -- Con la lista vacía esto es `not false` para todos: nadie queda excluido.
    and not (pr.role = any (s.time_request_excluded_roles))
    and not exists (
      select 1 from public.time_requests tr
      where tr.person_id = pe.id
        and tr.request_date = p_date
        and tr.channel = 'correo'
    );
$$;

revoke all on function public.time_request_targets(date) from public;
grant execute on function public.time_request_targets(date) to service_role;

-- ---------------------------------------------------------------------------
-- La vista previa de Configuración
-- ---------------------------------------------------------------------------
-- Responde "¿a quién le va a llegar esto?" sin mandar nada. `time_request_targets`
-- no sirve para eso: excluye a quien ya recibió su correo hoy, que es
-- justamente lo que se quiere seguir viendo en la lista.
--
-- Solo Administrador: es la misma pantalla donde se enciende el recordatorio,
-- y de paso evita que el resto del equipo tenga a mano un directorio de
-- correos por rol.
create or replace function public.time_request_recipients_preview()
returns table (
  full_name text,
  email text,
  role public.app_role,
  excluido boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    pr.full_name,
    pr.email,
    pr.role,
    (pr.role = any (s.time_request_excluded_roles))
  from public.people pe
  join public.profiles pr on pr.id = pe.profile_id
  cross join public.settings s
  where s.id = 1
    and pe.month_id = public.current_work_month()
    and pe.status = 'activo'
    and pr.is_active
    and public.is_admin()
  order by (pr.role = any (s.time_request_excluded_roles)), pr.full_name;
$$;

revoke all on function public.time_request_recipients_preview() from public;
grant execute on function public.time_request_recipients_preview() to authenticated;

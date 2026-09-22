-- Recordatorio diario de registro de tiempos: a quién se le pide, a qué hora
-- y por dónde.
--
-- LA HORA ES UN PARÁMETRO, NO UNA CONSTANTE. Las 4:30 p.m. de la propuesta
-- eran un supuesto; en la práctica cada equipo cierra a una hora distinta y
-- la buena se descubre con el piloto. Si viviera en el cron del flujo de
-- Power Automate, cambiarla sería entrar a Power Automate —que no todos
-- pueden— y el cambio quedaría fuera de este repositorio. Vive en `settings`,
-- se cambia desde Configuración y el flujo no se toca nunca.
--
-- CÓMO SE DISPARA: el flujo de Power Automate corre cada 15 minutos en horario
-- laboral y llama a la Edge Function `daily-time-request`. La función no
-- asume que es su hora: le pregunta a la base con `time_request_due()`, que
-- compara la hora configurada contra el reloj en la zona horaria configurada.
-- El flujo queda así reducido a un latido tonto, y toda la decisión —hora,
-- días, activado o no— es un dato de la aplicación.

-- ---------------------------------------------------------------------------
-- Parámetros
-- ---------------------------------------------------------------------------
alter table public.settings
  -- Apagado por defecto: la migración no puede empezar a escribirle a la
  -- gente sola. Se enciende desde Configuración cuando el piloto arranca.
  add column if not exists time_request_enabled boolean not null default false,
  add column if not exists time_request_time time not null default '16:30',
  add column if not exists time_request_timezone text not null default 'America/Bogota',
  -- ISO: 1 = lunes ... 7 = domingo. Lunes a viernes por defecto.
  add column if not exists time_request_weekdays smallint[] not null default '{1,2,3,4,5}',
  -- Cuánto dura el enlace del correo. Pasada la medianoche el registro del
  -- día ya no es memoria fresca, y un enlace que no caduca es un enlace que
  -- alguien reenvía.
  add column if not exists time_request_token_hours smallint not null default 18,
  -- Teams entra en la Fase 4; la bandera ya existe para que encenderlo sea
  -- un clic y no otra migración.
  add column if not exists time_request_teams_enabled boolean not null default false;

alter table public.settings drop constraint if exists settings_time_request_tz_check;
alter table public.settings
  add constraint settings_time_request_tz_check
  check (length(btrim(time_request_timezone)) > 0);

-- ---------------------------------------------------------------------------
-- Qué se le pidió a quién
-- ---------------------------------------------------------------------------
-- Sin esta tabla no hay forma de distinguir "no trabajó" de "nunca le llegó",
-- que son dos problemas distintos con dos responsables distintos.
create table public.time_requests (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id) on delete cascade,
  request_date date not null,
  channel text not null check (channel in ('teams', 'correo')),
  sent_at timestamptz,
  responded_at timestamptz,
  -- Se guarda el HASH, no el token. El token viaja en el enlace del correo y
  -- solo lo tiene quien recibió ese correo; si la base se filtra, no se
  -- filtra con ella la capacidad de registrar horas a nombre de nadie.
  token_hash text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  -- Un pedido por persona, día y canal. Es lo que hace que el latido cada 15
  -- minutos no mande el mismo recordatorio cuatro veces por hora: el segundo
  -- intento choca contra este índice. La defensa está acá y no en el código
  -- porque dos ejecuciones simultáneas del flujo pasarían las dos por
  -- cualquier chequeo previo.
  unique (person_id, request_date, channel)
);

create index time_requests_pending_idx
  on public.time_requests (request_date) where responded_at is null;

-- El token se busca por hash en cada apertura del enlace; sin índice eso es
-- un scan de toda la tabla.
create unique index time_requests_token_idx on public.time_requests (token_hash);

alter table public.time_requests enable row level security;

revoke all on public.time_requests from anon;
grant select on public.time_requests to authenticated;

-- Se ve quién tiene pendiente su registro: lo propio y, para quien ya ve la
-- sábana completa, la del equipo. `token_hash` no es secreto útil (es un
-- hash), pero igual la columna no se expone en ninguna consulta de la app.
create policy "time_requests_select" on public.time_requests
  for select to authenticated
  using (
    public.is_own_person(person_id)
    or not public.is_analista_tecnologia()
  );

-- ---------------------------------------------------------------------------
-- El canal del correo saliente
-- ---------------------------------------------------------------------------
alter table public.outbox
  add column if not exists channel text not null default 'email'
  check (channel in ('email', 'teams'));

alter table public.outbox drop constraint if exists outbox_kind_check;
alter table public.outbox
  add constraint outbox_kind_check
  check (kind in (
    'ticket_creado', 'ticket_cerrado', 'ticket_reabierto',
    'mes_liberado', 'revision_asignada', 'registro_diario'
  ));

-- ---------------------------------------------------------------------------
-- A quién hay que pedirle
-- ---------------------------------------------------------------------------
-- Quien esté activo en el roster del mes vigente y tenga cuenta activa
-- vinculada. Sin cuenta vinculada no hay correo al que escribirle ni forma de
-- saber a qué buzón de Outlook mirarle la agenda después (Fase 3), así que la
-- persona simplemente no entra al circuito — no es un error, es el caso de
-- quien no usa la plataforma.
--
-- Excluye a quien ya tiene pedido de ese día: devuelve lo que FALTA por
-- mandar, de modo que llamarla dos veces no manda nada dos veces.
create or replace function public.time_request_targets(p_date date)
returns table (
  person_id uuid,
  profile_id uuid,
  email text,
  full_name text,
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
    pe.available_hours
  from public.people pe
  join public.profiles pr on pr.id = pe.profile_id
  where pe.month_id = public.current_work_month()
    and pe.status = 'activo'
    and pr.is_active
    and not exists (
      select 1 from public.time_requests tr
      where tr.person_id = pe.id
        and tr.request_date = p_date
        and tr.channel = 'correo'
    );
$$;

-- ---------------------------------------------------------------------------
-- ¿Es hora de pedir el registro?
-- ---------------------------------------------------------------------------
-- Devuelve la fecha a registrar cuando corresponde, y null cuando no. La
-- decisión tiene cuatro partes y conviene tenerlas juntas y en un solo lugar:
-- está encendido, hoy es día hábil configurado, ya pasó la hora, y no se
-- mandó ya. Repartirlas entre el flujo y el código habría dejado la mitad de
-- la lógica donde nadie la lee.
create or replace function public.time_request_due(p_now timestamptz default now())
returns table (is_due boolean, request_date date, reason text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  s record;
  v_local timestamp;
  v_date date;
  v_month_id uuid;
begin
  select * into s from public.settings where id = 1;

  if not s.time_request_enabled then
    return query select false, null::date, 'recordatorio desactivado'::text; return;
  end if;

  v_local := p_now at time zone s.time_request_timezone;
  v_date := v_local::date;

  if not (extract(isodow from v_local)::smallint = any (s.time_request_weekdays)) then
    return query select false, v_date, 'no es un día configurado'::text; return;
  end if;

  if v_local::time < s.time_request_time then
    return query select false, v_date, 'todavía no es la hora'::text; return;
  end if;

  v_month_id := public.current_work_month();
  if v_month_id is null then
    return query select false, v_date, 'no hay un mes abierto y liberado'::text; return;
  end if;

  -- Queda por preguntar si falta alguien. Se mira contra los pedidos ya
  -- creados y no contra una marca de "última corrida": si alguien entra al
  -- roster a media tarde, el siguiente latido le manda el suyo sin
  -- reenviárselo a los demás.
  if not exists (select 1 from public.time_request_targets(v_date)) then
    return query select false, v_date, 'ya se envió a todos'::text; return;
  end if;

  return query select true, v_date, 'corresponde enviar'::text;
end;
$$;

revoke all on function public.time_request_due(timestamptz) from public;
revoke all on function public.time_request_targets(date) from public;
grant execute on function public.time_request_due(timestamptz) to service_role, authenticated;
grant execute on function public.time_request_targets(date) to service_role;

-- ---------------------------------------------------------------------------
-- El menú que ve la persona
-- ---------------------------------------------------------------------------
-- Una fila por celda de la sábana: proyecto + subproyecto, que desde
-- *_subproyecto_obligatorio.sql es SIEMPRE la unidad de asignación (no hay
-- allocation sin `line_id`). Por eso el desplegable ofrece exactamente las
-- celdas que esa persona tiene asignadas este mes, ni una más: es lo que
-- elimina de raíz los proyectos inexistentes, los ajenos y los errores de
-- digitación.
--
-- Va por función y no por consulta del cliente porque el formulario del
-- correo se abre SIN SESIÓN: quien lo abre trae un token, no un JWT, y RLS no
-- tiene a quién preguntarle.
create or replace function public.time_log_options(p_person_id uuid)
returns table (
  project_id uuid,
  project_name text,
  color text,
  line_id uuid,
  line_name text,
  horas_planeadas numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.name,
    p.color,
    pl.id,
    pl.name,
    a.hours
  from public.allocations a
  join public.projects p on p.id = a.project_id
  join public.project_lines pl on pl.id = a.line_id
  where a.person_id = p_person_id
    and p.status = 'activo'
  order by p.name, pl.position;
$$;

revoke all on function public.time_log_options(uuid) from public;
grant execute on function public.time_log_options(uuid) to service_role, authenticated;

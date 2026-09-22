-- Registro diario de horas REALES.
--
-- QUÉ PROBLEMA RESUELVE: la sábana reparte horas PLANEADAS por mes
-- (allocations/activities) y lo único real que se captura hoy es
-- `task_time_reports`, que solo existe cuando alguien entrega una tarea a
-- revisión. Todo lo demás —reuniones, comités, acompañamientos, el trabajo
-- que no nació como tarea— no deja rastro. Sin ese lado ejecutado, la
-- planeación del mes siguiente se hace a ojo.
--
-- POR QUÉ NO SE REUSA `activities`: una actividad desglosa una celda de la
-- sábana y su trigger SUMA sus horas dentro de `allocations.hours`, que es
-- el número planeado. Meter ahí lo ejecutado reescribiría el plan con lo que
-- pasó y borraría justo la comparación que se quiere hacer. Lo ejecutado
-- vive aparte y se cruza al leer, no al escribir.
--
-- POR QUÉ NO HAY INSERT DIRECTO: las filas las crea `log_daily_time`. Un
-- registro diario tiene reglas que una política RLS no expresa bien (tope de
-- 24 h al día, el proyecto debe ser del mes, la línea debe ser del proyecto)
-- y además se reemplaza en bloque cuando la persona corrige su día. Mismo
-- criterio que `task_time_reports` y `audit_logs`.

-- ---------------------------------------------------------------------------
-- ¿Cuál es el mes de trabajo hoy?
-- ---------------------------------------------------------------------------
-- El "mes activo" de la app es una preferencia del navegador
-- (activeMonthStore), no un dato del servidor: sirve para que cada quien
-- navegue donde quiera, pero un proceso automático no puede preguntarle a un
-- navegador contra qué mes registrar.
--
-- La regla es la que ya sigue la oficina: el mes vigente es el más reciente
-- que está ABIERTO y ya fue LIBERADO al equipo. Un mes en preparación todavía
-- se está armando —pedirle horas a alguien contra una sábana a medio hacer es
-- justo lo que `released_at` vino a evitar— y uno cerrado ya no admite
-- cambios.
create or replace function public.current_work_month()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.months
  where status = 'abierto' and released_at is not null
  order by released_at desc
  limit 1;
$$;

revoke all on function public.current_work_month() from public;
grant execute on function public.current_work_month() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- La tabla
-- ---------------------------------------------------------------------------
create table public.daily_time_logs (
  id uuid primary key default gen_random_uuid(),
  month_id uuid not null references public.months (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete cascade,
  log_date date not null,
  -- Nullable a propósito: una reunión que todavía no se sabe a qué proyecto
  -- cargar entra como hora sin asignar y se ve como tal en el tablero.
  -- Forzar un proyecto obligaría a inventar uno, que es peor dato que el
  -- hueco honesto.
  project_id uuid references public.projects (id) on delete set null,
  line_id uuid references public.project_lines (id) on delete set null,
  task_id uuid references public.tasks (id) on delete set null,
  hours numeric(5, 2) not null check (hours > 0 and hours <= 24),
  note text,
  -- De dónde salió la fila. Sin esta columna el tablero mezcla lo que la
  -- persona confirmó con lo que el calendario sugirió y nadie revisó, y
  -- pierde credibilidad el primer día que alguien lo mire de cerca.
  source text not null default 'app'
    check (source in ('teams', 'correo', 'app', 'calendario')),
  -- iCalUId del evento de Outlook cuando la fila nace de una reunión (Fase 3).
  calendar_event_id text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index daily_time_logs_person_date_idx
  on public.daily_time_logs (person_id, log_date);
create index daily_time_logs_month_idx
  on public.daily_time_logs (month_id, log_date);
create index daily_time_logs_project_idx
  on public.daily_time_logs (project_id);

-- Una reunión no se cuenta dos veces aunque la sincronización vuelva a correr.
create unique index daily_time_logs_event_uniq
  on public.daily_time_logs (person_id, calendar_event_id)
  where calendar_event_id is not null;

create trigger set_updated_at
  before update on public.daily_time_logs
  for each row execute function public.tg_set_updated_at();

alter table public.daily_time_logs enable row level security;

revoke all on public.daily_time_logs from anon;
-- Solo lectura para el cliente: escribe el RPC (ver arriba).
grant select on public.daily_time_logs to authenticated;

-- Quién ve qué: lo propio siempre; el trabajo del equipo, quien ya ve la
-- sábana completa. El Analista de Tecnología queda con lo suyo, igual que en
-- tasks y allocations — su módulo no muestra trabajo ajeno.
create policy "daily_time_logs_select" on public.daily_time_logs
  for select to authenticated
  using (
    public.is_own_person(person_id)
    or not public.is_analista_tecnologia()
  );

-- ---------------------------------------------------------------------------
-- ¿Qué persona del mes vigente es este usuario?
-- ---------------------------------------------------------------------------
create or replace function public.my_person_id(p_month_id uuid default null)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.id
  from public.people p
  where p.profile_id = auth.uid()
    and p.month_id = coalesce(p_month_id, public.current_work_month())
  limit 1;
$$;

revoke all on function public.my_person_id(uuid) from public;
grant execute on function public.my_person_id(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Escribir el día de una persona
-- ---------------------------------------------------------------------------
-- REEMPLAZA el día completo en vez de agregar filas sueltas. El registro
-- diario se corrige: la persona manda 6 horas, se acuerda de una reunión y
-- vuelve a enviar 8. Con inserts sueltos eso deja 14 horas y alguien tiene
-- que ir a borrar a mano; reemplazando, reenviar es idempotente y el último
-- envío es la verdad. Es también lo que hace que un reintento del webhook de
-- Teams no duplique nada.
--
-- SOBRE LAS HORAS CONTRA UN PROYECTO NO ASIGNADO: se aceptan. La alternativa
-- —rechazarlas— empuja a la gente a acomodar el dato con tal de poder cerrar
-- el día, y un dato acomodado es peor que una desviación visible. La
-- desviación se ve en la vista `planeado_vs_ejecutado`, que es donde sirve.
create or replace function public.replace_daily_time_logs(
  p_person_id uuid,
  p_date date,
  p_entries jsonb,
  p_source text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month_id uuid;
  v_total numeric(6, 2);
  v_count integer;
begin
  select month_id into v_month_id from public.people where id = p_person_id;
  if v_month_id is null then
    raise exception 'La persona no existe en el roster';
  end if;

  if public.is_month_locked(v_month_id) then
    raise exception 'El mes está cerrado: no admite registros nuevos';
  end if;

  if jsonb_typeof(p_entries) <> 'array' then
    raise exception 'Se esperaba un arreglo de registros';
  end if;

  -- El tope de 24 h se valida ANTES de escribir nada: un día de 30 horas es
  -- un error de digitación, no un dato que valga la pena guardar a medias.
  select coalesce(sum((e ->> 'hours')::numeric), 0)
  into v_total
  from jsonb_array_elements(p_entries) e;

  if v_total > 24 then
    raise exception 'El día no puede sumar más de 24 horas (se recibieron %)', v_total;
  end if;

  -- El proyecto tiene que ser del mes de la persona. Es la validación que
  -- hace que el desplegable de la tarjeta no pueda producir un proyecto
  -- inexistente ni uno de otro mes, venga de donde venga el envío.
  -- `nullif(…, '')` y no el valor crudo: una cadena vacía revienta el cast a
  -- uuid, y el formulario de un navegador manda cadenas vacías con más
  -- facilidad de la que uno quisiera.
  if exists (
    select 1
    from jsonb_array_elements(p_entries) e
    join public.projects pr on pr.id = nullif(e ->> 'project_id', '')::uuid
    where pr.month_id <> v_month_id
  ) then
    raise exception 'Hay un proyecto que no pertenece al mes vigente';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_entries) e
    join public.project_lines pl on pl.id = nullif(e ->> 'line_id', '')::uuid
    where pl.project_id is distinct from nullif(e ->> 'project_id', '')::uuid
  ) then
    raise exception 'Hay una línea que no pertenece a su proyecto';
  end if;

  delete from public.daily_time_logs
  where person_id = p_person_id and log_date = p_date;

  -- Y también cualquier registro previo de las MISMAS reuniones en otro día.
  -- El índice único por (persona, evento) impide contar una reunión dos
  -- veces; sin este borrado, ese índice se convertiría en un error que la
  -- persona no puede resolver desde el formulario (pasa cuando alguien
  -- registra el lunes una reunión y el martes corrige y la vuelve a marcar).
  -- Acá la regla es la misma de siempre: el último envío es la verdad.
  delete from public.daily_time_logs
  where person_id = p_person_id
    and calendar_event_id in (
      select nullif(e ->> 'calendar_event_id', '')
      from jsonb_array_elements(p_entries) e
      where nullif(e ->> 'calendar_event_id', '') is not null
    );

  insert into public.daily_time_logs (
    month_id, person_id, log_date, project_id, line_id, task_id,
    hours, note, source, calendar_event_id, created_by
  )
  select
    v_month_id,
    p_person_id,
    p_date,
    nullif(e ->> 'project_id', '')::uuid,
    nullif(e ->> 'line_id', '')::uuid,
    nullif(e ->> 'task_id', '')::uuid,
    (e ->> 'hours')::numeric,
    nullif(btrim(coalesce(e ->> 'note', '')), ''),
    p_source,
    nullif(e ->> 'calendar_event_id', ''),
    auth.uid()
  from jsonb_array_elements(p_entries) e
  where (e ->> 'hours')::numeric > 0;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Nadie la llama desde el cliente: es el motor compartido entre el RPC de la
-- app y la Edge Function que atiende el correo y Teams.
revoke all on function public.replace_daily_time_logs(uuid, date, jsonb, text) from public;
grant execute on function public.replace_daily_time_logs(uuid, date, jsonb, text) to service_role;

-- ---------------------------------------------------------------------------
-- El RPC que usa la app (usuario con sesión)
-- ---------------------------------------------------------------------------
create or replace function public.log_daily_time(p_date date, p_entries jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_person_id uuid;
begin
  v_person_id := public.my_person_id();

  if v_person_id is null then
    raise exception 'Tu cuenta no está vinculada a una persona del roster del mes vigente';
  end if;

  -- Registrar el futuro no tiene sentido y suele ser un error de fecha.
  if p_date > current_date then
    raise exception 'No se puede registrar tiempo de un día que no ha pasado';
  end if;

  return public.replace_daily_time_logs(v_person_id, p_date, p_entries, 'app');
end;
$$;

revoke all on function public.log_daily_time(date, jsonb) from public;
grant execute on function public.log_daily_time(date, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Planeado vs. ejecutado
-- ---------------------------------------------------------------------------
-- Un full outer join a propósito: interesa tanto el proyecto que se planeó y
-- nadie tocó (ejecutado 0) como el que nadie planeó y se está trabajando
-- (planeado 0, `fuera_de_plan`). Un inner join escondería justo los dos casos
-- por los que se construye el tablero.
create or replace view public.planeado_vs_ejecutado as
select
  coalesce(a.month_id, l.month_id) as month_id,
  coalesce(a.person_id, l.person_id) as person_id,
  coalesce(a.project_id, l.project_id) as project_id,
  coalesce(a.hours, 0) as horas_planeadas,
  coalesce(l.horas, 0) as horas_ejecutadas,
  coalesce(l.horas, 0) - coalesce(a.hours, 0) as desviacion,
  (a.id is null) as fuera_de_plan,
  l.dias_registrados
from public.allocations a
full outer join (
  select
    month_id,
    person_id,
    project_id,
    sum(hours) as horas,
    count(distinct log_date) as dias_registrados
  from public.daily_time_logs
  group by month_id, person_id, project_id
) l
  on l.month_id = a.month_id
 and l.person_id = a.person_id
 and l.project_id = a.project_id;

-- La vista hereda el RLS de las tablas que lee (security_invoker), así que
-- nadie ve por acá lo que no vería directamente.
alter view public.planeado_vs_ejecutado set (security_invoker = on);

revoke all on public.planeado_vs_ejecutado from anon;
grant select on public.planeado_vs_ejecutado to authenticated;

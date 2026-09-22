-- Fase 3: las reuniones de Outlook llegan pre-cargadas al formulario.
--
-- QUÉ PROBLEMA RESUELVE: el tiempo en reuniones es el que más se pierde al
-- reportar. Nadie se acuerda a las 5 de la tarde de que el comité duró hora y
-- media, y lo que no se recuerda no se registra. La agenda ya tiene ese dato
-- con la hora exacta; lo único que faltaba era traerlo y preguntar.
--
-- POR QUÉ UNA CACHÉ Y NO UNA CONSULTA EN VIVO: si el formulario le preguntara
-- a Microsoft Graph al abrirse, una demora de Graph sería una demora del
-- formulario, y una caída de Graph sería un formulario que no abre. El
-- recordatorio diario tiene que salir con o sin calendario. La sincronización
-- corre antes, aparte, y si falla el formulario llega en blanco — que es
-- exactamente como funcionaba en la Fase 2.
--
-- LA PRIVACIDAD SE RESUELVE AQUÍ, NO EN LA PANTALLA: Graph devuelve el asunto
-- de las reuniones privadas igual que el de las demás. De una reunión marcada
-- privada o confidencial se guarda la DURACIÓN y nada más: el asunto nunca
-- entra a la base. Filtrarlo al mostrar habría dejado el texto guardado, a un
-- `select` de distancia de cualquiera con acceso a la base, y la promesa que
-- se le hace al equipo al lanzar esto es justamente que eso no pasa.

-- ---------------------------------------------------------------------------
-- Parámetro
-- ---------------------------------------------------------------------------
alter table public.settings
  -- Apagado hasta que exista la app registration en Entra ID y el
  -- consentimiento del administrador del tenant. Mientras esté apagado, el
  -- recordatorio sigue saliendo sin sugerencias.
  add column if not exists time_request_calendar_enabled boolean not null default false;

-- ---------------------------------------------------------------------------
-- La caché de la agenda
-- ---------------------------------------------------------------------------
create table public.calendar_events_cache (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id) on delete cascade,
  -- iCalUId y no `id`: el `id` de Graph cambia entre buzones y cuando el
  -- organizador mueve la reunión; el iCalUId es estable y es el mismo que
  -- termina en daily_time_logs.calendar_event_id para no contar dos veces.
  event_uid text not null,
  -- Null cuando la reunión es privada. La columna no guarda "(privado)" como
  -- texto: guarda nada, y quien lo lea decide cómo lo rotula.
  subject text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  hours numeric(5, 2) generated always as (
    round(extract(epoch from (ends_at - starts_at))::numeric / 3600.0, 2)
  ) stored,
  is_private boolean not null default false,
  -- La sugerencia es la celda completa de la sábana, porque esa es la unidad
  -- de asignación. Las dos columnas o ninguna.
  suggested_project_id uuid references public.projects (id) on delete set null,
  suggested_line_id uuid references public.project_lines (id) on delete set null,
  synced_at timestamptz not null default now(),
  unique (person_id, event_uid)
);

create index calendar_events_cache_person_day_idx
  on public.calendar_events_cache (person_id, starts_at);

alter table public.calendar_events_cache enable row level security;

revoke all on public.calendar_events_cache from anon;
grant select on public.calendar_events_cache to authenticated;

-- La agenda de alguien es suya. A diferencia de `daily_time_logs` —que es
-- dato de gestión y el equipo de planeación necesita ver— acá no hay nada que
-- un tercero deba leer: el formulario de la persona se sirve por la Edge
-- Function con service_role, y lo que el resto necesita saber (las horas) ya
-- quedó en el registro diario cuando ella lo confirmó.
create policy "calendar_events_cache_select_own" on public.calendar_events_cache
  for select to authenticated
  using (public.is_own_person(person_id));

-- ---------------------------------------------------------------------------
-- Ventana del día en la zona horaria configurada
-- ---------------------------------------------------------------------------
-- Graph quiere el rango en instantes absolutos. "El 22 de septiembre" no es
-- un instante: empieza y termina en momentos distintos según la zona. Esta
-- función lo resuelve una vez, contra la zona configurada, en vez de dejar
-- que cada llamador haga su propia aritmética de horas y se equivoque en el
-- cambio de día.
create or replace function public.day_window(p_date date)
returns table (starts_at timestamptz, ends_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select
    (p_date::timestamp) at time zone s.time_request_timezone,
    ((p_date + 1)::timestamp) at time zone s.time_request_timezone
  from public.settings s
  where s.id = 1;
$$;

-- ---------------------------------------------------------------------------
-- A qué proyecto se parece esta reunión
-- ---------------------------------------------------------------------------
-- Es una SUGERENCIA, no una asignación: llena el desplegable, la persona la
-- confirma o la cambia. Por eso puede permitirse ser simple —¿el nombre del
-- proyecto o de la línea aparece en el asunto?— y por eso solo busca entre
-- los proyectos que esa persona tiene asignados en la sábana: acertar entre
-- cinco opciones es fácil, acertar entre el catálogo entero no, y una
-- sugerencia mala cuesta más que ninguna.
--
-- Sugiere la CELDA completa (proyecto + subproyecto), que desde
-- *_subproyecto_obligatorio.sql es la unidad de asignación: un proyecto suelto
-- no es una opción válida del formulario y sugerirlo dejaría a la persona con
-- medio dato que igual tendría que completar.
--
-- Gana el nombre más largo que coincida: si la persona tiene los subproyectos
-- "Formación" y "Formación Docente", el asunto "Comité Formación Docente"
-- debe caer en el segundo.
create or replace function public.suggest_allocation_for_event(
  p_person_id uuid,
  p_subject text
)
returns table (project_id uuid, line_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select a.project_id, a.line_id
  from public.allocations a
  join public.projects p on p.id = a.project_id
  join public.project_lines pl on pl.id = a.line_id
  where a.person_id = p_person_id
    and p.status = 'activo'
    and coalesce(btrim(p_subject), '') <> ''
    and (
      p_subject ilike '%' || p.name || '%'
      or p_subject ilike '%' || pl.name || '%'
    )
  -- El subproyecto manda sobre el proyecto: es el nombre más específico y el
  -- que distingue entre dos frentes del mismo proyecto.
  order by
    (p_subject ilike '%' || pl.name || '%') desc,
    length(pl.name) desc,
    length(p.name) desc
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- Guardar un evento
-- ---------------------------------------------------------------------------
-- Upsert por (persona, evento): sincronizar dos veces el mismo día no
-- duplica, y una reunión que se movió de hora se actualiza en vez de
-- convertirse en dos. La sugerencia se recalcula en cada sincronización
-- porque la sábana cambia: un proyecto que se le asignó a media semana debe
-- empezar a sugerirse sin tener que borrar la caché.
create or replace function public.cache_calendar_event(
  p_person_id uuid,
  p_event_uid text,
  p_subject text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_is_private boolean
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_subject text;
  v_suggestion record;
begin
  -- La única puerta por la que entra un asunto a la base. Una reunión privada
  -- pasa por acá con su texto y no lo deja.
  v_subject := case when p_is_private then null else nullif(btrim(p_subject), '') end;

  select * into v_suggestion
  from public.suggest_allocation_for_event(p_person_id, v_subject);

  insert into public.calendar_events_cache (
    person_id, event_uid, subject, starts_at, ends_at, is_private,
    suggested_project_id, suggested_line_id
  )
  values (
    p_person_id, p_event_uid, v_subject, p_starts_at, p_ends_at, p_is_private,
    v_suggestion.project_id, v_suggestion.line_id
  )
  on conflict (person_id, event_uid) do update
  set subject = excluded.subject,
      starts_at = excluded.starts_at,
      ends_at = excluded.ends_at,
      is_private = excluded.is_private,
      suggested_project_id = excluded.suggested_project_id,
      suggested_line_id = excluded.suggested_line_id,
      synced_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Las reuniones de un día, listas para el formulario
-- ---------------------------------------------------------------------------
-- Excluye las que ya se registraron: si la persona confirmó el comité en su
-- primer envío, al reabrir el enlace no le vuelve a aparecer como sugerencia
-- pendiente encima de la línea que ya tiene.
create or replace function public.calendar_events_for(p_person_id uuid, p_date date)
returns table (
  event_uid text,
  subject text,
  starts_at timestamptz,
  ends_at timestamptz,
  hours numeric,
  is_private boolean,
  suggested_project_id uuid,
  suggested_line_id uuid,
  suggested_project_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.event_uid,
    c.subject,
    c.starts_at,
    c.ends_at,
    c.hours,
    c.is_private,
    c.suggested_project_id,
    c.suggested_line_id,
    p.name
  from public.calendar_events_cache c
  left join public.projects p on p.id = c.suggested_project_id
  cross join lateral public.day_window(p_date) w
  where c.person_id = p_person_id
    and c.starts_at >= w.starts_at
    and c.starts_at < w.ends_at
    and not exists (
      select 1 from public.daily_time_logs l
      where l.person_id = p_person_id
        and l.calendar_event_id = c.event_uid
    )
  order by c.starts_at;
$$;

-- ---------------------------------------------------------------------------
-- A quién hay que sincronizarle la agenda
-- ---------------------------------------------------------------------------
-- Todo el roster con cuenta activa. A diferencia de `time_request_targets`,
-- acá NO se excluye a quien ya recibió su correo: la sincronización corre
-- antes del envío y no tiene nada que ver con lo que ya se mandó.
create or replace function public.roster_with_accounts()
returns table (person_id uuid, email text)
language sql
stable
security definer
set search_path = public
as $$
  select pe.id, pr.email
  from public.people pe
  join public.profiles pr on pr.id = pe.profile_id
  where pe.month_id = public.current_work_month()
    and pe.status = 'activo'
    and pr.is_active;
$$;

revoke all on function public.day_window(date) from public;
revoke all on function public.suggest_allocation_for_event(uuid, text) from public;
revoke all on function public.cache_calendar_event(uuid, text, text, timestamptz, timestamptz, boolean) from public;
revoke all on function public.calendar_events_for(uuid, date) from public;
revoke all on function public.roster_with_accounts() from public;

grant execute on function public.day_window(date) to service_role;
grant execute on function public.suggest_allocation_for_event(uuid, text) to service_role;
grant execute on function public.cache_calendar_event(uuid, text, text, timestamptz, timestamptz, boolean) to service_role;
grant execute on function public.calendar_events_for(uuid, date) to service_role, authenticated;
grant execute on function public.roster_with_accounts() to service_role;

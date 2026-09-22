# Plan de Implementación: Registro de Tiempos Interactivo (Teams + Calendario de Outlook)

> **Objetivo.** Cerrar la brecha entre lo que la sábana **planea** y lo que el equipo **ejecuta**. Hoy la plataforma reparte horas planeadas por mes (`allocations`, `activities`) y solo captura horas reales en la entrega de una tarea (`task_time_reports`), que no cubre reuniones, comités ni trabajo sin tarea asociada. La propuesta es un registro diario proactivo: el sistema va al usuario —por Teams y por correo—, le pre-carga sus reuniones del calendario de Outlook y le pide confirmar en menos de un minuto.

## 1. Por qué construirlo dentro de esta plataforma y no en Power Platform

Un bot en Power Automate + SharePoint sería un segundo origen de verdad: el maestro de proyectos vive aquí (`projects`, `project_lines`, `months`, `people`), el control de acceso vive en las políticas RLS de Postgres, y la comparación planeado vs. ejecutado necesita ambos lados en la misma base. Replicar el catálogo en SharePoint reintroduce justo el descuadre que se quiere eliminar.

Además, la infraestructura de avisos ya existe y está probada en producción:

| Pieza existente | Qué aporta al bot |
|---|---|
| `public.outbox` + `supabase/functions/outbox-worker` | Bandeja de salida con reintentos y tope de 5 intentos. El recordatorio diario se encola igual que `mes_liberado` o `revision_asignada`. |
| `supabase/functions/email-to-task` | Patrón de webhook entrante ya endurecido (firma, dominio permitido, `source_message_id` único contra reintentos). El submit de la tarjeta de Teams reusa ese guion. |
| `profiles` ↔ `people` (cuenta vinculada) | Resuelve la identidad: el correo corporativo es la llave con la que Microsoft Graph identifica el buzón y con la que Teams abre el chat 1:1. |
| Módulo de Reportes | El tablero "Planeado vs. Ejecutado" es una vista más de la app, no un Power BI aparte. |

Teams y Graph se suman como **canales**, no como motor.

## 2. Arquitectura

```
                    ┌───────────────────────────────┐
  cron (pg_cron) ──►│  Edge: daily-time-request      │
   16:30 L-V        │  arma el lote del día          │
                    └───────┬───────────────┬────────┘
                            │               │
           ┌────────────────▼────┐  ┌───────▼─────────────────┐
           │ Edge: graph-sync    │  │  public.outbox          │
           │ Microsoft Graph     │  │  (channel: email|teams) │
           │ /users/{id}/        │  └───────┬─────────────────┘
           │   calendarView      │          │
           └────────┬────────────┘  ┌───────▼───────┐ ┌───────────────┐
                    │               │ outbox-worker │ │ teams-worker  │
        calendar_events_cache       │  (Postmark)   │ │ (Bot / Flow)  │
                    │               └───────┬───────┘ └───────┬───────┘
                    └───────────► Adaptive Card / correo con enlace firmado
                                            │
                                 ┌──────────▼───────────┐
                                 │ Edge: time-log-hook  │
                                 └──────────┬───────────┘
                                            ▼
                                  public.daily_time_logs
                                            │
                                 vista planeado_vs_ejecutado
                                            ▼
                                  Módulo de Reportes (app)
```

**Decisión de canal.** Teams es el canal primario y el correo el respaldo, no una alternativa suelta: quien esté en campo o sin Teams abierto responde el correo, cuyo enlace lleva a la misma pantalla de registro de la app. El registro queda idéntico venga de donde venga; solo cambia `daily_time_logs.source`.

**Decisión de identidad en Microsoft.** Una sola registración de aplicación en Entra ID con **permisos de aplicación** (`Calendars.Read`, más `Chat.ReadWrite` si se va por bot propio), acotada con una **Application Access Policy** de Exchange a un grupo de correo que contenga solo al personal del piloto y después al equipo. La alternativa —consentimiento delegado por usuario, con refresh token por persona— multiplica el mantenimiento (tokens que expiran, gente que revoca, altas y bajas) sin ganar nada: el bot no actúa "como" el usuario, solo lee su agenda para sugerirle horas.

**Decisión sobre la entrega en Teams.** Hay dos caminos y conviene elegir con los ojos abiertos:

- **A — Azure Bot Service (Bot Framework) con mensajería proactiva.** Control total, la tarjeta se actualiza en sitio tras el envío, sin licencias adicionales. Costo: registrar el bot, publicar un app package de Teams y mantener el endpoint de mensajería.
- **B — Flujo de Power Automate con "Post adaptive card and wait for a response", disparado por HTTP desde `teams-worker`.** Se monta en días y no exige app package. Costo: depende de licencias Premium para el conector HTTP y deja parte de la lógica fuera del repositorio.

**Decidido: B para el piloto, A para el rollout.** El piloto necesita validar la experiencia y la tasa de respuesta, no la arquitectura definitiva; si el hábito no prende, se evita haber montado un bot completo. El contrato con `teams-worker` es el mismo en ambos casos, así que pasar de B a A no toca la base de datos ni la app.

## 3. Modelo de datos (Fase 1)

> Las Fases 1 y 2 ya están implementadas. Lo que manda es
> `supabase/migrations/20260922100000_registro_diario.sql` y
> `20260922110000_recordatorio_de_tiempos.sql`; lo de abajo es el diseño y
> puede haberse afinado al escribirlo. `calendar_events_cache` se pospuso a la
> Fase 3, donde nace junto a lo que la llena — una tabla que nadie escribe
> todavía es peso muerto.

Tres tablas nuevas y una columna en `outbox`. Todas con RLS y con la convención del repositorio: escribe el RPC o el service role, nunca el cliente directo.

```sql
-- Registro diario de horas REALES. Es el hermano ejecutado de allocations.
create table public.daily_time_logs (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id) on delete cascade,
  log_date date not null,
  project_id uuid references public.projects (id) on delete set null,
  project_line_id uuid references public.project_lines (id) on delete set null,
  task_id uuid references public.tasks (id) on delete set null,
  hours numeric(5, 2) not null check (hours > 0 and hours <= 24),
  note text,
  -- De dónde salió la fila: distingue lo que la persona confirmó de lo que el
  -- calendario sugirió y nadie tocó. Sin esta columna el tablero mezcla horas
  -- declaradas con horas inferidas y pierde credibilidad el primer día que
  -- alguien lo revise de cerca.
  source text not null check (source in ('teams', 'correo', 'app', 'calendario')),
  calendar_event_id text,   -- iCalUId de Graph cuando la fila nace de una reunión
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Una reunión no puede contarse dos veces aunque el cron vuelva a correr.
create unique index daily_time_logs_event_uniq
  on public.daily_time_logs (person_id, calendar_event_id)
  where calendar_event_id is not null;

create index daily_time_logs_person_date_idx
  on public.daily_time_logs (person_id, log_date);
```

```sql
-- Caché de la agenda leída por Graph. Existe para que la tarjeta se arme sin
-- llamar a Microsoft en el momento del envío (si Graph tarda, el recordatorio
-- igual sale) y para poder reenviarla sin volver a consultar.
create table public.calendar_events_cache (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id) on delete cascade,
  event_uid text not null,          -- iCalUId
  subject text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  hours numeric(5, 2) generated always as
    (round(extract(epoch from (ends_at - starts_at)) / 3600.0, 2)) stored,
  is_private boolean not null default false,
  suggested_project_id uuid references public.projects (id) on delete set null,
  synced_at timestamptz not null default now(),
  unique (person_id, event_uid)
);
```

```sql
-- Qué se le pidió a quién y qué contestó. Sin esta tabla no hay forma de saber
-- si el silencio de alguien significa "no trabajó" o "nunca le llegó".
create table public.time_requests (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id) on delete cascade,
  request_date date not null,
  channel text not null check (channel in ('teams', 'correo')),
  sent_at timestamptz,
  responded_at timestamptz,
  -- Token de un solo uso para el enlace del correo: permite registrar sin pasar
  -- por login, y no sirve para nada más ni para otro día.
  token_hash text not null,
  expires_at timestamptz not null,
  unique (person_id, request_date, channel)
);
```

```sql
alter table public.outbox add column if not exists channel text not null default 'email'
  check (channel in ('email', 'teams'));

alter table public.outbox drop constraint if exists outbox_kind_check;
alter table public.outbox add constraint outbox_kind_check
  check (kind in ('ticket_creado', 'ticket_cerrado', 'ticket_reabierto',
                  'mes_liberado', 'revision_asignada', 'registro_diario'));
```

**Regla de negocio aplicada (revisable):** una hora cargada contra un proyecto que la persona **no tiene asignado ese mes** se **acepta** y queda marcada como `fuera_de_plan` en la vista `planeado_vs_ejecutado`. Rechazarla empujaría a la gente a acomodar el dato con tal de poder cerrar el día, y un dato acomodado es peor que una desviación visible. Si el negocio prefiere rechazar o restringir a la categoría "Emergente", el cambio es una condición en `replace_daily_time_logs` y nada más.

## 4. Experiencia del usuario

**La hora es un parámetro, no una constante.** Las 4:30 p.m. eran un supuesto; cada equipo cierra a una hora distinta y la buena se descubre con el piloto. Si viviera en el cron del flujo, cambiarla exigiría entrar a Power Automate —que no todos pueden— y la decisión quedaría fuera de este repositorio. La hora, los días hábiles, la vigencia del enlace y el encendido viven en `settings` y se cambian desde **Configuración → Registro de tiempos**; el flujo es un latido cada 15 minutos que solo pregunta "¿ya toca?".

1. **A la hora configurada, los días configurados.** Llega el mensaje de Teams: *"Hola Ana, ¿cerramos el día? Revisé tu calendario y encontré 3 horas en reuniones."*
2. **La tarjeta llega pre-cargada.** Cada reunión aparece como una línea con su duración y un proyecto sugerido; la persona la acepta, la reasigna o la descarta. Debajo, filas en blanco cuyo desplegable trae **solo los proyectos que tiene asignados ese mes en la sábana**, no un catálogo global: eso es lo que elimina de raíz los proyectos inexistentes y los errores tipográficos.
3. **Total en vivo.** La tarjeta suma y contrasta contra las horas disponibles de la persona (`people.default_hours`). Si registra 3 donde le corresponden 8, no la bloquea: pide una nota. Registrar poco es un dato; no registrar nada no lo es.
4. **Confirmación.** La tarjeta se reemplaza por el acuse: *"Listo: 8 horas hoy, 32 esta semana."*
5. **Si a las 19:00 no respondió**, sale el correo de respaldo con el enlace firmado. Si tampoco, el día queda marcado como pendiente y aparece en el tablero del gestor — y **no** se generan más recordatorios al usuario. Un bot que insiste tres veces al día se silencia y deja de servir.

**Sobre la privacidad del calendario.** Graph devuelve también el asunto de las reuniones privadas. La plataforma guarda `is_private` y para esos eventos almacena solo la duración, con el rótulo "Reunión privada": se cuenta el tiempo sin exponer de qué trataba. Esto se comunica explícitamente al equipo antes del piloto; es la diferencia entre una herramienta de gestión y una de vigilancia, y de eso depende la adopción.

## 5. Roadmap

| Fase | Entregable | Depende de |
|---|---|---|
| **0. Habilitación** | App registration en Entra ID, consentimiento del administrador del tenant, Application Access Policy acotada al grupo piloto, secretos en Supabase (`GRAPH_TENANT_ID`, `GRAPH_CLIENT_ID`, `GRAPH_CLIENT_SECRET`). | Administrador de M365. **Es la ruta crítica para la Fase 3: arrancar la gestión ya.** |
| **1. Datos** ✅ | `daily_time_logs`, `time_requests`, vista `planeado_vs_ejecutado`, RPC `log_daily_time`. Ver `20260922100000_registro_diario.sql`. | — |
| **2. Canal correo** ✅ | Latido de Power Automate → Edge `daily-time-request` → `outbox` → formulario público `/registro/:token` (Edge `time-log`). Hora, días y encendido parametrizables en Configuración. **La funcionalidad ya opera sin Teams ni Graph.** Puesta en marcha: [`POWER_AUTOMATE_RECORDATORIO.md`](POWER_AUTOMATE_RECORDATORIO.md). | 1 |
| **3. Calendario** ✅ | Edge `graph-calendar-sync`: consulta `/users/{correo}/calendarView` del día, llena `calendar_events_cache` y sugiere la celda de la sábana cruzando el asunto contra nombres de proyecto y subproyecto. Habilitación en Entra ID: [`CALENDARIO_OUTLOOK.md`](CALENDARIO_OUTLOOK.md). | 0, 1 |
| **4. Teams** | Flujo de Power Automate + Edge `teams-worker` y `time-log-hook` (firma del webhook, idempotencia por `request_id`, las mismas tres defensas de `email-to-task`). | 0, 2, 3 |
| **5. Tablero** | Vista `planeado_vs_ejecutado` (join de `allocations`/`activities` contra `daily_time_logs` por persona-proyecto-mes) + pantalla en Reportes con desviación y cobertura de registro. | 1, 2 |
| **6. Piloto y rollout** | 6–10 personas, dos semanas. Métrica de corte: **tasa de registro diario ≥ 80 %** sostenida en la segunda semana. Ajustes, comunicación y ampliación por áreas. | 4, 5 |

Las fases 2 y 3 son paralelizables una vez cerrada la 1. La 2 entrega valor por sí sola, lo que permite detenerse sin pérdida si la habilitación en Entra se demora.

## 6. Riesgos

| Riesgo | Mitigación |
|---|---|
| El consentimiento del administrador de M365 no llega o se atrasa. | La Fase 2 (correo) no depende de Graph y se despliega sola. Radicar la solicitud el día uno. |
| Licencias Premium de Power Automate para el conector HTTP. | Verificar en Fase 0. Si no las hay, ir directo a la opción A (Azure Bot Service) o quedarse solo con correo. |
| Zonas horarias. | Guardar siempre `timestamptz` y pedir los eventos a Graph con `Prefer: outlook.timezone="America/Bogota"`. El cron corre en UTC: 16:30 Bogotá = 21:30 UTC. |
| La gente registra 8 horas de golpe sin detalle. | El tablero expone "cobertura de detalle" (% de horas con proyecto específico), no solo el total. Se conversa, no se bloquea. |
| Percepción de control sobre el tiempo del equipo. | Comunicación previa, calendario privado protegido, y el dato se usa para calibrar la planeación del mes siguiente, no para evaluar personas. Conviene decirlo así, con esas palabras, en el lanzamiento. |
| Duplicados por reintentos del proveedor. | Índice único sobre `(person_id, calendar_event_id)` y sobre `time_requests`, igual que `source_message_id` en `email-to-task`: la defensa vive en el índice, no en el código. |

## 7. Siguientes pasos

El código de las Fases 1, 2 y 3 está escrito. Lo que queda son las dos cosas que se hacen **fuera del repositorio**, en el tenant de Microsoft:

1. **Armar el flujo de Power Automate** — [`POWER_AUTOMATE_RECORDATORIO.md`](POWER_AUTOMATE_RECORDATORIO.md). Un disparador de recurrencia y una acción HTTP; el resto ya está resuelto del lado de la plataforma. Confirmar de paso la licencia Premium para la acción HTTP: si no la hay, el mismo latido sale por `pg_cron` + `pg_net` sin cambiar nada más.
2. **Registrar la aplicación en Entra ID** y acotarla con la Application Access Policy — [`CALENDARIO_OUTLOOK.md`](CALENDARIO_OUTLOOK.md). Lo hace quien administre M365. Es la ruta crítica y no depende de nada de lo anterior, así que conviene radicarlo ya.

Y, en paralelo, definir el grupo piloto y la hora del recordatorio con sus líderes — la hora se cambia en Configuración cuantas veces haga falta.

El orden importa poco: con solo el punto 1 el equipo ya registra por correo; el punto 2 agrega las reuniones pre-cargadas. Si el punto 2 se demora, no bloquea nada.

# Documentación — Distribución de Trabajo

Documento único de referencia del proyecto: qué hace, cómo está construido,
cómo se opera y qué reglas de negocio están codificadas dónde.

Complementos (no repiten lo que hay aquí, lo amplían):

- [`INSTALACION.md`](INSTALACION.md) — puesta en marcha paso a paso.
- [`ARQUITECTURA.md`](ARQUITECTURA.md) — ERD completo y detalle de RLS.
- [`../README.md`](../README.md) — resumen corto para quien llega al repo.

---

## 1. Qué es

Plataforma para planificar cuántas horas dedica cada colaborador a cada
proyecto, mes a mes. Sustituye la sábana de Excel que se llevaba a mano:
una grilla personas × proyectos con autoguardado, y alrededor de ella el
control de acceso, la auditoría, los reportes y el seguimiento de tareas.

La unidad de trabajo es el **mes**. Todo lo demás (personas, proyectos,
horas, tareas) pertenece a un mes concreto.

## 2. Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 19 + TypeScript + Vite |
| UI | TailwindCSS v4 + shadcn/ui (Radix) |
| Grilla | react-data-grid |
| Estado servidor | TanStack Query |
| Estado UI | Zustand |
| Formularios | react-hook-form + zod |
| Gráficos | Recharts |
| Exportar | write-excel-file (Excel), @react-pdf/renderer (PDF) |
| Backend | Supabase (Postgres, Auth, RLS, Realtime, Edge Functions) |
| Hosting | Cloudflare Pages |

Scripts: `npm run dev`, `npm run build` (type-check + build),
`npm run preview`, `npm run lint` (oxlint).

## 3. Estructura del repositorio

```
src/
  routes/            ProtectedRoute, RoleRoute, router.tsx (rutas lazy)
  app/providers.tsx  QueryClientProvider, TooltipProvider, Toaster
  components/ui/     primitivas shadcn
  components/shared/ AppShell, MonthSwitcher, ConfirmDialog, NoActiveMonth…
  stores/            sessionStore (sesión/perfil), activeMonthStore (mes activo)
  lib/               supabaseClient, roles, theme, utils
  types/             database.types.ts (tipos del esquema + alias de enums)
  features/<módulo>/
    api/         llamadas a Supabase
    hooks/       TanStack Query (queries y mutaciones)
    components/
    lib/         helpers puros del módulo
    pages/
supabase/
  migrations/        esquema, RLS, triggers, vistas y RPCs (en orden)
  functions/         Edge Functions (invite-user)
docs/
```

Cada módulo de negocio es una carpeta en `src/features/`. La convención
`api / hooks / components / pages` se respeta en todos: la capa `api` no
conoce React, los `hooks` envuelven TanStack Query, y las páginas no llaman
a Supabase directamente.

## 4. Conceptos centrales

### 4.1 El mes activo

El mes activo es contexto global de trabajo (como el workspace activo en
Notion o Airtable), no un parámetro de la URL. Vive en `activeMonthStore`
(zustand + `persist` en localStorage) y se cambia desde el `MonthSwitcher`
del header, disponible en toda la app. Distribución, Tareas, Proyectos,
Personas y Reportes operan sobre él.

### 4.2 Cuentas y personas son cosas distintas

`profiles` son las cuentas que inician sesión. `people` es el roster de un
mes: filas que se duplican mes a mes. **`people.profile_id`** es el puente
entre ambos, y es lo que hace posible la regla "cada quien ve lo suyo".

Es opcional: hay personas del roster sin cuenta en la plataforma. Pero un
Analista de Tecnología **sin** vínculo en el mes activo no verá ninguna
tarea ni cronograma — la app lo dice explícitamente en vez de mostrar
pantallas vacías. Se asigna en Personas → editar → **Cuenta vinculada**, y
se conserva al duplicar el mes.

Un índice único `(month_id, profile_id)` impide vincular la misma cuenta a
dos personas del mismo mes: si ocurriera, "mis tareas" devolvería dos
rosters y las horas se contarían dos veces.

### 4.3 Personas y proyectos "scoped" por mes

`people` y `projects` **no** son catálogos globales: cada fila lleva
`month_id` y pertenece a un único mes. Crear un mes nuevo desde otro
(`create_month_from_previous`) **duplica** las filas con IDs nuevos y guarda
el linaje en `cloned_from_id`.

Consecuencia deliberada: editar las personas de julio nunca toca las de
marzo, y el histórico de cada mes queda congelado tal como se trabajó.

### 4.4 Estados de un mes

`abierto` → `cerrado` → `archivado`.

- **abierto**: gestores y administradores editan con normalidad.
- **cerrado**: solo administradores pueden escribir (`can_write_month()`).
- **archivado**: solo lectura para todos salvo administrador; la transición
  a archivado y el borrado son exclusivos de administrador
  (trigger `guard_month_status_transition`).

### 4.5 Horas: tres niveles

| Nivel | Tabla | Entra en el cálculo del mes |
|---|---|---|
| Celda de la grilla | `allocations.hours` | **Sí** — es la asignación oficial |
| Desglose de una celda | `activities.hours` | **Sí** — un trigger las suma en la celda |
| Seguimiento de un work item | `tasks.estimated_hours` / `completed_hours` | **No** |

Si una celda tiene actividades, su total deja de editarse a mano: pasa a ser
la suma de sus actividades (`sync_allocation_hours_from_activities`). Si se
queda sin actividades, vuelve a 0 y a ser editable.

Las horas de una **tarea** son seguimiento cualitativo y están separadas a
propósito: mover una tarjeta en el tablero nunca debe alterar la
distribución de horas del mes.

## 5. Módulos

### 5.1 Dashboard (`/dashboard`)

KPIs del mes activo, medidor de utilización, lista de atención
(sobreasignaciones y personas sin carga), proyectos con más horas y últimos
cambios registrados en auditoría.

### 5.2 Distribución de trabajo (`/distribucion`)

La grilla personas × proyectos, corazón de la app.

- Autoguardado optimista por celda: se pinta el valor de inmediato y se
  revierte solo si Supabase rechaza el cambio.
- Las filas se derivan del cache de TanStack Query
  (`buildGridRows(people, allocations)`), no de un estado local paralelo:
  Total, Diferencia y color de estado se recalculan en el render siguiente.
- Semáforo verde / amarillo / rojo según horas asignadas vs. disponibles.
- Copiar/pegar de bloques multi-celda desde Excel (TSV) con un handler
  propio, no el `onCellPaste` de una sola celda de la librería.
- Realtime: las ediciones de otros usuarios sobre el mismo mes aparecen sin
  recargar.
- Cada celda puede abrir su hilo de **comentarios** y su desglose de
  **actividades** (descripción, fase de la metodología de innovación,
  fecha y horas).

### 5.3 Tareas (`/tareas`)

Tablero y backlog de work items del mes activo, con el vocabulario de Azure
DevOps Boards. Detalle completo en la [sección 6](#6-módulo-tareas).

### 5.4 Cronograma (`/cronograma`)

El trabajo de una persona sobre el eje del tiempo, en dos pestañas.
Detalle completo en la [sección 7](#7-módulo-cronograma).

### 5.5 Gestión de meses (`/meses`) — solo Administrador

Crear, duplicar, cerrar, archivar y eliminar meses. Duplicar copia el roster
(con sus tarifas) y la distribución de horas del mes de origen; el catálogo de
proyectos no se duplica porque los proyectos son durables, y las tareas
tampoco: en el mes nuevo el trabajo vuelve a empezar.
Cada mes admite **snapshots**: checkpoints restaurables de su roster y su
reparto de horas.

Es el único módulo del ciclo de vida del mes y es exclusivo del
Administrador: los demás roles **eligen** el mes en el selector del
encabezado y trabajan dentro de él, pero no lo crean ni lo cierran.

**Liberación.** Un mes nace *en preparación* (`months.released_at` en null):
lo ven el Administrador y los Gestores, que reparten las horas y cargan las
actividades, pero **ningún analista** — ni el mes en su selector, ni sus
tareas, ni sus horas (lo aplican las políticas de `months`, `tasks`,
`activities` y `allocations` vía `is_month_released`). Cuando la sábana está
lista, el Administrador la **libera al equipo** desde el menú del mes. Es
manual a propósito: es la luz verde. Se puede volver a preparación si se
liberó antes de tiempo. La fecha y el autor los sella el servidor
(`month_seal_release`); los meses que ya existían quedaron liberados en la
migración, para no esconderle a nadie su trabajo en curso.

### 5.6 Proyectos (`/proyectos`)

CRUD del portafolio del mes: nombre, color (identifica la columna en la
grilla), gerente responsable, estado y categoría. La categoría
`institucional` marca bloques que no son un proyecto del portafolio
(capacitación, feedback…) para poder excluirlos en Reportes.


**Tres categorías.** `proyecto` es el portafolio; `institucional` agrupa
bloques que no son un proyecto (capacitación, feedback) y Reportes puede
excluirlos; `emergente` es trabajo que apareció sin estar planeado. El
emergente consume horas y se le asignan personas y tareas igual que a un
proyecto —por eso es una categoría y no una tabla aparte—, pero se navega
separado: en Proyectos vive en su propia tarjeta al final, con buscador y
filtro de estado propios y ordenado del más viejo al más nuevo; y en la
sábana no aparece mezclado en "Agregar proyecto", sino en su propio grupo del
menú, con su acción "Crear un emergente".

### 5.7 El equipo ya no se administra aparte

**No existe un módulo `/personas`.** Se eliminó: el equipo casi no cambia y
todo el mundo tiene cuenta, así que mantener un roster a mano era llevar dos
listas de las mismas personas — y dar de alta a alguien exigía invitar la
cuenta, agregarlo al roster y vincular ambas cosas, con el tercer paso
olvidándose siempre (el síntoma eran los gestores que no aparecían al
asignar).

La tabla `people` **sí sigue existiendo**, y es estructural: `allocations`,
`task_assignees`, `project_managers`, `project_members` y `person_rates`
apuntan a ella, y al ser por mes es lo que conserva el histórico ("en agosto
éramos 12"). Lo que desapareció es tener que mantenerla:

| Qué | Dónde se hace ahora |
|---|---|
| Alta | Activar la cuenta en *Configuración › Usuarios*. Un trigger (`profile_syncs_person`) le crea la fila en todos los meses **abiertos**, ya vinculada y con las horas por defecto del mes. |
| Baja | Desactivar la cuenta: la persona queda `inactivo` en los meses abiertos, sin borrar su historial. |
| Nombre y cargo | En la cuenta. `profiles.job_title` es la fuente; baja a `people.job_title` de los meses abiertos, que es lo que leen las vistas de reporte. Los meses cerrados conservan el cargo que la persona tenía entonces. |
| Horas disponibles | En la **fila "Disponible" de la grilla de Distribución**, editable en línea. Son del mes (vacaciones, medio tiempo) y ahí es donde se miran: son el denominador del semáforo. |
| Tarifas | *Configuración › Tarifas* (solo Administrador), como antes por persona-mes. |

Un mes nuevo arranca con el equipo puesto: `seed_month_people` copia las
personas activas del mes más reciente **y** suma cualquier cuenta activa que
no tenga fila. Es idempotente — con gente en el mes no hace nada — y el botón
"Traer el equipo" de Distribución llama a la misma función para un mes que
haya quedado vacío.

Pertenecer a un proyecto tampoco se declara aparte: repartirle horas a alguien
en Distribución lo suma al equipo del proyecto
(`allocation_implies_membership`).

**Quién ocupa columna en la grilla.** Solo el Analista: Gestor y Administrador
dirigen el trabajo, no lo ejecutan, así que su tiempo no se reparte en la
sábana ni suma capacidad en el Dashboard — si sumara, el equipo aparecería con
cientos de horas libres que nadie va a trabajar. El Analista de Tecnología
también queda fuera (gestiona su propio trabajo). El criterio vive en
`usePlanningExclusions`, que usan la grilla y el Dashboard, para que no puedan
contradecirse. Una fila sin cuenta vinculada no se excluye: es roster viejo
cargado a mano y esconderla ocultaría sus horas sin explicación.

### 5.8 Reportes (`/reportes`)

Resumen ejecutivo con gráficos (horas por proyecto, por gerente, ranking de
carga) y exportación a Excel y PDF. Se apoya en tres vistas de Postgres:
`v_person_month_totals`, `v_project_month_totals` y
`v_manager_month_totals`.

### 5.9 Historial (`/historial`, solo administrador)

Auditoría completa: una fila por campo modificado, con quién, cuándo y los
valores anterior y nuevo.

### 5.10 Configuración (`/configuracion`, solo administrador)

Datos de la empresa, horas por defecto, gestión de usuarios e invitaciones.

---

## 6. Módulo Tareas

Seguimiento de trabajo del mes con la estructura de Azure DevOps Boards.
Vive en `src/features/tasks/` y se apoya en la tabla `tasks`.

### 6.1 Modelo del work item

| Campo | Descripción |
|---|---|
| `work_item_type` | `epica`, `historia`, `tarea`, `bug` |
| `status` | `pendiente`, `en_progreso`, `en_revision`, `bloqueada`, `completada` |
| `priority` | `1` crítica … `4` baja (misma escala de Azure DevOps) |
| `project_id` | Proyecto del mes al que pertenece (obligatorio) |
| `assigned_person_id` | Persona responsable (opcional) |
| `parent_task_id` | Jerarquía épica → historia → tarea (opcional) |
| `tags` | Etiquetas libres, `text[]` |
| `estimated_hours` / `completed_hours` | Estimación y avance del work item |
| `start_date` / `due_date` | Rango de fechas — es lo que dibuja la barra del Gantt |
| `board_order` | Posición dentro de su columna del tablero |
| `started_at` / `completed_at` | Marcas de flujo, las sella el servidor |

### 6.2 Las dos vistas

**Tablero** — cinco columnas en el orden del flujo: Por hacer → En progreso →
En revisión → Bloqueada → Completada. Las tarjetas se arrastran entre
columnas y dentro de una misma columna; una línea marca dónde se insertará.

**La columna depende de quién mira.** Una tarea entregada (`en_revision`) se
pinta en la columna **Por hacer del gerente del proyecto**, con el distintivo
"Por revisar": para quien revisa, revisar es su pendiente. Quien la entregó la
sigue viendo en "En revisión" — que es lo que le pasa a él, está esperando. El
estado en la base es uno solo; lo único que cambia por usuario es en qué
columna se dibuja (`awaitingMyReview` en `TareasPage`). Al arrastrarla, el
tablero traduce: sacarla a "Completada" es aprobar, a cualquier otra columna es
devolverla (y suma `returned_count`); dejarla en "Por hacer" o "En revisión" no
la mueve.

**Backlog** — la misma información como lista ordenada por prioridad, para
planificar sin arrastrar. El estado se cambia desde el select de cada fila,
lo que equivale a mover la tarjeta de columna (y la manda al final de la
columna destino, que es donde se espera encontrarla).

Ambas comparten la barra de filtros: búsqueda por texto (título, descripción
o etiqueta), proyecto, persona y tipo de work item.

### 6.2.1 De actividad de la sábana a tarea

Las actividades que Gestor/Administrador desglosan en una celda de
Distribución **son** el encargo de trabajo: al crearlas, un trigger
(`activity_syncs_task`) genera la tarea equivalente, asignada a la persona de
esa celda, con la descripción como título, las horas como `estimated_hours` y
la fecha de la actividad como `start_date`/`due_date` — así aparece en su
tablero y en su cronograma sin que nadie la vuelva a escribir. Una actividad
sin fecha genera la tarea igual; el Gantt la lista en su bloque "sin fechas".

La actividad manda y la tarea es su cara operativa: editar la actividad
sincroniza título, horas y fecha; borrarla borra la tarea **solo si nadie la
trabajó** (sigue en `pendiente` y sin comentarios) — si ya se movió, la tarea
sobrevive con `activities.task_id` en null, para no borrarle el trabajo a
nadie. El estado NO se sincroniza al revés: mover la tarjeta no cambia las
horas repartidas. Las horas del mes son la planeación; el tablero es la
ejecución.

### 6.2.2 Entregar exige horas reales

La sábana reparte horas **planeadas**; sin el dato real no hay contra qué
compararlas. Se piden en la entrega, que es cuando la persona acaba el trabajo
y lo tiene fresco: mover una tarjeta a *En revisión* abre el diálogo de
entrega, y el cambio de estado lo hace el RPC `submit_task_for_review` junto
con el reporte — un solo acto, para que ninguna entrega quede sin su número.
El trigger del circuito rechaza un `en_revision` que llegue por otra vía
cuando el reporte es obligatorio.

Cada entrega deja su fila en `task_time_reports` (`round` 1 = entrega inicial,
2+ = cada reproceso tras una devolución), así que un trabajo devuelto reporta
**las horas de esa vuelta** y se ve cuánto costó de más el reproceso, en vez de
pisar un único número. `tasks.completed_hours` guarda el acumulado y es lo que
el tablero y el backlog muestran junto a las planeadas.

**Quién reporta:** el Analista (a secas) sobre tareas que **no creó él**
(`task_requires_time_report`). Lo que uno se pone a sí mismo no es un encargo
que haya que medir contra un plan; el Analista de Tecnología queda fuera, igual
que del circuito de revisión, y Gestor/Administrador cierran directo.

### 6.2.3 Devolver exige motivo

Sacar una entrega de revisión sin cerrarla es **devolverla**, y eso pasa por el
RPC `return_task_for_rework`: el motivo entra como comentario de la tarea y el
estado cambia en el mismo acto (el trigger rechaza la devolución que llegue por
otra vía). Sin explicación, el analista adivina — y encima el reproceso se le
va a medir en horas.

Excepción: que **quien entregó** retire su propia entrega no es una devolución
y no pide motivo; no hay a quién explicarle nada.

### 6.2.4 Quién ve qué tarea

`tasks_select_scoped` recorta por rol, no por mes:

| Rol | Ve |
|---|---|
| Administrador | todo |
| Gestor | las tareas de los proyectos que **gerencia**, más las que creó y las que tiene asignadas |
| Analista | solo lo asignado a él y lo que él creó, y solo si el mes está liberado |

Ser **miembro** de un proyecto ya no abre el trabajo ajeno: la pertenencia
sirve para asignar, no para mirar.

Y para **borrar** manda la autoría, con el alcance del rol encima
(`tasks_delete_write`): el Analista borra lo que él creó, el Gestor lo suyo y
lo de los proyectos que gerencia, el Administrador cualquiera. Tener la tarea
asignada no habilita el borrado — se entrega o se comenta, no se hace
desaparecer. La opción "Eliminar" solo aparece donde va a funcionar
(`canDeleteTask`).

Dentro de eso, el tablero del Gestor abre en **"Mis tareas"** (lo que creó, lo
que tiene asignado y lo que le entregaron para revisar). "Todo lo de mis
proyectos" está a un clic, pero no es el punto de partida: el tablero es para
trabajar, no para supervisar. El Analista no ve ese filtro — la base ya solo le
manda lo suyo.

### 6.3 Decisiones de implementación

- **Arrastre nativo HTML5** (`dragstart`/`dragover`/`drop`) en vez de una
  librería de drag & drop: el tablero solo mueve tarjetas entre cinco
  columnas y así el módulo no agrega peso al bundle.
- **`board_order` es `numeric`, no un entero de posición.** Soltar una
  tarjeta entre otras dos calcula el punto medio de sus `board_order`, así
  que reordenar es **un solo UPDATE** en vez de reescribir la columna
  entera. Las tarjetas nuevas entran al final con un hueco de 1000.
- **Movimiento optimista**: la tarjeta se pinta en su nueva columna al
  instante y vuelve sola a su sitio si RLS rechaza el cambio (por ejemplo,
  el mes se cerró mientras el tablero estaba abierto). Mismo patrón que el
  autoguardado de la grilla.
- **`started_at` / `completed_at` los fija el servidor**
  (trigger `tasks_track_status_timestamps`), no el cliente: entrar por
  primera vez a un estado de trabajo sella `started_at`, llegar a
  `completada` sella `completed_at`, y reabrir una tarjeta lo limpia. Así el
  dato es consistente se cambie el estado desde el tablero, el backlog o el
  detalle.
- **Realtime** sobre `tasks`: el tablero es colaborativo, varias personas
  mueven tarjetas del mismo mes a la vez.
- **Crear un proyecto sin salir del diálogo.** El desplegable de proyecto
  termina siempre con "+ Crear proyecto nuevo": si el trabajo pertenece a un
  proyecto que aún no existe en el mes, no tiene sentido bloquear la tarea
  hasta que un gestor lo cree. Va **al final**, después de los proyectos
  reales, para que la acción no compita con la selección normal. Se crea solo
  con nombre y el azul de marca; color, gerente y estado se ajustan luego
  desde Proyectos. Los analistas pueden crear proyectos pero no editarlos ni
  eliminarlos.
- **Borrar un padre no borra los hijos** (`on delete set null`): quedan sin
  padre en el backlog en vez de desaparecer sin aviso.

### 6.4 Límites conocidos

- El arrastre usa la API nativa de HTML5, que **no funciona con teclado**.
  Como alternativa accesible, la tarjeta se abre con Enter o Espacio y el
  estado se cambia desde el detalle o desde el select del backlog.
- La UI impide que una tarjeta sea su propio padre, pero no detecta ciclos
  más largos (A → B → A). La jerarquía solo agrupa visualmente; nada se
  calcula en cascada sobre ella, así que un ciclo no rompe cálculos.
- `create_month_from_previous` **no** copia las tareas: desde que el proyecto
  es durable, duplicar un mes es copiar el roster y el reparto de horas. Las
  tareas se quedan en el mes en el que se crearon.
- Las tareas tampoco forman parte de `month_snapshots`, y restaurar no las
  toca. Cuidado con la versión vieja de esta afirmación: entre julio y el 12
  de agosto de 2026 era falsa. `restore_month_snapshot` borraba y reinsertaba
  `projects`, y como `tasks.project_id` es ON DELETE CASCADE, restaurar habría
  vaciado el tablero del mes entero. Nadie llegó a restaurar en esa ventana.
  Hoy el snapshot no incluye `projects` y no hay camino de restaurar a `tasks`.
- **Borrar un mes sí borra las tareas**, y eso sigue vigente:
  `tasks.month_id` es ON DELETE CASCADE. Es lo que se llevó 68 tarjetas el 11
  y el 12 de agosto de 2026 (entonces bajaba además por
  `projects.month_id`, que ya no existe). El borrado de un mes es la operación
  más destructiva de la plataforma y no tiene vuelta atrás salvo por
  `audit_logs`.

---

## 7. Módulo Cronograma

El trabajo de **una persona** sobre el eje del tiempo. Vive en
`src/features/schedule/` y no tiene tablas propias: combina lo que ya
existe (`tasks` para la planeación, `activities` para el tiempo real).

### 7.1 Las dos pestañas

**Gantt de tareas** — una barra por work item entre `start_date` y
`due_date`, coloreada con el color de su proyecto, sobre un eje de días.
Marca el día de hoy y atenúa lo completado. Las tareas **sin fechas** no se
esconden: se listan aparte, para que se note que les falta planificación en
vez de desaparecer sin explicación.

**Calendario de horas** — rejilla proyecto × día con las horas realmente
registradas, más totales por día, por proyecto y del período. Al hacer clic
en una celda se abre el registro de ese día: qué se trabajó, cuántas horas y
en qué fase.

Las filas del calendario son **proyectos y no tareas** porque el registro de
tiempo del sistema son las `activities`, que cuelgan de una celda persona ×
proyecto y no de un work item. El Gantt cubre la otra mitad de la pregunta:
qué tarea ocupa qué días.

### 7.2 De quién es el cronograma

Siempre es "el de alguien", y por defecto el propio (resuelto con
`people.profile_id`, ver [4.2](#42-cuentas-y-personas-son-cosas-distintas)):

- **Administrador, Gestor, Analista** eligen a cualquier persona del roster
  desde un selector.
- **Analista de Tecnología** no ve el selector: RLS solo le devuelve lo
  suyo, así que elegir a otra persona mostraría listas vacías.

### 7.3 El eje temporal se deriva de los datos

`months` guarda un **nombre de texto**, no un rango de fechas — el esquema
nunca tuvo día de inicio y fin. Así que el eje del cronograma se calcula a
partir de las fechas que sí existen (tareas y actividades) y, cuando no hay
ninguna, cae al mes natural en curso. Un rango de menos de una semana se
ensancha al mes que lo contiene, para que una tarea suelta no se vea como
una columna aislada sin contexto.

### 7.4 Registrar tiempo cambia la distribución del mes

Es una consecuencia deliberada y conviene tenerla presente: el calendario
escribe en `activities`, y el trigger
`sync_allocation_hours_from_activities` mantiene
`allocations.hours = suma de sus actividades`. Es decir, **las horas que un
analista registra aquí quedan reflejadas en la distribución oficial del
mes**.

Es el punto del módulo — que cada quien gestione su tiempo — y está acotado:
solo sobre sus propias celdas, solo con el mes abierto, y todo queda en
auditoría como cualquier otro cambio.

### 7.5 Límites conocidos

- Las barras del Gantt no se arrastran: las fechas se cambian abriendo el
  work item. Mover barras exigiría el mismo tipo de arrastre del tablero
  sobre un eje continuo, y no estaba en el alcance.
- Una tarea con solo una de las dos fechas se dibuja como una barra de un
  día en esa fecha.
- El calendario muestra todos los proyectos no archivados del mes como
  filas, tenga o no horas la persona: es lo que permite registrar tiempo en
  un proyecto donde aún no tenía nada.

## 8. Roles y seguridad

### 8.1 Los cuatro roles

- **Administrador** — todo, incluida gestión de usuarios, auditoría,
  escritura sobre meses cerrados o archivados y **la administración de los
  meses**: crear, duplicar, editar, abrir/cerrar, archivar y eliminar. El
  módulo *Meses* solo lo ve él.
- **Gestor** — edita horas, tareas, proyectos y personas **mientras el mes
  esté abierto**; no administra usuarios **ni los meses** (trabaja dentro
  del mes que elige en el selector del encabezado).
- **Analista** — consulta, filtra, busca y comenta; no edita horas. **Sí**
  gestiona sus propias tareas (ver abajo).
- **Analista de Tecnología** — ver abajo.

Los tres primeros se distinguen por **cuánto** pueden hacer sobre todo el
mes. El cuarto se distingue por **sobre qué**: solo su propio trabajo.

#### Dos ejes independientes

Los dos roles de analista son **equivalentes en Tareas** y se diferencian en
todo lo demás. Conviene no confundir los dos ejes que los separan:

| Eje | Función | A quién alcanza |
|---|---|---|
| Qué **ve** | `is_analista_tecnologia()` | Solo el Analista de Tecnología tiene la vista recortada a lo suyo. El Analista ve el trabajo de todo el equipo. |
| Qué **escribe** | `is_analista_role()` → `can_write_own_work()` | Ambos: crean y gestionan tareas, pero solo las asignadas a sí mismos. |

En el frontend son `isAnalistaTecnologia()` y `writesOwnWorkOnly()`.

#### Analista de Tecnología

| | |
|---|---|
| **Módulos** | Tareas y Cronograma, nada más. El resto ni aparece en el menú ni es alcanzable por URL (`RoleRoute`). |
| **Ve** | Solo work items asignados a él, sus celdas de horas, sus actividades y su propia fila del roster. Una tarea sin asignar tampoco le aparece. |
| **Escribe** | Sus tareas (crear, editar, mover, borrar), proyectos nuevos y su registro de tiempo, **mientras el mes esté abierto**. |
| **No puede** | Asignar una tarea a otra persona, ni "regalar" una suya: el `with check` de la política lo exige asignado a sí mismo. Tampoco editar ni eliminar proyectos, solo crearlos. |
| **Requisito** | Su cuenta debe estar vinculada a una persona del roster del mes (ver [4.2](#42-cuentas-y-personas-son-cosas-distintas)). Sin vínculo no ve nada, y la app se lo explica. |

El aislamiento es de **base de datos, no de interfaz**: aunque consulte la
API directamente con su token, Postgres no le devuelve trabajo ajeno.

### 8.2 Dónde vive la seguridad

**En las políticas RLS de `supabase/migrations/`, no en el frontend.**
`RoleRoute` y los chequeos de `lib/roles.ts` solo ocultan acciones que el
backend rechazaría de todos modos.

Funciones `security definer` que usan las políticas:

| Función | Qué verifica |
|---|---|
| `is_admin()` | rol `administrador` del usuario actual |
| `is_gestor_or_admin()` | rol `administrador` o `gestor` |
| `is_month_locked(month_id)` | el mes no está `abierto` |
| `can_write_month(month_id)` | admin siempre; gestor solo si el mes sigue abierto |
| `is_analista_tecnologia()` | rol `analista_tecnologia` (eje de **lectura**) |
| `is_analista_role()` | rol `analista` o `analista_tecnologia` (eje de **escritura**) |
| `is_own_person(person_id)` | esa fila del roster tiene `profile_id = auth.uid()`; false si es null |
| `is_own_allocation(allocation_id)` | esa celda es de la persona vinculada al usuario actual |
| `can_write_own_work(month_id, person_id)` | analista (cualquiera de los dos) + mes abierto + es suyo |

Resumen de permisos por tabla (el detalle completo está en
[`ARQUITECTURA.md`](ARQUITECTURA.md#roles-y-rls)):

| Tabla | Lectura | Escritura |
|---|---|---|
| `project_managers` | autenticado | `can_write_month()` |
| `projects` | autenticado | crear: `can_write_month()` o cualquier analista con el mes abierto; editar/eliminar: solo `can_write_month()` |
| `tasks` | autenticado, salvo analista de tecnología → solo las asignadas a él | `can_write_month()` o `can_write_own_work()` |
| `allocations`, `activities` | autenticado, salvo analista de tecnología → solo las suyas | `can_write_month()`; `activities` además el analista sobre sus celdas con el mes abierto |
| `people` | autenticado, salvo analista de tecnología → solo su propia fila | `can_write_month()` |
| `allocations` (excepción) | — | insertar con `hours = 0` lo puede hacer cualquiera, para anclar un comentario o registrar tiempo en una celda vacía |
| `comments` | autenticado, salvo analista de tecnología → solo las de sus celdas | insertar: cualquiera (autor = self); editar/borrar: autor o admin |
| `profiles` | autenticado | propio perfil; `role`/`is_active` solo admin |
| `settings` / `invitations` | `settings`: cualquiera / `invitations`: admin | solo admin |
| `audit_logs`, `month_snapshots` | admin (snapshots: gestor+admin) | ninguna — solo escriben triggers/RPC |

### 8.3 Alta de usuarios

El trigger `handle_new_user` crea todo perfil nuevo como `analista`, sin
mirar el rol que venga en el payload de registro: así nadie puede
auto-asignarse `administrador`. El primer administrador se promueve a mano
por SQL (ver [`INSTALACION.md`](INSTALACION.md), paso 4) y a partir de ahí
las cuentas se crean desde Configuración → Invitaciones, que usa el Edge
Function `invite-user`.

## 9. Auditoría

`audit_row_change()` es un trigger genérico (`security definer`) sobre
`months`, `people`, `projects`, `project_managers`, `tasks`, `allocations` y
`activities`:

- En `UPDATE`, compara el `jsonb` viejo contra el nuevo y escribe **una fila
  por campo que cambió**.
- En `INSERT` / `DELETE`, escribe una fila con el estado completo.

`audit_logs.record_id` **no** es una foreign key a propósito: el historial
debe sobrevivir al borrado de la fila original.

## 10. RPCs

- **`create_month_from_previous(source_month_id, new_name)`** — duplica un
  mes completo. Es una sola función `security definer` en vez de varios
  inserts desde el cliente porque hay que remapear IDs entre cuatro tablas
  de forma atómica (tablas temporales `_people_map` / `_project_map`); si el
  cliente lo hiciera en varios round-trips y se cortara la conexión,
  quedaría un mes a medio copiar. Copia personas (incluido su
  `profile_id`, para que nadie pierda acceso a su trabajo al abrirse el mes
  nuevo), proyectos, gerentes, tareas —con sus fechas y campos de tablero— y
  asignaciones. **No** copia comentarios ni auditoría.
- **`create_month_snapshot` / `restore_month_snapshot`** — checkpoint `jsonb`
  del roster, las tarifas y el reparto de horas del mes. Restaurar corrige en
  sitio y repone lo que falte, pero **no borra**: a nadie se le quita del
  roster (`task_assignees.person_id` es ON DELETE CASCADE y se llevaría las
  tarjetas asignadas) y ninguna celda de horas se elimina (arrastraría sus
  comentarios) — las que sobran quedan en 0, que es el mismo anclaje que usa
  un comentario sobre una celda vacía.

## 11. Convenciones para extender el proyecto

1. **Un módulo nuevo = una carpeta en `src/features/`** con
   `api / hooks / components / pages`. La página no llama a Supabase
   directamente.
2. **Ruta nueva**: entrada `lazy` en `src/routes/router.tsx` (usa el helper
   `lazyPage`, que además recarga una vez si el chunk quedó obsoleto tras un
   despliegue) y entrada en `NAV_ITEMS` de `AppShell.tsx`.
3. **Cambio de esquema = migración nueva** en `supabase/migrations/`, nunca
   editar una migración ya aplicada. Después, reflejar el cambio en
   `src/types/database.types.ts`.
4. **Toda tabla nueva**: `enable row level security`, `revoke all … from
   anon`, políticas explícitas, y trigger de auditoría si su historial
   importa.
5. **Permisos**: la política RLS es la regla; el chequeo en `lib/roles.ts`
   es solo para no mostrar botones que fallarían.
6. **Colores**: variables CSS de `src/index.css`, que implementa el sistema
   de diseño de Experia (ver `Experia-Design-System.md` en la raíz). Nunca
   un hex dentro de un componente: todo color que cambie con el tema va como
   `var(--token)`. La paleta de marca CEINFES (naranja, morado, azul, verde)
   y los colores de estado semánticos (`success` / `warning` / `danger`) son
   sets distintos y no deben mezclarse. Para gráficas, usar `--viz-1..8` en
   ese orden.

## 12. Despliegue

Frontend en Cloudflare Pages (`npm run build` → `dist`), backend en Supabase
hosteado. El SPA routing lo resuelve `wrangler.jsonc`
(`assets.not_found_handling: "single-page-application"`); **no** usar
`public/_redirects`, que el validador de Cloudflare rechaza como falso
positivo de bucle infinito. Procedimiento completo en
[`INSTALACION.md`](INSTALACION.md).

Migraciones: `supabase db push`. Se escribieron y revisaron a mano sin
`supabase start` (el entorno del proyecto no tiene Docker), así que conviene
aplicarlas primero contra un proyecto de prueba.

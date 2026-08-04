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

### 4.2 Personas y proyectos "scoped" por mes

`people` y `projects` **no** son catálogos globales: cada fila lleva
`month_id` y pertenece a un único mes. Crear un mes nuevo desde otro
(`create_month_from_previous`) **duplica** las filas con IDs nuevos y guarda
el linaje en `cloned_from_id`.

Consecuencia deliberada: editar las personas de julio nunca toca las de
marzo, y el histórico de cada mes queda congelado tal como se trabajó.

### 4.3 Estados de un mes

`abierto` → `cerrado` → `archivado`.

- **abierto**: gestores y administradores editan con normalidad.
- **cerrado**: solo administradores pueden escribir (`can_write_month()`).
- **archivado**: solo lectura para todos salvo administrador; la transición
  a archivado y el borrado son exclusivos de administrador
  (trigger `guard_month_status_transition`).

### 4.4 Horas: tres niveles

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

### 5.4 Gestión de meses (`/meses`)

Crear, duplicar, cerrar, archivar y eliminar meses. Duplicar copia personas,
proyectos, gerentes, tareas y la distribución de horas del mes de origen.
Cada mes admite **snapshots**: checkpoints restaurables de su estado.

### 5.5 Proyectos (`/proyectos`)

CRUD del portafolio del mes: nombre, color (identifica la columna en la
grilla), gerente responsable, estado y categoría. La categoría
`institucional` marca bloques que no son un proyecto del portafolio
(capacitación, feedback…) para poder excluirlos en Reportes.

### 5.6 Personas (`/personas`)

CRUD del equipo del mes: nombre, cargo, horas disponibles y estado.
`available_hours` es el denominador del semáforo de la grilla.

### 5.7 Reportes (`/reportes`)

Resumen ejecutivo con gráficos (horas por proyecto, por gerente, ranking de
carga) y exportación a Excel y PDF. Se apoya en tres vistas de Postgres:
`v_person_month_totals`, `v_project_month_totals` y
`v_manager_month_totals`.

### 5.8 Historial (`/historial`, solo administrador)

Auditoría completa: una fila por campo modificado, con quién, cuándo y los
valores anterior y nuevo.

### 5.9 Configuración (`/configuracion`, solo administrador)

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
| `due_date` | Fecha límite |
| `board_order` | Posición dentro de su columna del tablero |
| `started_at` / `completed_at` | Marcas de flujo, las sella el servidor |

### 6.2 Las dos vistas

**Tablero** — cinco columnas en el orden del flujo: Por hacer → En progreso →
En revisión → Bloqueada → Completada. Las tarjetas se arrastran entre
columnas y dentro de una misma columna; una línea marca dónde se insertará.

**Backlog** — la misma información como lista ordenada por prioridad, para
planificar sin arrastrar. El estado se cambia desde el select de cada fila,
lo que equivale a mover la tarjeta de columna (y la manda al final de la
columna destino, que es donde se espera encontrarla).

Ambas comparten la barra de filtros: búsqueda por texto (título, descripción
o etiqueta), proyecto, persona y tipo de work item.

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
- **Borrar un padre no borra los hijos** (`on delete set null`): quedan sin
  padre en el backlog en vez de desaparecer sin aviso.

### 6.4 Límites conocidos

- El arrastre usa la API nativa de HTML5, que **no funciona con teclado**.
  Como alternativa accesible, la tarjeta se abre con Enter o Espacio y el
  estado se cambia desde el detalle o desde el select del backlog.
- La UI impide que una tarjeta sea su propio padre, pero no detecta ciclos
  más largos (A → B → A). La jerarquía solo agrupa visualmente; nada se
  calcula en cascada sobre ella, así que un ciclo no rompe cálculos.
- `create_month_from_previous` copia las tareas al mes nuevo **sin** la
  jerarquía (`parent_task_id` queda en null) ni las marcas de tiempo:
  remapear los padres exigiría una tabla de mapeo adicional, y en el mes
  nuevo el trabajo vuelve a empezar.
- Las tareas **no** forman parte de `month_snapshots`. Restaurar un snapshot
  no las toca (pero sí borra y reinserta asignaciones).

---

## 7. Roles y seguridad

### 7.1 Los tres roles

- **Administrador** — todo, incluida gestión de usuarios, auditoría, y
  escritura sobre meses cerrados o archivados.
- **Gestor** — edita horas, tareas, proyectos, personas y meses **mientras
  el mes esté abierto**; no administra usuarios.
- **Analista** — consulta, filtra, busca y comenta; no edita horas.

### 7.2 Dónde vive la seguridad

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

Resumen de permisos por tabla (el detalle completo está en
[`ARQUITECTURA.md`](ARQUITECTURA.md#roles-y-rls)):

| Tabla | Lectura | Escritura |
|---|---|---|
| `people`, `projects`, `project_managers`, `tasks`, `allocations`, `activities` | autenticado | `can_write_month()` |
| `allocations` (excepción) | — | insertar con `hours = 0` lo puede hacer cualquiera, para que un Analista ancle un comentario a una celda vacía |
| `comments` | autenticado | insertar: cualquiera (autor = self); editar/borrar: autor o admin |
| `profiles` | autenticado | propio perfil; `role`/`is_active` solo admin |
| `settings` / `invitations` | `settings`: cualquiera / `invitations`: admin | solo admin |
| `audit_logs`, `month_snapshots` | admin (snapshots: gestor+admin) | ninguna — solo escriben triggers/RPC |

### 7.3 Alta de usuarios

El trigger `handle_new_user` crea todo perfil nuevo como `analista`, sin
mirar el rol que venga en el payload de registro: así nadie puede
auto-asignarse `administrador`. El primer administrador se promueve a mano
por SQL (ver [`INSTALACION.md`](INSTALACION.md), paso 4) y a partir de ahí
las cuentas se crean desde Configuración → Invitaciones, que usa el Edge
Function `invite-user`.

## 8. Auditoría

`audit_row_change()` es un trigger genérico (`security definer`) sobre
`months`, `people`, `projects`, `project_managers`, `tasks`, `allocations` y
`activities`:

- En `UPDATE`, compara el `jsonb` viejo contra el nuevo y escribe **una fila
  por campo que cambió**.
- En `INSERT` / `DELETE`, escribe una fila con el estado completo.

`audit_logs.record_id` **no** es una foreign key a propósito: el historial
debe sobrevivir al borrado de la fila original.

## 9. RPCs

- **`create_month_from_previous(source_month_id, new_name)`** — duplica un
  mes completo. Es una sola función `security definer` en vez de varios
  inserts desde el cliente porque hay que remapear IDs entre cuatro tablas
  de forma atómica (tablas temporales `_people_map` / `_project_map`); si el
  cliente lo hiciera en varios round-trips y se cortara la conexión,
  quedaría un mes a medio copiar. Copia personas, proyectos, gerentes,
  tareas y asignaciones. **No** copia comentarios ni auditoría.
- **`create_month_snapshot` / `restore_month_snapshot`** — checkpoint `jsonb`
  de personas, proyectos, gerentes y asignaciones. Restaurar borra y
  reinserta con los mismos IDs para que los comentarios existentes se
  reconecten.

## 10. Convenciones para extender el proyecto

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
6. **Colores**: variables CSS de `src/index.css`. La paleta de marca CEINFES
   (morado, azul, verde, naranja) y los colores de estado semánticos
   (`success` / `warning` / `danger`) son sets distintos y no deben
   mezclarse.

## 11. Despliegue

Frontend en Cloudflare Pages (`npm run build` → `dist`), backend en Supabase
hosteado. El SPA routing lo resuelve `wrangler.jsonc`
(`assets.not_found_handling: "single-page-application"`); **no** usar
`public/_redirects`, que el validador de Cloudflare rechaza como falso
positivo de bucle infinito. Procedimiento completo en
[`INSTALACION.md`](INSTALACION.md).

Migraciones: `supabase db push`. Se escribieron y revisaron a mano sin
`supabase start` (el entorno del proyecto no tiene Docker), así que conviene
aplicarlas primero contra un proyecto de prueba.

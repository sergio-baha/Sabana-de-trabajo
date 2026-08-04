# Arquitectura

## Decisión clave: personas y proyectos están "scoped" por mes

`people` y `projects` no son catálogos globales — cada fila lleva `month_id`
y pertenece a un único mes. Crear un mes nuevo (`create_month_from_previous`)
**duplica** las filas del mes de origen con IDs nuevos (`cloned_from_id`
guarda el linaje), en vez de reutilizar las mismas filas. Esto es lo que el
spec pide literalmente ("crear un mes nuevo copia... personas, proyectos,
distribución") y además preserva el historial: editar personas de julio
nunca toca las de marzo.

## Modelo de datos (ERD)

```mermaid
erDiagram
    profiles ||--o{ months : created_by
    months ||--o{ people : month_id
    months ||--o{ projects : month_id
    months ||--o{ project_managers : month_id
    months ||--o{ tasks : month_id
    months ||--o{ allocations : month_id
    months ||--o{ month_snapshots : month_id
    months }o--o| months : source_month_id

    people ||--o{ allocations : person_id
    people ||--o{ project_managers : person_id
    people }o--o| people : cloned_from_id

    projects ||--o{ allocations : project_id
    projects ||--o{ project_managers : project_id
    projects ||--o{ tasks : project_id
    projects }o--o| projects : cloned_from_id

    tasks }o--o| tasks : parent_task_id
    people ||--o{ tasks : assigned_person_id

    allocations ||--o{ comments : allocation_id
    comments }o--o| comments : parent_comment_id
    profiles ||--o{ comments : author_id

    profiles {
        uuid id PK
        text email
        text full_name
        app_role role
        boolean is_active
    }
    months {
        uuid id PK
        text name
        month_status status
        smallint default_hours
        uuid source_month_id FK
    }
    people {
        uuid id PK
        uuid month_id FK
        text name
        numeric available_hours
        person_status status
        uuid cloned_from_id FK
    }
    projects {
        uuid id PK
        uuid month_id FK
        text name
        text color
        project_status status
        uuid cloned_from_id FK
    }
    project_managers {
        uuid id PK
        uuid project_id FK
        uuid person_id FK
        boolean is_primary
    }
    allocations {
        uuid id PK
        uuid month_id FK
        uuid person_id FK
        uuid project_id FK
        numeric hours
    }
    tasks {
        uuid id PK
        uuid project_id FK
        uuid parent_task_id FK
        text title
        task_status status
        work_item_type work_item_type
        smallint priority
        numeric board_order
    }
    comments {
        uuid id PK
        uuid allocation_id FK
        uuid parent_comment_id FK
        uuid author_id FK
        text body
    }
    settings {
        smallint id PK
        text company_name
        smallint default_hours
    }
    invitations {
        uuid id PK
        text email
        app_role role
        invitation_status status
    }
    audit_logs {
        uuid id PK
        text table_name
        uuid record_id
        audit_action action
    }
    month_snapshots {
        uuid id PK
        uuid month_id FK
        jsonb snapshot
    }
```

`audit_logs.record_id` **no** es una foreign key a propósito — el historial
debe sobrevivir al borrado de la fila original.

## Roles y RLS

La seguridad real vive en las políticas de `supabase/migrations/`, no en el
frontend. El frontend (`RoleRoute`, chequeos de `lib/roles.ts`) solo oculta
acciones que el backend rechazaría de todos modos.

Funciones `security definer` usadas por las políticas:

| Función | Qué verifica |
|---|---|
| `is_admin()` | `profiles.role = 'administrador'` del usuario actual |
| `is_gestor_or_admin()` | rol `administrador` o `gestor` |
| `is_month_locked(month_id)` | el mes no está `abierto` |
| `can_write_month(month_id)` | admin siempre; gestor solo si el mes sigue abierto |

| Tabla | Lectura | Escritura |
|---|---|---|
| `profiles` | cualquier autenticado | propio perfil (columnas no privilegiadas) o admin; `role`/`is_active` solo admin (trigger `guard_profile_privileged_columns`) |
| `months` | cualquier autenticado | crear/cerrar: gestor+admin; archivar/eliminar: solo admin (trigger `guard_month_status_transition`) |
| `people`, `projects`, `project_managers`, `tasks`, `allocations` | cualquier autenticado | `can_write_month()` — admin siempre, gestor solo si el mes está abierto |
| `allocations` (excepción) | — | insertar con `hours = 0` permitido a cualquiera, para que un Analista pueda anclar un comentario a una celda vacía sin poder asignar horas reales |
| `comments` | cualquier autenticado | insertar: cualquiera (autor = self); editar/borrar: autor o admin |
| `settings`, `invitations` | `settings`: cualquiera / `invitations`: solo admin | solo admin |
| `audit_logs`, `month_snapshots` | admin (`month_snapshots`: gestor+admin) | ninguna política de insert — solo escriben los triggers/RPC `security definer`, que corren como dueño de la tabla y no pasan por RLS |

## RPCs (`security definer`)

- **`create_month_from_previous(source_month_id, new_name)`** — todo en una
  función en vez de varios inserts desde el cliente, porque hay que
  remapear IDs entre 4+ tablas de forma atómica (tablas temporales
  `_people_map`/`_project_map`). Copia personas/proyectos/gerentes/tareas;
  **no** copia comentarios ni auditoría del mes anterior.
- **`create_month_snapshot`** / **`restore_month_snapshot`** — checkpoint
  jsonb de personas/proyectos/gerentes/asignaciones. Restaurar borra y
  reinserta con los mismos IDs (para que comentarios existentes se
  reconecten), lo que implica que las tareas creadas después del snapshot
  se pierden al restaurar (no forman parte del snapshot).

## Auditoría

`audit_row_change()` es un trigger genérico (`security definer`) sobre
`months`, `people`, `projects`, `project_managers`, `tasks` y `allocations`:
en `UPDATE` compara cada columna del `jsonb` viejo vs. nuevo y escribe una
fila por campo que cambió; en `INSERT`/`DELETE` escribe una fila con el
estado completo.

## Frontend

```
src/
  routes/          ProtectedRoute, RoleRoute, router.tsx
  app/providers.tsx  QueryClientProvider, TooltipProvider, Toaster
  components/ui/    primitivas shadcn
  components/shared/ AppShell, MonthSwitcher, ConfirmDialog, NoActiveMonth
  stores/           sessionStore (sesión/perfil), activeMonthStore (mes activo, persistido)
  features/<módulo>/
    api/      llamadas a Supabase
    hooks/    TanStack Query (queries + mutations optimistas)
    components/
    pages/
```

El **mes activo** vive en `activeMonthStore` (zustand + `persist` en
localStorage), no en la URL — Distribución/Proyectos/Personas/Reportes
operan sobre él, con un selector (`MonthSwitcher`) disponible en todo
momento en el header, igual que el workspace activo de una herramienta tipo
Notion/Airtable.

### Grilla (react-data-grid)

Las filas de `DistribucionPage` se derivan directamente del cache de
TanStack Query (`buildGridRows(people, allocations)`), no de un estado
local paralelo: al confirmar una celda (`onRowsChange`), la mutación
optimista actualiza el cache y la grilla recalcula Total/Diferencia/color
de estado en el siguiente render. Copiar/pegar multi-celda (bloques TSV
desde Excel) se maneja con un handler propio en vez del `onCellPaste` de
una sola celda que trae la librería por defecto.

### Tablero de tareas

`board_order` es `numeric`, no un entero de posición: soltar una tarjeta
entre otras dos calcula el punto medio de sus órdenes, así que reordenar es
un solo UPDATE en vez de reescribir toda la columna. El arrastre usa la API
nativa de HTML5 en vez de una librería de DnD (el módulo solo mueve tarjetas
entre cinco columnas, no justifica el peso). `started_at`/`completed_at` los
sella el trigger `tasks_track_status_timestamps` en el servidor, para que el
dato sea el mismo se cambie el estado desde el tablero, el backlog o el
detalle. Ver [`DOCUMENTACION.md`](DOCUMENTACION.md#6-módulo-tareas).

### Tema

Paleta CEINFES + colores de estado semánticos (verde/amarillo/rojo,
independientes de los tonos de marca) como variables CSS en `src/index.css`,
con soporte claro/oscuro vía la clase `.dark` en `<html>`. La grilla mapea
sus propias variables `--rdg-*` a las mismas variables de tema en vez de
usar las clases `.rdg-light`/`.rdg-dark` del paquete.

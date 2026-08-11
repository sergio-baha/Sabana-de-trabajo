import type { TaskStatus, WorkItemType } from "@/types/database.types"

// Columnas del tablero, en el orden en que se pintan de izquierda a derecha.
// El orden es el flujo de trabajo, no el orden alfabético del enum: una
// tarjeta avanza hacia la derecha salvo cuando se bloquea.
export const BOARD_COLUMNS: TaskStatus[] = [
  "pendiente",
  "en_progreso",
  "en_revision",
  "bloqueada",
  "completada",
]

export const STATUS_LABELS: Record<TaskStatus, string> = {
  pendiente: "Por hacer",
  en_progreso: "En progreso",
  en_revision: "En revisión",
  bloqueada: "Bloqueada",
  completada: "Completada",
}

// Clases de la franja superior de cada columna. Se usan los colores de
// estado semánticos del tema (los mismos verde/amarillo/rojo de la grilla),
// no los tonos de marca — ver src/index.css.
export const STATUS_ACCENT: Record<TaskStatus, string> = {
  pendiente: "bg-muted-foreground/40",
  en_progreso: "bg-warning",
  en_revision: "bg-secondary",
  bloqueada: "bg-danger",
  completada: "bg-success",
}

// Color del estado allí donde se muestra como pastilla (backlog, listas de
// fase). Escanear una tabla larga buscando qué está hecho era imposible con
// todos los estados en gris.
//
// Los dos estados que cierran una conversación van SÓLIDOS —"completada" es
// la buena noticia y "bloqueada" la mala— y los intermedios en tinte suave.
// Si todos gritaran, ninguno destacaría.
export const STATUS_BADGE: Record<TaskStatus, string> = {
  pendiente: "border-transparent bg-muted text-muted-foreground",
  en_progreso: "border-transparent bg-warning-muted text-warning",
  en_revision: "border-transparent bg-accent text-accent-foreground",
  bloqueada: "border-transparent bg-danger text-danger-foreground",
  completada: "border-transparent bg-success text-success-foreground",
}

export const WORK_ITEM_LABELS: Record<WorkItemType, string> = {
  epica: "Épica",
  historia: "Historia",
  tarea: "Tarea",
  bug: "Bug",
}

// Color del punto que identifica el tipo de work item en la tarjeta, con la
// misma convención cromática de Azure DevOps Boards (épica morada, historia
// azul, tarea amarilla, bug rojo) resuelta contra las variables del tema.
export const WORK_ITEM_DOT: Record<WorkItemType, string> = {
  epica: "bg-primary",
  historia: "bg-secondary",
  tarea: "bg-warning",
  bug: "bg-danger",
}

export const PRIORITY_LABELS: Record<number, string> = {
  1: "1 · Crítica",
  2: "2 · Alta",
  3: "3 · Media",
  4: "4 · Baja",
}

export const PRIORITY_OPTIONS = [1, 2, 3, 4]

export const STATUS_OPTIONS = BOARD_COLUMNS.map(
  (status) => [status, STATUS_LABELS[status]] as [TaskStatus, string]
)

export const WORK_ITEM_OPTIONS = Object.entries(WORK_ITEM_LABELS) as [WorkItemType, string][]

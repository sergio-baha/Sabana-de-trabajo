import { readSheet } from "read-excel-file/browser"
import { format } from "date-fns"
import { STATUS_LABELS, PRIORITY_LABELS } from "@/features/tasks/lib/taskLabels"
import { nextBoardOrder, type Task, type TaskInsert } from "@/features/tasks/api/tasksApi"
import type { ProjectPhase } from "@/features/projects/api/projectBudgetApi"
import type { Person } from "@/features/people/api/peopleApi"
import type { TaskStatus } from "@/types/database.types"

interface RawImportRow {
  title: string
  phaseName?: string
  statusLabel?: string
  priorityLabel?: string
  assigneeNames?: string
  startDate?: Date
  dueDate?: Date
  notes?: string
}

export interface ImportedTaskRow {
  rowNumber: number
  title: string
  phaseName: string | null
  status: TaskStatus
  priority: number
  // Varias personas por tarea, separadas por coma en la celda.
  assigneeNames: string[]
  startDate: string | null
  dueDate: string | null
  notes: string | null
  // Avisos que no bloquean el import (p. ej. "fase no encontrada, se deja
  // sin fase") — se muestran, pero la fila igual se puede importar.
  warnings: string[]
}

export interface ParsedTaskImport {
  rows: ImportedTaskRow[]
  // Errores duros de lectura del archivo (columna requerida vacía, celda
  // con un tipo que no se pudo interpretar): esas filas no se importan.
  fileErrors: string[]
}

const normalize = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")

const STATUS_BY_LABEL = new Map(
  Object.entries(STATUS_LABELS).map(([status, label]) => [normalize(label), status as TaskStatus])
)

const PRIORITY_BY_LABEL = new Map(
  Object.entries(PRIORITY_LABELS).map(([value, label]) => [
    normalize(label.split(" · ")[1] ?? label),
    Number(value),
  ])
)

// read-excel-file v9: la clave externa es la propiedad del objeto de
// salida y `column` apunta al encabezado real de la hoja (al revés de la
// API de versiones viejas, que indexaba por encabezado).
const schema = {
  title: { column: "Título", type: String, required: true },
  phaseName: { column: "Fase", type: String },
  statusLabel: { column: "Estado", type: String },
  priorityLabel: { column: "Prioridad", type: String },
  assigneeNames: { column: "Responsable(s)", type: String },
  startDate: { column: "Fecha inicio", type: Date },
  dueDate: { column: "Fecha vencimiento", type: Date },
  notes: { column: "Notas", type: String },
} as const

export async function parseTaskImportFile(
  file: File,
  phases: ProjectPhase[],
  people: Person[]
): Promise<ParsedTaskImport> {
  // `readSheet` en modo schema no admite elegir hoja por nombre (solo las
  // dos variantes sin schema lo permiten) — se apoya en que "Tareas" es
  // siempre la primera hoja de la plantilla que genera este mismo módulo.
  const result = await readSheet<RawImportRow>(file, { schema })

  // La librería es todo-o-nada por hoja: si una sola celda no calza con su
  // tipo, `objects` viene undefined y solo hay `errors`. Se corta acá con un
  // mensaje claro en vez de dejar pasar un `rawRows` vacío silenciosamente.
  if (!result.objects) {
    return {
      rows: [],
      fileErrors: result.errors.map(
        (e) => `Fila ${e.row}, columna "${e.column}": ${e.error}`
      ),
    }
  }
  const rawRows = result.objects

  const phaseByName = new Map(phases.map((p) => [normalize(p.name), p.name]))
  const personByName = new Map(people.map((p) => [normalize(p.name), p.name]))

  const rows: ImportedTaskRow[] = rawRows
    // La fila de ejemplo de la plantilla siempre arranca así — se descarta
    // sin exigirle al usuario que se acuerde de borrarla.
    .filter((r) => normalize(r.title ?? "") !== normalize("Ejemplo: escribir el brief del taller"))
    .map((r, i) => {
      const warnings: string[] = []

      let phaseName: string | null = null
      if (r.phaseName?.trim()) {
        const match = phaseByName.get(normalize(r.phaseName))
        if (match) phaseName = match
        else warnings.push(`Fase "${r.phaseName}" no existe en el proyecto — se deja sin fase`)
      }

      let status: TaskStatus = "pendiente"
      if (r.statusLabel?.trim()) {
        const match = STATUS_BY_LABEL.get(normalize(r.statusLabel))
        if (match) status = match
        else warnings.push(`Estado "${r.statusLabel}" no reconocido — se deja "Por hacer"`)
      }

      let priority = 3
      if (r.priorityLabel?.trim()) {
        const match = PRIORITY_BY_LABEL.get(normalize(r.priorityLabel))
        if (match) priority = match
        else warnings.push(`Prioridad "${r.priorityLabel}" no reconocida — se deja "Media"`)
      }

      // Varios nombres separados por coma: cada uno se resuelve por
      // separado, así que un nombre mal escrito no descarta a los demás.
      const assigneeNames: string[] = []
      for (const raw of (r.assigneeNames ?? "").split(",")) {
        const name = raw.trim()
        if (!name) continue
        const match = personByName.get(normalize(name))
        if (match) assigneeNames.push(match)
        else warnings.push(`"${name}" no está en el equipo del proyecto — no se le asigna`)
      }

      return {
        rowNumber: i + 2, // +1 por índice base 1, +1 por la fila de encabezado
        title: r.title.trim(),
        phaseName,
        status,
        priority,
        assigneeNames,
        startDate: r.startDate ? format(r.startDate, "yyyy-MM-dd") : null,
        dueDate: r.dueDate ? format(r.dueDate, "yyyy-MM-dd") : null,
        notes: r.notes?.trim() || null,
        warnings,
      }
    })

  return { rows, fileErrors: [] }
}

interface BuildInsertsParams {
  monthId: string
  projectId: string
  phases: ProjectPhase[]
  people: Person[]
  existingTasks: Task[]
}

export interface BuiltTaskImportRow {
  insert: TaskInsert
  assigneePersonIds: string[]
}

// Convierte las filas ya resueltas en TaskInsert (+ los ids de sus
// asignados, para el insert de task_assignees que hace el caller después),
// calculando board_order como si cada tarea se hubiera agregado al final de
// su columna, en el orden en que aparecen en el archivo — mismo criterio
// que usa el tablero.
export function buildTaskInserts(
  rows: ImportedTaskRow[],
  { monthId, projectId, phases, people, existingTasks }: BuildInsertsParams
): BuiltTaskImportRow[] {
  const phaseIdByName = new Map(phases.map((p) => [p.name, p.id]))
  const personIdByName = new Map(people.map((p) => [p.name, p.id]))
  const running: Pick<Task, "status" | "board_order">[] = existingTasks.map((t) => ({
    status: t.status,
    board_order: t.board_order,
  }))

  return rows.map((row) => {
    const boardOrder = nextBoardOrder(running, row.status)
    running.push({ status: row.status, board_order: boardOrder })
    return {
      insert: {
        month_id: monthId,
        project_id: projectId,
        phase_id: row.phaseName ? (phaseIdByName.get(row.phaseName) ?? null) : null,
        title: row.title,
        description: row.notes,
        status: row.status,
        priority: row.priority,
        board_order: boardOrder,
        start_date: row.startDate,
        due_date: row.dueDate,
      },
      assigneePersonIds: row.assigneeNames
        .map((name) => personIdByName.get(name))
        .filter((id): id is string => Boolean(id)),
    }
  })
}

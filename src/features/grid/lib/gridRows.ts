import type { Person } from "@/features/people/api/peopleApi"
import type { Project } from "@/features/projects/api/projectsApi"
import type { ProjectLine } from "@/features/projects/api/projectLinesApi"
import type { Allocation } from "@/features/grid/api/allocationsApi"
import type { StatusColor } from "@/types/database.types"

// Filas = proyectos, columnas = personas — igual que la hoja de origen
// (Julio.xlsx): una fila por proyecto/actividad, una columna por persona,
// con los totales por persona resumidos al final (ver PersonSummary +
// bottomSummaryRows en DistribucionPage). Antes era al revés (fila por
// persona); se transpuso a pedido para que se vea como el Excel real.
//
// Un proyecto puede tener más de una fila: la BASE (lineId null, la de
// siempre) y, si alguien decidió dividirlo, una fila más por cada línea
// (ver project_lines / *_lineas_de_proyecto.sql). `rowKey` es lo que
// distingue dos filas del mismo proyecto entre sí — `projectId` solo ya no
// alcanza como llave única de fila.
export interface ProjectGridRow {
  rowKey: string
  projectId: string
  lineId: string | null
  name: string
  color: string
  hours: Record<string, number> // personId -> horas
}

export const rowKeyFor = (projectId: string, lineId: string | null) =>
  `${projectId}:${lineId ?? "base"}`

// Tipo de las bottomSummaryRows de react-data-grid (filas "Total"/
// "Disponible" al pie de la grilla) — vive acá para que HoursEditCell y
// DistribucionPage compartan el mismo segundo generic de Column/RenderEditCellProps.
export type SummaryRowId = "total" | "disponible" | "libres"
export interface SummaryRow {
  id: SummaryRowId
}

export interface PersonSummary {
  personId: string
  name: string
  availableHours: number
  totalHours: number
  statusColor: StatusColor
}

export function computeStatusColor(available: number, allocated: number): StatusColor {
  if (allocated > available) return "rojo"
  if (allocated < available) return "amarillo"
  return "verde"
}

// La fila base de cada proyecto siempre existe (así se comportaba antes de
// que hubiera líneas), y se le suma una fila por cada línea que el proyecto
// tenga — existan o no todavía horas escritas en ella, igual que una fila
// base recién agregada a la grilla puede empezar sin horas.
export function buildProjectGridRows(
  projects: Project[],
  lines: ProjectLine[],
  allocations: Allocation[]
): ProjectGridRow[] {
  const linesByProject = new Map<string, ProjectLine[]>()
  for (const line of lines) {
    const list = linesByProject.get(line.project_id) ?? []
    list.push(line)
    linesByProject.set(line.project_id, list)
  }

  const buildHours = (projectId: string, lineId: string | null) => {
    const hours: Record<string, number> = {}
    for (const allocation of allocations) {
      if (allocation.project_id !== projectId) continue
      if ((allocation.line_id ?? null) !== lineId) continue
      hours[allocation.person_id] = allocation.hours
    }
    return hours
  }

  const rows: ProjectGridRow[] = []
  for (const project of projects) {
    rows.push({
      rowKey: rowKeyFor(project.id, null),
      projectId: project.id,
      lineId: null,
      name: project.name,
      color: project.color,
      hours: buildHours(project.id, null),
    })
    const projectLines = linesByProject.get(project.id) ?? []
    for (const line of projectLines.sort((a, b) => a.position - b.position)) {
      rows.push({
        rowKey: rowKeyFor(project.id, line.id),
        projectId: project.id,
        lineId: line.id,
        // El guion largo separa visualmente "de qué proyecto es" de "cuál
        // frente es" sin inventar un símbolo nuevo — es el mismo que ya usa
        // el resto de la app para juntar dos datos en un solo texto.
        name: `${project.name} — ${line.name}`,
        color: project.color,
        hours: buildHours(project.id, line.id),
      })
    }
  }
  return rows
}

// Fila de resumen "Total"/"Disponible" por persona, para las
// bottomSummaryRows de la grilla — el semáforo verde/amarillo/rojo vive acá
// (es un concepto de la persona, no del proyecto). No distingue líneas: el
// total de una persona es de TODO lo que tiene repartido, sin importar en
// cuántas filas del mismo proyecto esté dividido.
export function buildPersonSummaries(people: Person[], allocations: Allocation[]): PersonSummary[] {
  return people.map((person) => {
    let total = 0
    for (const allocation of allocations) {
      if (allocation.person_id === person.id) total += allocation.hours
    }
    return {
      personId: person.id,
      name: person.name,
      availableHours: person.available_hours,
      totalHours: total,
      statusColor: computeStatusColor(person.available_hours, total),
    }
  })
}

export function sortActiveProjectsFirst(projects: Project[]): Project[] {
  return [...projects].sort((a, b) => {
    if (a.status === b.status) return a.name.localeCompare(b.name)
    if (a.status === "activo") return -1
    if (b.status === "activo") return 1
    return a.name.localeCompare(b.name)
  })
}

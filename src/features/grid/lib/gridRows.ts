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
// Todo proyecto tiene AL MENOS un subproyecto (project_lines): al crearlo se
// le crea uno con su mismo nombre (ver trigger project_creates_default_line
// en *_subproyecto_obligatorio.sql), así que ya no existe una "fila base" sin
// línea — cada fila de la grilla es siempre projectId + un lineId real.
// `rowKey` es lo que distingue dos filas del mismo proyecto entre sí.
export interface ProjectGridRow {
  rowKey: string
  projectId: string
  lineId: string
  name: string
  subprojectName: string
  color: string
  hours: Record<string, number> // personId -> horas
}

export const rowKeyFor = (projectId: string, lineId: string) => `${projectId}:${lineId}`

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

// Una fila por cada subproyecto (project_lines) de cada proyecto. Como todo
// proyecto tiene al menos uno (el obligatorio, con su mismo nombre), esto ya
// no necesita una fila base especial: si el proyecto no se dividió en más
// frentes, simplemente se ve una sola fila.
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

  const buildHours = (projectId: string, lineId: string) => {
    const hours: Record<string, number> = {}
    for (const allocation of allocations) {
      if (allocation.project_id !== projectId) continue
      if (allocation.line_id !== lineId) continue
      hours[allocation.person_id] = allocation.hours
    }
    return hours
  }

  const rows: ProjectGridRow[] = []
  for (const project of projects) {
    const projectLines = (linesByProject.get(project.id) ?? []).sort(
      (a, b) => a.position - b.position
    )
    for (const line of projectLines) {
      rows.push({
        rowKey: rowKeyFor(project.id, line.id),
        projectId: project.id,
        lineId: line.id,
        name: project.name,
        subprojectName: line.name,
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

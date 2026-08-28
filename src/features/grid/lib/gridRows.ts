import type { Person } from "@/features/people/api/peopleApi"
import type { Project } from "@/features/projects/api/projectsApi"
import type { Allocation } from "@/features/grid/api/allocationsApi"
import type { StatusColor } from "@/types/database.types"

// Filas = proyectos, columnas = personas — igual que la hoja de origen
// (Julio.xlsx): una fila por proyecto/actividad, una columna por persona,
// con los totales por persona resumidos al final (ver PersonSummary +
// bottomSummaryRows en DistribucionPage). Antes era al revés (fila por
// persona); se transpuso a pedido para que se vea como el Excel real.
export interface ProjectGridRow {
  projectId: string
  name: string
  color: string
  hours: Record<string, number> // personId -> horas
}

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

export function buildProjectGridRows(
  projects: Project[],
  allocations: Allocation[]
): ProjectGridRow[] {
  return projects.map((project) => {
    const hours: Record<string, number> = {}
    for (const allocation of allocations) {
      if (allocation.project_id !== project.id) continue
      hours[allocation.person_id] = allocation.hours
    }
    return { projectId: project.id, name: project.name, color: project.color, hours }
  })
}

// Fila de resumen "Total"/"Disponible" por persona, para las
// bottomSummaryRows de la grilla — el semáforo verde/amarillo/rojo vive acá
// (es un concepto de la persona, no del proyecto).
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

import type { Person } from "@/features/people/api/peopleApi"
import type { Project } from "@/features/projects/api/projectsApi"
import type { Allocation } from "@/features/grid/api/allocationsApi"
import type { StatusColor } from "@/types/database.types"

export interface GridRow {
  personId: string
  name: string
  jobTitle: string | null
  availableHours: number
  hours: Record<string, number>
  total: number
  difference: number
  statusColor: StatusColor
}

export function computeStatusColor(available: number, allocated: number): StatusColor {
  if (allocated > available) return "rojo"
  if (allocated < available) return "amarillo"
  return "verde"
}

// Combina personas/proyectos/asignaciones del mes activo en filas listas
// para react-data-grid. Una fila por persona; una columna clave por
// proyecto (project.id), más total/diferencia calculados en cliente.
export function buildGridRows(
  people: Person[],
  allocations: Allocation[]
): GridRow[] {
  return people.map((person) => {
    const hours: Record<string, number> = {}
    let total = 0
    for (const allocation of allocations) {
      if (allocation.person_id !== person.id) continue
      hours[allocation.project_id] = allocation.hours
      total += allocation.hours
    }
    const difference = person.available_hours - total
    return {
      personId: person.id,
      name: person.name,
      jobTitle: person.job_title,
      availableHours: person.available_hours,
      hours,
      total,
      difference,
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

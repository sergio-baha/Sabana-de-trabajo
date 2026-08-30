import type { Person } from "@/features/people/api/peopleApi"
import type { ProjectManager, ProjectMember } from "@/features/projects/api/projectsApi"

export interface ReviewerOptions {
  /** Gestores del proyecto: van primero en la lista. */
  owners: Person[]
  /** Resto del equipo del proyecto (miembros que no son gestores). */
  rest: Person[]
  ordered: Person[]
}

const EMPTY: ReviewerOptions = { owners: [], rest: [], ordered: [] }

// A quién se le puede pasar la revisión de una tarea: el equipo DE ESE
// PROYECTO puntual (project_managers primero, luego project_members), no
// cualquiera del roster. Se excluye a quien ya la tiene (no tiene sentido
// "reasignársela a uno mismo").
export function getProjectReviewOptions(
  projectId: string | null | undefined,
  projectManagers: ProjectManager[] | undefined,
  projectMembers: ProjectMember[] | undefined,
  people: Person[] | undefined,
  excludePersonId?: string | null
): ReviewerOptions {
  if (!projectId) return EMPTY
  const peopleById = new Map((people ?? []).map((p) => [p.id, p]))

  const managerIds = new Set(
    (projectManagers ?? []).filter((m) => m.project_id === projectId).map((m) => m.person_id)
  )
  const memberIds = new Set(
    (projectMembers ?? []).filter((m) => m.project_id === projectId).map((m) => m.person_id)
  )

  const byName = (a: Person, b: Person) => a.name.localeCompare(b.name)

  const owners = [...managerIds]
    .filter((id) => id !== excludePersonId)
    .map((id) => peopleById.get(id))
    .filter((p): p is Person => Boolean(p))
    .sort(byName)

  const rest = [...memberIds]
    .filter((id) => id !== excludePersonId && !managerIds.has(id))
    .map((id) => peopleById.get(id))
    .filter((p): p is Person => Boolean(p))
    .sort(byName)

  return { owners, rest, ordered: [...owners, ...rest] }
}

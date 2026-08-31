import type { Person } from "@/features/people/api/peopleApi"
import type { PeopleByRole } from "@/features/people/hooks/usePeopleByRole"

export interface ReviewerOptions {
  /** Gestores (y administradores) del roster: van primero en la lista. */
  owners: Person[]
  /** Resto del equipo, en orden alfabético. */
  rest: Person[]
  ordered: Person[]
}

// A quién se le puede pasar la revisión de una tarea: TODO el equipo
// (gestores primero, luego el resto) — mismo agrupamiento que ya usa
// usePeopleByRole para elegir responsable de una tarea, no el equipo
// puntual de un proyecto (eso dejaba la lista vacía o casi vacía en
// proyectos sin gerente/miembros configurados en "Gestionar equipo").
//
// Se excluyen quienes no tiene sentido ofrecer como destino — típicamente
// quien ya la tiene (uno mismo) y el remitente original (para eso está
// "Devolver", no "Reasignar") — y a cualquiera sin cuenta vinculada, porque
// el backend (validate_task_reviewer) los rechazaría igual.
export function reviewerOptionsFromRoster(
  peopleByRole: PeopleByRole,
  ...excludePersonIds: (string | null | undefined)[]
): ReviewerOptions {
  const excluded = new Set(excludePersonIds.filter((id): id is string => Boolean(id)))
  const canReview = (p: Person) => Boolean(p.profile_id) && !excluded.has(p.id)

  const owners = peopleByRole.owners.filter(canReview)
  const rest = peopleByRole.rest.filter(canReview)

  return { owners, rest, ordered: [...owners, ...rest] }
}

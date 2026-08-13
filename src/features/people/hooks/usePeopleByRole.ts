import { useMemo } from "react"
import { useProfiles } from "@/hooks/useProfiles"
import type { Person } from "@/features/people/api/peopleApi"

export interface PeopleByRole {
  /** Gestores y administradores: los dueños de los proyectos. */
  owners: Person[]
  /** El resto del roster, en orden alfabético. */
  rest: Person[]
  /** Los dos grupos concatenados, para listas sin encabezados. */
  ordered: Person[]
}

// Al elegir a alguien para un proyecto, el Gestor es la respuesta más
// probable: es el dueño del trabajo. Ordenar alfabético lo dejaba enterrado
// entre analistas y obligaba a buscarlo.
//
// El rol vive en `profiles` y la fila del mes en `people`; el puente es
// `people.profile_id` — mismo cruce que usePlanningExclusions. Una persona
// del roster sin cuenta vinculada no tiene rol, así que cae en "el resto".
export function usePeopleByRole(people: Person[] | undefined): PeopleByRole {
  const { byId } = useProfiles()

  return useMemo(() => {
    const byName = (a: Person, b: Person) => a.name.localeCompare(b.name)
    const owners: Person[] = []
    const rest: Person[] = []

    for (const person of people ?? []) {
      const role = person.profile_id ? byId.get(person.profile_id)?.role : undefined
      if (role === "gestor" || role === "administrador") owners.push(person)
      else rest.push(person)
    }

    owners.sort(byName)
    rest.sort(byName)
    return { owners, rest, ordered: [...owners, ...rest] }
  }, [people, byId])
}

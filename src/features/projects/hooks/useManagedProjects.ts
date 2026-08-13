import { useMemo } from "react"
import { useProjectManagers } from "@/features/projects/hooks/useProjectsQueries"
import { usePeople } from "@/features/people/hooks/usePeopleQueries"
import { useActiveMonthStore } from "@/stores/activeMonthStore"
import { useSessionStore } from "@/stores/sessionStore"

// Ids de los proyectos que gerencia quien está mirando. El puente es el de
// siempre: `project_managers` apunta a una fila del roster (`people`), y esa
// fila se ata a la cuenta por `people.profile_id`.
//
// Se usa para decidir qué le toca revisar y qué puede borrar, así que vive en
// un solo lugar: si el criterio cambia, cambia para todas las pantallas a la
// vez. Espejo de `is_project_manager()` en la base.
export function useManagedProjectIds() {
  const { activeMonthId } = useActiveMonthStore()
  const profile = useSessionStore((s) => s.profile)
  const { data: people } = usePeople(activeMonthId)
  const { data: managers } = useProjectManagers()

  return useMemo(() => {
    if (!profile) return new Set<string>()
    const myPersonIds = new Set(
      (people ?? []).filter((p) => p.profile_id === profile.id).map((p) => p.id)
    )
    return new Set(
      (managers ?? []).filter((m) => myPersonIds.has(m.person_id)).map((m) => m.project_id)
    )
  }, [people, managers, profile])
}

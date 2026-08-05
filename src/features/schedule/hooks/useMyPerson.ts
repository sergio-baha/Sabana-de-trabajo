import { useMemo } from "react"
import { usePeople } from "@/features/people/hooks/usePeopleQueries"
import { useSessionStore } from "@/stores/sessionStore"

// Resuelve qué fila del roster del mes corresponde al usuario conectado.
// El vínculo es `people.profile_id` (ver migración *_people_profile_link.sql):
// `people` se duplica mes a mes, así que la persona "yo" es distinta en cada
// mes aunque la cuenta sea la misma.
//
// Devuelve null cuando la cuenta no está vinculada en este mes — un estado
// real y esperable (alguien creó el roster sin asignar cuentas), que la UI
// debe explicar en vez de mostrar un cronograma vacío sin motivo aparente.
export function useMyPerson(monthId: string | null) {
  const profileId = useSessionStore((s) => s.profile?.id)
  const { data: people, isLoading } = usePeople(monthId)

  const myPerson = useMemo(() => {
    if (!profileId || !people) return null
    return people.find((person) => person.profile_id === profileId) ?? null
  }, [people, profileId])

  return { myPerson, isLoading }
}

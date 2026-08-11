import { useMemo } from "react"
import { usePeople } from "@/features/people/hooks/usePeopleQueries"
import { useProfiles } from "@/hooks/useProfiles"

// Ids de las personas del mes que NO entran en la planeación de horas: hoy,
// las cuentas con rol Analista de Tecnología. Gestionan su propio trabajo y
// no participan del reparto del mes, así que ni suman capacidad en el
// Dashboard ni ocupan una columna en la grilla de Distribución.
//
// El rol vive en `profiles` y la fila del mes en `people`; el puente es
// `people.profile_id`. Ninguna de las vistas de reporte trae el rol, así que
// el cruce se hace en el cliente — y en un solo lugar, para que las dos
// pantallas no se contradigan.
export function usePlanningExclusions(monthId: string | null) {
  const { data: people } = usePeople(monthId)
  const { byId } = useProfiles()

  return useMemo(
    () =>
      new Set(
        (people ?? [])
          .filter(
            (person) =>
              person.profile_id && byId.get(person.profile_id)?.role === "analista_tecnologia"
          )
          .map((person) => person.id)
      ),
    [people, byId]
  )
}

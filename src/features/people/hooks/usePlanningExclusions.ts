import { useMemo } from "react"
import { usePeople } from "@/features/people/hooks/usePeopleQueries"
import { useProfiles } from "@/hooks/useProfiles"
import type { AppRole } from "@/types/database.types"

// Roles que NO entran en el reparto de horas del mes:
//
//   · Gestor y Administrador — dirigen el trabajo, no lo ejecutan. Su tiempo
//     no se reparte en la sábana, así que ni ocupan columna en la grilla ni
//     suman capacidad en el Dashboard (si sumaran, el equipo aparecería con
//     cientos de horas libres que nadie va a trabajar).
//   · Analista de Tecnología — gestiona su propio trabajo y no participa del
//     reparto del mes.
//
// Queda dentro el Analista, que es de quien se reparten las horas.
const EXCLUDED_ROLES: AppRole[] = ["gestor", "administrador", "analista_tecnologia"]

// Ids de las personas del mes que no entran en la planeación de horas.
//
// El rol vive en `profiles` y la fila del mes en `people`; el puente es
// `people.profile_id`. Ninguna de las vistas de reporte trae el rol, así que
// el cruce se hace en el cliente — y en un solo lugar, para que la grilla y
// el Dashboard no se contradigan.
//
// Una fila sin cuenta vinculada NO se excluye: es una persona cargada a mano
// (roster viejo) y esconderla ocultaría sus horas sin explicación.
export function usePlanningExclusions(monthId: string | null) {
  const { data: people } = usePeople(monthId)
  const { byId } = useProfiles()

  return useMemo(
    () =>
      new Set(
        (people ?? [])
          .filter((person) => {
            if (!person.profile_id) return false
            const role = byId.get(person.profile_id)?.role
            return Boolean(role && EXCLUDED_ROLES.includes(role))
          })
          .map((person) => person.id)
      ),
    [people, byId]
  )
}

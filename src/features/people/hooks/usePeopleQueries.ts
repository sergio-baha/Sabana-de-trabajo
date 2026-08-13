import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  createPerson,
  deletePerson,
  listPeople,
  seedMonthPeople,
  updatePerson,
  type PersonInsert,
  type PersonUpdate,
} from "@/features/people/api/peopleApi"

export const peopleKeys = {
  all: (monthId: string) => ["people", monthId] as const,
}

export function usePeople(monthId: string | null) {
  return useQuery({
    queryKey: peopleKeys.all(monthId ?? ""),
    queryFn: () => listPeople(monthId as string),
    enabled: Boolean(monthId),
  })
}

// "Traer el equipo": para un mes que quedó vacío (los nuevos ya nacen con el
// roster). Copia también la tarifa de cada quien, así que el costo del mes no
// arranca en cero por descuido.
export function useSeedMonthPeople(monthId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => seedMonthPeople(monthId),
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: peopleKeys.all(monthId) })
      if (count > 0) {
        toast.success(`Se agregaron ${count} persona${count === 1 ? "" : "s"} al mes`)
      } else {
        toast.info("No hay un mes anterior con equipo para copiar")
      }
    },
    onError: (error) =>
      toast.error("No se pudo traer el equipo", { description: error.message }),
  })
}

export function useCreatePerson(monthId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: PersonInsert) => createPerson(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: peopleKeys.all(monthId) })
      toast.success("Persona creada")
    },
    onError: (error) => toast.error("No se pudo crear la persona", { description: error.message }),
  })
}

export function useUpdatePerson(monthId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: PersonUpdate }) => updatePerson(id, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: peopleKeys.all(monthId) })
      toast.success("Persona actualizada")
    },
    onError: (error) =>
      toast.error("No se pudo actualizar la persona", { description: error.message }),
  })
}

export function useDeletePerson(monthId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deletePerson(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: peopleKeys.all(monthId) })
      toast.success("Persona eliminada")
    },
    onError: (error) =>
      toast.error("No se pudo eliminar la persona", { description: error.message }),
  })
}

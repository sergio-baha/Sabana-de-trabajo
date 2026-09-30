import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  aplicarHorasDelMes,
  createMonth,
  deleteMonth,
  duplicateMonth,
  listGestorChecks,
  listMonths,
  setGestorCheck,
  updateMonth,
  type MonthInsert,
  type MonthUpdate,
} from "@/features/months/api/monthsApi"
import { peopleKeys } from "@/features/people/hooks/usePeopleQueries"

export const monthsKeys = {
  all: ["months"] as const,
  gestorChecks: ["month_gestor_checks"] as const,
}

export function useMonths() {
  return useQuery({ queryKey: monthsKeys.all, queryFn: listMonths })
}

export function useCreateMonth() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: MonthInsert) => createMonth(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: monthsKeys.all })
      toast.success("Mes creado")
    },
    onError: (error) => toast.error("No se pudo crear el mes", { description: error.message }),
  })
}

export function useUpdateMonth() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: MonthUpdate }) => updateMonth(id, patch),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: monthsKeys.all })
      // Cambiar `default_hours` reescribe la capacidad del roster en la base
      // (trigger `propagar_default_hours`), así que la sábana que está en
      // pantalla quedó mostrando el tope viejo. Se invalida siempre y no solo
      // cuando el patch trae `default_hours`: el costo es una consulta a una
      // tabla chica, y la alternativa —adivinar acá qué campos del patch
      // disparan qué triggers— se desincroniza en cuanto la base cambie.
      queryClient.invalidateQueries({ queryKey: peopleKeys.all(id) })
      toast.success("Mes actualizado")
    },
    onError: (error) => toast.error("No se pudo actualizar el mes", { description: error.message }),
  })
}

export function useDeleteMonth() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteMonth(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: monthsKeys.all })
      toast.success("Mes eliminado")
    },
    onError: (error) => toast.error("No se pudo eliminar el mes", { description: error.message }),
  })
}

export function useGestorChecks() {
  return useQuery({ queryKey: monthsKeys.gestorChecks, queryFn: listGestorChecks })
}

export function useSetGestorCheck() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ monthId, checked }: { monthId: string; checked: boolean }) =>
      setGestorCheck(monthId, checked),
    onSuccess: (_data, { checked }) => {
      queryClient.invalidateQueries({ queryKey: monthsKeys.gestorChecks })
      toast.success(
        checked
          ? "Marcaste tu planeación como lista."
          : "Se quitó tu marca de planeación lista."
      )
    },
    onError: (error: Error) => toast.error(error.message),
  })
}

export function useDuplicateMonth() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ sourceMonthId, newName }: { sourceMonthId: string; newName: string }) =>
      duplicateMonth(sourceMonthId, newName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: monthsKeys.all })
      toast.success("Mes duplicado")
    },
    onError: (error) => toast.error("No se pudo duplicar el mes", { description: error.message }),
  })
}

// Igualar la capacidad del equipo al `default_hours` del mes. Invalida
// `people` de ESE mes —no el de la pantalla— porque es el roster que acaba de
// cambiar. `allocations` no se invalida: el reparto de horas no se toca, solo
// el denominador del semáforo.
export function useAplicarHorasDelMes() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (monthId: string) => aplicarHorasDelMes(monthId),
    onSuccess: (count, monthId) => {
      queryClient.invalidateQueries({ queryKey: peopleKeys.all(monthId) })
      if (count > 0) {
        toast.success(`Se igualaron las horas de ${count} persona${count === 1 ? "" : "s"}`)
      } else {
        toast.info("Todo el equipo ya tenía las horas del mes")
      }
    },
    onError: (error) =>
      toast.error("No se pudieron aplicar las horas del mes", { description: error.message }),
  })
}

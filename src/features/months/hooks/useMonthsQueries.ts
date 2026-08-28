import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  createMonth,
  deleteMonth,
  duplicateMonth,
  listMonths,
  setPlanningReady,
  updateMonth,
  type MonthInsert,
  type MonthUpdate,
} from "@/features/months/api/monthsApi"

export const monthsKeys = {
  all: ["months"] as const,
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: monthsKeys.all })
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

export function useSetPlanningReady() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ monthId, ready }: { monthId: string; ready: boolean }) =>
      setPlanningReady(monthId, ready),
    onSuccess: (_data, { ready }) => {
      queryClient.invalidateQueries({ queryKey: monthsKeys.all })
      toast.success(
        ready
          ? "Planeación marcada como lista. El Administrador ya puede liberar el mes."
          : "Se quitó la marca de planeación lista."
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

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  clearAllocationHours,
  listAllocations,
  upsertAllocation,
  type Allocation,
} from "@/features/grid/api/allocationsApi"
import { projectsKeys } from "@/features/projects/hooks/useProjectsQueries"

export const allocationsKeys = {
  all: (monthId: string) => ["allocations", monthId] as const,
}

export function useAllocations(monthId: string | null) {
  return useQuery({
    queryKey: allocationsKeys.all(monthId ?? ""),
    queryFn: () => listAllocations(monthId as string),
    enabled: Boolean(monthId),
  })
}

interface UpsertVars {
  personId: string
  projectId: string
  hours: number
}

// Autoguardado optimista: la celda se actualiza en pantalla de inmediato
// (onMutate) y se revierte sola si Supabase rechaza el cambio (por ejemplo,
// RLS bloqueando la edición porque el mes quedó cerrado mientras se editaba).
export function useUpsertAllocation(monthId: string) {
  const queryClient = useQueryClient()
  const key = allocationsKeys.all(monthId)

  return useMutation({
    mutationFn: ({ personId, projectId, hours }: UpsertVars) =>
      upsertAllocation(monthId, personId, projectId, hours),
    onMutate: async ({ personId, projectId, hours }) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Allocation[]>(key)

      queryClient.setQueryData<Allocation[]>(key, (current = []) => {
        const idx = current.findIndex(
          (a) => a.person_id === personId && a.project_id === projectId
        )
        if (idx === -1) {
          return [
            ...current,
            {
              id: `optimistic-${personId}-${projectId}`,
              month_id: monthId,
              person_id: personId,
              project_id: projectId,
              hours,
              updated_by: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ]
        }
        const next = [...current]
        next[idx] = { ...next[idx], hours }
        return next
      })

      return { previous }
    },
    onError: (error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
      toast.error("No se pudo guardar la celda", { description: error.message })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key })
      // Repartirle horas a alguien lo hace miembro del proyecto (lo resuelve
      // el trigger `allocation_implies_membership` en la base), así que la
      // lista de equipos que ya está en pantalla quedó desactualizada.
      queryClient.invalidateQueries({ queryKey: projectsKeys.members })
    },
  })
}

// Vaciar una fila (o toda la grilla) en un solo viaje, también optimista para
// que la limpieza se vea de inmediato aunque sean decenas de celdas.
export function useClearAllocations(monthId: string) {
  const queryClient = useQueryClient()
  const key = allocationsKeys.all(monthId)

  return useMutation({
    mutationFn: (allocationIds: string[]) => clearAllocationHours(allocationIds),
    onMutate: async (allocationIds) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Allocation[]>(key)
      const ids = new Set(allocationIds)

      queryClient.setQueryData<Allocation[]>(key, (current = []) =>
        current.map((a) => (ids.has(a.id) ? { ...a, hours: 0 } : a))
      )

      return { previous }
    },
    onError: (error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
      toast.error("No se pudieron limpiar las horas", { description: error.message })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key })
    },
  })
}

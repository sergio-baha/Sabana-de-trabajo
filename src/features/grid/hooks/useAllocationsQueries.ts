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
  /** Null = fila base del proyecto. Con id = una línea (ver project_lines). */
  lineId?: string | null
}

// Autoguardado optimista: la celda se actualiza en pantalla de inmediato
// (onMutate) y se revierte sola si Supabase rechaza el cambio (por ejemplo,
// RLS bloqueando la edición porque el mes quedó cerrado mientras se editaba).
export function useUpsertAllocation(monthId: string) {
  const queryClient = useQueryClient()
  const key = allocationsKeys.all(monthId)

  return useMutation({
    mutationFn: ({ personId, projectId, hours, lineId = null }: UpsertVars) =>
      upsertAllocation(monthId, personId, projectId, hours, lineId),
    onMutate: async ({ personId, projectId, hours, lineId = null }) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Allocation[]>(key)

      queryClient.setQueryData<Allocation[]>(key, (current = []) => {
        // La igualdad de línea no puede ser `a.line_id === lineId` a secas
        // cuando lineId es null: si la fila optimista anterior no existe
        // todavía, undefined !== null y se crearía una segunda fila en vez de
        // actualizar la misma celda.
        const idx = current.findIndex(
          (a) =>
            a.person_id === personId &&
            a.project_id === projectId &&
            (a.line_id ?? null) === lineId
        )
        if (idx === -1) {
          return [
            ...current,
            {
              id: `optimistic-${personId}-${projectId}-${lineId ?? "base"}`,
              month_id: monthId,
              person_id: personId,
              project_id: projectId,
              line_id: lineId,
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

import { useEffect, useMemo } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { supabase } from "@/lib/supabaseClient"
import {
  createActivity,
  deleteActivity,
  listActivitiesForMonth,
  updateActivity,
  type ActivityWithCell,
  type CreateActivityInput,
} from "@/features/activities/api/activitiesApi"
import { getOrCreateAllocationId } from "@/features/grid/api/allocationsApi"
import { allocationsKeys } from "@/features/grid/hooks/useAllocationsQueries"
import type { Database } from "@/types/database.types"

export const activitiesKeys = {
  all: (monthId: string) => ["activities", monthId] as const,
}

export function useActivitiesForMonth(monthId: string | null) {
  return useQuery({
    queryKey: activitiesKeys.all(monthId ?? ""),
    queryFn: () => listActivitiesForMonth(monthId as string),
    enabled: Boolean(monthId),
  })
}

// Agrupa actividades por celda (persona × proyecto × línea), igual que
// useCommentsByCell en comments — así la grilla sabe qué celdas tienen
// desglose sin una consulta por celda. La línea entra en la llave porque dos
// filas del mismo proyecto (la base y una línea) son celdas distintas para
// la misma persona: sin esto, el desglose de una se vería mezclado con el de
// la otra.
export function cellKey(personId: string, projectId: string, lineId: string | null) {
  return `${personId}:${projectId}:${lineId ?? ""}`
}

export function useActivitiesByCell(monthId: string | null) {
  const { data, ...rest } = useActivitiesForMonth(monthId)

  const byCell = useMemo(() => {
    const map = new Map<string, ActivityWithCell[]>()
    for (const activity of data ?? []) {
      const key = cellKey(
        activity.allocation.person_id,
        activity.allocation.project_id,
        activity.allocation.line_id
      )
      const list = map.get(key) ?? []
      list.push(activity)
      map.set(key, list)
    }
    return map
  }, [data])

  return { byCell, ...rest }
}

export function useRealtimeActivities(monthId: string | null) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!monthId) return
    const channel = supabase
      .channel(`activities-${monthId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "activities" }, () => {
        queryClient.invalidateQueries({ queryKey: activitiesKeys.all(monthId) })
        // El trigger sync_allocation_hours_from_activities cambia
        // allocations.hours del otro lado — refresca la grilla también.
        queryClient.invalidateQueries({ queryKey: allocationsKeys.all(monthId) })
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [monthId, queryClient])
}

type AddActivityVars = Omit<CreateActivityInput, "allocationId" | "monthId"> & {
  personId: string
  projectId: string
  lineId: string
}

export function useAddActivity(monthId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (vars: AddActivityVars) => {
      const allocationId = await getOrCreateAllocationId(
        monthId,
        vars.personId,
        vars.projectId,
        vars.lineId
      )
      return createActivity({
        allocationId,
        monthId,
        description: vars.description,
        notes: vars.notes,
        phaseId: vars.phaseId,
        activityDate: vars.activityDate,
        hours: vars.hours,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: activitiesKeys.all(monthId) })
      queryClient.invalidateQueries({ queryKey: allocationsKeys.all(monthId) })
      toast.success("Actividad agregada")
    },
    onError: (error) =>
      toast.error("No se pudo agregar la actividad", { description: error.message }),
  })
}

export function useUpdateActivity(monthId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string
      patch: Database["public"]["Tables"]["activities"]["Update"]
    }) => updateActivity(id, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: activitiesKeys.all(monthId) })
      queryClient.invalidateQueries({ queryKey: allocationsKeys.all(monthId) })
    },
    onError: (error) =>
      toast.error("No se pudo actualizar la actividad", { description: error.message }),
  })
}

export function useDeleteActivity(monthId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteActivity(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: activitiesKeys.all(monthId) })
      queryClient.invalidateQueries({ queryKey: allocationsKeys.all(monthId) })
      toast.success("Actividad eliminada")
    },
    onError: (error) =>
      toast.error("No se pudo eliminar la actividad", { description: error.message }),
  })
}

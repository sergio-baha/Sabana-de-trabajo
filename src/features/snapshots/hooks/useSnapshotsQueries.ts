import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  createSnapshot,
  deleteSnapshot,
  listSnapshots,
  restoreSnapshot,
} from "@/features/snapshots/api/snapshotsApi"

export const snapshotsKeys = {
  all: (monthId: string) => ["month_snapshots", monthId] as const,
}

export function useSnapshots(monthId: string | null) {
  return useQuery({
    queryKey: snapshotsKeys.all(monthId ?? ""),
    queryFn: () => listSnapshots(monthId as string),
    enabled: Boolean(monthId),
  })
}

export function useCreateSnapshot(monthId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (label: string | null) => createSnapshot(monthId, label),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: snapshotsKeys.all(monthId) })
      toast.success("Versión guardada")
    },
    onError: (error) => toast.error("No se pudo guardar la versión", { description: error.message }),
  })
}

export function useRestoreSnapshot(monthId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (snapshotId: string) => restoreSnapshot(snapshotId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["people", monthId] })
      queryClient.invalidateQueries({ queryKey: ["projects", monthId] })
      queryClient.invalidateQueries({ queryKey: ["allocations", monthId] })
      queryClient.invalidateQueries({ queryKey: snapshotsKeys.all(monthId) })
      toast.success("Mes restaurado a la versión seleccionada")
    },
    onError: (error) => toast.error("No se pudo restaurar la versión", { description: error.message }),
  })
}

export function useDeleteSnapshot(monthId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteSnapshot(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: snapshotsKeys.all(monthId) })
      toast.success("Versión eliminada")
    },
    onError: (error) => toast.error("No se pudo eliminar la versión", { description: error.message }),
  })
}

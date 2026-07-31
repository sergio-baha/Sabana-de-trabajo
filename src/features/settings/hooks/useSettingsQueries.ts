import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { getSettings, updateSettings } from "@/features/settings/api/settingsApi"
import type { Database } from "@/types/database.types"

export const settingsKeys = { all: ["settings"] as const }

export function useSettings() {
  return useQuery({ queryKey: settingsKeys.all, queryFn: getSettings, staleTime: 60_000 })
}

export function useUpdateSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (patch: Database["public"]["Tables"]["settings"]["Update"]) => updateSettings(patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.all })
      toast.success("Configuración actualizada")
    },
    onError: (error) =>
      toast.error("No se pudo actualizar la configuración", { description: error.message }),
  })
}

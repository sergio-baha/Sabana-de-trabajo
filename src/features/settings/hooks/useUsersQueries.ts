import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { setProfileActive, updateProfileRole } from "@/features/settings/api/usersApi"
import type { AppRole } from "@/types/database.types"

export function useUpdateProfileRole() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: AppRole }) => updateProfileRole(id, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profiles"] })
      toast.success("Rol actualizado")
    },
    onError: (error) => toast.error("No se pudo actualizar el rol", { description: error.message }),
  })
}

export function useSetProfileActive() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      setProfileActive(id, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profiles"] })
      toast.success("Estado de la cuenta actualizado")
    },
    onError: (error) => toast.error("No se pudo actualizar la cuenta", { description: error.message }),
  })
}

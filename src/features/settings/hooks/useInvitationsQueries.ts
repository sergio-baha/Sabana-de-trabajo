import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { inviteUser, listInvitations, revokeInvitation } from "@/features/settings/api/invitationsApi"
import type { AppRole } from "@/types/database.types"

export const invitationsKeys = { all: ["invitations"] as const }

export function useInvitations() {
  return useQuery({ queryKey: invitationsKeys.all, queryFn: listInvitations })
}

export function useInviteUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      email,
      role,
      fullName,
      password,
    }: {
      email: string
      role: AppRole
      fullName?: string
      password?: string
    }) => inviteUser(email, role, fullName, password),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: invitationsKeys.all })
      queryClient.invalidateQueries({ queryKey: ["profiles"] })
      toast.success(
        variables.password ? "Cuenta creada y lista para usar" : "Invitación enviada por correo"
      )
    },
    onError: (error) => toast.error("No se pudo crear el usuario", { description: error.message }),
  })
}

export function useRevokeInvitation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => revokeInvitation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invitationsKeys.all })
      toast.success("Invitación revocada")
    },
    onError: (error) => toast.error("No se pudo revocar la invitación", { description: error.message }),
  })
}

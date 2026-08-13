import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  resetUserPassword,
  setProfileActive,
  updateProfileJobTitle,
  updateProfileName,
  updateProfileRole,
  updateUserEmail,
} from "@/features/settings/api/usersApi"
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

// Sin toast: el cargo se guarda al salir del campo y avisar cada vez que
// alguien pasa por la columna sería ruido. El error sí se avisa.
export function useUpdateProfileJobTitle() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, jobTitle }: { id: string; jobTitle: string }) =>
      updateProfileJobTitle(id, jobTitle),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profiles"] })
      queryClient.invalidateQueries({ queryKey: ["people"] })
    },
    onError: (error) =>
      toast.error("No se pudo actualizar el cargo", { description: error.message }),
  })
}

export function useUpdateProfileName() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, fullName }: { id: string; fullName: string }) =>
      updateProfileName(id, fullName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profiles"] })
      // El nombre baja al roster de los meses abiertos (profile_syncs_person),
      // así que las columnas de la grilla también cambian.
      queryClient.invalidateQueries({ queryKey: ["people"] })
    },
    onError: (error) =>
      toast.error("No se pudo actualizar el nombre", { description: error.message }),
  })
}

export function useUpdateUserEmail() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, email }: { id: string; email: string }) => updateUserEmail(id, email),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profiles"] })
      toast.success("Correo actualizado", {
        description: "La persona entra desde ahora con el correo nuevo.",
      })
    },
    onError: (error) =>
      toast.error("No se pudo cambiar el correo", { description: error.message }),
  })
}

export function useResetUserPassword() {
  return useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      resetUserPassword(id, password),
    onSuccess: () =>
      toast.success("Contraseña reiniciada", {
        description: "Se cerraron sus sesiones abiertas: tendrá que entrar con la nueva.",
      }),
    onError: (error) =>
      toast.error("No se pudo reiniciar la contraseña", { description: error.message }),
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

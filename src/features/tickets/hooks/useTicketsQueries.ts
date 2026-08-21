import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  assignTicket,
  listTickets,
  releaseTicket,
  takeTicket,
} from "@/features/tickets/api/ticketsApi"
import { tasksKeys } from "@/features/tasks/hooks/useTasksQueries"

export const ticketsKeys = {
  all: ["tickets"] as const,
}

export function useTickets(enabled: boolean) {
  return useQuery({
    queryKey: ticketsKeys.all,
    queryFn: listTickets,
    enabled,
  })
}

// Tomar, asignar y soltar tocan `task_assignees`, que es lo que decide qué ve
// cada quien. Se invalidan también las claves de tareas: un ticket que
// alguien toma aparece en SU tablero, no solo en la bandeja.
function useTicketMutation<T extends unknown[]>(
  fn: (...args: T) => Promise<void>,
  successMessage: string
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (args: T) => fn(...args),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ticketsKeys.all })
      queryClient.invalidateQueries({ queryKey: tasksKeys.root })
      queryClient.invalidateQueries({ queryKey: tasksKeys.assigneesRoot })
      toast.success(successMessage)
    },
    onError: (error: Error) => toast.error(error.message),
  })
}

export const useTakeTicket = () =>
  useTicketMutation(takeTicket, "El ticket es tuyo. Ya lo ves en tu tablero.")

export const useAssignTicket = () => useTicketMutation(assignTicket, "Ticket asignado.")

export const useReleaseTicket = () =>
  useTicketMutation(releaseTicket, "El ticket volvió a la bandeja.")

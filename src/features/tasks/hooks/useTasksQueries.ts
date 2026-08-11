import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  bulkCreateTasks,
  bulkSetTaskAssignees,
  createTask,
  deleteTask,
  listTaskAssignees,
  moveTask,
  setTaskAssignees,
  updateTask,
  listTasks,
  type Task,
  type TaskInsert,
  type TaskUpdate,
} from "@/features/tasks/api/tasksApi"
import type { TaskStatus } from "@/types/database.types"

export const tasksKeys = {
  all: (monthId: string) => ["tasks", monthId] as const,
  assignees: (monthId: string) => ["task_assignees", monthId] as const,
}

export function useTasks(monthId: string | null) {
  return useQuery({
    queryKey: tasksKeys.all(monthId ?? ""),
    queryFn: () => listTasks(monthId as string),
    enabled: Boolean(monthId),
  })
}

export function useCreateTask(monthId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: TaskInsert) => createTask(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tasksKeys.all(monthId) })
      toast.success("Tarea creada")
    },
    onError: (error) => toast.error("No se pudo crear la tarea", { description: error.message }),
  })
}

export function useBulkCreateTasks(monthId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (inputs: TaskInsert[]) => bulkCreateTasks(inputs),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: tasksKeys.all(monthId) })
      toast.success(`${created.length} tarea${created.length === 1 ? "" : "s"} importada${created.length === 1 ? "" : "s"}`)
    },
    onError: (error) => toast.error("No se pudo importar el archivo", { description: error.message }),
  })
}

export function useTaskAssignees(monthId: string | null) {
  return useQuery({
    queryKey: tasksKeys.assignees(monthId ?? ""),
    queryFn: () => listTaskAssignees(monthId as string),
    enabled: Boolean(monthId),
  })
}

export function useSetTaskAssignees(monthId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ taskId, personIds }: { taskId: string; personIds: string[] }) =>
      setTaskAssignees(monthId, taskId, personIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tasksKeys.assignees(monthId) })
    },
    onError: (error) =>
      toast.error("No se pudieron guardar los asignados", { description: error.message }),
  })
}

export function useBulkSetTaskAssignees(monthId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (assignments: { taskId: string; personIds: string[] }[]) =>
      bulkSetTaskAssignees(monthId, assignments),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tasksKeys.assignees(monthId) })
    },
    onError: (error) =>
      toast.error("No se pudieron asignar las tareas importadas", { description: error.message }),
  })
}

export function useUpdateTask(monthId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: TaskUpdate }) => updateTask(id, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tasksKeys.all(monthId) })
      toast.success("Tarea actualizada")
    },
    onError: (error) =>
      toast.error("No se pudo actualizar la tarea", { description: error.message }),
  })
}

export function useDeleteTask(monthId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tasksKeys.all(monthId) })
      toast.success("Tarea eliminada")
    },
    onError: (error) =>
      toast.error("No se pudo eliminar la tarea", { description: error.message }),
  })
}

interface MoveVars {
  id: string
  status: TaskStatus
  boardOrder: number
}

// Arrastrar una tarjeta tiene que sentirse instantáneo: la tarjeta se pinta
// en su nueva columna en onMutate y vuelve sola a su sitio si el backend
// rechaza el cambio (RLS: el mes se cerró mientras el tablero estaba
// abierto). Mismo patrón que el autoguardado de la grilla.
export function useMoveTask(monthId: string) {
  const queryClient = useQueryClient()
  const key = tasksKeys.all(monthId)

  return useMutation({
    mutationFn: ({ id, status, boardOrder }: MoveVars) => moveTask(id, status, boardOrder),
    onMutate: async ({ id, status, boardOrder }) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Task[]>(key)

      queryClient.setQueryData<Task[]>(key, (current = []) =>
        current.map((task) =>
          task.id === id ? { ...task, status, board_order: boardOrder } : task
        )
      )

      return { previous }
    },
    onError: (error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
      toast.error("No se pudo mover la tarea", { description: error.message })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key })
    },
  })
}

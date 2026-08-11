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

// `root` existe para invalidar de una vez las tareas de cualquier mes y las
// de la vista "todos los meses" — ver useRealtimeTasks.
export const tasksKeys = {
  root: ["tasks"] as const,
  all: (monthId: string) => ["tasks", monthId] as const,
  allMonths: () => ["tasks", "__all-months__"] as const,
  assigneesRoot: ["task_assignees"] as const,
  assignees: (monthId: string) => ["task_assignees", monthId] as const,
  assigneesAllMonths: () => ["task_assignees", "__all-months__"] as const,
}

// `allMonths` ignora el mes activo y trae todo lo visible. Es para el
// Analista de Tecnología, cuyo trabajo no se corta por mes; RLS ya acota el
// resultado a sus propias tareas.
export function useTasks(monthId: string | null, options?: { allMonths?: boolean }) {
  const allMonths = options?.allMonths ?? false
  return useQuery({
    queryKey: allMonths ? tasksKeys.allMonths() : tasksKeys.all(monthId ?? ""),
    queryFn: () => listTasks(allMonths ? null : (monthId as string)),
    enabled: allMonths || Boolean(monthId),
  })
}

export function useCreateTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: TaskInsert) => createTask(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tasksKeys.root })
      toast.success("Tarea creada")
    },
    onError: (error) => toast.error("No se pudo crear la tarea", { description: error.message }),
  })
}

export function useBulkCreateTasks() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (inputs: TaskInsert[]) => bulkCreateTasks(inputs),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: tasksKeys.root })
      toast.success(`${created.length} tarea${created.length === 1 ? "" : "s"} importada${created.length === 1 ? "" : "s"}`)
    },
    onError: (error) => toast.error("No se pudo importar el archivo", { description: error.message }),
  })
}

export function useTaskAssignees(monthId: string | null, options?: { allMonths?: boolean }) {
  const allMonths = options?.allMonths ?? false
  return useQuery({
    queryKey: allMonths ? tasksKeys.assigneesAllMonths() : tasksKeys.assignees(monthId ?? ""),
    queryFn: () => listTaskAssignees(allMonths ? null : (monthId as string)),
    enabled: allMonths || Boolean(monthId),
  })
}

export function useSetTaskAssignees(monthId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ taskId, personIds }: { taskId: string; personIds: string[] }) =>
      setTaskAssignees(monthId, taskId, personIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tasksKeys.assigneesRoot })
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
      queryClient.invalidateQueries({ queryKey: tasksKeys.assigneesRoot })
    },
    onError: (error) =>
      toast.error("No se pudieron asignar las tareas importadas", { description: error.message }),
  })
}

export function useUpdateTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: TaskUpdate }) => updateTask(id, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tasksKeys.root })
      toast.success("Tarea actualizada")
    },
    onError: (error) =>
      toast.error("No se pudo actualizar la tarea", { description: error.message }),
  })
}

export function useDeleteTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tasksKeys.root })
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
export function useMoveTask() {
  const queryClient = useQueryClient()
  const key = tasksKeys.root

  return useMutation({
    mutationFn: ({ id, status, boardOrder }: MoveVars) => moveTask(id, status, boardOrder),
    onMutate: async ({ id, status, boardOrder }) => {
      await queryClient.cancelQueries({ queryKey: key })
      // Se opera sobre TODAS las cachés de tareas (la del mes y la de
      // "todos los meses"), no sobre una clave fija: si no, arrastrar una
      // tarjeta en la vista sin mes no se vería hasta el refetch.
      const previous = queryClient.getQueriesData<Task[]>({ queryKey: key })

      queryClient.setQueriesData<Task[]>({ queryKey: key }, (current) =>
        (current ?? []).map((task) =>
          task.id === id ? { ...task, status, board_order: boardOrder } : task
        )
      )

      return { previous }
    },
    onError: (error, _vars, context) => {
      for (const [cacheKey, data] of context?.previous ?? []) {
        queryClient.setQueryData(cacheKey, data)
      }
      toast.error("No se pudo mover la tarea", { description: error.message })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key })
    },
  })
}

import { supabase } from "@/lib/supabaseClient"
import type { Database, TaskStatus } from "@/types/database.types"

export type Task = Database["public"]["Tables"]["tasks"]["Row"]
export type TaskInsert = Database["public"]["Tables"]["tasks"]["Insert"]
export type TaskUpdate = Database["public"]["Tables"]["tasks"]["Update"]
export type TaskAssignee = Database["public"]["Tables"]["task_assignees"]["Row"]

// Separación entre dos tarjetas consecutivas al final de una columna. Al
// mover una tarjeta entre otras dos se usa el punto medio de sus
// board_order, así que este hueco inicial deja margen para muchos
// reordenamientos antes de que los decimales se agoten.
const ORDER_GAP = 1000

export async function listTasks(monthId: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("month_id", monthId)
    .order("board_order", { ascending: true })
    .order("created_at", { ascending: true })
  if (error) throw error
  return data
}

export async function createTask(input: TaskInsert): Promise<Task> {
  const { data, error } = await supabase.from("tasks").insert(input).select("*").single()
  if (error) throw error
  return data
}

// Cargue masivo desde Excel: un solo insert con todas las filas ya
// validadas y mapeadas (título, fase, estado, prioridad, responsable,
// board_order calculado). Si una fila viola una restricción, Postgres
// rechaza el insert completo — no hay una tarea "a medias" en la tabla.
export async function bulkCreateTasks(inputs: TaskInsert[]): Promise<Task[]> {
  if (inputs.length === 0) return []
  const { data, error } = await supabase.from("tasks").insert(inputs).select("*")
  if (error) throw error
  return data
}

export async function updateTask(id: string, patch: TaskUpdate): Promise<Task> {
  const { data, error } = await supabase
    .from("tasks")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single()
  if (error) throw error
  return data
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase.from("tasks").delete().eq("id", id)
  if (error) throw error
}

export async function listTaskAssignees(monthId: string): Promise<TaskAssignee[]> {
  const { data, error } = await supabase
    .from("task_assignees")
    .select("*")
    .eq("month_id", monthId)
  if (error) throw error
  return data
}

// Reemplaza de una sola vez la lista de asignados de una tarea, igual que
// setProjectMembers: manda la lista completa deseada y esta función calcula
// qué insertar/borrar.
export async function setTaskAssignees(
  monthId: string,
  taskId: string,
  personIds: string[]
): Promise<void> {
  const { data: existing, error: listError } = await supabase
    .from("task_assignees")
    .select("person_id")
    .eq("task_id", taskId)
  if (listError) throw listError

  const existingIds = new Set((existing ?? []).map((row) => row.person_id))
  const nextIds = new Set(personIds)

  const toRemove = [...existingIds].filter((id) => !nextIds.has(id))
  const toAdd = [...nextIds].filter((id) => !existingIds.has(id))

  if (toRemove.length > 0) {
    const { error } = await supabase
      .from("task_assignees")
      .delete()
      .eq("task_id", taskId)
      .in("person_id", toRemove)
    if (error) throw error
  }

  if (toAdd.length > 0) {
    const { error } = await supabase
      .from("task_assignees")
      .insert(toAdd.map((personId) => ({ month_id: monthId, task_id: taskId, person_id: personId })))
    if (error) throw error
  }
}

// Cargue masivo: cada tarea puede traer varios asignados, así que el insert
// de task_assignees se hace en un solo lote después de crear las tareas
// (bulkCreateTasks), emparejando por índice — mismo orden en el que se
// insertaron las filas.
export async function bulkSetTaskAssignees(
  monthId: string,
  assignments: { taskId: string; personIds: string[] }[]
): Promise<void> {
  const rows = assignments.flatMap(({ taskId, personIds }) =>
    personIds.map((personId) => ({ month_id: monthId, task_id: taskId, person_id: personId }))
  )
  if (rows.length === 0) return
  const { error } = await supabase.from("task_assignees").insert(rows)
  if (error) throw error
}

// board_order de una tarjeta nueva: al final de su columna. Acepta filas
// parciales (no solo Task completo) para que el import masivo pueda ir
// calculando el siguiente hueco sin fabricar tareas falsas con todos los
// campos.
export function nextBoardOrder(
  tasks: Pick<Task, "status" | "board_order">[],
  status: TaskStatus
): number {
  const inColumn = tasks.filter((t) => t.status === status)
  if (inColumn.length === 0) return ORDER_GAP
  return Math.max(...inColumn.map((t) => t.board_order)) + ORDER_GAP
}

// Calcula el board_order que debe tener una tarjeta soltada en `status`
// justo delante de `beforeTaskId` (null = al final de la columna): el punto
// medio entre su nuevo vecino anterior y el siguiente. Devolver un número en
// vez de reescribir toda la columna mantiene el drop en un solo UPDATE.
export function orderForDrop(
  tasks: Task[],
  status: TaskStatus,
  draggedId: string,
  beforeTaskId: string | null
): number {
  const column = tasks
    .filter((t) => t.status === status && t.id !== draggedId)
    .sort((a, b) => a.board_order - b.board_order)

  if (column.length === 0) return ORDER_GAP

  const index = beforeTaskId ? column.findIndex((t) => t.id === beforeTaskId) : -1

  // Soltada al final (o sobre un id que ya no está en la columna).
  if (index === -1) return column[column.length - 1].board_order + ORDER_GAP
  // Soltada en primer lugar.
  if (index === 0) return column[0].board_order / 2
  return (column[index - 1].board_order + column[index].board_order) / 2
}

// Mover una tarjeta = cambiar estado y/o posición. started_at/completed_at
// los sella el trigger tasks_track_status_timestamps en el servidor, así que
// aquí no se envían.
export async function moveTask(
  id: string,
  status: TaskStatus,
  boardOrder: number
): Promise<Task> {
  return updateTask(id, { status, board_order: boardOrder })
}

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

// `monthId: null` trae las tareas de TODOS los meses. Lo usa el Analista de
// Tecnología, cuyo trabajo no se organiza por mes: RLS ya acota el resultado
// a lo suyo, así que "sin filtro de mes" no expone nada de más.
export async function listTasks(monthId: string | null): Promise<Task[]> {
  let query = supabase.from("tasks").select("*")
  if (monthId) query = query.eq("month_id", monthId)

  const { data, error } = await query
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

// Cuando RLS rechaza la escritura, el UPDATE no falla: simplemente no toca
// ninguna fila. Con `.single()` eso llegaba al usuario como "Cannot coerce
// the result to a single JSON object" — un mensaje de PostgREST que no dice
// nada. Con `.maybeSingle()` se distingue el caso y se explica en castellano.
//
// El motivo casi siempre es el mismo: el mes está cerrado. Un Analista o un
// Gestor pueden VER las tareas de un mes cerrado pero no modificarlas (solo
// el Administrador), así que el tablero se puede abrir y la tarjeta no se
// puede mover.
export async function updateTask(id: string, patch: TaskUpdate): Promise<Task> {
  const { data, error } = await supabase
    .from("tasks")
    .update(patch)
    .eq("id", id)
    .select("*")
    .maybeSingle()
  if (error) throw error
  if (!data) {
    throw new Error(
      "No se guardó el cambio. Puede que el mes esté cerrado o que no tengas permiso sobre esta tarea."
    )
  }
  return data
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase.from("tasks").delete().eq("id", id)
  if (error) throw error
}

// Mismo criterio que listTasks: `null` = todos los meses.
export async function listTaskAssignees(monthId: string | null): Promise<TaskAssignee[]> {
  let query = supabase.from("task_assignees").select("*")
  if (monthId) query = query.eq("month_id", monthId)

  const { data, error } = await query
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

// Entregar a revisión es reportar las horas reales Y cambiar el estado, en un
// solo acto: si fueran dos pasos, una entrega podría quedar sin su reporte. Lo
// resuelve el RPC `submit_task_for_review` — el trigger del circuito rechaza
// un `en_revision` que no venga por ahí cuando el reporte es obligatorio (ver
// supabase/migrations/*_horas_reales_al_entregar.sql).
// Devolver una entrega es explicar qué corregir Y cambiar el estado. Mismo
// criterio que la entrega: un solo acto, para que ninguna devolución quede sin
// motivo. El comentario entra al hilo de la tarea, que es donde el analista lo
// va a buscar.
export async function returnTaskForRework(
  taskId: string,
  status: TaskStatus,
  comment: string
): Promise<void> {
  const { error } = await supabase.rpc("return_task_for_rework", {
    p_task_id: taskId,
    p_status: status,
    p_comment: comment,
  })
  if (error) throw error
}

export async function submitTaskForReview(
  taskId: string,
  hours: number | null,
  note: string | null
): Promise<void> {
  const { error } = await supabase.rpc("submit_task_for_review", {
    p_task_id: taskId,
    p_hours: hours ?? undefined,
    p_note: note ?? undefined,
  })
  if (error) throw error
}

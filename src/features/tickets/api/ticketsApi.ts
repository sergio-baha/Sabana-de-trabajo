import { supabase } from "@/lib/supabaseClient"
import type { Database } from "@/types/database.types"

export type Ticket = Database["public"]["Tables"]["tasks"]["Row"]

// Un ticket es una tarea con número — ver *_tickets_esquema.sql. No se filtra
// por el proyecto contenedor a propósito: si mañana los tickets se reparten
// entre varios proyectos, `ticket_number is not null` sigue siendo cierto y
// esta consulta no cambia.
//
// Sin filtro de mes, igual que el tablero del Analista de Tecnología: el
// trabajo de soporte no se corta por mes. RLS ya acota el resultado —
// tickets para quien es de soporte, nada para el resto.
export async function listTickets(): Promise<Ticket[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .not("ticket_number", "is", null)
    .order("ticket_number", { ascending: false })
  if (error) throw error
  return data
}

// La fila de roster de una cuenta EN UN MES CONCRETO.
//
// Hace falta porque `task_assignees.person_id` apunta a `people`, que es por
// mes: para tomar un ticket de agosto necesito MI fila de agosto, no la del
// mes que tenga seleccionado en el encabezado. Y la bandeja mezcla meses,
// porque el trabajo de soporte no se corta por mes.
export async function personInMonth(monthId: string, profileId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("people")
    .select("id")
    .eq("month_id", monthId)
    .eq("profile_id", profileId)
    .maybeSingle()
  if (error) throw error
  return data?.id ?? null
}

// Candidatos a atender un ticket: el roster de ese mes que además tenga
// cuenta de Analista de Tecnología. Se cruza contra `profiles` porque el rol
// vive allí y `people` es solo la fila del mes.
export async function listSupportPeople(
  monthId: string
): Promise<{ id: string; name: string }[]> {
  const { data, error } = await supabase
    .from("people")
    .select("id, name, profiles!inner(role, is_active)")
    .eq("month_id", monthId)
    .eq("profiles.role", "analista_tecnologia")
    .eq("profiles.is_active", true)
  if (error) throw error
  return (data ?? []).map((p) => ({ id: p.id, name: p.name }))
}

// Tomar un ticket para sí mismo. La política verifica que `person_id`
// corresponda a auth.uid(), así que pasar la fila de otro no es un riesgo de
// seguridad — es un error que rebota.
export async function takeTicket(taskId: string, monthId: string, personId: string) {
  const { error } = await supabase
    .from("task_assignees")
    .insert({ task_id: taskId, month_id: monthId, person_id: personId })
  if (error) throw error
}

// Asignar a un tercero (Coordinador y Administrador). Reemplaza al
// responsable actual en vez de sumar: un ticket tiene un dueño, a diferencia
// de una tarea de proyecto, que admite varios.
export async function assignTicket(taskId: string, monthId: string, personId: string) {
  const { error: clearError } = await supabase
    .from("task_assignees")
    .delete()
    .eq("task_id", taskId)
  if (clearError) throw clearError

  const { error } = await supabase
    .from("task_assignees")
    .insert({ task_id: taskId, month_id: monthId, person_id: personId })
  if (error) throw error
}

// Devolver a la bandeja. Se usa cuando alguien tomó un ticket que no le
// correspondía; el ticket vuelve a quedar sin dueño y visible para todos.
export async function releaseTicket(taskId: string) {
  const { error } = await supabase.from("task_assignees").delete().eq("task_id", taskId)
  if (error) throw error
}

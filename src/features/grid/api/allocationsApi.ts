import { supabase } from "@/lib/supabaseClient"
import type { Database } from "@/types/database.types"

export type Allocation = Database["public"]["Tables"]["allocations"]["Row"]

export async function listAllocations(monthId: string): Promise<Allocation[]> {
  const { data, error } = await supabase.from("allocations").select("*").eq("month_id", monthId)
  if (error) throw error
  return data
}

// Una celda de la grilla = una fila de allocations (unique month_id+person_id
// +project_id+line_id, ver supabase/migrations/*_allocations.sql y
// *_lineas_de_proyecto.sql). "Guardar" una celda es upsert por ese conflicto;
// 0 horas simplemente se guarda como 0 en vez de borrar la fila, para no
// perder el rastro de auditoría de quién la dejó en 0 (el trigger
// audit_row_change registra el update igual).
//
// `lineId` es el subproyecto de la fila: todo proyecto tiene al menos uno
// obligatorio (ver *_subproyecto_obligatorio.sql), así que ya no hay un caso
// "fila base sin línea" — siempre se guarda contra un subproyecto real.
export async function upsertAllocation(
  monthId: string,
  personId: string,
  projectId: string,
  hours: number,
  lineId: string
): Promise<Allocation> {
  const { data, error } = await supabase
    .from("allocations")
    .upsert(
      { month_id: monthId, person_id: personId, project_id: projectId, line_id: lineId, hours },
      { onConflict: "month_id,person_id,project_id,line_id" }
    )
    .select("*")
    .single()
  if (error) throw error
  return data
}

// "Limpiar" celdas es ponerlas en 0, no borrarlas: mismo criterio que el
// upsert de arriba (se conserva el rastro de auditoría) y además así la fila
// del proyecto no desaparece de la grilla del mes al vaciarla.
//
// Recibe ids de allocations y no month+project porque quien limpia decide
// celda por celda: las que tienen desglose de actividades no se tocan, ya que
// allí las horas las manda el trigger que suma las actividades
// (ver *_activities.sql) y un 0 escrito a mano quedaría desincronizado.
export async function clearAllocationHours(allocationIds: string[]): Promise<void> {
  if (allocationIds.length === 0) return
  const { error } = await supabase
    .from("allocations")
    .update({ hours: 0 })
    .in("id", allocationIds)
  if (error) throw error
}

// Encuentra la fila de allocations para esta celda o la crea en 0 horas —
// necesario para que un Analista pueda anclar un comentario a una celda que
// nunca se guardó (ver migración *_allocations_allow_comment_anchor.sql), y
// para que Gestor/Admin puedan agregar la primera actividad de una celda
// vacía (features/activities).
//
export async function getOrCreateAllocationId(
  monthId: string,
  personId: string,
  projectId: string,
  lineId: string
): Promise<string> {
  const query = supabase
    .from("allocations")
    .select("id")
    .eq("month_id", monthId)
    .eq("person_id", personId)
    .eq("project_id", projectId)
    .eq("line_id", lineId)

  const { data: existing, error: selectError } = await query.maybeSingle()
  if (selectError) throw selectError
  if (existing) return existing.id

  const { data: created, error: insertError } = await supabase
    .from("allocations")
    .insert({ month_id: monthId, person_id: personId, project_id: projectId, line_id: lineId, hours: 0 })
    .select("id")
    .single()
  if (insertError) throw insertError
  return created.id
}

// Saca un proyecto de la sábana de UN mes, sin tocar el proyecto ni los demás
// meses. La pertenencia de un proyecto a un mes no se guarda en ninguna parte:
// es derivada — un proyecto está en la sábana si tiene filas en `allocations`
// de ese mes (ver `monthProjectIds` en DistribucionPage). Así que quitarlo es
// borrar esas filas, y por eso acá sí se borra en vez de poner en 0 como hace
// `clearAllocationHours`: un 0 es justamente lo que mantiene la fila visible.
//
// Se lleva por cascada las actividades y los comentarios anclados a esas
// celdas (`on delete cascade` en *_activities.sql y *_comments.sql). No hay
// forma de evitarlo sin dejar huérfanos, así que quien confirma tiene que
// saberlo: el diálogo lo dice con las cifras del mes.
export async function removeProjectFromMonth(
  monthId: string,
  projectId: string
): Promise<void> {
  const { error } = await supabase
    .from("allocations")
    .delete()
    .eq("month_id", monthId)
    .eq("project_id", projectId)
  if (error) throw error
}

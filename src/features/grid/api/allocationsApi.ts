import { supabase } from "@/lib/supabaseClient"
import type { Database } from "@/types/database.types"

export type Allocation = Database["public"]["Tables"]["allocations"]["Row"]

export async function listAllocations(monthId: string): Promise<Allocation[]> {
  const { data, error } = await supabase.from("allocations").select("*").eq("month_id", monthId)
  if (error) throw error
  return data
}

// Una celda de la grilla = una fila de allocations (unique month_id+person_id
// +project_id, ver supabase/migrations/*_allocations.sql). "Guardar" una
// celda es upsert por ese conflicto; 0 horas simplemente se guarda como 0 en
// vez de borrar la fila, para no perder el rastro de auditoría de quién la
// dejó en 0 (el trigger audit_row_change registra el update igual).
export async function upsertAllocation(
  monthId: string,
  personId: string,
  projectId: string,
  hours: number
): Promise<Allocation> {
  const { data, error } = await supabase
    .from("allocations")
    .upsert(
      { month_id: monthId, person_id: personId, project_id: projectId, hours },
      { onConflict: "month_id,person_id,project_id" }
    )
    .select("*")
    .single()
  if (error) throw error
  return data
}

// Encuentra la fila de allocations para esta celda o la crea en 0 horas —
// necesario para que un Analista pueda anclar un comentario a una celda que
// nunca se guardó (ver migración *_allocations_allow_comment_anchor.sql), y
// para que Gestor/Admin puedan agregar la primera actividad de una celda
// vacía (features/activities).
export async function getOrCreateAllocationId(
  monthId: string,
  personId: string,
  projectId: string
): Promise<string> {
  const { data: existing, error: selectError } = await supabase
    .from("allocations")
    .select("id")
    .eq("month_id", monthId)
    .eq("person_id", personId)
    .eq("project_id", projectId)
    .maybeSingle()
  if (selectError) throw selectError
  if (existing) return existing.id

  const { data: created, error: insertError } = await supabase
    .from("allocations")
    .insert({ month_id: monthId, person_id: personId, project_id: projectId, hours: 0 })
    .select("id")
    .single()
  if (insertError) throw insertError
  return created.id
}

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

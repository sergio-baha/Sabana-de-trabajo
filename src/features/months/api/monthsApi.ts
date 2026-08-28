import { supabase } from "@/lib/supabaseClient"
import type { Database } from "@/types/database.types"

export type Month = Database["public"]["Tables"]["months"]["Row"]
export type MonthInsert = Database["public"]["Tables"]["months"]["Insert"]
export type MonthUpdate = Database["public"]["Tables"]["months"]["Update"]

export async function listMonths(): Promise<Month[]> {
  const { data, error } = await supabase
    .from("months")
    .select("*")
    .order("created_at", { ascending: false })
  if (error) throw error
  return data
}

export async function createMonth(input: MonthInsert): Promise<Month> {
  const { data, error } = await supabase.from("months").insert(input).select("*").single()
  if (error) throw error
  return data
}

export async function updateMonth(id: string, patch: MonthUpdate): Promise<Month> {
  const { data, error } = await supabase
    .from("months")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single()
  if (error) throw error
  return data
}

export async function deleteMonth(id: string): Promise<void> {
  const { error } = await supabase.from("months").delete().eq("id", id)
  if (error) throw error
}

// Marca (o desmarca) la planeación del mes como terminada. Va por RPC y no
// por un update: `months` es de escritura exclusiva del Administrador, y esta
// es la única operación que un Gestor puede hacer sobre el mes. Ver
// *_planeacion_lista.sql.
export async function setPlanningReady(monthId: string, ready: boolean): Promise<void> {
  const { error } = await supabase.rpc("set_planning_ready", {
    p_month_id: monthId,
    p_ready: ready,
  })
  if (error) throw error
}

export async function duplicateMonth(sourceMonthId: string, newName: string): Promise<string> {
  const { data, error } = await supabase.rpc("create_month_from_previous", {
    p_source_month_id: sourceMonthId,
    p_new_name: newName,
  })
  if (error) throw error
  return data
}

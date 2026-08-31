import { supabase } from "@/lib/supabaseClient"
import type { Database } from "@/types/database.types"

export type Month = Database["public"]["Tables"]["months"]["Row"]
export type MonthInsert = Database["public"]["Tables"]["months"]["Insert"]
export type MonthUpdate = Database["public"]["Tables"]["months"]["Update"]
export type GestorCheck = Database["public"]["Tables"]["month_gestor_checks"]["Row"]

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

// Tabla chica (un puñado de gestores × meses activos) — se trae completa,
// igual que useProfiles, y se agrupa por mes en el cliente.
export async function listGestorChecks(): Promise<GestorCheck[]> {
  const { data, error } = await supabase.from("month_gestor_checks").select("*")
  if (error) throw error
  return data
}

// Marca (o desmarca) la casilla del gestor que llama, para un mes. Va por
// RPC y no por un insert/delete directo: `months` sigue siendo de escritura
// exclusiva del Administrador, y esta es la única señal que un Gestor puede
// dejar sobre el mes. Ver *_check_planeacion_por_gestor.sql.
export async function setGestorCheck(monthId: string, checked: boolean): Promise<void> {
  const { error } = await supabase.rpc("set_gestor_check", {
    p_month_id: monthId,
    p_checked: checked,
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

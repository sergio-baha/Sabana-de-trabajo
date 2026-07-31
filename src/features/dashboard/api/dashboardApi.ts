import { supabase } from "@/lib/supabaseClient"
import type { Database } from "@/types/database.types"

export type PersonMonthTotal = Database["public"]["Views"]["v_person_month_totals"]["Row"]
export type ProjectMonthTotal = Database["public"]["Views"]["v_project_month_totals"]["Row"]

export async function listPersonTotals(monthId: string): Promise<PersonMonthTotal[]> {
  const { data, error } = await supabase
    .from("v_person_month_totals")
    .select("*")
    .eq("month_id", monthId)
  if (error) throw error
  return data
}

export async function listProjectTotals(monthId: string): Promise<ProjectMonthTotal[]> {
  const { data, error } = await supabase
    .from("v_project_month_totals")
    .select("*")
    .eq("month_id", monthId)
  if (error) throw error
  return data
}

export interface RecentChange {
  id: string
  table_name: string
  field_name: string | null
  old_value: string | null
  new_value: string | null
  action: Database["public"]["Tables"]["audit_logs"]["Row"]["action"]
  changed_by: string | null
  changed_at: string
}

// audit_logs es de solo lectura para Admin (ver RLS en
// supabase/migrations/*_audit_logs.sql) — este widget se omite en el
// Dashboard para otros roles en vez de mostrar una lista vacía confusa.
export async function listRecentChanges(monthId: string, limit = 8): Promise<RecentChange[]> {
  const { data, error } = await supabase
    .from("audit_logs")
    .select("id, table_name, field_name, old_value, new_value, action, changed_by, changed_at")
    .eq("month_id", monthId)
    .order("changed_at", { ascending: false })
    .limit(limit)
  if (error) throw error
  return data
}

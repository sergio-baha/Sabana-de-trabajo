import { supabase } from "@/lib/supabaseClient"
import type { Database } from "@/types/database.types"

export type ManagerMonthTotal = Database["public"]["Views"]["v_manager_month_totals"]["Row"]

export async function listManagerTotals(monthId: string): Promise<ManagerMonthTotal[]> {
  const { data, error } = await supabase
    .from("v_manager_month_totals")
    .select("*")
    .eq("month_id", monthId)
  if (error) throw error
  return data
}

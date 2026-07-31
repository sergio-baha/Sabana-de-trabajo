import { supabase } from "@/lib/supabaseClient"
import type { Database } from "@/types/database.types"

export type MonthSnapshot = Database["public"]["Tables"]["month_snapshots"]["Row"]

export async function listSnapshots(monthId: string): Promise<MonthSnapshot[]> {
  const { data, error } = await supabase
    .from("month_snapshots")
    .select("*")
    .eq("month_id", monthId)
    .order("created_at", { ascending: false })
  if (error) throw error
  return data
}

export async function createSnapshot(monthId: string, label: string | null): Promise<string> {
  const { data, error } = await supabase.rpc("create_month_snapshot", {
    p_month_id: monthId,
    p_label: label ?? undefined,
  })
  if (error) throw error
  return data
}

export async function restoreSnapshot(snapshotId: string): Promise<void> {
  const { error } = await supabase.rpc("restore_month_snapshot", { p_snapshot_id: snapshotId })
  if (error) throw error
}

export async function deleteSnapshot(id: string): Promise<void> {
  const { error } = await supabase.from("month_snapshots").delete().eq("id", id)
  if (error) throw error
}

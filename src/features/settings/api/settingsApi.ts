import { supabase } from "@/lib/supabaseClient"
import type { Database } from "@/types/database.types"

export type Settings = Database["public"]["Tables"]["settings"]["Row"]

export async function getSettings(): Promise<Settings> {
  const { data, error } = await supabase.from("settings").select("*").eq("id", 1).single()
  if (error) throw error
  return data
}

export async function updateSettings(
  patch: Database["public"]["Tables"]["settings"]["Update"]
): Promise<Settings> {
  const { data, error } = await supabase
    .from("settings")
    .update(patch)
    .eq("id", 1)
    .select("*")
    .single()
  if (error) throw error
  return data
}

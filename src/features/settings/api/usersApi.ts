import { supabase } from "@/lib/supabaseClient"
import type { AppRole } from "@/types/database.types"

export async function updateProfileRole(id: string, role: AppRole): Promise<void> {
  const { error } = await supabase.from("profiles").update({ role }).eq("id", id)
  if (error) throw error
}

export async function setProfileActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.from("profiles").update({ is_active: isActive }).eq("id", id)
  if (error) throw error
}

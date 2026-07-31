import { supabase } from "@/lib/supabaseClient"
import type { AppRole, Database } from "@/types/database.types"

export type Invitation = Database["public"]["Tables"]["invitations"]["Row"]

export async function listInvitations(): Promise<Invitation[]> {
  const { data, error } = await supabase
    .from("invitations")
    .select("*")
    .order("invited_at", { ascending: false })
  if (error) throw error
  return data
}

// Llama al Edge Function invite-user (supabase/functions/invite-user), que
// es el único lugar con permiso para crear cuentas en auth.users — el
// cliente nunca tiene la service_role key.
export async function inviteUser(email: string, role: AppRole, fullName?: string): Promise<void> {
  const { error } = await supabase.functions.invoke("invite-user", {
    body: { email, role, fullName },
  })
  if (error) throw error
}

export async function revokeInvitation(id: string): Promise<void> {
  const { error } = await supabase
    .from("invitations")
    .update({ status: "revocada", revoked_at: new Date().toISOString() })
    .eq("id", id)
  if (error) throw error
}

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
//
// Sin `password` envía una invitación por correo; con `password` crea la
// cuenta directamente, ya confirmada y lista para usar.
export async function inviteUser(
  email: string,
  role: AppRole,
  fullName?: string,
  password?: string
): Promise<void> {
  const { data, error } = await supabase.functions.invoke("invite-user", {
    body: { email, role, fullName, password },
  })
  if (error) {
    // Los errores de negocio del Edge Function (correo repetido, rol
    // inválido…) llegan como 4xx: supabase-js solo dice "non-2xx status", así
    // que se lee el cuerpo para mostrar el motivo real al administrador.
    let detail: string | undefined
    try {
      const context = (error as { context?: Response }).context
      if (context && typeof context.json === "function") {
        detail = (await context.json())?.error
      }
    } catch {
      /* el cuerpo no era JSON; se muestra el error genérico */
    }
    throw new Error(detail ?? error.message)
  }
  const returned = data as { error?: string } | null
  if (returned?.error) throw new Error(returned.error)
}

export async function revokeInvitation(id: string): Promise<void> {
  const { error } = await supabase
    .from("invitations")
    .update({ status: "revocada", revoked_at: new Date().toISOString() })
    .eq("id", id)
  if (error) throw error
}

import { supabase } from "@/lib/supabaseClient"
import type { AppRole } from "@/types/database.types"

export async function updateProfileRole(id: string, role: AppRole): Promise<void> {
  const { error } = await supabase.from("profiles").update({ role }).eq("id", id)
  if (error) throw error
}

// El cargo es de la persona, no del mes: se escribe una vez acá y un trigger
// lo baja a las filas del roster de los meses abiertos, que es lo que leen
// los reportes (ver *_roster_desde_las_cuentas.sql).
export async function updateProfileJobTitle(id: string, jobTitle: string): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ job_title: jobTitle.trim() || null })
    .eq("id", id)
  if (error) throw error
}

export async function updateProfileName(id: string, fullName: string): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName.trim() })
    .eq("id", id)
  if (error) throw error
}

// El correo y la contraseña viven en `auth.users`, que el navegador no puede
// tocar: van por RPC con SECURITY DEFINER, que comprueba que quien llama sea
// administrador (ver *_admin_gestion_de_cuentas.sql).
export async function updateUserEmail(id: string, email: string): Promise<void> {
  const { error } = await supabase.rpc("admin_update_user_email", {
    p_user_id: id,
    p_email: email.trim(),
  })
  if (error) throw error
}

export async function resetUserPassword(id: string, password: string): Promise<void> {
  const { error } = await supabase.rpc("admin_reset_user_password", {
    p_user_id: id,
    p_password: password,
  })
  if (error) throw error
}

export async function setProfileActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.from("profiles").update({ is_active: isActive }).eq("id", id)
  if (error) throw error
}

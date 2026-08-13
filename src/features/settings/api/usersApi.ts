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

export async function setProfileActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.from("profiles").update({ is_active: isActive }).eq("id", id)
  if (error) throw error
}

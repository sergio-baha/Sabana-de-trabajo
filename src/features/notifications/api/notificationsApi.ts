import { supabase } from "@/lib/supabaseClient"
import type { Database } from "@/types/database.types"

export type Notification = Database["public"]["Tables"]["notifications"]["Row"]
export type NotificationKind = "revision_pendiente" | "tarea_aprobada" | "tarea_devuelta"

// El buzón es corto por naturaleza (avisos de revisión de un equipo pequeño),
// así que se trae completo y se pagina en el cliente. RLS ya lo acota a la
// propia cuenta: no hace falta filtrar por destinatario acá.
export async function listNotifications(): Promise<Notification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50)
  if (error) throw error
  return data
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
  if (error) throw error
}

export async function markAllNotificationsRead(): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null)
  if (error) throw error
}

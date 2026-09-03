import { supabase } from "@/lib/supabaseClient"
import type { Database } from "@/types/database.types"

export type OutboxMail = Database["public"]["Tables"]["outbox"]["Row"]

export type OutboxStatus = "enviado" | "pendiente" | "fallido"

// No es una columna: se deriva de sent_at/attempts/last_error, igual que ya
// hace outbox-worker para decidir si reintenta. "Fallido" es a partir de 5
// intentos (MAX_ATTEMPTS en la Edge Function) — antes de eso todavía puede
// salir en el próximo ciclo del cron, así que sigue siendo "pendiente".
const MAX_ATTEMPTS = 5

export function outboxStatus(mail: Pick<OutboxMail, "sent_at" | "attempts">): OutboxStatus {
  if (mail.sent_at) return "enviado"
  if (mail.attempts >= MAX_ATTEMPTS) return "fallido"
  return "pendiente"
}

export interface OutboxFilters {
  kind?: string
  status?: OutboxStatus
  search?: string
}

const PAGE_SIZE = 25

export async function listOutbox(
  filters: OutboxFilters,
  page: number
): Promise<{ rows: OutboxMail[]; count: number }> {
  let query = supabase.from("outbox").select("*", { count: "exact" }).order("created_at", {
    ascending: false,
  })

  if (filters.kind) query = query.eq("kind", filters.kind)
  // "Fallido" son intentos agotados sin éxito; "pendiente" es sent_at nulo
  // pero todavía con intentos disponibles — se filtra en el cliente para
  // "pendiente" porque cruza dos columnas con un umbral, no una comparación
  // directa que .eq()/.lt() resuelva sola contra el servidor sin duplicar
  // MAX_ATTEMPTS en dos lenguajes distintos de consulta.
  if (filters.status === "enviado") query = query.not("sent_at", "is", null)
  if (filters.status === "fallido") query = query.is("sent_at", null).gte("attempts", MAX_ATTEMPTS)
  if (filters.status === "pendiente") query = query.is("sent_at", null).lt("attempts", MAX_ATTEMPTS)
  if (filters.search) {
    const q = `%${filters.search}%`
    query = query.or(`to_email.ilike.${q},subject.ilike.${q}`)
  }

  const from = page * PAGE_SIZE
  const to = from + PAGE_SIZE - 1
  const { data, error, count } = await query.range(from, to)
  if (error) throw error
  return { rows: data, count: count ?? 0 }
}

export const OUTBOX_PAGE_SIZE = PAGE_SIZE

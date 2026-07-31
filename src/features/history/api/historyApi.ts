import { supabase } from "@/lib/supabaseClient"
import type { Database } from "@/types/database.types"

export type AuditLog = Database["public"]["Tables"]["audit_logs"]["Row"]

export interface AuditLogFilters {
  monthId?: string
  tableName?: string
  changedBy?: string
  from?: string
  to?: string
  search?: string
}

const PAGE_SIZE = 25

// audit_logs es de solo lectura para Admin (RLS), y puede crecer sin límite
// — se pagina con .range() en vez de traer todo, y los filtros se aplican
// en el servidor para no descargar más de lo necesario.
export async function listAuditLogs(
  filters: AuditLogFilters,
  page: number
): Promise<{ rows: AuditLog[]; count: number }> {
  let query = supabase
    .from("audit_logs")
    .select("*", { count: "exact" })
    .order("changed_at", { ascending: false })

  if (filters.monthId) query = query.eq("month_id", filters.monthId)
  if (filters.tableName) query = query.eq("table_name", filters.tableName)
  if (filters.changedBy) query = query.eq("changed_by", filters.changedBy)
  if (filters.from) query = query.gte("changed_at", filters.from)
  if (filters.to) query = query.lte("changed_at", filters.to)
  if (filters.search) {
    const q = `%${filters.search}%`
    query = query.or(`old_value.ilike.${q},new_value.ilike.${q},field_name.ilike.${q}`)
  }

  const from = page * PAGE_SIZE
  const to = from + PAGE_SIZE - 1
  const { data, error, count } = await query.range(from, to)
  if (error) throw error
  return { rows: data, count: count ?? 0 }
}

export const AUDIT_PAGE_SIZE = PAGE_SIZE

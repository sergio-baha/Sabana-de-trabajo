import { supabase } from "@/lib/supabaseClient"
import type { Json } from "@/types/database.types"

// El registro diario abierto desde el enlace del correo va contra la Edge
// Function `time-log` y no contra PostgREST, porque quien abre ese enlace NO
// tiene sesión: trae un token de un día, y RLS no tiene a quién preguntarle.
// La función valida el token con la service_role key del servidor, que nunca
// puede viajar al navegador.

export interface TimeLogOption {
  project_id: string
  project_name: string
  color: string
  line_id: string | null
  line_name: string | null
  horas_planeadas: number
}

export interface TimeLogEntry {
  project_id: string | null
  line_id: string | null
  hours: number
  note: string | null
  /** Presente cuando la línea salió de una reunión de Outlook. */
  calendar_event_id?: string | null
}

// Una reunión del calendario, ya filtrada y con su proyecto sugerido. De las
// marcadas privadas llega la duración y no el asunto: se cuenta el tiempo sin
// exponer de qué se trataba.
export interface CalendarEvent {
  event_uid: string
  subject: string | null
  starts_at: string
  ends_at: string
  hours: number
  is_private: boolean
  // La sugerencia es la celda de la sábana completa: proyecto + subproyecto.
  suggested_project_id: string | null
  suggested_line_id: string | null
  suggested_project_name: string | null
}

export interface TimeLogContext {
  person: { id: string; name: string; available_hours: number; month: string | null }
  date: string
  responded_at: string | null
  options: TimeLogOption[]
  entries: TimeLogEntry[]
  calendar: CalendarEvent[]
}

export interface TimeLogReceipt {
  registros: number
  horas_dia: number
  horas_semana: number
}

// La función responde 410 con { error: "expirado" } para el token vencido o
// inexistente. Se distingue de un fallo de red porque la pantalla muestra
// cosas distintas: "pide un enlace nuevo" contra "reintenta".
export class TimeLogTokenError extends Error {}

async function callTimeLog<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("time-log", { body })

  if (error) {
    // supabase-js envuelve el cuerpo del error; el mensaje útil está adentro.
    const detail = await readErrorBody(error)
    if (detail === "expirado") throw new TimeLogTokenError("expirado")
    throw new Error(detail ?? error.message)
  }

  if (data?.error) {
    if (data.error === "expirado") throw new TimeLogTokenError("expirado")
    throw new Error(data.error)
  }

  return data as T
}

async function readErrorBody(error: unknown): Promise<string | null> {
  const context = (error as { context?: Response })?.context
  if (!context || typeof context.json !== "function") return null
  try {
    const body = await context.json()
    return typeof body?.error === "string" ? body.error : null
  } catch {
    return null
  }
}

export function getTimeLogContext(token: string): Promise<TimeLogContext> {
  return callTimeLog<TimeLogContext>({ token, action: "context" })
}

export function submitTimeLog(token: string, entries: TimeLogEntry[]): Promise<TimeLogReceipt> {
  return callTimeLog<TimeLogReceipt>({ token, action: "submit", entries })
}

// Registro desde dentro de la aplicación, con sesión: acá sí hay JWT, así que
// va por el RPC directo y no pasa por la Edge Function.
export async function logDailyTime(date: string, entries: TimeLogEntry[]): Promise<number> {
  const { data, error } = await supabase.rpc("log_daily_time", {
    p_date: date,
    // El RPC recibe jsonb; el tipo generado lo expresa como `Json`, que no
    // acepta una interfaz sin índice de cadena. El contenido es el mismo.
    p_entries: entries as unknown as Json,
  })
  if (error) throw error
  return data ?? 0
}

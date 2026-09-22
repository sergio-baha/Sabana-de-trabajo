// Edge Function: graph-calendar-sync
//
// Lee la agenda del día de cada persona del roster en Microsoft Graph y la
// deja en `calendar_events_cache`, para que el formulario de registro llegue
// con las reuniones ya cargadas. La llama `daily-time-request` justo antes de
// enviar los recordatorios, y también se puede llamar a mano.
//
// PERMISOS DE APLICACIÓN, NO DELEGADOS: la función lee buzones sin que nadie
// inicie sesión. La alternativa —consentimiento por persona, con refresh
// token de cada quien— multiplica el mantenimiento (tokens que expiran, gente
// que revoca, altas y bajas) sin ganar nada: el bot no actúa "como" el
// usuario, solo le mira la agenda para sugerirle horas. El alcance se acota
// del lado de Exchange con una Application Access Policy sobre un grupo de
// correo; sin esa política, `Calendars.Read` de aplicación da acceso a TODOS
// los buzones del tenant, que es más de lo que este circuito necesita.
//
// LA PRIVACIDAD SE DECIDE ANTES DE GUARDAR: de una reunión marcada privada o
// confidencial se manda `is_private` y el asunto se descarta en
// `cache_calendar_event`, que nunca lo escribe. Se cuenta el tiempo sin
// exponer de qué se trataba.
//
// QUÉ SE IGNORA Y POR QUÉ:
//   - Canceladas: el tiempo no ocurrió.
//   - De día completo: casi siempre son marcas (vacaciones, cumpleaños), no
//     tiempo de trabajo; sugerir 24 horas sería ruido.
//   - Rechazadas: si la persona dijo que no, no estuvo.
//   - Marcadas como "libre": es tiempo bloqueado, no tiempo ocupado.
//
// FALLA EN SILENCIO A PROPÓSITO: quien la llama sigue adelante si esto se
// cae. El recordatorio diario tiene que salir con o sin calendario; un Graph
// caído no puede volverse un día sin registrar.
//
// Variables de entorno requeridas:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY
//   GRAPH_TENANT_ID, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET
//   TIME_REQUEST_SECRET  — mismo secreto compartido que daily-time-request

import { createClient } from "npm:@supabase/supabase-js@2"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  })
}

async function autorizado(req: Request): Promise<boolean> {
  const secret = Deno.env.get("TIME_REQUEST_SECRET")
  if (secret && req.headers.get("X-Webhook-Secret") === secret) return true

  const authHeader = req.headers.get("Authorization")
  if (!authHeader) return false

  const client = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  )

  const { data: user } = await client.auth.getUser()
  if (!user?.user) return false

  const { data: profile } = await client
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.user.id)
    .single()

  return profile?.role === "administrador" && profile?.is_active === true
}

async function graphToken(): Promise<string> {
  const tenant = Deno.env.get("GRAPH_TENANT_ID")
  const clientId = Deno.env.get("GRAPH_CLIENT_ID")
  const clientSecret = Deno.env.get("GRAPH_CLIENT_SECRET")

  if (!tenant || !clientId || !clientSecret) {
    throw new Error("Falta configurar GRAPH_TENANT_ID / GRAPH_CLIENT_ID / GRAPH_CLIENT_SECRET")
  }

  const res = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    }),
  })

  if (!res.ok) throw new Error(`Entra ID ${res.status}: ${await res.text()}`)
  const body = await res.json()
  return body.access_token as string
}

interface GraphEvent {
  iCalUId?: string
  id?: string
  subject?: string
  start?: { dateTime: string; timeZone: string }
  end?: { dateTime: string; timeZone: string }
  isAllDay?: boolean
  isCancelled?: boolean
  sensitivity?: string
  showAs?: string
  responseStatus?: { response?: string }
}

function seCuenta(event: GraphEvent): boolean {
  if (event.isCancelled || event.isAllDay) return false
  if (event.showAs === "free") return false
  if (event.responseStatus?.response === "declined") return false
  return Boolean(event.start?.dateTime && event.end?.dateTime)
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS })
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405)
  if (!(await autorizado(req))) return json({ error: "No autorizado" }, 401)

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  )

  const { data: settings } = await supabase
    .from("settings")
    .select("time_request_calendar_enabled, time_request_timezone")
    .eq("id", 1)
    .single()

  if (!settings?.time_request_calendar_enabled) {
    return json({ ok: true, synced: 0, skipped: "calendario desactivado" })
  }

  let fecha: string | null = null
  try {
    const body = await req.json()
    if (typeof body?.date === "string") fecha = body.date
  } catch {
    /* sin cuerpo: se sincroniza el día de hoy en la zona configurada */
  }

  if (!fecha) {
    // "Hoy" en la zona de la empresa, no en UTC: a las 7 p.m. de Bogotá, UTC
    // ya está en el día siguiente y se sincronizaría una agenda vacía.
    fecha = new Intl.DateTimeFormat("en-CA", {
      timeZone: settings.time_request_timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date())
  }

  const { data: ventana, error: ventanaError } = await supabase
    .rpc("day_window", { p_date: fecha })
    .single()

  if (ventanaError) return json({ error: ventanaError.message }, 500)

  const { data: roster, error: rosterError } = await supabase.rpc("roster_with_accounts")
  if (rosterError) return json({ error: rosterError.message }, 500)
  if (!roster?.length) return json({ ok: true, synced: 0, skipped: "roster vacío" })

  let token: string
  try {
    token = await graphToken()
  } catch (e) {
    return json({ error: String(e) }, 502)
  }

  const params = new URLSearchParams({
    startDateTime: ventana.starts_at,
    endDateTime: ventana.ends_at,
    $select: "iCalUId,subject,start,end,isAllDay,isCancelled,sensitivity,showAs,responseStatus",
    $orderby: "start/dateTime",
    $top: "100",
  })

  let eventos = 0
  const failures: string[] = []

  for (const persona of roster) {
    try {
      const res = await fetch(
        `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(persona.email)}/calendarView?${params}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            // Sin esto Graph devuelve las horas en UTC sin decirlo, y una
            // reunión de las 8 a.m. de Bogotá aparece como de la 1 p.m.
            Prefer: `outlook.timezone="${settings.time_request_timezone}"`,
          },
        }
      )

      if (!res.ok) {
        // 404 = ese correo no tiene buzón en el tenant (cuenta de prueba,
        // persona externa). No es un fallo que haya que mirar.
        if (res.status === 404) continue
        throw new Error(`Graph ${res.status}: ${await res.text()}`)
      }

      const body = await res.json()

      for (const event of (body.value ?? []) as GraphEvent[]) {
        if (!seCuenta(event)) continue

        const uid = event.iCalUId ?? event.id
        if (!uid) continue

        const privada = event.sensitivity === "private" || event.sensitivity === "confidential"

        // Graph devuelve "2026-09-22T14:00:00.0000000" sin zona, ya
        // convertido a la del encabezado Prefer. Se le pega el offset de esa
        // zona para que Postgres no lo interprete como UTC.
        const { error } = await supabase.rpc("cache_calendar_event", {
          p_person_id: persona.person_id,
          p_event_uid: uid,
          p_subject: event.subject ?? null,
          p_starts_at: conZona(event.start!.dateTime, event.start!.timeZone),
          p_ends_at: conZona(event.end!.dateTime, event.end!.timeZone),
          p_is_private: privada,
        })

        if (error) throw new Error(error.message)
        eventos++
      }
    } catch (e) {
      failures.push(`${persona.email}: ${e}`)
    }
  }

  return json({ ok: true, date: fecha, eventos, failed: failures.length, failures })
})

// Graph entrega la hora local sin offset ("2026-09-22T14:00:00.0000000") y la
// zona en un campo aparte. Postgres, ante una cadena sin offset, asume la
// zona del servidor —UTC— y corre la reunión cinco horas. Esta función arma
// el instante absoluto con la zona que Graph declaró.
function conZona(dateTime: string, timeZone: string): string {
  const limpio = dateTime.replace(/(\.\d{3})\d*$/, "$1").replace(/Z$/, "")
  if (timeZone === "UTC") return `${limpio}Z`

  // Offset de esa zona en ese instante, en minutos. Se calcula con la fecha
  // concreta y no con una constante porque el offset de una zona cambia
  // (horario de verano); Bogotá no lo tiene, pero la función no debería
  // romperse el día que la empresa abra oficina en otra parte.
  const tentativo = new Date(`${limpio}Z`)
  const enZona = new Date(tentativo.toLocaleString("en-US", { timeZone }))
  const enUtc = new Date(tentativo.toLocaleString("en-US", { timeZone: "UTC" }))
  const offsetMin = Math.round((enZona.getTime() - enUtc.getTime()) / 60000)

  const signo = offsetMin >= 0 ? "+" : "-"
  const abs = Math.abs(offsetMin)
  const hh = String(Math.floor(abs / 60)).padStart(2, "0")
  const mm = String(abs % 60).padStart(2, "0")
  return `${limpio}${signo}${hh}:${mm}`
}

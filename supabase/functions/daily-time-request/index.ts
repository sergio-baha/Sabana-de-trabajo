// Edge Function: daily-time-request
//
// El latido del recordatorio diario de tiempos. Un flujo de Power Automate la
// llama cada 15 minutos en horario laboral; ella decide si toca mandar y, si
// toca, encola un correo por persona en `public.outbox` — de donde lo saca el
// mismo outbox-worker que ya manda los avisos de tickets y de liberación de
// mes. No manda correo ella misma: el transporte ya está resuelto, con sus
// reintentos y su tope de intentos, y duplicarlo habría dado dos lugares
// donde mirar cuando un correo no llega.
//
// POR QUÉ EL FLUJO NO SABE LA HORA: la hora, los días y el encendido viven en
// `public.settings` y se cambian desde Configuración. El flujo es un latido
// tonto que pregunta "¿toca?" y se va. Así cambiar las 4:30 por las 3:00 es un
// clic de un administrador y no una edición en Power Automate, que además
// dejaría esa decisión fuera de este repositorio.
//
// POR QUÉ SE PUEDE LLAMAR DE MÁS: es idempotente por diseño. `time_requests`
// tiene un índice único por (persona, día, canal) y `time_request_targets`
// devuelve solo a quien todavía no tiene pedido. Un flujo que se dispara dos
// veces, o dos ejecuciones simultáneas, no producen dos correos: la segunda
// choca contra el índice. La defensa está en la base, no acá, porque dos
// procesos a la vez pasarían los dos por cualquier chequeo que hiciéramos en
// código.
//
// EL ENLACE DEL CORREO: lleva un token de un solo día. El formulario se abre
// SIN INICIAR SESIÓN, a propósito — pedir login a las 4:30 de la tarde para
// un formulario de 30 segundos es la diferencia entre que la gente registre y
// que no. Lo que se guarda en la base es el hash; el token solo existe en el
// correo de su dueño.
//
// Variables de entorno requeridas:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   TIME_REQUEST_SECRET  — el mismo que se configura en el flujo de Power Automate
//   APP_BASE_URL         — p. ej. "https://sabana.ceinfes.com"

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

function newToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("")
}

function saludo(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? ""
}

// Dos formas de entrar, porque son dos llamadores legítimos y distintos: el
// flujo de Power Automate, que no tiene usuario y se identifica con el
// secreto compartido, y el botón "Enviar ahora" de Configuración, que sí
// tiene usuario y se identifica con su JWT. Lo que NO se hace es poner el
// secreto en el navegador para que el botón funcione: un secreto que viaja al
// cliente deja de ser un secreto.
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

// Llama a `graph-calendar-sync` y devuelve qué pasó, sin propagar el fallo.
// Se invoca por HTTP y no importando su código porque cada Edge Function se
// despliega por separado: compartir el módulo obligaría a redesplegar las dos
// cada vez que cambia una.
async function sincronizarCalendario(fecha: string): Promise<string> {
  const secret = Deno.env.get("TIME_REQUEST_SECRET")
  if (!secret) return "sin TIME_REQUEST_SECRET"

  try {
    const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/graph-calendar-sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Secret": secret,
        // Las Edge Functions exigen apikey aunque la suya no verifique JWT.
        apikey: Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      },
      body: JSON.stringify({ date: fecha }),
      signal: AbortSignal.timeout(60_000),
    })
    const body = await res.json()
    return body?.skipped ?? `${body?.eventos ?? 0} eventos`
  } catch (e) {
    // Se reporta en la respuesta para que quede en el historial del flujo,
    // pero el envío continúa.
    return `falló: ${e}`
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS })
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405)

  if (!(await autorizado(req))) return json({ error: "No autorizado" }, 401)

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  )

  const appUrl = (Deno.env.get("APP_BASE_URL") ?? "").replace(/\/+$/, "")

  // `force` existe para el botón "Enviar ahora" de Configuración y para poder
  // probar el circuito completo sin esperar a la hora. Salta el chequeo de
  // hora y de día, NO el de duplicados: probar no puede significar mandarle
  // dos correos al equipo.
  let force = false
  try {
    const body = await req.json()
    force = body?.force === true
  } catch {
    /* sin cuerpo: es el latido normal */
  }

  const { data: due, error: dueError } = await supabase.rpc("time_request_due").single()
  if (dueError) return json({ error: dueError.message }, 500)

  const requestDate: string | null = due?.request_date ?? null

  if (!due?.is_due && !force) {
    return json({ ok: true, sent: 0, skipped: due?.reason ?? "sin motivo" })
  }
  if (!requestDate) {
    return json({ ok: true, sent: 0, skipped: due?.reason ?? "sin fecha que registrar" })
  }

  const { data: targets, error: targetsError } = await supabase.rpc("time_request_targets", {
    p_date: requestDate,
  })
  if (targetsError) return json({ error: targetsError.message }, 500)
  if (!targets?.length) return json({ ok: true, sent: 0, skipped: "nadie pendiente" })

  // El calendario se sincroniza ANTES de mandar, para que el formulario abra
  // con las reuniones del día ya cargadas. Va en best-effort a propósito: si
  // Graph está caído o todavía no está configurado, el recordatorio sale
  // igual y el formulario llega en blanco. Un calendario que no responde no
  // puede convertirse en un día sin registrar.
  const sync = await sincronizarCalendario(requestDate)

  const { data: settings } = await supabase
    .from("settings")
    .select("time_request_token_hours")
    .eq("id", 1)
    .single()

  const ttlHours = settings?.time_request_token_hours ?? 18
  const expiresAt = new Date(Date.now() + ttlHours * 3600_000).toISOString()

  let sent = 0
  const failures: string[] = []

  for (const target of targets) {
    const token = newToken()
    try {
      // Primero el pedido: si esta fila no entra (porque otra ejecución se
      // adelantó), NO se encola el correo. Al revés se correría el riesgo de
      // mandar dos veces, que es el error que sí se nota.
      const { error: requestError } = await supabase.from("time_requests").insert({
        person_id: target.person_id,
        request_date: requestDate,
        channel: "correo",
        token_hash: await sha256(token),
        expires_at: expiresAt,
        sent_at: new Date().toISOString(),
      })

      if (requestError) {
        // 23505 = choque con el índice único: ya se le mandó. No es un fallo.
        if (requestError.code === "23505") continue
        throw new Error(requestError.message)
      }

      const link = `${appUrl}/registro/${token}`
      const nombre = saludo(target.full_name)

      const { error: mailError } = await supabase.from("outbox").insert({
        kind: "registro_diario",
        channel: "email",
        to_email: target.email,
        subject: `¿Cerramos el día? Registro de tiempos del ${requestDate}`,
        body:
          `Hola ${nombre},\n\n` +
          `Es momento de registrar en qué se te fue el día de hoy (${requestDate}).\n` +
          `Toma menos de un minuto y el enlace ya viene con tus proyectos cargados:\n\n` +
          `${link}\n\n` +
          `El enlace es personal y vence en ${ttlHours} horas.\n\n` +
          `Si ya lo registraste desde la aplicación, puedes ignorar este correo.`,
      })

      if (mailError) throw new Error(mailError.message)
      sent++
    } catch (e) {
      failures.push(`${target.email}: ${e}`)
    }
  }

  return json({ ok: true, date: requestDate, sent, calendario: sync, failed: failures.length, failures })
})

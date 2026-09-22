// Edge Function: time-log
//
// Atiende el formulario de registro diario que se abre desde el enlace del
// correo (y, en la Fase 4, el envío de la tarjeta de Teams). Dos acciones
// sobre el mismo token:
//
//   { action: "context" } -> quién es, qué día registra, sus proyectos del
//                            mes y lo que ya tenga registrado.
//   { action: "submit", entries: [...] } -> reemplaza el día.
//
// POR QUÉ NO PIDE INICIAR SESIÓN: porque el formulario tiene que costar
// menos que no llenarlo. Pedir usuario y contraseña a las 4:30 de la tarde
// para un formulario de 30 segundos es, en la práctica, la diferencia entre
// que el equipo registre y que no. El token cumple el papel del login, pero
// acotado a un solo día y a una sola persona.
//
// QUÉ PUEDE HACER QUIEN TENGA EL TOKEN: registrar las horas de esa persona en
// ESE día, y nada más. No ve el trabajo de nadie, no cambia la sábana, no
// entra a la aplicación. Es el mismo criterio de un enlace de restablecer
// contraseña: alcance mínimo y vencimiento corto.
//
// TRES DEFENSAS, EN ESTE ORDEN:
//   1. El token viaja en el cuerpo, no en la URL. Las URLs quedan en
//      historiales, en logs de proxy y en el encabezado Referer cuando la
//      página carga algo de afuera; un cuerpo POST no.
//   2. Se busca por HASH. La base nunca guarda el token, así que un volcado
//      de `time_requests` no sirve para registrar a nombre de nadie.
//   3. Vencimiento. Un enlace reenviado a las semanas no abre nada.
//
// Variables de entorno requeridas:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

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

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("")
}

interface Entry {
  project_id?: string | null
  line_id?: string | null
  hours: number
  note?: string | null
  // Presente cuando la línea nació de una reunión de Outlook. Es lo que
  // permite no volver a sugerirla y no contarla dos veces.
  calendar_event_id?: string | null
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS })
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405)

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  )

  let payload: { token?: string; action?: string; entries?: Entry[] }
  try {
    payload = await req.json()
  } catch {
    return json({ error: "Cuerpo inválido" }, 400)
  }

  const token = (payload.token ?? "").trim()
  if (!token) return json({ error: "Falta el token" }, 400)

  const { data: request, error } = await supabase
    .from("time_requests")
    .select("id, person_id, request_date, expires_at, responded_at")
    .eq("token_hash", await sha256(token))
    .maybeSingle()

  if (error) return json({ error: error.message }, 500)

  // Mismo mensaje para "no existe" y "venció": un enlace inválido no tiene
  // por qué contar cuál de las dos cosas es.
  if (!request || new Date(request.expires_at) < new Date()) {
    return json({ error: "expirado" }, 410)
  }

  const { data: person } = await supabase
    .from("people")
    .select("id, name, available_hours, month_id, months(name)")
    .eq("id", request.person_id)
    .single()

  if (payload.action === "submit") {
    const entries = (payload.entries ?? []).filter((e) => Number(e.hours) > 0)
    if (!entries.length) return json({ error: "No hay horas que registrar" }, 400)

    const { data: count, error: rpcError } = await supabase.rpc("replace_daily_time_logs", {
      p_person_id: request.person_id,
      p_date: request.request_date,
      p_entries: entries,
      p_source: "correo",
    })

    // Los errores del RPC son reglas de negocio con mensaje en español
    // (tope de 24 h, proyecto de otro mes, mes cerrado). Se devuelven tal
    // cual: el formulario los muestra sin traducir nada.
    if (rpcError) return json({ error: rpcError.message }, 400)

    await supabase
      .from("time_requests")
      .update({ responded_at: new Date().toISOString() })
      .eq("id", request.id)

    // La suma de la semana es lo que convierte el acuse en algo que vale la
    // pena leer. Se calcula desde el lunes de la semana del día registrado.
    const monday = new Date(`${request.request_date}T00:00:00Z`)
    monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7))

    const { data: week } = await supabase
      .from("daily_time_logs")
      .select("hours")
      .eq("person_id", request.person_id)
      .gte("log_date", monday.toISOString().slice(0, 10))
      .lte("log_date", request.request_date)

    const weekHours = (week ?? []).reduce((sum, row) => sum + Number(row.hours), 0)
    const dayHours = entries.reduce((sum, e) => sum + Number(e.hours), 0)

    return json({ ok: true, registros: count, horas_dia: dayHours, horas_semana: weekHours })
  }

  // action: "context"
  const { data: options } = await supabase.rpc("time_log_options", {
    p_person_id: request.person_id,
  })

  const { data: existing } = await supabase
    .from("daily_time_logs")
    .select("project_id, line_id, hours, note, calendar_event_id")
    .eq("person_id", request.person_id)
    .eq("log_date", request.request_date)

  // Las reuniones del día que todavía no se registraron. Si el calendario
  // está apagado o la sincronización falló, la lista llega vacía y el
  // formulario se comporta como en la Fase 2.
  const { data: calendar } = await supabase.rpc("calendar_events_for", {
    p_person_id: request.person_id,
    p_date: request.request_date,
  })

  return json({
    ok: true,
    person: {
      id: person?.id,
      name: person?.name,
      available_hours: person?.available_hours,
      month: person?.months?.name ?? null,
    },
    date: request.request_date,
    responded_at: request.responded_at,
    options: options ?? [],
    entries: existing ?? [],
    calendar: calendar ?? [],
  })
})

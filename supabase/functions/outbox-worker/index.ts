// Edge Function: outbox-worker
//
// Vacía `public.outbox`: toma los correos pendientes, los manda por Microsoft
// Graph desde el buzón corporativo y marca los que salieron. La invoca
// pg_cron cada minuto (ver *_latido_del_outbox.sql).
//
// POR QUÉ EXISTE ESTA FUNCIÓN Y NO SE ENVÍA DESDE EL TRIGGER:
// un trigger que llama a un servicio externo ata el commit de la base a que
// responda un tercero. Si el proveedor tarda, la transacción del analista que
// cerró el ticket se queda esperando; si falla, hay que elegir entre perder el
// correo o revertirle el cierre. Con la bandeja de salida, cerrar un ticket
// solo escribe una fila —rápido y seguro— y el correo se manda aparte. Si el
// proveedor está caído, las filas esperan y se reintentan.
//
// POR QUÉ GRAPH Y NO UN PROVEEDOR DE CORREO TRANSACCIONAL:
// la organización ya tiene Microsoft 365, y este circuito ya necesita una app
// registration en Entra ID para leer los calendarios. Sumarle `Mail.Send` es
// un permiso más en la misma solicitud, en vez de una cuenta nueva con su
// facturación, sus registros DNS y su dominio que verificar. El remitente es
// una dirección corporativa real, que es además la que mejor entrega dentro
// de la propia organización.
//
// EL REINTENTO NO ES INFINITO: a los 5 intentos la fila se queda con su
// `last_error` a la vista. Una dirección que no existe no mejora por
// reintentarla mil veces, y un error real merece que alguien lo mire en vez de
// quedar enterrado en un bucle silencioso.
//
// EL TOKEN SE PIDE UNA VEZ POR TANDA, no por correo: son hasta 25 envíos y
// pedir un token para cada uno multiplicaría por 25 las llamadas a Entra ID
// sin ninguna ganancia.
//
// Variables de entorno requeridas:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   GRAPH_TENANT_ID, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET
//   SUPPORT_FROM_EMAIL   — el buzón desde el que se manda
//   TIME_REQUEST_SECRET  — el que valida a quien invoca esta función

import { createClient } from "npm:@supabase/supabase-js@2"

const MAX_ATTEMPTS = 5
const BATCH = 25

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
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
  return (await res.json()).access_token as string
}

Deno.serve(async (req) => {
  // QUIÉN PUEDE VACIAR LA BANDEJA: la llama pg_cron por pg_net, que no tiene
  // usuario. Se desplegó con verify_jwt desactivado porque las llaves nuevas
  // de Supabase (`sb_publishable_…`) no son JWT y la puerta de las Edge
  // Functions las rechaza — así que la autenticación la hace la función, con
  // el mismo secreto compartido que usan las demás del circuito.
  //
  // Sin esta comprobación la URL sería un botón público de "manda todo lo
  // pendiente ahora". No expone datos, pero sí deja que un tercero decida
  // cuándo le llegan los correos al equipo.
  const secret = Deno.env.get("TIME_REQUEST_SECRET")
  if (secret && req.headers.get("X-Webhook-Secret") !== secret) {
    return json({ error: "Firma inválida" }, 401)
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  )

  const from = Deno.env.get("SUPPORT_FROM_EMAIL")
  if (!from) return json({ error: "Falta SUPPORT_FROM_EMAIL" }, 500)

  const { data: pending, error } = await supabase
    .from("outbox")
    .select("*")
    .is("sent_at", null)
    .lt("attempts", MAX_ATTEMPTS)
    .order("created_at", { ascending: true })
    .limit(BATCH)

  if (error) return json({ error: error.message }, 500)
  if (!pending?.length) return json({ ok: true, sent: 0 })

  // Si el token no se puede obtener, ninguna fila va a salir. Se devuelve el
  // error sin gastarle un intento a 25 correos por un problema que no es de
  // ellos: los intentos son para direcciones malas, no para una credencial
  // vencida que alguien tiene que ir a renovar.
  let token: string
  try {
    token = await graphToken()
  } catch (e) {
    return json({ error: String(e), pending: pending.length }, 502)
  }

  let sent = 0
  const failures: string[] = []

  for (const mail of pending) {
    try {
      const res = await fetch(
        `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(from)}/sendMail`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: {
              subject: mail.subject,
              body: { contentType: "Text", content: mail.body },
              toRecipients: [{ emailAddress: { address: mail.to_email } }],
              // Las respuestas del solicitante van al buzón de soporte, que es
              // donde alguien las lee, y no a la dirección de envío si algún
              // día deja de ser la misma.
              replyTo: [{ emailAddress: { address: from } }],
            },
            // Queda copia en Elementos enviados del buzón: cuando alguien
            // pregunte "¿me mandaron el aviso?", la respuesta se busca en el
            // correo y no en la base de datos.
            saveToSentItems: true,
          }),
        }
      )

      // Graph responde 202 sin cuerpo cuando acepta el envío.
      if (!res.ok) throw new Error(`Graph ${res.status}: ${await res.text()}`)

      await supabase
        .from("outbox")
        .update({ sent_at: new Date().toISOString(), attempts: mail.attempts + 1 })
        .eq("id", mail.id)

      sent++
    } catch (e) {
      // El intento se cuenta aunque falle: es lo que hace que el reintento
      // termine en vez de repetirse para siempre.
      await supabase
        .from("outbox")
        .update({ attempts: mail.attempts + 1, last_error: String(e) })
        .eq("id", mail.id)

      failures.push(`${mail.id}: ${e}`)
    }
  }

  return json({ ok: true, sent, failed: failures.length, failures })
})

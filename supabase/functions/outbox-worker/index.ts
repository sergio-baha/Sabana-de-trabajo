// Edge Function: outbox-worker
//
// Vacía `public.outbox`: toma los correos pendientes, los manda por Postmark y
// marca los que salieron. Se invoca por cron (pg_cron o el scheduler de
// Supabase) cada minuto.
//
// POR QUÉ EXISTE ESTA FUNCIÓN Y NO SE ENVÍA DESDE EL TRIGGER:
// un trigger que llama a un servicio externo ata el commit de la base a que
// responda un tercero. Si Postmark tarda, la transacción del analista que
// cerró el ticket se queda esperando; si falla, hay que elegir entre perder el
// correo o revertirle el cierre. Con la bandeja de salida, cerrar un ticket
// solo escribe una fila —rápido y seguro— y el correo se manda aparte. Si el
// proveedor está caído, las filas esperan y se reintentan.
//
// EL REINTENTO NO ES INFINITO: a los 5 intentos la fila se queda con su
// `last_error` a la vista. Una dirección que no existe no mejora por
// reintentarla mil veces, y un error real merece que alguien lo mire en vez de
// quedar enterrado en un bucle silencioso.
//
// Variables de entorno requeridas:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   POSTMARK_TOKEN, SUPPORT_FROM_EMAIL

import { createClient } from "npm:@supabase/supabase-js@2"

const MAX_ATTEMPTS = 5
const BATCH = 25

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  )

  const token = Deno.env.get("POSTMARK_TOKEN")!
  const from = Deno.env.get("SUPPORT_FROM_EMAIL")!

  const { data: pending, error } = await supabase
    .from("outbox")
    .select("*")
    .is("sent_at", null)
    .lt("attempts", MAX_ATTEMPTS)
    .order("created_at", { ascending: true })
    .limit(BATCH)

  if (error) return json({ error: error.message }, 500)
  if (!pending?.length) return json({ ok: true, sent: 0 })

  let sent = 0
  const failures: string[] = []

  for (const mail of pending) {
    try {
      const res = await fetch("https://api.postmarkapp.com/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-Postmark-Server-Token": token,
        },
        body: JSON.stringify({
          From: from,
          To: mail.to_email,
          Subject: mail.subject,
          TextBody: mail.body,
          // Hace que las respuestas del solicitante lleguen a la cuenta de
          // soporte y no a la dirección de envío, que puede ser no-reply.
          ReplyTo: from,
          MessageStream: "outbound",
        }),
      })

      if (!res.ok) {
        throw new Error(`Postmark ${res.status}: ${await res.text()}`)
      }

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

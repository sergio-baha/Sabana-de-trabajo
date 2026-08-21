// Edge Function: email-to-task
//
// Recibe el webhook del proveedor de inbound (Postmark) cada vez que llega un
// correo a la cuenta de soporte, y lo convierte en ticket — o en comentario,
// si es la continuación de uno que ya existe.
//
// POR QUÉ NO SE CONECTA AL BUZÓN CORPORATIVO: no hace falta y sería invasivo.
// La cuenta de soporte reenvía a una dirección del proveedor, que parsea el
// correo y llama acá. Una regla de reenvío se pone y se quita en un clic; unos
// MX apuntados a otro sitio afectan al correo de toda la empresa.
//
// TRES DEFENSAS, EN ESTE ORDEN:
//   1. Firma del webhook. Sin ella la URL es un formulario público: cualquiera
//      que la descubra crea tickets a nombre de quien quiera.
//   2. Dominio del remitente. Solo @ceinfes.com. Un `From` se falsifica, pero
//      esto para el spam corriente y los rebotes automáticos.
//   3. `source_message_id` único en la base. Los proveedores REINTENTAN
//      cuando el webhook tarda en responder, y sin esa restricción el mismo
//      correo entra dos o tres veces. La defensa está en el índice, no acá:
//      dos reintentos simultáneos pasarían los dos por cualquier chequeo que
//      hiciéramos en código.
//
// Variables de entorno requeridas:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   INBOUND_WEBHOOK_SECRET  — el que se configura en Postmark
//   ALLOWED_SENDER_DOMAIN   — p. ej. "ceinfes.com"

import { createClient } from "npm:@supabase/supabase-js@2"

// El asunto lleva `[#123]` en todos los correos que salen. Es lo que reconecta
// una respuesta con su ticket cuando el cliente de correo pierde las cabeceras
// de hilo, que pasa más de lo que uno esperaría con reenvíos y webmails.
const TICKET_TAG = /\[#(\d+)\]/

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

// El cuerpo que manda el proveedor trae la respuesta citada completa. Cortarla
// evita que cada respuesta duplique todo el hilo dentro del comentario.
function stripQuotedReply(text: string): string {
  const cut = text.search(/^(>|On .+ wrote:|El .+ escribió:|-{2,} ?Mensaje original)/m)
  return (cut === -1 ? text : text.slice(0, cut)).trim()
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405)
  }

  // 1. Firma.
  const secret = Deno.env.get("INBOUND_WEBHOOK_SECRET")
  if (!secret || req.headers.get("X-Webhook-Secret") !== secret) {
    return json({ error: "Firma inválida" }, 401)
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  )

  try {
    const mail = await req.json()

    const from: string = (mail.From ?? mail.from ?? "").toLowerCase().trim()
    const subject: string = (mail.Subject ?? mail.subject ?? "(sin asunto)").trim()
    const body: string = stripQuotedReply(mail.TextBody ?? mail.text ?? "")
    const messageId: string = mail.MessageID ?? mail.messageId ?? crypto.randomUUID()

    // 2. Dominio.
    const domain = Deno.env.get("ALLOWED_SENDER_DOMAIN") ?? "ceinfes.com"
    if (!from.endsWith(`@${domain}`)) {
      // 200 a propósito: un 4xx hace que el proveedor reintente y luego avise
      // de un webhook caído. Esto no es un fallo nuestro, es correo que no nos
      // toca atender.
      return json({ ignored: "remitente fuera del dominio" })
    }

    // ¿Es continuación de un ticket existente?
    const tagged = subject.match(TICKET_TAG)
    if (tagged) {
      const ticketNumber = Number(tagged[1])
      const { data: ticket } = await supabase
        .from("tasks")
        .select("id, status, requester_email")
        .eq("ticket_number", ticketNumber)
        .maybeSingle()

      // Solo el solicitante original continúa su hilo. Sin esto, cualquiera
      // del dominio que conozca un número podría escribir en un ticket ajeno.
      if (ticket && ticket.requester_email?.toLowerCase() === from) {
        await supabase.from("task_comments").insert({
          task_id: ticket.id,
          author_id: null,
          body: `Respuesta de ${from}:\n\n${body}`,
        })

        // Responder a un ticket cerrado lo reabre. El trigger de estado se
        // encarga del correo de reapertura.
        if (ticket.status === "completada") {
          await supabase.from("tasks").update({ status: "pendiente" }).eq("id", ticket.id)
        }

        return json({ ok: true, action: "comentario", ticket: ticketNumber })
      }
      // Si el número no existe o no es su hilo, cae abajo y abre uno nuevo:
      // es preferible un ticket de más que un correo que se traga el sistema.
    }

    // 3. Ticket nuevo. Mes y proyecto salen de la base, no de acá: es una
    //    decisión del negocio y cambia sin redesplegar la función.
    const { data: target, error: targetError } = await supabase
      .rpc("resolve_ticket_target")
      .single()

    if (targetError || !target) {
      // Sin destino no se puede crear la tarjeta. Devolver 500 hace que el
      // proveedor reintente, que es lo correcto: probablemente falte abrir el
      // mes y alguien lo va a abrir en un rato.
      return json({ error: "No hay mes o proyecto de soporte configurado" }, 500)
    }

    const { data: created, error } = await supabase
      .from("tasks")
      .insert({
        month_id: target.month_id,
        project_id: target.project_id,
        title: subject.replace(TICKET_TAG, "").trim() || "(sin asunto)",
        description: body,
        status: "pendiente",
        requester_email: from,
        source_message_id: messageId,
        thread_reference: messageId,
      })
      .select("ticket_number")
      .single()

    if (error) {
      // 23505 = clave duplicada: es el reintento del proveedor sobre un correo
      // que YA entró. No es un error, es la defensa funcionando.
      if (error.code === "23505") {
        return json({ ok: true, action: "duplicado ignorado" })
      }
      throw error
    }

    return json({ ok: true, action: "ticket", ticket: created.ticket_number })
  } catch (e) {
    console.error("email-to-task:", e)
    return json({ error: String(e) }, 500)
  }
})

import { supabase } from "@/lib/supabaseClient"
import type { AppRole } from "@/types/database.types"

export interface EnvioRecordatorio {
  sent: number
  failed?: number
  skipped?: string
  date?: string
}

// "Enviar ahora" de Configuración. Llama a la misma Edge Function que el
// flujo de Power Automate, con `force` para saltarse el chequeo de hora y de
// día — pero NO el de duplicados: a quien ya le llegó su correo hoy no le
// vuelve a llegar por probar. La función autoriza esta llamada por el JWT del
// administrador, no por el secreto compartido, que nunca viaja al navegador.
export interface DestinatarioRecordatorio {
  full_name: string
  email: string
  role: AppRole
  excluido: boolean
}

// Quién recibiría el recordatorio con la configuración actual. Existe para
// poder responder "¿a quién le va a llegar esto?" ANTES de encenderlo, en vez
// de averiguarlo mandando correos: el roster lo dictan las cuentas activas, y
// eso es más gente de la que uno tiene en la cabeza.
export async function listarDestinatarios(): Promise<DestinatarioRecordatorio[]> {
  const { data, error } = await supabase.rpc("time_request_recipients_preview")
  if (error) throw error
  return data ?? []
}

export async function enviarRecordatorioAhora(): Promise<EnvioRecordatorio> {
  const { data, error } = await supabase.functions.invoke("daily-time-request", {
    body: { force: true },
  })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  return data as EnvioRecordatorio
}

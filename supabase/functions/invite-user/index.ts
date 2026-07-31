// Edge Function: invite-user
//
// El cliente (navegador) nunca tiene la service_role key, así que crear una
// cuenta de auth.users solo se puede hacer desde el servidor. Esta función:
//   1. Verifica que quien llama esté autenticado y sea 'administrador'
//      (usando su propio JWT contra la tabla profiles, sujeto a RLS).
//   2. Usa un cliente aparte con la service_role key (bypassa RLS) para
//      invitar al usuario vía supabase.auth.admin.inviteUserByEmail — esto
//      crea la fila en auth.users (dispara handle_new_user, que SIEMPRE crea
//      el perfil con role='analista', ver *_profiles.sql) y envía el correo
//      de invitación de Supabase.
//   3. Actualiza el perfil recién creado con el rol invitado, y registra la
//      invitación en la tabla `invitations`.
//
// Variables de entorno requeridas (Supabase las provee automáticamente en
// producción; para `supabase functions serve` local hay que definirlas en
// supabase/functions/.env — ver docs/INSTALACION.md):
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "npm:@supabase/supabase-js@2"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  })
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS })
  }

  try {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      return jsonResponse({ error: "Falta el encabezado Authorization" }, 401)
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

    // Cliente "como el usuario que llama" — respeta RLS, solo sirve para
    // confirmar quién es y que sea administrador.
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const {
      data: { user: caller },
      error: callerError,
    } = await callerClient.auth.getUser()

    if (callerError || !caller) {
      return jsonResponse({ error: "No se pudo verificar tu sesión" }, 401)
    }

    const { data: callerProfile, error: profileError } = await callerClient
      .from("profiles")
      .select("role")
      .eq("id", caller.id)
      .single()

    if (profileError || callerProfile?.role !== "administrador") {
      return jsonResponse({ error: "Solo un administrador puede invitar usuarios" }, 403)
    }

    const { email, role, fullName, password } = await req.json()

    if (!email || typeof email !== "string") {
      return jsonResponse({ error: "Falta el correo del usuario" }, 400)
    }
    if (!["administrador", "gestor", "analista"].includes(role)) {
      return jsonResponse({ error: "Rol inválido" }, 400)
    }

    // Dos modos:
    //   - sin password → invitación por correo (la persona fija su clave).
    //   - con password → alta directa con la clave que puso el admin, ya
    //     confirmada, para entregarla en mano sin depender del correo.
    const withPassword = typeof password === "string" && password.length > 0
    if (withPassword && password.length < 8) {
      return jsonResponse({ error: "La contraseña debe tener al menos 8 caracteres" }, 400)
    }

    // Cliente con service_role — bypassa RLS, único que puede crear cuentas.
    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    const { data: created, error: createError } = withPassword
      ? await adminClient.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name: fullName ?? null },
        })
      : await adminClient.auth.admin.inviteUserByEmail(email, {
          data: { full_name: fullName ?? null },
        })

    if (createError || !created.user) {
      return jsonResponse({ error: createError?.message ?? "No se pudo crear el usuario" }, 400)
    }

    // handle_new_user ya creó el perfil con role='analista' por defecto
    // (nunca confía en metadata de signup); ahora se fija el rol real que
    // el administrador eligió, con un cliente que sí puede saltarse la RLS
    // de auto-escalación.
    const { error: roleUpdateError } = await adminClient
      .from("profiles")
      .update({ role, full_name: fullName || email.split("@")[0] })
      .eq("id", created.user.id)

    if (roleUpdateError) {
      return jsonResponse({ error: roleUpdateError.message }, 500)
    }

    // Con contraseña la cuenta queda usable de inmediato → 'aceptada'. Por
    // invitación queda 'pendiente' hasta que la persona siga el enlace del
    // correo; no hay forma de saberlo desde aquí sin un webhook adicional,
    // así que el admin puede revocarla a mano desde Configuración.
    await adminClient.from("invitations").insert({
      email,
      role,
      status: withPassword ? "aceptada" : "pendiente",
      invited_by: caller.id,
      accepted_at: withPassword ? new Date().toISOString() : null,
    })

    return jsonResponse({ userId: created.user.id })
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Error inesperado" },
      500
    )
  }
})

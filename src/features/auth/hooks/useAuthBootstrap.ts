import { useEffect } from "react"
import { supabase } from "@/lib/supabaseClient"
import { useSessionStore } from "@/stores/sessionStore"

// Se monta una única vez en la raíz de la app (ver src/App.tsx). Carga la
// sesión inicial + su perfil, y mantiene ambos sincronizados en el store al
// escuchar onAuthStateChange (login/logout/refresco de token en cualquier
// pestaña).
export function useAuthBootstrap() {
  const setSession = useSessionStore((s) => s.setSession)
  const setProfile = useSessionStore((s) => s.setProfile)
  const setStatus = useSessionStore((s) => s.setStatus)

  useEffect(() => {
    let active = true

    const loadProfile = async (userId: string) => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single()

      if (!active) return
      if (error) {
        setProfile(null)
        return
      }
      setProfile(data)
    }

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return
      setSession(data.session)
      if (data.session) {
        await loadProfile(data.session.user.id)
      }
      if (active) setStatus(data.session ? "signed-in" : "signed-out")
    })

    const { data: subscription } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!active) return
        setSession(session)
        if (session) {
          await loadProfile(session.user.id)
          setStatus("signed-in")
        } else {
          setProfile(null)
          setStatus("signed-out")
        }
      }
    )

    return () => {
      active = false
      subscription.subscription.unsubscribe()
    }
  }, [setSession, setProfile, setStatus])
}

import { useEffect, useRef } from "react"
import { supabase } from "@/lib/supabaseClient"
import { useOnboardingStore } from "@/stores/onboardingStore"
import { useSessionStore } from "@/stores/sessionStore"

async function markOnboarded(profileId: string, at: string) {
  const { error } = await supabase
    .from("profiles")
    .update({ onboarded_at: at })
    .eq("id", profileId)
  // Un fallo acá no merece molestar a nadie: lo peor que pasa es que el
  // recorrido vuelva a salir la próxima vez, que es un problema mucho menor
  // que un toast de error apenas alguien entra por primera vez.
  if (error) console.error("No se pudo guardar el fin del recorrido", error)
}

// Arranca el recorrido la primera vez que entra una cuenta y lo marca como
// visto cuando se cierra — se cierre como se cierre (terminándolo o con la
// X), porque quien lo salta también está diciendo que no lo quiere ver más.
export function useOnboarding() {
  const profile = useSessionStore((s) => s.profile)
  const setProfile = useSessionStore((s) => s.setProfile)
  const open = useOnboardingStore((s) => s.open)
  const start = useOnboardingStore((s) => s.start)

  const autoStarted = useRef(false)
  const wasOpen = useRef(false)

  useEffect(() => {
    if (!profile || autoStarted.current || profile.onboarded_at) return
    autoStarted.current = true
    start()
  }, [profile, start])

  useEffect(() => {
    if (open) {
      wasOpen.current = true
      return
    }
    if (!wasOpen.current) return
    wasOpen.current = false

    // Relanzarlo a mano desde el menú no vuelve a escribir en la base: ya
    // está marcado, y `onboarded_at` guarda la primera vez, no la última.
    if (!profile || profile.onboarded_at) return

    const at = new Date().toISOString()
    setProfile({ ...profile, onboarded_at: at })
    void markOnboarded(profile.id, at)
  }, [open, profile, setProfile])
}

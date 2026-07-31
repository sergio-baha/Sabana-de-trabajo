import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabaseClient"
import type { Database } from "@/types/database.types"

type Profile = Database["public"]["Tables"]["profiles"]["Row"]

async function listProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase.from("profiles").select("*").order("full_name")
  if (error) throw error
  return data
}

// Tabla interna pequeña (un equipo de trabajo, no miles de usuarios) — se
// trae completa una vez y se reutiliza para resolver "comentado por"/
// "modificado por" en Comentarios e Historial sin una consulta por fila.
export function useProfiles() {
  const query = useQuery({ queryKey: ["profiles"], queryFn: listProfiles, staleTime: 60_000 })

  const byId = useMemo(() => {
    const map = new Map<string, Profile>()
    for (const profile of query.data ?? []) map.set(profile.id, profile)
    return map
  }, [query.data])

  return { ...query, byId }
}

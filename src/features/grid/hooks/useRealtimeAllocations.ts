import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabaseClient"
import { allocationsKeys } from "@/features/grid/hooks/useAllocationsQueries"

// Se suscribe a cambios en allocations del mes activo mientras la grilla
// está montada, para que ediciones de otro usuario (otra pestaña, otro
// Gestor) aparezcan sin recargar. Simplemente invalida la query — dejamos
// que TanStack Query pida el estado fresco en vez de mergear el payload a
// mano, que es más simple y suficientemente rápido para el tamaño de estas
// tablas. Requiere que `allocations` esté en la publicación
// `supabase_realtime` (ver migración *_enable_realtime.sql).
export function useRealtimeAllocations(monthId: string | null) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!monthId) return

    const channel = supabase
      .channel(`allocations-${monthId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "allocations", filter: `month_id=eq.${monthId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: allocationsKeys.all(monthId) })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [monthId, queryClient])
}

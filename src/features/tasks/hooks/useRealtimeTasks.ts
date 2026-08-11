import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabaseClient"
import { tasksKeys } from "@/features/tasks/hooks/useTasksQueries"

// El tablero es colaborativo: varias personas mueven tarjetas del mismo mes
// a la vez. Se invalida la query en vez de mergear el payload a mano, igual
// que useRealtimeAllocations. Requiere `tasks` en la publicación
// `supabase_realtime` (ver migración *_tasks_board.sql).
export function useRealtimeTasks(monthId: string | null) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!monthId) return

    const channel = supabase
      .channel(`tasks-${monthId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks", filter: `month_id=eq.${monthId}` },
        () => {
          // Se invalida por el prefijo `["tasks"]` y no por el mes puntual:
          // el Analista de Tecnología consulta sus tareas de TODOS los meses
          // bajo otra clave, y con una invalidación por mes esa vista se
          // quedaba desactualizada.
          queryClient.invalidateQueries({ queryKey: tasksKeys.root })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [monthId, queryClient])
}

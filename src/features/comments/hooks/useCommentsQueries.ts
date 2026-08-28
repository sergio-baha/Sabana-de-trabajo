import { useEffect, useMemo } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { supabase } from "@/lib/supabaseClient"
import {
  createComment,
  deleteComment,
  listCommentsForMonth,
  updateComment,
  type CommentWithCell,
} from "@/features/comments/api/commentsApi"
import { getOrCreateAllocationId } from "@/features/grid/api/allocationsApi"
import { cellKey } from "@/features/activities/hooks/useActivitiesQueries"
import type { Database } from "@/types/database.types"

export const commentsKeys = {
  all: (monthId: string) => ["comments", monthId] as const,
}

export function useCommentsForMonth(monthId: string | null) {
  return useQuery({
    queryKey: commentsKeys.all(monthId ?? ""),
    queryFn: () => listCommentsForMonth(monthId as string),
    enabled: Boolean(monthId),
  })
}

// Agrupa comentarios por celda (persona × proyecto × línea) para que la
// grilla sepa dónde mostrar el ícono, sin que cada celda tenga que hacer su
// propia consulta. Mismo `cellKey` que usa useActivitiesByCell: la base y
// una línea del mismo proyecto son celdas distintas, no la misma.
export function useCommentsByCell(monthId: string | null) {
  const { data, ...rest } = useCommentsForMonth(monthId)

  const byCell = useMemo(() => {
    const map = new Map<string, CommentWithCell[]>()
    for (const comment of data ?? []) {
      const key = cellKey(
        comment.allocation.person_id,
        comment.allocation.project_id,
        comment.allocation.line_id
      )
      const list = map.get(key) ?? []
      list.push(comment)
      map.set(key, list)
    }
    return map
  }, [data])

  return { byCell, ...rest }
}

export function useRealtimeComments(monthId: string | null) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!monthId) return
    const channel = supabase
      .channel(`comments-${monthId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "comments" },
        () => queryClient.invalidateQueries({ queryKey: commentsKeys.all(monthId) })
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [monthId, queryClient])
}

export function useAddComment(monthId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (vars: {
      personId: string
      projectId: string
      lineId: string
      authorId: string
      body: string
      parentCommentId?: string | null
    }) => {
      const allocationId = await getOrCreateAllocationId(
        monthId,
        vars.personId,
        vars.projectId,
        vars.lineId
      )
      return createComment({
        allocationId,
        authorId: vars.authorId,
        body: vars.body,
        parentCommentId: vars.parentCommentId,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commentsKeys.all(monthId) })
      queryClient.invalidateQueries({ queryKey: ["allocations", monthId] })
    },
    onError: (error) =>
      toast.error("No se pudo agregar el comentario", { description: error.message }),
  })
}

export function useUpdateComment(monthId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string
      patch: Database["public"]["Tables"]["comments"]["Update"]
    }) => updateComment(id, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: commentsKeys.all(monthId) }),
    onError: (error) =>
      toast.error("No se pudo actualizar el comentario", { description: error.message }),
  })
}

export function useDeleteComment(monthId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteComment(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: commentsKeys.all(monthId) }),
    onError: (error) =>
      toast.error("No se pudo eliminar el comentario", { description: error.message }),
  })
}

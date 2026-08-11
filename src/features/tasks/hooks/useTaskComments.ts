import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { supabase } from "@/lib/supabaseClient"
import type { Database } from "@/types/database.types"

export type TaskComment = Database["public"]["Tables"]["task_comments"]["Row"]

const commentsKey = (taskId: string) => ["task_comments", taskId] as const

async function listTaskComments(taskId: string): Promise<TaskComment[]> {
  const { data, error } = await supabase
    .from("task_comments")
    .select("*")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true })
  if (error) throw error
  return data
}

export function useTaskComments(taskId: string | null) {
  return useQuery({
    queryKey: commentsKey(taskId ?? ""),
    queryFn: () => listTaskComments(taskId as string),
    enabled: Boolean(taskId),
  })
}

export function useAddTaskComment(taskId: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ body, authorId }: { body: string; authorId: string }) => {
      const { error } = await supabase
        .from("task_comments")
        .insert({ task_id: taskId as string, author_id: authorId, body })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commentsKey(taskId ?? "") })
    },
    onError: (error) =>
      toast.error("No se pudo publicar el comentario", { description: error.message }),
  })
}

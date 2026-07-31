import { supabase } from "@/lib/supabaseClient"
import type { Database } from "@/types/database.types"

export type Comment = Database["public"]["Tables"]["comments"]["Row"]

export interface CommentWithCell extends Comment {
  allocation: { person_id: string; project_id: string; month_id: string }
}

// select con recurso embebido (allocations!inner) — los tipos generados a
// mano en database.types.ts no describen FKs (Relationships: []), así que
// esta consulta no se infiere sola; se castea el resultado a la forma real
// que devuelve PostgREST (la FK sí existe en la base, PostgREST la resuelve
// igual sin importar lo que diga nuestro tipo TS).
export async function listCommentsForMonth(monthId: string): Promise<CommentWithCell[]> {
  const { data, error } = await supabase
    .from("comments")
    .select("*, allocation:allocations!inner(person_id, project_id, month_id)")
    .eq("allocation.month_id", monthId)
    .order("created_at", { ascending: true })
  if (error) throw error
  return data as unknown as CommentWithCell[]
}

export async function createComment(input: {
  allocationId: string
  authorId: string
  body: string
  parentCommentId?: string | null
}): Promise<Comment> {
  const { data, error } = await supabase
    .from("comments")
    .insert({
      allocation_id: input.allocationId,
      author_id: input.authorId,
      body: input.body,
      parent_comment_id: input.parentCommentId ?? null,
    })
    .select("*")
    .single()
  if (error) throw error
  return data
}

export async function updateComment(
  id: string,
  patch: Database["public"]["Tables"]["comments"]["Update"]
): Promise<Comment> {
  const { data, error } = await supabase
    .from("comments")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single()
  if (error) throw error
  return data
}

export async function deleteComment(id: string): Promise<void> {
  const { error } = await supabase.from("comments").delete().eq("id", id)
  if (error) throw error
}

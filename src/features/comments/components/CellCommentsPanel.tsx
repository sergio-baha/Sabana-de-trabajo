import { useMemo, useState } from "react"
import { CheckCircle2, Circle, Send, Trash2 } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  useAddComment,
  useDeleteComment,
  useUpdateComment,
} from "@/features/comments/hooks/useCommentsQueries"
import type { CommentWithCell } from "@/features/comments/api/commentsApi"
import { useProfiles } from "@/hooks/useProfiles"
import { useSessionStore } from "@/stores/sessionStore"
import { isAdmin, isGestorOrAdmin } from "@/lib/roles"
import { cn } from "@/lib/utils"

interface CellCommentsPanelProps {
  monthId: string
  personId: string
  projectId: string
  comments: CommentWithCell[]
}

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/)
  return (parts[0]?.[0] ?? "").concat(parts[1]?.[0] ?? "").toUpperCase() || "?"
}

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

// La conversación de una celda. Vive sin diálogo propio porque se muestra
// como pestaña dentro de CellDetailsDialog, junto al desglose de actividades:
// antes eran dos botones distintos en la celda y nadie distinguía cuál era
// cuál.
export default function CellCommentsPanel({
  monthId,
  personId,
  projectId,
  comments,
}: CellCommentsPanelProps) {
  const profile = useSessionStore((s) => s.profile)
  const { byId: profilesById } = useProfiles()
  const addComment = useAddComment(monthId)
  const updateComment = useUpdateComment(monthId)
  const deleteComment = useDeleteComment(monthId)

  const [body, setBody] = useState("")

  const thread = useMemo(() => {
    const topLevel = comments.filter((c) => !c.parent_comment_id)
    const repliesByParent = new Map<string, CommentWithCell[]>()
    for (const c of comments) {
      if (!c.parent_comment_id) continue
      const list = repliesByParent.get(c.parent_comment_id) ?? []
      list.push(c)
      repliesByParent.set(c.parent_comment_id, list)
    }
    return { topLevel, repliesByParent }
  }, [comments])

  if (!profile) return null

  const canManage = (comment: CommentWithCell) =>
    comment.author_id === profile.id || isAdmin(profile.role)

  const handleSend = async () => {
    const trimmed = body.trim()
    if (!trimmed) return
    await addComment.mutateAsync({ personId, projectId, authorId: profile.id, body: trimmed })
    setBody("")
  }

  const renderComment = (comment: CommentWithCell, isReply: boolean) => {
    const author = profilesById.get(comment.author_id)
    return (
      <div key={comment.id} className={cn("flex gap-2", isReply && "ml-8")}>
        <Avatar className="size-7 shrink-0">
          <AvatarFallback className="text-xs">
            {initialsFor(author?.full_name ?? "?")}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 rounded-md border border-border bg-card p-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{author?.full_name ?? "Usuario"}</span>
              <span className="text-xs text-muted-foreground">{formatWhen(comment.created_at)}</span>
              {comment.resolved && (
                <Badge className="border-transparent bg-success-muted text-success">
                  Resuelto
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              {isGestorOrAdmin(profile.role) && !isReply && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  title={comment.resolved ? "Marcar como pendiente" : "Marcar como resuelto"}
                  onClick={() =>
                    updateComment.mutate({ id: comment.id, patch: { resolved: !comment.resolved } })
                  }
                >
                  {comment.resolved ? <CheckCircle2 /> : <Circle />}
                </Button>
              )}
              {canManage(comment) && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  title="Eliminar"
                  onClick={() => deleteComment.mutate(comment.id)}
                >
                  <Trash2 />
                </Button>
              )}
            </div>
          </div>
          <p className="mt-1 whitespace-pre-wrap text-sm">{comment.body}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Notas y acuerdos sobre esta celda. No cambian las horas.
      </p>

      <ScrollArea className="max-h-72">
        <div className="flex flex-col gap-3 pr-3">
          {thread.topLevel.length === 0 && (
            <p className="text-sm text-muted-foreground">Todavía no hay comentarios.</p>
          )}
          {thread.topLevel.map((comment) => (
            <div key={comment.id} className="flex flex-col gap-2">
              {renderComment(comment, false)}
              {(thread.repliesByParent.get(comment.id) ?? []).map((reply) =>
                renderComment(reply, true)
              )}
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="flex items-end gap-2 border-t border-border pt-3">
        <Textarea
          placeholder="Escribe un comentario…"
          rows={2}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
        />
        <Button
          size="icon"
          onClick={handleSend}
          disabled={addComment.isPending || !body.trim()}
          aria-label="Enviar comentario"
        >
          <Send />
        </Button>
      </div>
    </div>
  )
}

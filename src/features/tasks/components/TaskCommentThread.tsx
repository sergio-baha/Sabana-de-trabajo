import { useState } from "react"
import { MessageSquare, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useTaskComments, useAddTaskComment } from "@/features/tasks/hooks/useTaskComments"
import { useProfiles } from "@/hooks/useProfiles"
import { useSessionStore } from "@/stores/sessionStore"

interface TaskCommentThreadProps {
  taskId: string
  readOnly?: boolean
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

// Hilo de la tarea. Es la pieza que hace utilizable el circuito de revisión:
// devolver un trabajo sin poder decir por qué manda la conversación a otro
// lado, y ahí se pierde.
export default function TaskCommentThread({ taskId, readOnly = false }: TaskCommentThreadProps) {
  const profile = useSessionStore((s) => s.profile)
  const { data: comments } = useTaskComments(taskId)
  const { byId: profilesById } = useProfiles()
  const addComment = useAddTaskComment(taskId)
  const [draft, setDraft] = useState("")

  const submit = async () => {
    const body = draft.trim()
    if (!body || !profile) return
    await addComment.mutateAsync({ body, authorId: profile.id })
    setDraft("")
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <MessageSquare className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium">Comentarios</span>
        {(comments?.length ?? 0) > 0 && (
          <span className="rounded-full bg-muted px-1.5 text-xs text-muted-foreground">
            {comments?.length}
          </span>
        )}
      </div>

      {(comments?.length ?? 0) === 0 ? (
        <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
          Sin comentarios todavía. Si devuelves la tarea, explica acá qué hay que ajustar.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {comments?.map((comment) => {
            const author = profilesById.get(comment.author_id)
            return (
              <li key={comment.id} className="flex gap-2.5">
                <Avatar className="mt-0.5 size-7 shrink-0">
                  <AvatarFallback className="bg-muted text-[10px]">
                    {initialsFor(author?.full_name ?? "?")}
                  </AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-sm font-medium">
                      {author?.full_name ?? "Alguien"}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {formatWhen(comment.created_at)}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                    {comment.body}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {!readOnly && (
        <div className="flex flex-col gap-2">
          <Textarea
            rows={2}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Escribe un comentario…"
            onKeyDown={(e) => {
              // Ctrl/Cmd+Enter publica; Enter solo salta de línea, porque un
              // comentario de revisión suele ser de varias frases.
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault()
                void submit()
              }
            }}
          />
          <Button
            type="button"
            size="sm"
            className="self-end"
            disabled={!draft.trim() || addComment.isPending}
            onClick={() => void submit()}
          >
            <Send /> {addComment.isPending ? "Publicando…" : "Comentar"}
          </Button>
        </div>
      )}
    </div>
  )
}

import { useEffect, useState } from "react"
import { Undo2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { STATUS_LABELS } from "@/features/tasks/lib/taskLabels"
import { useReturnTaskForRework } from "@/features/tasks/hooks/useTasksQueries"
import type { Task } from "@/features/tasks/api/tasksApi"
import type { TaskStatus } from "@/types/database.types"

export interface PendingReturn {
  task: Task
  /** Columna a la que la mandó el gestor: es su nuevo estado. */
  status: TaskStatus
}

interface ReturnTaskDialogProps {
  pending: PendingReturn | null
  onOpenChange: (open: boolean) => void
}

// Devolver una entrega sin decir qué corregir deja al analista adivinando —
// y encima el reproceso se le va a medir en horas. El motivo entra como
// comentario de la tarea, que es donde lo va a buscar, y la base rechaza la
// devolución si no viene por acá.
export default function ReturnTaskDialog({ pending, onOpenChange }: ReturnTaskDialogProps) {
  const returnTask = useReturnTaskForRework()
  const [comment, setComment] = useState("")

  useEffect(() => {
    if (pending) setComment("")
  }, [pending])

  if (!pending) return null

  const { task, status } = pending
  const canSubmit = comment.trim().length > 0

  const handleReturn = async () => {
    if (!canSubmit) return
    await returnTask.mutateAsync({ taskId: task.id, status, comment: comment.trim() })
    onOpenChange(false)
  }

  return (
    <Dialog open={Boolean(pending)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Devolver la tarea</DialogTitle>
          <DialogDescription>
            Vuelve a <strong>{STATUS_LABELS[status]}</strong> para quien la entregó. Cuéntale qué
            hay que corregir: lo recibe como comentario de la tarea y con eso rehace el trabajo.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <p className="text-sm font-medium">{task.title}</p>

          <div className="flex flex-wrap gap-x-6 gap-y-1 rounded-xl bg-muted/60 p-3 text-sm">
            <span>
              <span className="text-muted-foreground">Planeadas: </span>
              {task.estimated_hours ?? "—"} h
            </span>
            <span>
              <span className="text-muted-foreground">Reales reportadas: </span>
              {task.completed_hours ?? 0} h
            </span>
            {(task.returned_count ?? 0) > 0 && (
              <span className="text-muted-foreground">
                Devuelta {task.returned_count} vez{task.returned_count === 1 ? "" : "es"}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="return-reason">
              Qué hay que corregir <span className="text-danger">*</span>
            </Label>
            <Textarea
              id="return-reason"
              rows={4}
              placeholder="Sé concreto: qué falta, qué está mal, qué esperabas…"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              El reproceso también se reporta en horas, así que vale la pena ser específico.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleReturn} disabled={!canSubmit || returnTask.isPending}>
            <Undo2 /> {returnTask.isPending ? "Devolviendo…" : "Devolver"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

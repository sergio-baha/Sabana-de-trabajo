import { useEffect, useState } from "react"
import { Send } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useSubmitTaskForReview } from "@/features/tasks/hooks/useTasksQueries"
import type { Task } from "@/features/tasks/api/tasksApi"

interface SubmitReviewDialogProps {
  task: Task | null
  onOpenChange: (open: boolean) => void
  /** Si el reporte es obligatorio para quien entrega (ver requiresTimeReport). */
  requiresHours: boolean
}

// Entregar a revisión: el momento en que se captura cuánto costó de verdad la
// tarea. Se pide acá y no al cerrarla porque es cuando la persona acaba de
// hacer el trabajo y lo tiene fresco.
//
// En un reproceso (el gestor devolvió el trabajo) se piden las horas de ESA
// vuelta, no el total: así queda medido cuánto costó de más el reproceso, que
// es justo el dato que se pierde cuando se sobreescribe un único número.
export default function SubmitReviewDialog({
  task,
  onOpenChange,
  requiresHours,
}: SubmitReviewDialogProps) {
  const submit = useSubmitTaskForReview()
  const [hours, setHours] = useState("")
  const [note, setNote] = useState("")

  useEffect(() => {
    if (task) {
      setHours("")
      setNote("")
    }
  }, [task])

  if (!task) return null

  const isRework = (task.returned_count ?? 0) > 0
  const parsed = Number(hours.replace(",", "."))
  const validHours = Number.isFinite(parsed) && parsed > 0
  const canSubmit = requiresHours ? validHours : hours === "" || validHours

  const handleSubmit = async () => {
    if (!canSubmit) return
    await submit.mutateAsync({
      taskId: task.id,
      hours: validHours ? parsed : null,
      note: note.trim() || null,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={Boolean(task)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Entregar a revisión</DialogTitle>
          <DialogDescription>
            {isRework
              ? "Esta tarea volvió del gestor. Reporta las horas que te tomó el reproceso — se suman a las ya registradas."
              : "El gestor del proyecto la revisará. Antes, deja registrado cuánto te tomó de verdad."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <p className="text-sm font-medium">{task.title}</p>

          {/* Planeado vs real: el motivo de pedir el dato, a la vista. */}
          <div className="flex flex-wrap gap-x-6 gap-y-1 rounded-xl bg-muted/60 p-3 text-sm">
            <span>
              <span className="text-muted-foreground">Planeadas: </span>
              {task.estimated_hours ?? "—"} h
            </span>
            <span>
              <span className="text-muted-foreground">Reportadas hasta ahora: </span>
              {task.completed_hours ?? 0} h
            </span>
            {isRework && (
              <span className="text-muted-foreground">Reproceso #{task.returned_count}</span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="real-hours">
              {isRework ? "Horas de este reproceso" : "Horas reales"}
              {requiresHours && <span className="text-danger"> *</span>}
            </Label>
            <Input
              id="real-hours"
              type="number"
              min="0"
              step="0.5"
              inputMode="decimal"
              placeholder="Ej. 6.5"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              autoFocus
            />
            {!requiresHours && (
              <p className="text-xs text-muted-foreground">
                Opcional: esta tarea la creaste tú, así que no se compara contra un encargo.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="real-note">Nota para el gestor (opcional)</Label>
            <Textarea
              id="real-note"
              rows={2}
              placeholder="Qué quedó hecho, qué se complicó…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || submit.isPending}>
            <Send /> {submit.isPending ? "Entregando…" : "Entregar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

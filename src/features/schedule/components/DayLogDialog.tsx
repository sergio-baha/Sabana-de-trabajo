import { useState } from "react"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { Plus, Trash2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAddActivity, useDeleteActivity } from "@/features/activities/hooks/useActivitiesQueries"
import { PHASE_LABELS, PHASE_OPTIONS } from "@/features/activities/lib/phaseLabels"
import type { ActivityWithCell } from "@/features/activities/api/activitiesApi"
import type { ActivityPhase } from "@/types/database.types"

interface DayLogDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  monthId: string
  personId: string
  projectId: string
  projectName: string
  dateIso: string
  activities: ActivityWithCell[]
  canLog: boolean
}

// Registro de tiempo de un día sobre un proyecto. Escribe en `activities`,
// la misma tabla que usa el desglose de la grilla — no hay un segundo
// registro de horas paralelo. Como el trigger
// sync_allocation_hours_from_activities mantiene allocations.hours = suma de
// sus actividades, lo que se registre aquí queda reflejado en la
// distribución del mes.
export default function DayLogDialog({
  open,
  onOpenChange,
  monthId,
  personId,
  projectId,
  projectName,
  dateIso,
  activities,
  canLog,
}: DayLogDialogProps) {
  const addActivity = useAddActivity(monthId)
  const deleteActivity = useDeleteActivity(monthId)

  const [description, setDescription] = useState("")
  const [hours, setHours] = useState("")
  const [phase, setPhase] = useState<ActivityPhase | "none">("none")

  const total = activities.reduce((sum, a) => sum + a.hours, 0)
  const parsedHours = Number(hours)
  const canSubmit =
    description.trim().length > 0 && hours.trim().length > 0 && Number.isFinite(parsedHours) && parsedHours > 0

  const submit = async () => {
    if (!canSubmit) return
    await addActivity.mutateAsync({
      personId,
      projectId,
      description: description.trim(),
      phase: phase === "none" ? null : phase,
      activityDate: dateIso,
      hours: parsedHours,
    })
    setDescription("")
    setHours("")
    setPhase("none")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{projectName}</DialogTitle>
          <DialogDescription>
            {format(parseISO(dateIso), "EEEE d 'de' MMMM 'de' y", { locale: es })} · {total} h
            registradas
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          {activities.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Sin tiempo registrado este día.
            </p>
          )}
          {activities.map((activity) => (
            <div
              key={activity.id}
              className="flex items-start gap-2 rounded-lg border border-border p-2"
            >
              <div className="flex-1">
                <p className="text-sm">{activity.description}</p>
                <p className="text-xs text-muted-foreground">
                  {activity.hours} h
                  {activity.phase ? ` · ${PHASE_LABELS[activity.phase]}` : ""}
                </p>
              </div>
              {canLog && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => deleteActivity.mutate(activity.id)}
                  aria-label="Eliminar actividad"
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
            </div>
          ))}
        </div>

        {canLog && (
          <div className="flex flex-col gap-3 border-t border-border pt-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="log-description">Actividad</Label>
              <Input
                id="log-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Qué se trabajó"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="log-hours">Horas</Label>
                <Input
                  id="log-hours"
                  type="number"
                  min="0"
                  step="0.5"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Fase</Label>
                <Select value={phase} onValueChange={(v) => setPhase(v as ActivityPhase | "none")}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin fase</SelectItem>
                    {PHASE_OPTIONS.map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={submit} disabled={!canSubmit || addActivity.isPending}>
              <Plus /> {addActivity.isPending ? "Guardando…" : "Registrar tiempo"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

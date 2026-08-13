import { useEffect, useMemo, useState } from "react"
import { Pencil, Plus, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import ConfirmDialog from "@/components/shared/ConfirmDialog"
import {
  useAddActivity,
  useDeleteActivity,
  useUpdateActivity,
} from "@/features/activities/hooks/useActivitiesQueries"
import { usePhases } from "@/features/projects/hooks/useProjectBudgetQueries"
import type { ActivityWithCell } from "@/features/activities/api/activitiesApi"

interface ActivityBreakdownPanelProps {
  open: boolean
  monthId: string
  personId: string
  projectId: string
  activities: ActivityWithCell[]
  readOnly: boolean
}

interface DraftState {
  id: string | null // null = creando una nueva
  description: string
  phaseId: string | "none"
  activityDate: string
  hours: string
}

const EMPTY_DRAFT: DraftState = {
  id: null,
  description: "",
  phaseId: "none",
  activityDate: "",
  hours: "",
}

// Desglose de horas de una celda. Se muestra como pestaña dentro de
// CellDetailsDialog; `open` sigue llegando para no pedir las fases del
// proyecto mientras el diálogo está cerrado.
export default function ActivityBreakdownPanel({
  open,
  monthId,
  personId,
  projectId,
  activities,
  readOnly,
}: ActivityBreakdownPanelProps) {
  const addActivity = useAddActivity(monthId)
  const updateActivity = useUpdateActivity(monthId)
  const deleteActivity = useDeleteActivity(monthId)

  // Las fases son del proyecto completo, no de un mes. Un proyecto sin fases
  // devuelve lista vacía y el selector queda solo con "Sin fase".
  const { data: phases } = usePhases(open ? projectId : null)
  const phaseNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const phase of phases ?? []) map.set(phase.id, phase.name)
    return map
  }, [phases])

  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT)
  const [toDelete, setToDelete] = useState<ActivityWithCell | null>(null)

  useEffect(() => {
    if (open) setDraft(EMPTY_DRAFT)
  }, [open])

  const total = activities.reduce((sum, a) => sum + a.hours, 0)

  const startEdit = (activity: ActivityWithCell) => {
    setDraft({
      id: activity.id,
      description: activity.description,
      phaseId: activity.phase_id ?? "none",
      activityDate: activity.activity_date ?? "",
      hours: String(activity.hours),
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const hours = Number(draft.hours)
    if (!draft.description.trim() || !Number.isFinite(hours) || hours < 0) return

    const phaseId = draft.phaseId === "none" ? null : draft.phaseId
    const activityDate = draft.activityDate || null

    if (draft.id) {
      await updateActivity.mutateAsync({
        id: draft.id,
        patch: {
          description: draft.description.trim(),
          phase_id: phaseId,
          activity_date: activityDate,
          hours,
        },
      })
    } else {
      await addActivity.mutateAsync({
        personId,
        projectId,
        description: draft.description.trim(),
        phaseId,
        activityDate,
        hours,
      })
    }
    setDraft(EMPTY_DRAFT)
  }

  const submitting = addActivity.isPending || updateActivity.isPending

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        En qué se van las horas de esta celda. Al desglosarla, las horas de la grilla pasan a ser
        la suma de estas actividades:{" "}
        <span className="font-medium text-foreground">{total} h</span>.
      </p>

      <ScrollArea className="max-h-64">
        <div className="flex flex-col gap-2 pr-3">
          {activities.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Sin actividades todavía — las horas de esta celda se editan directo en la grilla.
            </p>
          )}
          {activities.map((activity) => (
            <div
              key={activity.id}
              className="flex items-start justify-between gap-2 rounded-md border border-border p-2"
            >
              <div className="flex flex-col gap-0.5">
                <p className="text-sm">{activity.description}</p>
                <p className="text-xs text-muted-foreground">
                  {phaseNameById.get(activity.phase_id ?? "")}
                  {activity.phase_id && activity.activity_date && " · "}
                  {activity.activity_date}
                  {(activity.phase_id || activity.activity_date) && " · "}
                  {activity.hours} h
                </p>
              </div>
              {!readOnly && (
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => startEdit(activity)}
                    title="Editar"
                  >
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setToDelete(activity)}
                    title="Eliminar"
                  >
                    <Trash2 />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>

      {!readOnly && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 border-t border-border pt-3">
          <div className="flex items-center justify-between">
            <Label>{draft.id ? "Editar actividad" : "Nueva actividad"}</Label>
            {draft.id && (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => setDraft(EMPTY_DRAFT)}
                aria-label="Cancelar la edición"
              >
                <X />
              </Button>
            )}
          </div>
          <Textarea
            placeholder="Descripción de la actividad…"
            rows={2}
            value={draft.description}
            onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
          />
          <div className="grid grid-cols-3 gap-2">
            <Select
              value={draft.phaseId}
              onValueChange={(v) => setDraft((d) => ({ ...d, phaseId: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Fase" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin fase</SelectItem>
                {(phases ?? []).map((phase) => (
                  <SelectItem key={phase.id} value={phase.id}>
                    {phase.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={draft.activityDate}
              onChange={(e) => setDraft((d) => ({ ...d, activityDate: e.target.value }))}
            />
            <Input
              type="number"
              min={0}
              step="0.5"
              placeholder="Horas"
              value={draft.hours}
              onChange={(e) => setDraft((d) => ({ ...d, hours: e.target.value }))}
            />
          </div>
          <Button type="submit" disabled={submitting} className="w-fit">
            <Plus /> {draft.id ? "Guardar cambios" : "Agregar actividad"}
          </Button>
        </form>
      )}

      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Eliminar actividad"
        description="Las horas de la celda se recalculan sin esta actividad."
        onConfirm={async () => {
          if (toDelete) await deleteActivity.mutateAsync(toDelete.id)
        }}
      />
    </div>
  )
}

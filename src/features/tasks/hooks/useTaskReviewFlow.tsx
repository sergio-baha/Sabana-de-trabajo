import { useState } from "react"
import SubmitReviewDialog from "@/features/tasks/components/SubmitReviewDialog"
import ReturnTaskDialog, { type PendingReturn } from "@/features/tasks/components/ReturnTaskDialog"
import type { Task } from "@/features/tasks/api/tasksApi"
import { useSessionStore } from "@/stores/sessionStore"
import { requiresTimeReport, writesOwnWorkOnly } from "@/lib/roles"
import type { TaskStatus } from "@/types/database.types"

// Los dos momentos del circuito que no son un simple cambio de estado:
// entregar (hay que reportar horas reales) y devolver (hay que decir qué
// corregir). Viven juntos en un hook porque las dos vistas que mueven tareas
// —el tablero de Tareas y el backlog del proyecto— necesitan exactamente lo
// mismo, y duplicarlo garantizaba que una de las dos se quedara atrás.
export function useTaskReviewFlow() {
  const profile = useSessionStore((s) => s.profile)
  const writesOwn = writesOwnWorkOnly(profile?.role)

  const [taskToSubmit, setTaskToSubmit] = useState<Task | null>(null)
  const [taskToReturn, setTaskToReturn] = useState<PendingReturn | null>(null)

  // Entregar es del que hace el trabajo. Un gestor que mueve algo a revisión
  // no está entregando: que la tarjeta se mueva y ya.
  const handleRequestReview = (task: Task) => {
    if (!writesOwn) return false
    setTaskToSubmit(task)
    return true
  }

  // Devolver una entrega ajena exige motivo. Retirar la propia (quien entregó
  // se arrepiente) no: no hay a quién explicarle nada, y la base aplica el
  // mismo criterio.
  const handleRequestReturn = (task: Task, status: TaskStatus) => {
    if (task.submitted_by === profile?.id) return false
    setTaskToReturn({ task, status })
    return true
  }

  const dialogs = (
    <>
      <SubmitReviewDialog
        task={taskToSubmit}
        onOpenChange={(open) => !open && setTaskToSubmit(null)}
        requiresHours={requiresTimeReport(profile?.role, taskToSubmit?.created_by, profile?.id)}
      />
      <ReturnTaskDialog
        pending={taskToReturn}
        onOpenChange={(open) => !open && setTaskToReturn(null)}
      />
    </>
  )

  return { handleRequestReview, handleRequestReturn, dialogs }
}

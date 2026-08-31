import { useMemo, useState } from "react"
import SubmitReviewDialog from "@/features/tasks/components/SubmitReviewDialog"
import ReturnTaskDialog, { type PendingReturn } from "@/features/tasks/components/ReturnTaskDialog"
import { getProjectReviewOptions } from "@/features/tasks/lib/reviewerOptions"
import type { Task } from "@/features/tasks/api/tasksApi"
import type { Person } from "@/features/people/api/peopleApi"
import type { Project } from "@/features/projects/api/projectsApi"
import type { ProjectManager, ProjectMember } from "@/features/projects/api/projectsApi"
import { useSessionStore } from "@/stores/sessionStore"
import { requiresReviewerPick, requiresTimeReport, writesOwnWorkOnly } from "@/lib/roles"
import type { TaskStatus } from "@/types/database.types"

interface UseTaskReviewFlowArgs {
  projects: Project[]
  people: Person[]
  projectManagers: ProjectManager[] | undefined
  projectMembers: ProjectMember[] | undefined
  /** Persona vinculada a la cuenta actual, para excluirse de su propia lista de revisores. */
  myPersonId: string | null | undefined
}

// Los dos momentos del circuito que no son un simple cambio de estado:
// entregar (hay que reportar horas reales y, si aplica, elegir revisor) y
// devolver (hay que decir qué corregir). Viven juntos en un hook porque las
// dos vistas que mueven tareas —el tablero de Tareas y el backlog del
// proyecto— necesitan exactamente lo mismo, y duplicarlo garantizaba que una
// de las dos se quedara atrás.
export function useTaskReviewFlow({
  projects,
  people,
  projectManagers,
  projectMembers,
  myPersonId,
}: UseTaskReviewFlowArgs) {
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

  const submitProject = projects.find((p) => p.id === taskToSubmit?.project_id)
  const requiresReviewer = requiresReviewerPick(profile?.role, submitProject?.created_by, profile?.id)
  // Recorre proyectos/miembros y arma dos arreglos ordenados: no vale la
  // pena repetirlo en cada tecleo del diálogo de entrega, solo cuando
  // cambia el proyecto en cuestión o el roster.
  const reviewerOptions = useMemo(
    () =>
      getProjectReviewOptions(
        taskToSubmit?.project_id,
        projectManagers,
        projectMembers,
        people,
        myPersonId
      ),
    [taskToSubmit?.project_id, projectManagers, projectMembers, people, myPersonId]
  )

  const dialogs = (
    <>
      <SubmitReviewDialog
        task={taskToSubmit}
        onOpenChange={(open) => !open && setTaskToSubmit(null)}
        requiresHours={requiresTimeReport(profile?.role, taskToSubmit?.created_by, profile?.id)}
        requiresReviewer={requiresReviewer}
        reviewerOptions={reviewerOptions}
      />
      <ReturnTaskDialog
        pending={taskToReturn}
        onOpenChange={(open) => !open && setTaskToReturn(null)}
      />
    </>
  )

  return { handleRequestReview, handleRequestReturn, dialogs }
}

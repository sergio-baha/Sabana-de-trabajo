import { useState } from "react"
import ConfirmDialog from "@/components/shared/ConfirmDialog"
import { useSetProjectMembers } from "@/features/projects/hooks/useProjectsQueries"
import type { ProjectManager, ProjectMember } from "@/features/projects/api/projectsApi"

interface PendingMembership {
  projectId: string
  personId: string
  personName: string
  resolve: (proceed: boolean) => void
}

// Elegir revisor ya no está acotado al equipo del proyecto (ver
// reviewerOptions.ts) — se puede elegir a cualquiera del roster. Antes de
// mandarle la revisión a alguien que no está en `project_members`/
// `project_managers` de ESE proyecto, se confirma e inscribe de una vez: así
// queda registrada en "Gestionar equipo" sin que alguien tenga que acordarse
// de hacerlo aparte, y de paso se le entrega la tarea.
export function useEnsureProjectMember(
  projectManagers: ProjectManager[] | undefined,
  projectMembers: ProjectMember[] | undefined
) {
  const setMembers = useSetProjectMembers()
  const [pending, setPending] = useState<PendingMembership | null>(null)

  const isOnTeam = (projectId: string, personId: string) =>
    (projectManagers ?? []).some((m) => m.project_id === projectId && m.person_id === personId) ||
    (projectMembers ?? []).some((m) => m.project_id === projectId && m.person_id === personId)

  // Resuelve `true` si ya era del equipo o el usuario confirmó inscribirla;
  // `false` si canceló — el caller decide si sigue con la entrega/reasignación.
  const ensureMember = (projectId: string, personId: string, personName: string): Promise<boolean> => {
    if (isOnTeam(projectId, personId)) return Promise.resolve(true)
    return new Promise((resolve) => setPending({ projectId, personId, personName, resolve }))
  }

  const dialog = (
    <ConfirmDialog
      open={Boolean(pending)}
      onOpenChange={(open) => {
        if (!open && pending) {
          pending.resolve(false)
          setPending(null)
        }
      }}
      title={`${pending?.personName ?? "Esta persona"} no es del equipo de este proyecto`}
      description="Se puede inscribir de una vez, para que quede registrada en Gestionar equipo, y continuar."
      confirmLabel="Inscribir y continuar"
      destructive={false}
      onConfirm={async () => {
        if (!pending) return
        const existingIds = (projectMembers ?? [])
          .filter((m) => m.project_id === pending.projectId)
          .map((m) => m.person_id)
        await setMembers.mutateAsync({
          projectId: pending.projectId,
          personIds: [...existingIds, pending.personId],
        })
        pending.resolve(true)
        setPending(null)
      }}
    />
  )

  return { dialog, ensureMember }
}

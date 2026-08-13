import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  createProject,
  deleteProject,
  getProject,
  listProjectManagers,
  listProjectMembers,
  listProjects,
  setProjectManager,
  setProjectMembers,
  updateProject,
  type ProjectInsert,
  type ProjectUpdate,
} from "@/features/projects/api/projectsApi"
import { invalidateTotals } from "@/features/projects/hooks/useProjectBudgetQueries"

// Los proyectos y su equipo son durables: las claves no llevan mes. Lo que
// cambia mes a mes son las horas (allocations), que tienen su propio caché.
// `detail` cuelga de `all` a propósito: invalidar la lista arrastra también
// la ficha abierta, que es justo lo que se quiere tras editar.
export const projectsKeys = {
  all: ["projects"] as const,
  detail: (id: string) => ["projects", id] as const,
  managers: ["project_managers"] as const,
  members: ["project_members"] as const,
}

export function useProjects() {
  return useQuery({ queryKey: projectsKeys.all, queryFn: listProjects })
}

export function useProject(id: string | null) {
  return useQuery({
    queryKey: projectsKeys.detail(id ?? ""),
    queryFn: () => getProject(id as string),
    enabled: Boolean(id),
  })
}

export function useProjectManagers() {
  return useQuery({ queryKey: projectsKeys.managers, queryFn: listProjectManagers })
}

export function useProjectMembers() {
  return useQuery({ queryKey: projectsKeys.members, queryFn: listProjectMembers })
}

export function useCreateProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ProjectInsert) => createProject(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectsKeys.all })
      invalidateTotals(queryClient)
      toast.success("Proyecto creado")
    },
    onError: (error) => toast.error("No se pudo crear el proyecto", { description: error.message }),
  })
}

export function useUpdateProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: ProjectUpdate }) => updateProject(id, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectsKeys.all })
      invalidateTotals(queryClient)
      toast.success("Proyecto actualizado")
    },
    onError: (error) =>
      toast.error("No se pudo actualizar el proyecto", { description: error.message }),
  })
}

export function useDeleteProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteProject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectsKeys.all })
      invalidateTotals(queryClient)
      toast.success("Proyecto eliminado")
    },
    onError: (error) =>
      toast.error("No se pudo eliminar el proyecto", { description: error.message }),
  })
}

export function useSetProjectManager() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ projectId, personId }: { projectId: string; personId: string | null }) =>
      setProjectManager(projectId, personId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectsKeys.managers })
    },
    onError: (error) =>
      toast.error("No se pudo asignar el gerente", { description: error.message }),
  })
}

export function useSetProjectMembers() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ projectId, personIds }: { projectId: string; personIds: string[] }) =>
      setProjectMembers(projectId, personIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectsKeys.members })
    },
    onError: (error) =>
      toast.error("No se pudieron guardar los miembros", { description: error.message }),
  })
}

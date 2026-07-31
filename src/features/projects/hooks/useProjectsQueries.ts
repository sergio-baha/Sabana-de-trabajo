import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  createProject,
  deleteProject,
  duplicateProject,
  listProjectManagers,
  listProjects,
  setProjectManager,
  updateProject,
  type Project,
  type ProjectInsert,
  type ProjectUpdate,
} from "@/features/projects/api/projectsApi"

export const projectsKeys = {
  all: (monthId: string) => ["projects", monthId] as const,
  managers: (monthId: string) => ["project_managers", monthId] as const,
}

export function useProjects(monthId: string | null) {
  return useQuery({
    queryKey: projectsKeys.all(monthId ?? ""),
    queryFn: () => listProjects(monthId as string),
    enabled: Boolean(monthId),
  })
}

export function useProjectManagers(monthId: string | null) {
  return useQuery({
    queryKey: projectsKeys.managers(monthId ?? ""),
    queryFn: () => listProjectManagers(monthId as string),
    enabled: Boolean(monthId),
  })
}

export function useCreateProject(monthId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ProjectInsert) => createProject(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectsKeys.all(monthId) })
      toast.success("Proyecto creado")
    },
    onError: (error) => toast.error("No se pudo crear el proyecto", { description: error.message }),
  })
}

export function useUpdateProject(monthId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: ProjectUpdate }) => updateProject(id, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectsKeys.all(monthId) })
      toast.success("Proyecto actualizado")
    },
    onError: (error) =>
      toast.error("No se pudo actualizar el proyecto", { description: error.message }),
  })
}

export function useDeleteProject(monthId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteProject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectsKeys.all(monthId) })
      toast.success("Proyecto eliminado")
    },
    onError: (error) =>
      toast.error("No se pudo eliminar el proyecto", { description: error.message }),
  })
}

export function useDuplicateProject(monthId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (project: Project) => duplicateProject(project),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectsKeys.all(monthId) })
      toast.success("Proyecto duplicado")
    },
    onError: (error) =>
      toast.error("No se pudo duplicar el proyecto", { description: error.message }),
  })
}

export function useSetProjectManager(monthId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ projectId, personId }: { projectId: string; personId: string | null }) =>
      setProjectManager(monthId, projectId, personId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectsKeys.managers(monthId) })
    },
    onError: (error) =>
      toast.error("No se pudo asignar el gerente", { description: error.message }),
  })
}

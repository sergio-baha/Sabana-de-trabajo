import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  createProjectLine,
  deleteProjectLine,
  listProjectLines,
  renameProjectLine,
} from "@/features/projects/api/projectLinesApi"

export const projectLinesKeys = {
  all: ["project_lines"] as const,
}

export function useProjectLines() {
  return useQuery({ queryKey: projectLinesKeys.all, queryFn: listProjectLines })
}

export function useCreateProjectLine() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ projectId, name }: { projectId: string; name: string }) =>
      createProjectLine(projectId, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectLinesKeys.all })
      toast.success("Subproyecto agregado")
    },
    onError: (error) =>
      toast.error("No se pudo agregar el subproyecto", { description: error.message }),
  })
}

export function useRenameProjectLine() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => renameProjectLine(id, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectLinesKeys.all })
      toast.success("Subproyecto renombrado")
    },
    onError: (error) =>
      toast.error("No se pudo renombrar el subproyecto", { description: error.message }),
  })
}

// Borrar un subproyecto se lleva sus horas (allocations.line_id on delete
// cascade), así que también hay que refrescar las sábanas de todos los meses
// abiertos que lo tuvieran — no se sabe cuáles desde acá, así que se
// invalidan todas las claves de allocations con este prefijo. Si es el
// último subproyecto del proyecto, un trigger en la base lo rechaza (ver
// *_subproyecto_obligatorio.sql) y ese mensaje llega tal cual en error.message.
export function useDeleteProjectLine() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteProjectLine(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectLinesKeys.all })
      queryClient.invalidateQueries({ queryKey: ["allocations"] })
      toast.success("Subproyecto eliminado")
    },
    onError: (error) =>
      toast.error("No se pudo eliminar el subproyecto", { description: error.message }),
  })
}

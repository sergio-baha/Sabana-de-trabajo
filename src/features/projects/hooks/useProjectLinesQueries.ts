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
      toast.success("Línea agregada")
    },
    onError: (error) => toast.error("No se pudo agregar la línea", { description: error.message }),
  })
}

export function useRenameProjectLine() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => renameProjectLine(id, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectLinesKeys.all })
      toast.success("Línea renombrada")
    },
    onError: (error) =>
      toast.error("No se pudo renombrar la línea", { description: error.message }),
  })
}

// Borrar una línea se lleva sus horas (allocations.line_id on delete
// cascade), así que también hay que refrescar las sábanas de todos los meses
// abiertos que tuvieran esa línea — no se sabe cuáles desde acá, así que se
// invalidan todas las claves de allocations con este prefijo.
export function useDeleteProjectLine() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteProjectLine(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectLinesKeys.all })
      queryClient.invalidateQueries({ queryKey: ["allocations"] })
      toast.success("Línea eliminada")
    },
    onError: (error) =>
      toast.error("No se pudo eliminar la línea", { description: error.message }),
  })
}

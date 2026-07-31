import { useMemo, useState } from "react"
import { Copy, MoreHorizontal, Pencil, Plus, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import ConfirmDialog from "@/components/shared/ConfirmDialog"
import NoActiveMonth from "@/components/shared/NoActiveMonth"
import ProjectFormDialog from "@/features/projects/components/ProjectFormDialog"
import {
  useDeleteProject,
  useDuplicateProject,
  useProjectManagers,
  useProjects,
} from "@/features/projects/hooks/useProjectsQueries"
import { usePeople } from "@/features/people/hooks/usePeopleQueries"
import type { Project } from "@/features/projects/api/projectsApi"
import { useActiveMonthStore } from "@/stores/activeMonthStore"
import { useSessionStore } from "@/stores/sessionStore"
import { isGestorOrAdmin } from "@/lib/roles"

const STATUS_LABEL: Record<Project["status"], string> = {
  activo: "Activo",
  pausado: "Pausado",
  finalizado: "Finalizado",
  archivado: "Archivado",
}

export default function ProyectosPage() {
  const { activeMonthId } = useActiveMonthStore()
  const profile = useSessionStore((s) => s.profile)
  const canWrite = isGestorOrAdmin(profile?.role)

  const { data: projects, isLoading } = useProjects(activeMonthId)
  const { data: people } = usePeople(activeMonthId)
  const { data: managers } = useProjectManagers(activeMonthId)
  const deleteProject = useDeleteProject(activeMonthId ?? "")
  const duplicateProject = useDuplicateProject(activeMonthId ?? "")

  const [search, setSearch] = useState("")
  const [formOpen, setFormOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null)

  const managerNameByProject = useMemo(() => {
    const map = new Map<string, string>()
    for (const pm of managers ?? []) {
      const person = people?.find((p) => p.id === pm.person_id)
      if (person) map.set(pm.project_id, person.name)
    }
    return map
  }, [managers, people])

  const filtered = useMemo(() => {
    if (!projects) return []
    const q = search.trim().toLowerCase()
    if (!q) return projects
    return projects.filter((p) => p.name.toLowerCase().includes(q))
  }, [projects, search])

  if (!activeMonthId) return <NoActiveMonth />

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Gestión de proyectos</h1>
          <p className="text-sm text-muted-foreground">
            Proyectos del mes activo: color, gerente responsable y estado.
          </p>
        </div>
        {canWrite && (
          <Button
            onClick={() => {
              setEditingProject(null)
              setFormOpen(true)
            }}
          >
            <Plus /> Nuevo proyecto
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar proyecto…"
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Proyecto</TableHead>
                  <TableHead>Gerente responsable</TableHead>
                  <TableHead>Estado</TableHead>
                  {canWrite && <TableHead className="w-10" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <span
                          className="size-3 shrink-0 rounded-full"
                          style={{ backgroundColor: project.color }}
                        />
                        {project.name}
                      </div>
                    </TableCell>
                    <TableCell>{managerNameByProject.get(project.id) ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{STATUS_LABEL[project.status]}</Badge>
                    </TableCell>
                    {canWrite && (
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setEditingProject(project)
                                setFormOpen(true)
                              }}
                            >
                              <Pencil /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => duplicateProject.mutate(project)}
                            >
                              <Copy /> Duplicar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => setProjectToDelete(project)}
                            >
                              Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      Sin resultados.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {activeMonthId && (
        <ProjectFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          monthId={activeMonthId}
          project={editingProject}
          people={people ?? []}
          currentManager={managers?.find((m) => m.project_id === editingProject?.id)}
        />
      )}
      <ConfirmDialog
        open={Boolean(projectToDelete)}
        onOpenChange={(open) => !open && setProjectToDelete(null)}
        title={`Eliminar "${projectToDelete?.name}"`}
        description="Se eliminarán también sus asignaciones de horas, tareas y comentarios asociados."
        onConfirm={async () => {
          if (projectToDelete) await deleteProject.mutateAsync(projectToDelete.id)
        }}
      />
    </div>
  )
}

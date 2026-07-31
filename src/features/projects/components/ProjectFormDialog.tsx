import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import ColorPicker from "@/features/projects/components/ColorPicker"
import {
  useCreateProject,
  useSetProjectManager,
  useUpdateProject,
} from "@/features/projects/hooks/useProjectsQueries"
import type { Project, ProjectManager } from "@/features/projects/api/projectsApi"
import type { Person } from "@/features/people/api/peopleApi"

const schema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  color: z.string().min(1),
  status: z.enum(["activo", "pausado", "finalizado", "archivado"]),
  managerId: z.string().optional(),
  description: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

interface ProjectFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  monthId: string
  project?: Project | null
  people: Person[]
  currentManager?: ProjectManager
}

export default function ProjectFormDialog({
  open,
  onOpenChange,
  monthId,
  project,
  people,
  currentManager,
}: ProjectFormDialogProps) {
  const isEdit = Boolean(project)
  const createProject = useCreateProject(monthId)
  const updateProject = useUpdateProject(monthId)
  const setManager = useSetProjectManager(monthId)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      color: "#3A5BA7",
      status: "activo",
      managerId: "",
      description: "",
    },
  })

  useEffect(() => {
    if (open) {
      form.reset({
        name: project?.name ?? "",
        color: project?.color ?? "#3A5BA7",
        status: project?.status ?? "activo",
        managerId: currentManager?.person_id ?? "",
        description: project?.description ?? "",
      })
    }
  }, [open, project, currentManager, form])

  const submitting = createProject.isPending || updateProject.isPending || setManager.isPending

  const onSubmit = async (values: FormValues) => {
    const { managerId, ...projectValues } = values
    let projectId = project?.id

    if (isEdit && project) {
      await updateProject.mutateAsync({ id: project.id, patch: projectValues })
    } else {
      const created = await createProject.mutateAsync({ ...projectValues, month_id: monthId })
      projectId = created.id
    }

    if (projectId) {
      await setManager.mutateAsync({ projectId, personId: managerId || null })
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar proyecto" : "Nuevo proyecto"}</DialogTitle>
          <DialogDescription>
            El color identifica al gerente responsable y pinta la columna en la grilla.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Color</FormLabel>
                  <FormControl>
                    <ColorPicker value={field.value} onChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="managerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gerente responsable</FormLabel>
                    <Select
                      value={field.value || "none"}
                      onValueChange={(v) => field.onChange(v === "none" ? "" : v)}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Sin asignar" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Sin asignar</SelectItem>
                        {people.map((person) => (
                          <SelectItem key={person.id} value={person.id}>
                            {person.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estado</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="activo">Activo</SelectItem>
                        <SelectItem value="pausado">Pausado</SelectItem>
                        <SelectItem value="finalizado">Finalizado</SelectItem>
                        <SelectItem value="archivado">Archivado</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear proyecto"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

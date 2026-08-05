import { useEffect, useState } from "react"
import { Plus, X } from "lucide-react"
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
import {
  PRIORITY_LABELS,
  PRIORITY_OPTIONS,
  STATUS_OPTIONS,
  WORK_ITEM_OPTIONS,
} from "@/features/tasks/lib/taskLabels"
import { nextBoardOrder, type Task } from "@/features/tasks/api/tasksApi"
import { useCreateTask, useUpdateTask } from "@/features/tasks/hooks/useTasksQueries"
import { useCreateProject } from "@/features/projects/hooks/useProjectsQueries"
import { useSessionStore } from "@/stores/sessionStore"
import { canCreateProjects } from "@/lib/roles"
import type { Project } from "@/features/projects/api/projectsApi"
import type { Person } from "@/features/people/api/peopleApi"
import type { TaskStatus } from "@/types/database.types"

// Valor centinela del <Select>: no es un proyecto, es la acción "crear uno".
// Va siempre al final de la lista, después de los proyectos reales.
const NEW_PROJECT = "__new__"

// Color por defecto de un proyecto creado al vuelo desde aquí. El diálogo de
// tarea no es el lugar para elegir paleta: se crea con el azul de marca y se
// ajusta luego desde Proyectos (donde además está el gerente y el estado).
const QUICK_PROJECT_COLOR = "#3A5BA7"

const schema = z.object({
  title: z.string().min(1, "El título es obligatorio"),
  description: z.string(),
  projectId: z.string().min(1, "Elige un proyecto"),
  workItemType: z.enum(["epica", "historia", "tarea", "bug"]),
  status: z.enum(["pendiente", "en_progreso", "en_revision", "bloqueada", "completada"]),
  priority: z.number().int().min(1).max(4),
  assignedPersonId: z.string(),
  parentTaskId: z.string(),
  startDate: z.string(),
  dueDate: z.string(),
  // Se validan como texto y se convierten al enviar: un input vacío da ""
  // (no undefined), y "" no es un número — así el campo puede quedarse en
  // blanco sin disparar un error de validación.
  estimatedHours: z.string(),
  completedHours: z.string(),
  tags: z.string(),
})
  // Mismo orden que exige el check `tasks_dates_ordered` en la base: se
  // valida aquí para dar el error en el campo y no como un fallo de red.
  .refine((v) => !v.startDate || !v.dueDate || v.startDate <= v.dueDate, {
    message: "La fecha de inicio no puede ser posterior a la fecha límite",
    path: ["dueDate"],
  })

type FormValues = z.infer<typeof schema>

interface TaskFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  monthId: string
  task?: Task | null
  defaultStatus?: TaskStatus
  tasks: Task[]
  projects: Project[]
  people: Person[]
  readOnly: boolean
  // Cuando quien edita solo puede trabajar sobre lo suyo (Analista de
  // Tecnología), la tarea queda fijada a su persona: RLS rechaza cualquier
  // otro responsable, así que dejar el campo libre solo produciría un error
  // al guardar.
  lockedPersonId?: string | null
}

const toNumberOrNull = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

const parseTags = (value: string) =>
  value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)

export default function TaskFormDialog({
  open,
  onOpenChange,
  monthId,
  task,
  defaultStatus = "pendiente",
  tasks,
  projects,
  people,
  readOnly,
  lockedPersonId = null,
}: TaskFormDialogProps) {
  const isEdit = Boolean(task)
  const createTask = useCreateTask(monthId)
  const updateTask = useUpdateTask(monthId)
  const createProject = useCreateProject(monthId)
  const profile = useSessionStore((s) => s.profile)
  const canAddProject = !readOnly && canCreateProjects(profile?.role)

  // Proyecto recién creado desde este diálogo. Se guarda aparte porque la
  // lista `projects` la refresca el padre de forma asíncrona: sin esto, el
  // <Select> se quedaría un instante en blanco con un id que todavía no
  // está entre sus opciones.
  const [justCreated, setJustCreated] = useState<Project | null>(null)
  const [newProjectName, setNewProjectName] = useState("")
  const [addingProject, setAddingProject] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      description: "",
      projectId: "",
      workItemType: "tarea",
      status: defaultStatus,
      priority: 3,
      assignedPersonId: "",
      parentTaskId: "",
      startDate: "",
      dueDate: "",
      estimatedHours: "",
      completedHours: "",
      tags: "",
    },
  })

  useEffect(() => {
    if (!open) return
    form.reset({
      title: task?.title ?? "",
      description: task?.description ?? "",
      projectId: task?.project_id ?? "",
      workItemType: task?.work_item_type ?? "tarea",
      status: task?.status ?? defaultStatus,
      priority: task?.priority ?? 3,
      assignedPersonId: task?.assigned_person_id ?? lockedPersonId ?? "",
      parentTaskId: task?.parent_task_id ?? "",
      startDate: task?.start_date ?? "",
      dueDate: task?.due_date ?? "",
      estimatedHours: task?.estimated_hours?.toString() ?? "",
      completedHours: task?.completed_hours?.toString() ?? "",
      tags: task?.tags.join(", ") ?? "",
    })
    setJustCreated(null)
    setNewProjectName("")
    setAddingProject(false)
  }, [open, task, defaultStatus, lockedPersonId, form])

  // Proyectos reales + el creado en esta sesión del diálogo, sin duplicarlo
  // cuando el refetch del padre ya lo trajo.
  const projectOptions =
    justCreated && !projects.some((p) => p.id === justCreated.id)
      ? [...projects, justCreated]
      : projects

  const submitNewProject = async () => {
    const name = newProjectName.trim()
    if (!name) return
    const created = await createProject.mutateAsync({
      month_id: monthId,
      name,
      color: QUICK_PROJECT_COLOR,
      status: "activo",
      category: "proyecto",
    })
    setJustCreated(created)
    form.setValue("projectId", created.id, { shouldValidate: true })
    setNewProjectName("")
    setAddingProject(false)
  }

  const submitting = createTask.isPending || updateTask.isPending

  // Candidatas a padre: cualquier work item del mes que no sea la propia
  // tarjeta (evita el ciclo trivial A → A). Una jerarquía más profunda
  // (A → B → A) es posible y la UI no la impide; el módulo solo la usa para
  // agrupar visualmente, no para calcular nada en cascada.
  const parentCandidates = tasks.filter((t) => t.id !== task?.id)

  const onSubmit = async (values: FormValues) => {
    const payload = {
      title: values.title.trim(),
      description: values.description.trim() || null,
      project_id: values.projectId,
      work_item_type: values.workItemType,
      status: values.status,
      priority: values.priority,
      assigned_person_id: values.assignedPersonId || null,
      parent_task_id: values.parentTaskId || null,
      start_date: values.startDate || null,
      due_date: values.dueDate || null,
      estimated_hours: toNumberOrNull(values.estimatedHours),
      completed_hours: toNumberOrNull(values.completedHours),
      tags: parseTags(values.tags),
    }

    if (isEdit && task) {
      await updateTask.mutateAsync({ id: task.id, patch: payload })
    } else {
      await createTask.mutateAsync({
        ...payload,
        month_id: monthId,
        board_order: nextBoardOrder(tasks, values.status),
      })
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Detalle del work item" : "Nueva tarea"}</DialogTitle>
          <DialogDescription>
            Las horas estimadas y trabajadas de una tarea son seguimiento del work item: no entran
            en la distribución de horas del mes.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título</FormLabel>
                  <FormControl>
                    <Input disabled={readOnly} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="workItemType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={readOnly}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {WORK_ITEM_OPTIONS.map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
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
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={readOnly}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {STATUS_OPTIONS.map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
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
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prioridad</FormLabel>
                    <Select
                      value={String(field.value)}
                      onValueChange={(v) => field.onChange(Number(v))}
                      disabled={readOnly}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PRIORITY_OPTIONS.map((value) => (
                          <SelectItem key={value} value={String(value)}>
                            {PRIORITY_LABELS[value]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="projectId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Proyecto</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(v) => {
                        // El centinela no es un proyecto: abre el campo de
                        // alta y deja la selección como estaba.
                        if (v === NEW_PROJECT) {
                          setAddingProject(true)
                          return
                        }
                        field.onChange(v)
                      }}
                      disabled={readOnly}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Elige un proyecto" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {projectOptions.map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.name}
                          </SelectItem>
                        ))}
                        {canAddProject && (
                          <SelectItem value={NEW_PROJECT} className="text-primary">
                            + Crear proyecto nuevo
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    {addingProject && (
                      <div className="flex items-center gap-1.5">
                        <Input
                          autoFocus
                          placeholder="Nombre del proyecto"
                          value={newProjectName}
                          onChange={(e) => setNewProjectName(e.target.value)}
                          onKeyDown={(e) => {
                            // Enter aquí crea el proyecto; sin esto enviaría
                            // el formulario de la tarea a medio llenar.
                            if (e.key === "Enter") {
                              e.preventDefault()
                              void submitNewProject()
                            }
                            if (e.key === "Escape") {
                              e.preventDefault()
                              setAddingProject(false)
                            }
                          }}
                        />
                        <Button
                          type="button"
                          size="icon"
                          variant="secondary"
                          disabled={!newProjectName.trim() || createProject.isPending}
                          onClick={() => void submitNewProject()}
                          aria-label="Crear proyecto"
                        >
                          <Plus />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => setAddingProject(false)}
                          aria-label="Cancelar"
                        >
                          <X />
                        </Button>
                      </div>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="assignedPersonId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Asignada a</FormLabel>
                    <Select
                      value={field.value || "none"}
                      onValueChange={(v) => field.onChange(v === "none" ? "" : v)}
                      disabled={readOnly || Boolean(lockedPersonId)}
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
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="parentTaskId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Work item padre</FormLabel>
                    <Select
                      value={field.value || "none"}
                      onValueChange={(v) => field.onChange(v === "none" ? "" : v)}
                      disabled={readOnly}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Sin padre" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Sin padre</SelectItem>
                        {parentCandidates.map((candidate) => (
                          <SelectItem key={candidate.id} value={candidate.id}>
                            {candidate.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha de inicio</FormLabel>
                    <FormControl>
                      <Input type="date" disabled={readOnly} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha límite</FormLabel>
                    <FormControl>
                      <Input type="date" disabled={readOnly} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="estimatedHours"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Horas estimadas</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" step="0.5" disabled={readOnly} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="completedHours"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Horas trabajadas</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" step="0.5" disabled={readOnly} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="tags"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Etiquetas</FormLabel>
                    <FormControl>
                      <Input placeholder="urgente, cliente" disabled={readOnly} {...field} />
                    </FormControl>
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
                    <Textarea rows={4} disabled={readOnly} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {!readOnly && (
              <DialogFooter>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear tarea"}
                </Button>
              </DialogFooter>
            )}
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

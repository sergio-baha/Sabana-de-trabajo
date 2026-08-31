import { useEffect, useMemo, useState } from "react"
import { CheckCheck, CornerUpLeft, Plus, Send, ShieldCheck, X } from "lucide-react"
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
import { Label } from "@/components/ui/label"
import { RichTextEditor } from "@/components/ui/rich-text-editor"
import { Textarea } from "@/components/ui/textarea"
import { PersonMultiSelect } from "@/components/shared/PersonMultiSelect"
import ReviewerSelect from "@/features/tasks/components/ReviewerSelect"
import { reviewerOptionsFromRoster } from "@/features/tasks/lib/reviewerOptions"
import { useEnsureProjectMember } from "@/features/tasks/hooks/useEnsureProjectMember"
import { useMyPerson } from "@/features/schedule/hooks/useMyPerson"
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
import { uploadTaskImage } from "@/features/tasks/lib/uploadTaskImage"
import {
  useCreateTask,
  useEscalateTaskReview,
  useReturnTaskForRework,
  useSetTaskAssignees,
  useTaskAssignees,
  useUpdateTask,
} from "@/features/tasks/hooks/useTasksQueries"
import {
  useCreateProject,
  useProjectManagers,
  useProjectMembers,
} from "@/features/projects/hooks/useProjectsQueries"
import { usePhases } from "@/features/projects/hooks/useProjectBudgetQueries"
import { usePeopleByRole } from "@/features/people/hooks/usePeopleByRole"
import { useSessionStore } from "@/stores/sessionStore"
import { canCreateProjects, requiresReviewerPick, writesOwnWorkOnly } from "@/lib/roles"
import { Separator } from "@/components/ui/separator"
import TaskCommentThread from "@/features/tasks/components/TaskCommentThread"
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
  phaseId: z.string(),
  workItemType: z.enum(["epica", "historia", "tarea", "bug"]),
  status: z.enum(["pendiente", "en_progreso", "en_revision", "bloqueada", "completada"]),
  priority: z.number().int().min(1).max(4),
  assignedPersonIds: z.array(z.string()),
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
  // Prellena la fase al crear (p. ej. el botón "+ Tarea" de una fase
  // concreta en la página del proyecto). A diferencia de lockedProjectId,
  // sigue siendo editable — mover una tarea de fase es normal.
  defaultPhaseId?: string | null
  tasks: Task[]
  projects: Project[]
  people: Person[]
  readOnly: boolean
  // Prellena "Asignada a" al crear (p. ej. con uno mismo). No bloquea el
  // campo: con varios asignados por igual, cualquier miembro del equipo del
  // proyecto puede sumar o quitar a otros — la barrera real es RLS
  // (is_project_team_member), no este valor por defecto.
  defaultAssigneeIds?: string[]
  // Al crear una tarea desde la página de detalle de un proyecto, el
  // proyecto ya está decidido por el contexto — no tiene sentido pedirlo de
  // nuevo ni permitir cambiarlo a mitad de la edición.
  lockedProjectId?: string | null
}

const toNumberOrNull = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

const formatReviewDate = (iso: string) =>
  new Date(iso).toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })

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
  defaultPhaseId = null,
  tasks,
  projects,
  people,
  readOnly,
  defaultAssigneeIds = [],
  lockedProjectId = null,
}: TaskFormDialogProps) {
  const isEdit = Boolean(task)
  const createTask = useCreateTask()
  const updateTask = useUpdateTask()
  const setAssignees = useSetTaskAssignees(monthId)
  const { data: taskAssignees } = useTaskAssignees(monthId)
  const createProject = useCreateProject()
  const { data: projectMembers } = useProjectMembers()
  const profile = useSessionStore((s) => s.profile)
  const canAddProject = !readOnly && canCreateProjects(profile?.role)
  const { data: projectManagers } = useProjectManagers()

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
      phaseId: "",
      workItemType: "tarea",
      status: defaultStatus,
      priority: 3,
      assignedPersonIds: [],
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
    const currentAssigneeIds = task
      ? (taskAssignees ?? []).filter((a) => a.task_id === task.id).map((a) => a.person_id)
      : defaultAssigneeIds
    form.reset({
      title: task?.title ?? "",
      description: task?.description ?? "",
      projectId: task?.project_id ?? lockedProjectId ?? "",
      phaseId: task?.phase_id ?? defaultPhaseId ?? "",
      workItemType: task?.work_item_type ?? "tarea",
      status: task?.status ?? defaultStatus,
      priority: task?.priority ?? 3,
      assignedPersonIds: currentAssigneeIds,
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
    // Sin esto, cerrar el diálogo con Escape/clic afuera (en vez del botón
    // "Cancelar" del recuadro inline) dejaba "Devolver"/"Reasignar" abiertos
    // con el texto de la tarea anterior — y al reabrir sobre OTRA tarea, ese
    // motivo/reasignación quedaba listo para confirmarse sobre la que no era.
    setReturning(false)
    setReturnComment("")
    setEscalating(false)
    setEscalateTo("")
    // `defaultAssigneeIds` se deja fuera a propósito: el caller suele pasar
    // un array literal nuevo en cada render, y si entrara a las deps el
    // formulario se resetearía en cada tecleo mientras el diálogo está
    // abierto. Solo importa su valor en el instante en que `open` pasa a
    // true, que es cuando este efecto igual se vuelve a correr.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task, taskAssignees, defaultStatus, defaultPhaseId, lockedProjectId, form])

  // Proyectos reales + el creado en esta sesión del diálogo, sin duplicarlo
  // cuando el refetch del padre ya lo trajo.
  const projectOptions =
    justCreated && !projects.some((p) => p.id === justCreated.id)
      ? [...projects, justCreated]
      : projects

  // Si el proyecto elegido tiene un equipo definido, el selector de
  // responsable se acota a ese equipo — así no hay que buscar entre todas
  // las personas del mes. Sin equipo configurado (o mientras se elige
  // proyecto) se ve la lista completa, como antes.
  const selectedProjectId = form.watch("projectId")
  const currentAssigneeIds = form.watch("assignedPersonIds")
  const { data: phasesForProject } = usePhases(selectedProjectId || null)
  const projectMemberIds = new Set(
    (projectMembers ?? [])
      .filter((m) => m.project_id === selectedProjectId)
      .map((m) => m.person_id)
  )
  // Los gestores (y administradores) del roster nunca se filtran: son los
  // dueños de los proyectos y hay que poder encargarles trabajo aunque no
  // tengan horas repartidas en la sábana — que es de donde sale hoy la
  // pertenencia al equipo (allocation_implies_membership). Sin esto,
  // justamente los responsables desaparecían del selector.
  const peopleByRole = usePeopleByRole(people)
  const alwaysVisibleIds = new Set(peopleByRole.owners.map((p) => p.id))
  const projectManagerPersonId = (projectManagers ?? []).find(
    (m) => m.project_id === selectedProjectId
  )?.person_id
  if (projectManagerPersonId) alwaysVisibleIds.add(projectManagerPersonId)

  const assigneeOptions =
    projectMemberIds.size > 0
      ? people.filter(
          (p) =>
            projectMemberIds.has(p.id) ||
            currentAssigneeIds.includes(p.id) ||
            alwaysVisibleIds.has(p.id)
        )
      : people

  const submitNewProject = async () => {
    const name = newProjectName.trim()
    if (!name) return
    const created = await createProject.mutateAsync({
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

  const submitting = createTask.isPending || updateTask.isPending || setAssignees.isPending

  // ── Circuito de revisión ────────────────────────────────────────────
  // Espejo en la interfaz de task_requires_review() en la base. La regla de
  // verdad vive allá; esto solo evita ofrecer una acción que sería
  // rechazada. Un work item sin crear todavía se trata como propio (va a
  // quedar creado por quien lo está llenando).
  const selectedProject = projectOptions.find((p) => p.id === selectedProjectId)
  const requiresReview = requiresReviewerPick(
    profile?.role,
    selectedProject?.created_by,
    task ? task.created_by : profile?.id,
    selectedProject?.category,
    profile?.id
  )

  // "En revisión" también se filtra: este selector hace un UPDATE llano
  // (sin RPC), así que nunca elige revisor — entrar por acá cuando el
  // circuito lo exige solo llega hasta el trigger de la base, que lo
  // rechaza con un mensaje genérico. La vía real es "Entregar" (arrastrar
  // la tarjeta o el botón del tablero), que sí abre el diálogo del revisor.
  const statusOptions = requiresReview
    ? STATUS_OPTIONS.filter(([value]) => value !== "completada" && value !== "en_revision")
    : STATUS_OPTIONS

  const { myPerson } = useMyPerson(monthId)
  const inReview = task?.status === "en_revision"
  // Quien puede actuar sobre ESTA entrega puntual: gestor/admin (siempre), o
  // la persona que quedó como revisor elegido — ya no "cualquier gestor del
  // proyecto". Espejo de is_current_reviewer()/is_project_manager() en la
  // base (return_task_for_rework / el trigger del circuito).
  const isCurrentReviewer = Boolean(
    myPerson && task && task.current_reviewer_person_id === myPerson.id
  )
  const canReview = !readOnly && (!writesOwnWorkOnly(profile?.role) || isCurrentReviewer)
  const currentReviewerName = people.find((p) => p.id === task?.current_reviewer_person_id)?.name

  // Si el proyecto no tiene gerente con cuenta, la entrega no le llega a
  // nadie. Es la regla acordada, pero callarlo dejaría al analista creyendo
  // que alguien fue avisado.
  const projectHasReviewer = (projectManagers ?? []).some(
    (m) => m.project_id === selectedProjectId
  )

  const returnTask = useReturnTaskForRework()
  const escalate = useEscalateTaskReview()
  const [returning, setReturning] = useState(false)
  const [returnComment, setReturnComment] = useState("")
  const [escalating, setEscalating] = useState(false)
  const [escalateTo, setEscalateTo] = useState("")

  // Todo el roster, gestores primero — no acotado al equipo del proyecto
  // (ver reviewerOptions.ts). Al reasignar, además de no ofrecerte a ti
  // mismo, tampoco se ofrece a quien la entregó originalmente — eso es
  // "Devolver", no "Reasignar" (el backend, validate_task_reviewer, es
  // quien de verdad lo hace cumplir).
  const originalSubmitterPersonId = people.find((p) => p.profile_id === task?.submitted_by)?.id
  const escalateOptions = useMemo(
    () => reviewerOptionsFromRoster(peopleByRole, myPerson?.id, originalSubmitterPersonId),
    [peopleByRole, myPerson?.id, originalSubmitterPersonId]
  )
  const { dialog: ensureMemberDialog, ensureMember } = useEnsureProjectMember(
    projectManagers,
    projectMembers
  )

  const approveReview = async () => {
    if (!task) return
    await updateTask.mutateAsync({ id: task.id, patch: { status: "completada" } })
    onOpenChange(false)
  }

  const confirmReturn = async () => {
    if (!task || !returnComment.trim()) return
    await returnTask.mutateAsync({
      taskId: task.id,
      status: "en_progreso",
      comment: returnComment.trim(),
    })
    setReturning(false)
    setReturnComment("")
    onOpenChange(false)
  }

  const confirmEscalate = async () => {
    if (!task || !escalateTo) return
    const reviewer = escalateOptions.ordered.find((p) => p.id === escalateTo)
    const proceed = await ensureMember(task.project_id, escalateTo, reviewer?.name ?? "")
    if (!proceed) return
    await escalate.mutateAsync({ taskId: task.id, reviewerPersonId: escalateTo, comment: null })
    setEscalating(false)
    setEscalateTo("")
    onOpenChange(false)
  }

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
      phase_id: values.phaseId || null,
      work_item_type: values.workItemType,
      status: values.status,
      priority: values.priority,
      parent_task_id: values.parentTaskId || null,
      start_date: values.startDate || null,
      due_date: values.dueDate || null,
      estimated_hours: toNumberOrNull(values.estimatedHours),
      completed_hours: toNumberOrNull(values.completedHours),
      tags: parseTags(values.tags),
    }

    let taskId = task?.id
    if (isEdit && task) {
      await updateTask.mutateAsync({ id: task.id, patch: payload })
    } else {
      const created = await createTask.mutateAsync({
        ...payload,
        month_id: monthId,
        board_order: nextBoardOrder(tasks, values.status),
      })
      taskId = created.id
    }

    if (taskId) {
      await setAssignees.mutateAsync({ taskId, personIds: values.assignedPersonIds })
    }
    onOpenChange(false)
  }

  return (
    <>
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
                        {statusOptions.map(([value, label]) => (
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
                        // Las fases son del proyecto: cambiar de proyecto
                        // invalida cualquier fase ya elegida.
                        form.setValue("phaseId", "")
                      }}
                      disabled={readOnly || Boolean(lockedProjectId)}
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
            </div>

            <FormField
              control={form.control}
              name="assignedPersonIds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Asignada a</FormLabel>
                  <FormControl>
                    <PersonMultiSelect
                      people={assigneeOptions}
                      value={field.value}
                      onChange={field.onChange}
                      disabled={readOnly}
                      placeholder="Sin asignar"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phaseId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fase</FormLabel>
                  <Select
                    value={field.value || "none"}
                    onValueChange={(v) => field.onChange(v === "none" ? "" : v)}
                    disabled={readOnly || !selectedProjectId || (phasesForProject ?? []).length === 0}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Sin fase" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">Sin fase</SelectItem>
                      {(phasesForProject ?? []).map((phase) => (
                        <SelectItem key={phase.id} value={phase.id}>
                          {phase.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                    <RichTextEditor
                      value={field.value}
                      onChange={field.onChange}
                      onUploadImage={uploadTaskImage}
                      disabled={readOnly}
                      placeholder="Explica la tarea… puedes pegar o arrastrar imágenes"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {isEdit && inReview && task?.submitted_at && (
              <div className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-xl bg-muted/60 p-3 text-sm">
                <span>
                  <span className="text-muted-foreground">Entregada a revisión: </span>
                  {formatReviewDate(task.submitted_at)}
                </span>
                <span>
                  <span className="text-muted-foreground">Revisor actual: </span>
                  {currentReviewerName ?? "—"}
                </span>
              </div>
            )}

            {isEdit && requiresReview && (
              <div className="flex items-start gap-2.5 rounded-xl border border-border bg-muted/60 p-3 text-sm">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span className="text-muted-foreground">
                  Esta tarea la cierra quien la revise. Cuando termines, ponla{" "}
                  <strong>En revisión</strong> y elige quién debe revisarla.
                  {!projectHasReviewer && (
                    <>
                      {" "}
                      <span className="text-warning">
                        Ojo: este proyecto no tiene gerente asignado, así que la entrega no le
                        llegará a nadie hasta que se le asigne uno.
                      </span>
                    </>
                  )}
                </span>
              </div>
            )}

            {inReview && canReview && (returning || escalating) && (
              <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/40 p-3">
                {returning && (
                  <>
                    <Label htmlFor="inline-return-reason">
                      Qué hay que corregir <span className="text-danger">*</span>
                    </Label>
                    <Textarea
                      id="inline-return-reason"
                      rows={3}
                      placeholder="Sé concreto: qué falta, qué está mal, qué esperabas…"
                      value={returnComment}
                      onChange={(e) => setReturnComment(e.target.value)}
                      autoFocus
                    />
                  </>
                )}
                {escalating && (
                  <>
                    <Label>Reasignar revisión a</Label>
                    <ReviewerSelect
                      options={escalateOptions}
                      value={escalateTo}
                      onChange={setEscalateTo}
                    />
                  </>
                )}
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setReturning(false)
                      setEscalating(false)
                      setReturnComment("")
                      setEscalateTo("")
                    }}
                  >
                    Cancelar
                  </Button>
                  {returning && (
                    <Button
                      type="button"
                      size="sm"
                      disabled={!returnComment.trim() || returnTask.isPending}
                      onClick={() => void confirmReturn()}
                    >
                      <CornerUpLeft /> Confirmar devolución
                    </Button>
                  )}
                  {escalating && (
                    <Button
                      type="button"
                      size="sm"
                      disabled={!escalateTo || escalate.isPending}
                      onClick={() => void confirmEscalate()}
                    >
                      <Send /> Confirmar reasignación
                    </Button>
                  )}
                </div>
              </div>
            )}

            {isEdit && task && (
              <>
                <Separator />
                <TaskCommentThread taskId={task.id} readOnly={readOnly} />
              </>
            )}

            {!readOnly && (
              <DialogFooter className="gap-2 sm:justify-between">
                {/* Las acciones de revisión van aparte del guardado: son
                    decisiones sobre la entrega, no una edición más del
                    formulario. Solo las ofrece quien tiene la revisión
                    ahora mismo (o gestor/admin) — is_current_reviewer en
                    la base. */}
                {inReview && canReview && !returning && !escalating ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={submitting}
                      onClick={() => setReturning(true)}
                    >
                      <CornerUpLeft /> Devolver
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={submitting}
                      onClick={() => setEscalating(true)}
                    >
                      <Send /> Reasignar
                    </Button>
                    <Button type="button" disabled={submitting} onClick={() => void approveReview()}>
                      <CheckCheck /> Aprobar
                    </Button>
                  </div>
                ) : (
                  <span />
                )}
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear tarea"}
                </Button>
              </DialogFooter>
            )}
          </form>
        </Form>
      </DialogContent>
    </Dialog>
    {ensureMemberDialog}
    </>
  )
}

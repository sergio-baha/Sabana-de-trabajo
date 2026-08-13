import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { ChevronDown } from "lucide-react"
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
  SelectLabel,
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import ColorPicker from "@/features/projects/components/ColorPicker"
import { PersonMultiSelect } from "@/components/shared/PersonMultiSelect"
import {
  useCreateProject,
  useSetProjectManager,
  useSetProjectMembers,
  useUpdateProject,
} from "@/features/projects/hooks/useProjectsQueries"
import type { Project, ProjectManager } from "@/features/projects/api/projectsApi"
import type { Person } from "@/features/people/api/peopleApi"
import { usePeopleByRole } from "@/features/people/hooks/usePeopleByRole"
import { useSessionStore } from "@/stores/sessionStore"
import { canSeeCosts } from "@/lib/roles"

// Los campos de presupuesto y fecha se manejan como texto y se convierten al
// enviar: un `<input type="number">` vacío entrega "" y no null, y en zod un
// coerce directo lo volvería 0 — que en presupuesto significa "cero pesos",
// muy distinto de "sin presupuesto definido".
const optionalMoney = z
  .string()
  .trim()
  .refine((v) => v === "" || (!Number.isNaN(Number(v)) && Number(v) >= 0), {
    message: "Debe ser un número mayor o igual a cero",
  })

const schema = z
  .object({
    name: z.string().min(1, "El nombre es obligatorio"),
    color: z.string().min(1),
    status: z.enum(["activo", "pausado", "finalizado", "archivado"]),
    category: z.enum(["proyecto", "institucional"]),
    managerId: z.string(),
    description: z.string(),
    start_date: z.string(),
    end_date: z.string(),
    budget_amount: optionalMoney,
    budget_hours: optionalMoney,
  })
  .refine((v) => !v.start_date || !v.end_date || v.end_date >= v.start_date, {
    message: "La fecha de fin no puede ser anterior a la de inicio",
    path: ["end_date"],
  })

type FormValues = z.infer<typeof schema>

const toNumberOrNull = (value: string) => (value.trim() === "" ? null : Number(value))
const toDateOrNull = (value: string) => (value.trim() === "" ? null : value)

interface ProjectFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  project?: Project | null
  people: Person[]
  currentManager?: ProjectManager
  currentMemberIds?: string[]
  /** Recibe la fila guardada. Distribución lo usa para meter el proyecto
   *  recién creado en la grilla del mes sin esperar a que tenga horas. */
  onSaved?: (project: Project) => void
}

// Único formulario del proyecto: identidad, equipo y presupuesto. Antes había
// dos (uno "del mes" y otro "del portafolio") porque el proyecto vivía en dos
// tablas; ahora es una sola fila durable y un solo diálogo.
export default function ProjectFormDialog({
  open,
  onOpenChange,
  project,
  people,
  currentManager,
  currentMemberIds = [],
  onSaved,
}: ProjectFormDialogProps) {
  const isEdit = Boolean(project)
  const createProject = useCreateProject()
  const updateProject = useUpdateProject()
  const setManager = useSetProjectManager()
  const setMembers = useSetProjectMembers()
  // El Analista puede crear proyectos (válvula de escape del diálogo de
  // tareas), pero el dinero no es asunto suyo: no ve el presupuesto.
  const canSeeCost = canSeeCosts(useSessionStore((s) => s.profile)?.role)
  // Gerente responsable: los gestores encabezan la lista.
  const { owners, rest } = usePeopleByRole(people)
  // Colapsados por defecto al crear (nombre + miembros basta para arrancar);
  // abiertos al editar, para que los valores ya guardados no queden ocultos.
  const [advancedOpen, setAdvancedOpen] = useState(isEdit)
  const [memberIds, setMemberIds] = useState<string[]>(currentMemberIds)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      color: "#3A5BA7",
      status: "activo",
      category: "proyecto",
      managerId: "",
      description: "",
      start_date: "",
      end_date: "",
      budget_amount: "",
      budget_hours: "",
    },
  })

  useEffect(() => {
    if (!open) return
    form.reset({
      name: project?.name ?? "",
      color: project?.color ?? "#3A5BA7",
      status: project?.status ?? "activo",
      category: project?.category ?? "proyecto",
      managerId: currentManager?.person_id ?? "",
      description: project?.description ?? "",
      start_date: project?.start_date ?? "",
      end_date: project?.end_date ?? "",
      budget_amount: project?.budget_amount?.toString() ?? "",
      budget_hours: project?.budget_hours?.toString() ?? "",
    })
    setMemberIds(currentMemberIds)
    setAdvancedOpen(Boolean(project))
  }, [open, project, currentManager, currentMemberIds, form])

  const submitting =
    createProject.isPending ||
    updateProject.isPending ||
    setManager.isPending ||
    setMembers.isPending

  const onSubmit = async (values: FormValues) => {
    const patch = {
      name: values.name,
      color: values.color,
      status: values.status,
      category: values.category,
      description: values.description || null,
      start_date: toDateOrNull(values.start_date),
      end_date: toDateOrNull(values.end_date),
      budget_amount: toNumberOrNull(values.budget_amount),
      budget_hours: toNumberOrNull(values.budget_hours),
    }

    const saved =
      isEdit && project
        ? await updateProject.mutateAsync({ id: project.id, patch })
        : await createProject.mutateAsync(patch)

    await setManager.mutateAsync({ projectId: saved.id, personId: values.managerId || null })
    await setMembers.mutateAsync({ projectId: saved.id, personIds: memberIds })

    onSaved?.(saved)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar proyecto" : "Nuevo proyecto"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "El presupuesto es del proyecto completo: las horas de todos los meses suman contra el mismo techo."
              : "Ponle un nombre y suma al equipo que va a trabajar en él. El resto se puede ajustar después."}
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
                    <Input autoFocus placeholder="Nombre del proyecto" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex flex-col gap-2">
              <FormLabel>Equipo del proyecto</FormLabel>
              <PersonMultiSelect
                people={people}
                value={memberIds}
                onChange={setMemberIds}
                placeholder="Agregar personas del equipo…"
              />
              <p className="text-xs text-muted-foreground">
                Cualquier persona, sin importar su rol. Podrás asignarles tareas de este proyecto
                desde el tablero. El equipo acompaña al proyecto mientras dure, no solo un mes.
                Repartirle horas a alguien en Distribución también lo suma al equipo, así que
                esta lista es para adelantarse a eso, no un requisito previo.
              </p>
            </div>

            <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
              <CollapsibleTrigger asChild>
                <Button type="button" variant="ghost" size="sm" className="w-fit -ml-2 gap-1">
                  <ChevronDown
                    className={advancedOpen ? "rotate-180 transition-transform" : "transition-transform"}
                  />
                  Más opciones
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="flex flex-col gap-4 pt-2">
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
                          {/* Los gestores primero: son los dueños de los
                              proyectos y casi siempre la respuesta a esta
                              pregunta. Los encabezados solo aparecen cuando
                              hay de los dos grupos. */}
                          <SelectContent>
                            <SelectItem value="none">Sin asignar</SelectItem>
                            {owners.length > 0 && rest.length > 0 && (
                              <SelectLabel className="text-eyebrow text-muted-foreground">
                                Gestores
                              </SelectLabel>
                            )}
                            {owners.map((person) => (
                              <SelectItem key={person.id} value={person.id}>
                                {person.name}
                              </SelectItem>
                            ))}
                            {owners.length > 0 && rest.length > 0 && (
                              <SelectLabel className="text-eyebrow text-muted-foreground">
                                Equipo
                              </SelectLabel>
                            )}
                            {rest.map((person) => (
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
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Categoría</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="proyecto">Proyecto</SelectItem>
                          <SelectItem value="institucional">Tiempo institucional</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        "Tiempo institucional" agrupa capacitaciones, feedback u otros bloques que
                        no son un proyecto — Reportes puede excluirlos.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="start_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Inicio</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="end_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fin</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {canSeeCost && (
                    <FormField
                      control={form.control}
                      name="budget_amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Presupuesto (COP)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              step="1000"
                              placeholder="Sin definir"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  <FormField
                    control={form.control}
                    name="budget_hours"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Techo de horas</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" step="1" placeholder="Sin definir" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Dejar un presupuesto vacío no es lo mismo que ponerlo en cero: vacío significa
                  que no hay techo y no se muestra barra de consumo.
                </p>

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
              </CollapsibleContent>
            </Collapsible>

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

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
  useCreatePortfolioProject,
  useUpdatePortfolioProject,
} from "@/features/portfolio/hooks/usePortfolioQueries"
import type { PortfolioProject } from "@/features/portfolio/api/portfolioApi"

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

interface PortfolioFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  project?: PortfolioProject | null
}

export default function PortfolioFormDialog({
  open,
  onOpenChange,
  project,
}: PortfolioFormDialogProps) {
  const isEdit = Boolean(project)
  const createProject = useCreatePortfolioProject()
  const updateProject = useUpdatePortfolioProject()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      color: "#3A5BA7",
      status: "activo",
      category: "proyecto",
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
      description: project?.description ?? "",
      start_date: project?.start_date ?? "",
      end_date: project?.end_date ?? "",
      budget_amount: project?.budget_amount?.toString() ?? "",
      budget_hours: project?.budget_hours?.toString() ?? "",
    })
  }, [open, project, form])

  const submitting = createProject.isPending || updateProject.isPending

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

    if (isEdit && project) {
      await updateProject.mutateAsync({ id: project.id, patch })
    } else {
      await createProject.mutateAsync(patch)
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar proyecto" : "Nuevo proyecto del portafolio"}</DialogTitle>
          <DialogDescription>
            El presupuesto es del proyecto completo, no de un mes: las horas de todos los meses
            suman contra el mismo techo.
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
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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
              <FormField
                control={form.control}
                name="budget_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Presupuesto (COP)</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" step="1000" placeholder="Sin definir" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
              Dejar un presupuesto vacío no es lo mismo que ponerlo en cero: vacío significa que no
              hay techo y no se muestra barra de consumo.
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

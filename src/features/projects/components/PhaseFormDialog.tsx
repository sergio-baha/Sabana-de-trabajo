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
  useCreatePhase,
  useUpdatePhase,
} from "@/features/projects/hooks/useProjectBudgetQueries"
import { PHASE_STATUS_OPTIONS } from "@/features/projects/lib/projectLabels"
import type { ProjectPhase } from "@/features/projects/api/projectBudgetApi"

const optionalNumber = z
  .string()
  .trim()
  .refine((v) => v === "" || (!Number.isNaN(Number(v)) && Number(v) >= 0), {
    message: "Debe ser un número mayor o igual a cero",
  })

const schema = z
  .object({
    name: z.string().min(1, "El nombre es obligatorio"),
    status: z.enum(["pendiente", "en_curso", "completada"]),
    start_date: z.string(),
    end_date: z.string(),
    budget_amount: optionalNumber,
    budget_hours: optionalNumber,
  })
  .refine((v) => !v.start_date || !v.end_date || v.end_date >= v.start_date, {
    message: "La fecha de fin no puede ser anterior a la de inicio",
    path: ["end_date"],
  })

type FormValues = z.infer<typeof schema>

const toNumberOrNull = (value: string) => (value.trim() === "" ? null : Number(value))
const toDateOrNull = (value: string) => (value.trim() === "" ? null : value)

interface PhaseFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  phase?: ProjectPhase | null
  /** Posición que tomará una fase nueva: va al final de la lista. */
  nextPosition: number
}

export default function PhaseFormDialog({
  open,
  onOpenChange,
  projectId,
  phase,
  nextPosition,
}: PhaseFormDialogProps) {
  const isEdit = Boolean(phase)
  const createPhase = useCreatePhase(projectId)
  const updatePhase = useUpdatePhase(projectId)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      status: "pendiente",
      start_date: "",
      end_date: "",
      budget_amount: "",
      budget_hours: "",
    },
  })

  useEffect(() => {
    if (!open) return
    form.reset({
      name: phase?.name ?? "",
      status: phase?.status ?? "pendiente",
      start_date: phase?.start_date ?? "",
      end_date: phase?.end_date ?? "",
      budget_amount: phase?.budget_amount?.toString() ?? "",
      budget_hours: phase?.budget_hours?.toString() ?? "",
    })
  }, [open, phase, form])

  const submitting = createPhase.isPending || updatePhase.isPending

  const onSubmit = async (values: FormValues) => {
    const patch = {
      name: values.name,
      status: values.status,
      start_date: toDateOrNull(values.start_date),
      end_date: toDateOrNull(values.end_date),
      budget_amount: toNumberOrNull(values.budget_amount),
      budget_hours: toNumberOrNull(values.budget_hours),
    }

    if (isEdit && phase) {
      await updatePhase.mutateAsync({ id: phase.id, patch })
    } else {
      await createPhase.mutateAsync({
        ...patch,
        project_id: projectId,
        position: nextPosition,
      })
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar fase" : "Nueva fase"}</DialogTitle>
          <DialogDescription>
            {isEdit && phase?.phase_key
              ? "Es una de las cinco fases de la metodología. Renombrarla no rompe nada: el vínculo con las actividades ya registradas se mantiene."
              : "Las fases cruzan meses — sus fechas no están limitadas al mes activo."}
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
                      {PHASE_STATUS_OPTIONS.map(([value, label]) => (
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
            <DialogFooter>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Guardando…" : isEdit ? "Guardar cambios" : "Agregar fase"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

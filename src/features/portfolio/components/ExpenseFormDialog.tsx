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
import { useCreateExpense } from "@/features/portfolio/hooks/usePortfolioQueries"
import type { ProjectPhase } from "@/features/portfolio/api/portfolioApi"
import { useActiveMonthStore } from "@/stores/activeMonthStore"

const schema = z.object({
  concept: z.string().min(1, "Describe el gasto"),
  amount: z
    .string()
    .trim()
    .min(1, "El monto es obligatorio")
    .refine((v) => !Number.isNaN(Number(v)) && Number(v) >= 0, {
      message: "Debe ser un número mayor o igual a cero",
    }),
  incurred_on: z.string().min(1, "La fecha es obligatoria"),
  phase_id: z.string(),
  notes: z.string(),
})

type FormValues = z.infer<typeof schema>

interface ExpenseFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  portfolioProjectId: string
  phases: ProjectPhase[]
}

export default function ExpenseFormDialog({
  open,
  onOpenChange,
  portfolioProjectId,
  phases,
}: ExpenseFormDialogProps) {
  const createExpense = useCreateExpense(portfolioProjectId)
  const { activeMonthId } = useActiveMonthStore()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      concept: "",
      amount: "",
      incurred_on: new Date().toISOString().slice(0, 10),
      phase_id: "none",
      notes: "",
    },
  })

  useEffect(() => {
    if (!open) return
    form.reset({
      concept: "",
      amount: "",
      incurred_on: new Date().toISOString().slice(0, 10),
      phase_id: "none",
      notes: "",
    })
  }, [open, form])

  const onSubmit = async (values: FormValues) => {
    await createExpense.mutateAsync({
      portfolio_project_id: portfolioProjectId,
      // "none" es el valor centinela del Select: Radix no admite un
      // SelectItem con value="" porque lo usa internamente para "sin
      // selección".
      phase_id: values.phase_id === "none" ? null : values.phase_id,
      // Se guarda el mes activo para poder cruzar el gasto con el consumo de
      // horas del mismo período. Si no hay mes activo queda null y el gasto
      // sigue contando contra el proyecto.
      month_id: activeMonthId ?? null,
      incurred_on: values.incurred_on,
      concept: values.concept,
      amount: Number(values.amount),
      notes: values.notes || null,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar gasto</DialogTitle>
          <DialogDescription>
            Gastos que no son nómina — proveedores, viáticos, licencias. El costo de las horas del
            equipo se calcula aparte con las tarifas.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="concept"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Concepto</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej. Licencia anual de la herramienta" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Monto (COP)</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" step="1000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="incurred_on"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="phase_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fase</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">Sin fase (cuenta al proyecto)</SelectItem>
                      {phases.map((phase) => (
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
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notas</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={createExpense.isPending}>
                {createExpense.isPending ? "Guardando…" : "Registrar gasto"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { useCreateMonth, useUpdateMonth } from "@/features/months/hooks/useMonthsQueries"
import type { Month } from "@/features/months/api/monthsApi"

const schema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  default_hours: z.coerce.number().int().min(1, "Debe ser mayor a 0"),
  working_days: z.coerce.number().int().min(0).optional(),
  notes: z.string().optional(),
})

// z.coerce.number() hace que el tipo de entrada (lo que ve <Input>) difiera
// del tipo de salida (lo que llega a onSubmit) — con 2 generics en useForm,
// el resolver de zod no tipa bien esa diferencia; con 3 sí (input/output).
type FormInput = z.input<typeof schema>
type FormValues = z.output<typeof schema>

interface MonthFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  month?: Month | null
}

// Crear un mes "en blanco" (sin copiar de otro) — pensado para el primer mes
// de la app, cuando todavía no hay nada que duplicar. El flujo principal
// ("Duplicar mes") vive en DuplicateMonthDialog.
export default function MonthFormDialog({ open, onOpenChange, month }: MonthFormDialogProps) {
  const isEdit = Boolean(month)
  const createMonth = useCreateMonth()
  const updateMonth = useUpdateMonth()

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", default_hours: 160, working_days: 22, notes: "" },
  })

  useEffect(() => {
    if (open) {
      form.reset({
        name: month?.name ?? "",
        default_hours: month?.default_hours ?? 160,
        working_days: month?.working_days ?? 22,
        notes: month?.notes ?? "",
      })
    }
  }, [open, month, form])

  const submitting = createMonth.isPending || updateMonth.isPending

  const onSubmit = async (values: FormValues) => {
    if (isEdit && month) {
      await updateMonth.mutateAsync({ id: month.id, patch: values })
    } else {
      await createMonth.mutateAsync(values)
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar mes" : "Nuevo mes en blanco"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Actualiza el nombre y la configuración de este mes."
              : "Crea un mes sin copiar datos de otro. Para partir de un mes existente, usa \"Duplicar mes\"."}
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
                    <Input placeholder="Ej. Julio 2026" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="default_hours"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Horas laborales por defecto</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} {...field} value={field.value as number} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="working_days"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Días laborales</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        {...field}
                        value={field.value as number | undefined}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
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
              <Button type="submit" disabled={submitting}>
                {submitting ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear mes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

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
import { useCreatePerson, useUpdatePerson } from "@/features/people/hooks/usePeopleQueries"
import type { Person } from "@/features/people/api/peopleApi"

const schema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  job_title: z.string().optional(),
  available_hours: z.coerce.number().min(0, "No puede ser negativo"),
  status: z.enum(["activo", "inactivo"]),
  notes: z.string().optional(),
})

// z.coerce.number() difiere en tipo de entrada/salida — ver nota en
// MonthFormDialog.tsx.
type FormInput = z.input<typeof schema>
type FormValues = z.output<typeof schema>

interface PersonFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  monthId: string
  person?: Person | null
}

export default function PersonFormDialog({
  open,
  onOpenChange,
  monthId,
  person,
}: PersonFormDialogProps) {
  const isEdit = Boolean(person)
  const createPerson = useCreatePerson(monthId)
  const updatePerson = useUpdatePerson(monthId)

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      job_title: "",
      available_hours: 160,
      status: "activo",
      notes: "",
    },
  })

  useEffect(() => {
    if (open) {
      form.reset({
        name: person?.name ?? "",
        job_title: person?.job_title ?? "",
        available_hours: person?.available_hours ?? 160,
        status: person?.status ?? "activo",
        notes: person?.notes ?? "",
      })
    }
  }, [open, person, form])

  const submitting = createPerson.isPending || updatePerson.isPending

  const onSubmit = async (values: FormValues) => {
    if (isEdit && person) {
      await updatePerson.mutateAsync({ id: person.id, patch: values })
    } else {
      await createPerson.mutateAsync({ ...values, month_id: monthId })
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar persona" : "Nueva persona"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Actualiza los datos de esta persona." : "Agrega una persona al mes activo."}
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
              name="job_title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cargo</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="available_hours"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Horas disponibles</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        step="0.5"
                        {...field}
                        value={field.value as number}
                      />
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
                        <SelectItem value="activo">Activo</SelectItem>
                        <SelectItem value="inactivo">Inactivo</SelectItem>
                      </SelectContent>
                    </Select>
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
                  <FormLabel>Observaciones</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear persona"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import type { ProjectLine } from "@/features/projects/api/projectLinesApi"

const schema = z.object({
  name: z.string().trim().min(1, "Ponle un nombre a la línea"),
})

type FormValues = z.infer<typeof schema>

interface ProjectLineFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Con línea = renombrar; sin ella = crear una nueva. */
  line: ProjectLine | null
  onSubmit: (name: string) => Promise<void>
}

// Crear o renombrar una línea: una fila adicional del MISMO proyecto en la
// sábana, con sus propias horas por persona (ver project_lines en
// *_lineas_de_proyecto.sql). No pide más que el nombre — la línea no tiene
// fecha, presupuesto ni gerente propio, eso sigue siendo del proyecto.
export default function ProjectLineFormDialog({
  open,
  onOpenChange,
  line,
  onSubmit,
}: ProjectLineFormDialogProps) {
  const isEdit = Boolean(line)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "" },
  })

  useEffect(() => {
    if (!open) return
    form.reset({ name: line?.name ?? "" })
  }, [open, line, form])

  const submitting = form.formState.isSubmitting

  const handleSubmit = async (values: FormValues) => {
    await onSubmit(values.name.trim())
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Renombrar línea" : "Agregar línea"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "El nombre nuevo se ve de inmediato en todos los meses donde esta línea tenga horas."
              : "Se agrega como una fila más de este proyecto en la sábana, con sus propias horas por persona. El proyecto sigue siendo el mismo: mismo gerente, mismo presupuesto, mismas tareas."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre de la línea</FormLabel>
                  <FormControl>
                    <Input autoFocus placeholder="Ej. Frente 2, Soporte, Mantenimiento…" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Guardando…" : isEdit ? "Guardar cambios" : "Agregar línea"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

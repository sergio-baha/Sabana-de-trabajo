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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  useCreateProducto,
  useUpdateProducto,
} from "@/features/estratega/hooks/useGobernanzaQueries"
import { CELULAS, CELULA_LABEL } from "@/features/estratega/lib/gobernanza"
import type { Celula } from "@/features/estratega/lib/gobernanza"
import type { Producto } from "@/features/estratega/api/gobernanzaApi"

const schema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio"),
  celula: z.enum(["evaluacion", "gestion_academica", "sostenibilidad"]),
  fecha_limite: z.string().min(1, "La fecha de salida al mercado es obligatoria"),
  notas: z.string(),
})

type FormValues = z.infer<typeof schema>

interface ProductoFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  producto?: Producto | null
}

export default function ProductoFormDialog({
  open,
  onOpenChange,
  producto,
}: ProductoFormDialogProps) {
  const isEdit = Boolean(producto)
  const create = useCreateProducto()
  const update = useUpdateProducto()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { nombre: "", celula: "evaluacion", fecha_limite: "", notas: "" },
  })

  useEffect(() => {
    if (!open) return
    form.reset({
      nombre: producto?.nombre ?? "",
      celula: (producto?.celula ?? "evaluacion") as Celula,
      fecha_limite: producto?.fecha_limite ?? "",
      notas: producto?.notas ?? "",
    })
  }, [open, producto, form])

  const submitting = create.isPending || update.isPending

  const onSubmit = async (values: FormValues) => {
    const payload = {
      nombre: values.nombre.trim(),
      celula: values.celula,
      fecha_limite: values.fecha_limite,
      notas: values.notas.trim() || null,
    }
    if (isEdit && producto) await update.mutateAsync({ id: producto.id, ...payload })
    else await create.mutateAsync(payload)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar iniciativa" : "Nueva iniciativa estratégica"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "El checklist de entregables se edita desde el panel de detalle."
              : "Nace con el checklist estándar del Doble Diamante —catorce entregables sin marcar— para que puedas renombrarlos según lo que este producto realmente necesite."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="nombre"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Producto o proyecto</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej. Aula de Formación Continua V2" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="fecha_limite"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha límite (SLA)</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormDescription>Salida comprometida al mercado.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="celula"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Célula</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CELULAS.map((celula) => (
                          <SelectItem key={celula} value={celula}>
                            {CELULA_LABEL[celula]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="notas"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notas del estratega</FormLabel>
                  <FormControl>
                    <Textarea rows={3} placeholder="Contexto, decisiones, riesgos…" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Guardando…" : isEdit ? "Guardar cambios" : "Agregar al pipeline"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

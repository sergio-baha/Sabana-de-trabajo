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
import {
  useCreateEntregable,
  useUpdateEntregable,
} from "@/features/estratega/hooks/useGobernanzaQueries"
import {
  ESTADOS,
  ESTADO_LABEL,
  MES_LABEL,
  SIN_ESTADO_LABEL,
} from "@/features/estratega/lib/gobernanza"
import type { EntregaEstado, GestorOption } from "@/features/estratega/lib/gobernanza"
import type { Entregable } from "@/features/estratega/api/gobernanzaApi"

// "sin" es un valor centinela del <Select>, no un estado: Radix no acepta
// cadena vacía como valor de opción, y en la base esto se guarda como NULL.
const SIN_ESTADO = "sin"

const schema = z.object({
  colaborador: z.string().min(1, "Elige un gestor"),
  anio: z.string().min(4),
  mes: z.string().min(1),
  descripcion: z.string().trim().min(1, "Describe el compromiso"),
  estado: z.string(),
})

type FormValues = z.infer<typeof schema>

interface EntregableFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  entregable?: Entregable | null
  gestores: GestorOption[]
  anioSugerido: number
  mesSugerido: number
}

export default function EntregableFormDialog({
  open,
  onOpenChange,
  entregable,
  gestores,
  anioSugerido,
  mesSugerido,
}: EntregableFormDialogProps) {
  const isEdit = Boolean(entregable)
  const create = useCreateEntregable()
  const update = useUpdateEntregable()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      colaborador: "",
      anio: String(anioSugerido),
      mes: String(mesSugerido),
      descripcion: "",
      estado: SIN_ESTADO,
    },
  })

  useEffect(() => {
    if (!open) return
    form.reset({
      colaborador: entregable?.colaborador ?? "",
      anio: String(entregable?.anio ?? anioSugerido),
      mes: String(entregable?.mes ?? mesSugerido),
      descripcion: entregable?.descripcion ?? "",
      estado: entregable?.estado ?? SIN_ESTADO,
    })
  }, [open, entregable, anioSugerido, mesSugerido, form])

  const submitting = create.isPending || update.isPending

  const onSubmit = async (values: FormValues) => {
    const gestor = gestores.find((g) => g.nombre === values.colaborador)
    const payload = {
      anio: Number(values.anio),
      mes: Number(values.mes),
      colaborador: values.colaborador,
      profile_id: gestor?.profileId ?? null,
      descripcion: values.descripcion.trim(),
      estado: values.estado === SIN_ESTADO ? null : (values.estado as EntregaEstado),
    }

    if (isEdit && entregable) {
      await update.mutateAsync({ id: entregable.id, ...payload })
    } else {
      await create.mutateAsync(payload)
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar entregable" : "Nuevo entregable"}</DialogTitle>
          <DialogDescription>
            Un compromiso de gestión del mes. Si se arrastra al mes siguiente sin cumplirse, se
            registra de nuevo en ese mes: el histórico de cada período queda como fue.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="descripcion"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Entregable</FormLabel>
                  <FormControl>
                    <Textarea rows={4} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="colaborador"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Gestor</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Elige un gestor" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {gestores.map((g) => (
                        <SelectItem key={g.nombre} value={g.nombre}>
                          {g.nombre}
                          {!g.profileId && " · sin cuenta"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="mes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mes</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {MES_LABEL.map((label, indice) => (
                          <SelectItem key={label} value={String(indice + 1)}>
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
                name="anio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Año</FormLabel>
                    <FormControl>
                      <Input type="number" min="2000" max="2100" step="1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="estado"
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
                        <SelectItem value={SIN_ESTADO}>{SIN_ESTADO_LABEL}</SelectItem>
                        {ESTADOS.map((estado) => (
                          <SelectItem key={estado} value={estado}>
                            {ESTADO_LABEL[estado]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Guardando…" : isEdit ? "Guardar cambios" : "Agregar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

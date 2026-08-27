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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { useUpsertFinanza } from "@/features/estratega/hooks/useGobernanzaQueries"
import {
  MES_LABEL,
  formatCOP,
  porcentajeEjecucion,
  semaforoEjecucion,
  type GestorOption,
} from "@/features/estratega/lib/gobernanza"
import type { Finanza } from "@/features/estratega/api/gobernanzaApi"

const cifra = z
  .string()
  .trim()
  .refine((v) => v !== "" && !Number.isNaN(Number(v)) && Number(v) >= 0, {
    message: "Debe ser un número mayor o igual a cero",
  })

const schema = z.object({
  colaborador: z.string().min(1, "Elige un gestor"),
  anio: z.string().min(4),
  mes: z.string().min(1),
  presupuestado: cifra,
  ejecutado: cifra,
})

type FormValues = z.infer<typeof schema>

interface FinanzaFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Fila a corregir; si no viene, se registra un período nuevo. */
  finanza?: Finanza | null
  gestores: GestorOption[]
  /** Período preseleccionado: el que esté filtrado en la pantalla. */
  anioSugerido: number
  mesSugerido: number
}

// Registrar o corregir la ejecución de UN gestor en UN mes.
//
// No valida que el ejecutado no supere al presupuestado: sobre-ejecutar es un
// hecho real —y tiene su propio color en el semáforo—, no un error de
// captura. Bloquearlo obligaría a mentir en la cifra para poder guardarla.
export default function FinanzaFormDialog({
  open,
  onOpenChange,
  finanza,
  gestores,
  anioSugerido,
  mesSugerido,
}: FinanzaFormDialogProps) {
  const isEdit = Boolean(finanza)
  const upsert = useUpsertFinanza()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      colaborador: "",
      anio: String(anioSugerido),
      mes: String(mesSugerido),
      presupuestado: "",
      ejecutado: "",
    },
  })

  useEffect(() => {
    if (!open) return
    form.reset({
      colaborador: finanza?.colaborador ?? "",
      anio: String(finanza?.anio ?? anioSugerido),
      mes: String(finanza?.mes ?? mesSugerido),
      presupuestado: finanza ? String(finanza.presupuestado) : "",
      ejecutado: finanza ? String(finanza.ejecutado) : "",
    })
  }, [open, finanza, anioSugerido, mesSugerido, form])

  // Vista previa del semáforo mientras se escribe: es la única forma de
  // notar en el momento que uno tecleó un dígito de más.
  const presupuestado = Number(form.watch("presupuestado")) || 0
  const ejecutado = Number(form.watch("ejecutado")) || 0
  const porcentaje = porcentajeEjecucion(presupuestado, ejecutado)
  const semaforo = semaforoEjecucion(porcentaje)

  const onSubmit = async (values: FormValues) => {
    const gestor = gestores.find((g) => g.nombre === values.colaborador)
    await upsert.mutateAsync({
      // El id viaja solo al corregir: sin él, el upsert por llave natural
      // (año, mes, gestor) decide si es alta o corrección.
      ...(finanza ? { id: finanza.id } : {}),
      anio: Number(values.anio),
      mes: Number(values.mes),
      colaborador: values.colaborador,
      profile_id: gestor?.profileId ?? null,
      presupuestado: Number(values.presupuestado),
      ejecutado: Number(values.ejecutado),
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Corregir ejecución" : "Registrar ejecución"}</DialogTitle>
          <DialogDescription>
            Un gestor tiene una sola cifra por mes. Si el período ya estaba registrado, esto lo
            corrige en vez de duplicarlo.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
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
            <div className="grid grid-cols-2 gap-4">
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
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="presupuestado"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Presupuestado (COP)</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" step="1000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="ejecutado"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ejecutado (COP)</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" step="1000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormDescription className="flex flex-wrap items-center gap-2">
              <span className="text-eyebrow text-muted-foreground">Resultado</span>
              <span className="text-display text-lg font-black tabular-nums">
                {porcentaje.toFixed(2)}%
              </span>
              <span
                className={`text-eyebrow rounded-full px-2 py-0.5 ${semaforo.badge}`}
              >
                {semaforo.label}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatCOP(ejecutado)} de {formatCOP(presupuestado)}
              </span>
            </FormDescription>

            <DialogFooter>
              <Button type="submit" disabled={upsert.isPending}>
                {upsert.isPending ? "Guardando…" : isEdit ? "Guardar cambios" : "Registrar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

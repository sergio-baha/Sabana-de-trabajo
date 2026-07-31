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
import { useDuplicateMonth } from "@/features/months/hooks/useMonthsQueries"
import { useActiveMonthStore } from "@/stores/activeMonthStore"
import type { Month } from "@/features/months/api/monthsApi"

const schema = z.object({
  sourceMonthId: z.string().min(1, "Elige el mes de origen"),
  newName: z.string().min(1, "El nombre es obligatorio"),
})

type FormValues = z.infer<typeof schema>

interface DuplicateMonthDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  months: Month[]
  defaultSourceId?: string
}

// Flujo principal de "Gestión de meses": copia personas, proyectos, gerentes
// y tareas del mes de origen vía el RPC create_month_from_previous (ver
// supabase/migrations/*_rpc_create_month_from_previous.sql). El nuevo mes
// queda como mes activo automáticamente.
export default function DuplicateMonthDialog({
  open,
  onOpenChange,
  months,
  defaultSourceId,
}: DuplicateMonthDialogProps) {
  const duplicateMonth = useDuplicateMonth()
  const setActiveMonthId = useActiveMonthStore((s) => s.setActiveMonthId)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { sourceMonthId: defaultSourceId ?? "", newName: "" },
  })

  useEffect(() => {
    if (open) {
      form.reset({ sourceMonthId: defaultSourceId ?? months[0]?.id ?? "", newName: "" })
    }
  }, [open, defaultSourceId, months, form])

  const onSubmit = async (values: FormValues) => {
    const newMonthId = await duplicateMonth.mutateAsync({
      sourceMonthId: values.sourceMonthId,
      newName: values.newName,
    })
    setActiveMonthId(newMonthId)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Duplicar mes</DialogTitle>
          <DialogDescription>
            Copia personas, proyectos, gerentes y tareas del mes elegido. Solo cambia el nombre.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="sourceMonthId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mes de origen</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecciona un mes" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {months.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
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
              name="newName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre del mes nuevo</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej. Agosto 2026" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={duplicateMonth.isPending}>
                {duplicateMonth.isPending ? "Duplicando…" : "Duplicar mes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

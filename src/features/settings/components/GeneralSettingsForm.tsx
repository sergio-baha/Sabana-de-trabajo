import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useSettings, useUpdateSettings } from "@/features/settings/hooks/useSettingsQueries"

const schema = z.object({
  company_name: z.string().min(1, "El nombre es obligatorio"),
  logo_url: z.string().optional(),
  default_working_days: z.coerce.number().int().min(0),
})

type FormInput = z.input<typeof schema>
type FormValues = z.output<typeof schema>

export default function GeneralSettingsForm() {
  const { data: settings, isLoading } = useSettings()
  const updateSettings = useUpdateSettings()
  const [hoursOptions, setHoursOptions] = useState<number[]>([])
  const [newOption, setNewOption] = useState("")

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { company_name: "", logo_url: "", default_working_days: 22 },
  })

  useEffect(() => {
    if (settings) {
      form.reset({
        company_name: settings.company_name,
        logo_url: settings.logo_url ?? "",
        default_working_days: settings.default_working_days,
      })
      setHoursOptions(settings.default_hours_options)
    }
  }, [settings, form])

  const addOption = () => {
    const value = Number(newOption)
    if (Number.isFinite(value) && value > 0 && !hoursOptions.includes(value)) {
      setHoursOptions([...hoursOptions, value].sort((a, b) => a - b))
      setNewOption("")
    }
  }

  const removeOption = (value: number) => {
    setHoursOptions(hoursOptions.filter((v) => v !== value))
  }

  const onSubmit = async (values: FormValues) => {
    await updateSettings.mutateAsync({ ...values, default_hours_options: hoursOptions })
  }

  if (isLoading) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configuración general</CardTitle>
        <CardDescription>Datos de la empresa y horas laborales por defecto.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="company_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre de la empresa</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="logo_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>URL del logo</FormLabel>
                  <FormControl>
                    <Input placeholder="https://…" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="default_working_days"
              render={({ field }) => (
                <FormItem className="max-w-52">
                  <FormLabel>Días laborales por defecto</FormLabel>
                  <FormControl>
                    <Input type="number" min={0} {...field} value={field.value as number} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Opciones de horas laborales por mes</span>
              <div className="flex flex-wrap items-center gap-2">
                {hoursOptions.map((value) => (
                  <Badge key={value} variant="secondary" className="gap-1 pr-1">
                    {value} h
                    <button
                      type="button"
                      onClick={() => removeOption(value)}
                      className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))}
                <Input
                  className="h-7 w-20"
                  placeholder="Ej. 160"
                  value={newOption}
                  onChange={(e) => setNewOption(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      addOption()
                    }
                  }}
                />
                <Button type="button" variant="outline" size="sm" onClick={addOption}>
                  Agregar
                </Button>
              </div>
            </div>

            <Button type="submit" disabled={updateSettings.isPending} className="w-fit">
              {updateSettings.isPending ? "Guardando…" : "Guardar cambios"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}

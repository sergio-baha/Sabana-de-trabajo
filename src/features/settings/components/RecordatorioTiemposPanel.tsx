import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useSettings, useUpdateSettings } from "@/features/settings/hooks/useSettingsQueries"
import { enviarRecordatorioAhora, listarDestinatarios } from "@/features/settings/api/timeRequestApi"
import { ASSIGNABLE_ROLES, roleLabel } from "@/lib/roles"
import type { AppRole } from "@/types/database.types"

// ISO 8601: 1 = lunes … 7 = domingo. Es el mismo criterio que usa
// `extract(isodow …)` en time_request_due, para que lo que se marca acá y lo
// que evalúa la base sean el mismo número sin conversiones intermedias.
const DIAS = [
  { value: 1, label: "L" },
  { value: 2, label: "M" },
  { value: 3, label: "X" },
  { value: 4, label: "J" },
  { value: 5, label: "V" },
  { value: 6, label: "S" },
  { value: 7, label: "D" },
]

export default function RecordatorioTiemposPanel() {
  const { data: settings, isLoading } = useSettings()
  const updateSettings = useUpdateSettings()

  const [enabled, setEnabled] = useState(false)
  const [hora, setHora] = useState("16:30")
  const [dias, setDias] = useState<number[]>([1, 2, 3, 4, 5])
  const [vigencia, setVigencia] = useState(18)
  const [calendario, setCalendario] = useState(false)
  const [excluidos, setExcluidos] = useState<AppRole[]>([])
  const [verLista, setVerLista] = useState(false)
  const [enviando, setEnviando] = useState(false)

  // Se lee del servidor y no se calcula en el cliente: el roster del mes
  // vigente y las cuentas activas no están cargados en esta pantalla, y
  // traerlos completos para contar filas sería pedir mucho más de lo que se
  // muestra.
  const destinatarios = useQuery({
    queryKey: ["time-request-recipients"],
    queryFn: listarDestinatarios,
    staleTime: 60_000,
  })

  useEffect(() => {
    if (!settings) return
    setEnabled(settings.time_request_enabled)
    // Postgres devuelve "16:30:00"; el input type=time quiere "16:30".
    setHora(settings.time_request_time.slice(0, 5))
    setDias(settings.time_request_weekdays)
    setVigencia(settings.time_request_token_hours)
    setCalendario(settings.time_request_calendar_enabled)
    setExcluidos(settings.time_request_excluded_roles)
  }, [settings])

  const alternarDia = (value: number) =>
    setDias((current) =>
      current.includes(value)
        ? current.filter((d) => d !== value)
        : [...current, value].sort((a, b) => a - b)
    )

  const alternarRol = (rol: AppRole) =>
    setExcluidos((current) =>
      current.includes(rol) ? current.filter((r) => r !== rol) : [...current, rol]
    )

  const guardar = () =>
    updateSettings.mutate(
      {
        time_request_enabled: enabled,
        time_request_time: `${hora}:00`,
        time_request_weekdays: dias,
        time_request_token_hours: vigencia,
        time_request_calendar_enabled: calendario,
        time_request_excluded_roles: excluidos,
      },
      // La vista previa la calcula el servidor con la configuración GUARDADA,
      // así que hay que releerla: si no, el conteo seguiría mostrando el
      // reparto anterior justo cuando se acaba de cambiar.
      { onSuccess: () => destinatarios.refetch() }
    )

  const enviarAhora = async () => {
    setEnviando(true)
    try {
      const resultado = await enviarRecordatorioAhora()
      toast.success(
        resultado.sent > 0
          ? `Se enviaron ${resultado.sent} recordatorios`
          : `No se envió nada: ${resultado.skipped ?? "nadie pendiente"}`
      )
    } catch (error) {
      toast.error("No se pudo enviar", { description: (error as Error).message })
    } finally {
      setEnviando(false)
    }
  }

  if (isLoading || !settings) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recordatorio de registro de tiempos</CardTitle>
        <CardDescription>
          Cada día hábil, a la hora que se fije aquí, cada persona del roster recibe un correo con
          un enlace para registrar en qué se le fue el día. El flujo automático solo pregunta si ya
          es la hora: cambiarla es un clic aquí, no una edición en Power Automate.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
          <div>
            <p className="font-medium">Enviar el recordatorio diario</p>
            <p className="text-sm text-muted-foreground">
              Mientras esté apagado, no sale ningún correo aunque el flujo siga corriendo.
            </p>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>

        <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
          <div>
            <p className="font-medium">Sugerir las reuniones de Outlook</p>
            <p className="text-sm text-muted-foreground">
              El formulario llega con las reuniones del día ya cargadas. De una reunión marcada
              privada se guarda la duración y nunca el asunto. Requiere la app registration en
              Entra ID; si falla, el recordatorio igual sale, solo que en blanco.
            </p>
          </div>
          <Switch checked={calendario} onCheckedChange={setCalendario} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="hora-recordatorio">Hora de envío</Label>
            <Input
              id="hora-recordatorio"
              type="time"
              className="w-40"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Hora de {settings.time_request_timezone}. El correo sale en el primer chequeo
              posterior, así que puede llegar hasta 15 minutos después.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="vigencia-enlace">Vigencia del enlace (horas)</Label>
            <Input
              id="vigencia-enlace"
              type="number"
              min={1}
              max={72}
              className="w-40"
              value={vigencia}
              onChange={(e) => setVigencia(Number(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">
              Pasado ese plazo el enlace deja de abrir. El registro sigue siendo posible desde la
              plataforma.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <Label>Roles que NO reciben el recordatorio</Label>
            {/* El roster lo dictan las cuentas activas
                (*_roster_desde_las_cuentas.sql), así que sin este filtro el
                correo le llega a toda la organización con cuenta — incluida
                gente que no reparte su día entre proyectos de la sábana. */}
            <p className="text-xs text-muted-foreground">
              Quien tenga uno de estos roles queda fuera del envío, aunque esté en el roster del
              mes.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {ASSIGNABLE_ROLES.map((rol) => (
              <button
                key={rol}
                type="button"
                onClick={() => alternarRol(rol)}
                aria-pressed={excluidos.includes(rol)}
              >
                <Badge variant={excluidos.includes(rol) ? "destructive" : "outline"}>
                  {roleLabel[rol]}
                </Badge>
              </button>
            ))}
          </div>

          {destinatarios.data && (
            <p className="text-sm text-muted-foreground">
              Con la configuración guardada, el recordatorio le llega a{" "}
              <span className="font-medium text-foreground">
                {destinatarios.data.filter((d) => !d.excluido).length} de{" "}
                {destinatarios.data.length}
              </span>{" "}
              personas del roster.{" "}
              <button
                type="button"
                className="underline underline-offset-2"
                onClick={() => setVerLista((v) => !v)}
              >
                {verLista ? "Ocultar la lista" : "Ver quiénes"}
              </button>
            </p>
          )}

          {verLista && destinatarios.data && (
            <ul className="flex flex-col gap-1 rounded-lg border p-3 text-sm">
              {destinatarios.data.map((persona) => (
                <li key={persona.email} className="flex items-center justify-between gap-3">
                  <span className={persona.excluido ? "text-muted-foreground line-through" : ""}>
                    {persona.full_name}
                  </span>
                  <span className="text-xs text-muted-foreground">{roleLabel[persona.role]}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label>Días en que se pide</Label>
          <div className="flex gap-1.5">
            {DIAS.map((dia) => (
              <button
                key={dia.value}
                type="button"
                onClick={() => alternarDia(dia.value)}
                aria-pressed={dias.includes(dia.value)}
              >
                <Badge
                  variant={dias.includes(dia.value) ? "default" : "outline"}
                  className="w-9 justify-center"
                >
                  {dia.label}
                </Badge>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={guardar} disabled={updateSettings.isPending}>
              {updateSettings.isPending ? "Guardando…" : "Guardar cambios"}
            </Button>
            {/* Probar el circuito completo sin esperar a la hora. No salta el
                control de duplicados: a quien ya le llegó hoy, no le vuelve a
                llegar por darle a este botón.

                Se mira `settings`, que es lo GUARDADO, y no `enabled`, que es
                lo que está en pantalla. Con el estado local, encender el
                interruptor sin guardar habilitaba el botón y el envío moría
                del otro lado con un "recordatorio desactivado" que nadie
                relacionaba con el cambio sin guardar. */}
            <Button
              variant="outline"
              onClick={enviarAhora}
              disabled={enviando || !settings.time_request_enabled}
            >
              <Send className="size-4" />
              {enviando ? "Enviando…" : "Enviar ahora"}
            </Button>
          </div>

          {/* Un botón deshabilitado sin decir por qué obliga a adivinar. */}
          {!settings.time_request_enabled && (
            <p className="text-xs text-muted-foreground">
              Para poder enviar una prueba, enciende el recordatorio y guarda los cambios.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

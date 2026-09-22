import { useMutation, useQuery } from "@tanstack/react-query"
import { useParams } from "react-router"
import { CalendarCheck, Clock, TriangleAlert } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import TimeLogForm from "@/features/timelog/components/TimeLogForm"
import {
  getTimeLogContext,
  submitTimeLog,
  TimeLogTokenError,
  type TimeLogEntry,
  type TimeLogReceipt,
} from "@/features/timelog/api/timeLogApi"

// Pantalla pública: se abre desde el enlace del correo, SIN sesión. Es la
// única ruta de la aplicación fuera de ProtectedRoute además del login, y lo
// es a propósito — pedir usuario y contraseña a las 4:30 de la tarde para un
// formulario de 30 segundos es, en la práctica, la diferencia entre que el
// equipo registre y que no.

function formatoLargo(iso: string): string {
  // El día llega como "YYYY-MM-DD". Se parte a mano en vez de pasarlo por
  // `new Date`, que lo interpreta como UTC y en Bogotá lo corre un día atrás.
  const [year, month, day] = iso.split("-").map(Number)
  return new Date(year, month - 1, day).toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  })
}

function Marco({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-2xl">{children}</Card>
    </div>
  )
}

export default function RegistroDiarioPage() {
  const { token = "" } = useParams()

  const context = useQuery({
    queryKey: ["time-log", token],
    queryFn: () => getTimeLogContext(token),
    enabled: Boolean(token),
    retry: false,
  })

  const enviar = useMutation<TimeLogReceipt, Error, TimeLogEntry[]>({
    mutationFn: (entries) => submitTimeLog(token, entries),
  })

  if (context.isLoading) {
    return (
      <Marco>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Marco>
    )
  }

  if (context.error) {
    const vencido = context.error instanceof TimeLogTokenError
    return (
      <Marco>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TriangleAlert className="size-5 text-amber-600" />
            {vencido ? "Este enlace ya no sirve" : "No se pudo abrir el registro"}
          </CardTitle>
          <CardDescription>
            {vencido
              ? "Los enlaces de registro vencen el mismo día. Puedes registrar tus horas entrando a la plataforma, o esperar el correo de mañana."
              : context.error.message}
          </CardDescription>
        </CardHeader>
      </Marco>
    )
  }

  if (enviar.data) {
    const { horas_dia, horas_semana } = enviar.data
    return (
      <Marco>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarCheck className="size-5 text-emerald-600" />
            Quedó registrado
          </CardTitle>
          <CardDescription>
            {horas_dia.toFixed(1)} horas hoy. Llevas {horas_semana.toFixed(1)} esta semana.
            ¡Buen descanso!
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Si te falta algo, vuelve a abrir este mismo enlace: el último envío reemplaza al
          anterior, no se suma.
        </CardContent>
      </Marco>
    )
  }

  const data = context.data!
  const horasEnAgenda = data.calendar.reduce((sum, event) => sum + Number(event.hours), 0)

  return (
    <Marco>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="size-5" />
          Hola, {data.person.name.split(" ")[0]}
        </CardTitle>
        <CardDescription>
          ¿En qué se te fue el {formatoLargo(data.date)}?
          {horasEnAgenda > 0
            ? ` Revisé tu calendario y encontré ${horasEnAgenda.toFixed(1)} horas en reuniones.`
            : ""}
          {data.responded_at ? " Ya registraste este día; puedes corregirlo." : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {enviar.error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {enviar.error.message}
          </p>
        )}
        <TimeLogForm
          options={data.options}
          initialEntries={data.entries}
          calendar={data.calendar}
          pending={enviar.isPending}
          onSubmit={(entries) => enviar.mutate(entries)}
        />
      </CardContent>
    </Marco>
  )
}

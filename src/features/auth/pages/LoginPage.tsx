import { useState, type CSSProperties } from "react"
import { Link, useLocation, useNavigate } from "react-router"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import {
  ArrowRight,
  BarChart3,
  CalendarRange,
  Gauge,
  ShieldCheck,
  Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { signInWithPassword } from "@/features/auth/api/authApi"

const schema = z.object({
  email: z.string().min(1, "Ingresa tu correo").email("Correo inválido"),
  password: z.string().min(1, "Ingresa tu contraseña"),
})

type FormValues = z.infer<typeof schema>

// Lo que el panel de marca promete. Son las tres cosas que la herramienta
// realmente resuelve —capacidad, cronograma y control de cambios—, no
// adjetivos: quien entra por primera vez debe reconocer su trabajo aquí.
const HIGHLIGHTS = [
  {
    icon: Gauge,
    title: "Capacidad real del equipo",
    text: "Horas disponibles contra horas asignadas, persona por persona y mes a mes.",
  },
  {
    icon: CalendarRange,
    title: "Cronograma vivo",
    text: "Tareas y fases en una línea de tiempo que se actualiza con el equipo.",
  },
  {
    icon: BarChart3,
    title: "Reportes al instante",
    text: "Distribución por proyecto, exportable y lista para presentar.",
  },
]

// Cinta inferior del panel: se repite dos veces en el marcado para que el
// bucle del marquee no muestre el salto.
const MODULES = [
  "Distribución de trabajo",
  "Cronograma",
  "Proyectos",
  "Personas",
  "Reportes",
  "Historial",
  "Tareas",
  "Meses",
]

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [submitting, setSubmitting] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  })

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true)
    try {
      await signInWithPassword(values.email, values.password)
      const redirectTo = (location.state as { from?: string } | null)?.from ?? "/dashboard"
      navigate(redirectTo, { replace: true })
    } catch (error) {
      toast.error("No se pudo iniciar sesión", {
        description: error instanceof Error ? error.message : "Verifica tus credenciales.",
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="grid min-h-svh lg:grid-cols-[1.15fr_1fr]">
      {/* ── Panel de marca ────────────────────────────────────────────────
          Solo desde lg: en móvil el teclado se come la pantalla y el único
          objetivo es entrar, así que el formulario ocupa todo el ancho. */}
      <section className="surface-brand relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12">
        {/* Capas de fondo, de atrás hacia adelante: rejilla fina, dos halos
            que derivan y un velo oscuro abajo para que el texto del pie se
            lea sobre cualquier posición del gradiente. */}
        <div aria-hidden className="bg-grid pointer-events-none absolute inset-0" />
        <div
          aria-hidden
          className="aurora-blob pointer-events-none -top-24 -left-16 size-[32rem] opacity-40"
          style={{ background: "var(--gradient-orange)" }}
        />
        <div
          aria-hidden
          className="aurora-blob aurora-blob-slow pointer-events-none right-[-8rem] bottom-[-6rem] size-[30rem] opacity-30"
          style={{ background: "var(--gradient-brand)" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/35 to-transparent"
        />

        <div className="relative flex items-center gap-3">
          <div className="relative">
            <div
              aria-hidden
              className="animate-glow absolute inset-0 rounded-2xl blur-lg"
              style={{ background: "var(--gradient-orange)" }}
            />
            <div className="relative flex size-11 items-center justify-center rounded-2xl border border-white/25 bg-white/15 text-base font-bold backdrop-blur-sm">
              DT
            </div>
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">Distribución de Trabajo</span>
            <span className="text-eyebrow text-white/60">CEINFES</span>
          </div>
        </div>

        <div className="relative max-w-lg">
          <div className="reveal inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-medium backdrop-blur-sm">
            <Sparkles className="size-3.5" />
            Planeación del equipo, en un solo lugar
          </div>

          <h1
            className="reveal text-display mt-6 text-5xl font-semibold text-balance xl:text-6xl"
            style={{ "--i": 1 } as CSSProperties}
          >
            Cada hora del equipo,{" "}
            <span className="text-white/70">donde tiene que estar.</span>
          </h1>

          <p
            className="reveal mt-5 text-base leading-relaxed text-white/75"
            style={{ "--i": 2 } as CSSProperties}
          >
            Distribuye la carga del mes, sigue el avance de cada proyecto y detecta la
            sobreasignación antes de que se convierta en un problema.
          </p>

          <ul className="mt-10 flex flex-col gap-5">
            {HIGHLIGHTS.map((item, index) => (
              <li
                key={item.title}
                className="reveal flex items-start gap-4"
                style={{ "--i": index + 3 } as CSSProperties}
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/10 backdrop-blur-sm">
                  <item.icon className="size-4.5" />
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold">{item.title}</span>
                  <span className="text-sm text-white/65">{item.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Cinta de módulos: comunica el alcance de la herramienta sin una
            lista estática que ocuparía media pantalla. */}
        <div className="relative">
          <div className="text-eyebrow mb-3 text-white/50">Módulos</div>
          <div className="marquee-mask overflow-hidden">
            <div className="marquee-track gap-3">
              {[...MODULES, ...MODULES].map((name, index) => (
                <span
                  key={`${name}-${index}`}
                  className="rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-medium whitespace-nowrap backdrop-blur-sm"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Acceso ──────────────────────────────────────────────────────── */}
      <section className="relative flex items-center justify-center overflow-hidden bg-background p-6">
        <div
          aria-hidden
          className="aurora-blob pointer-events-none -top-32 -right-24 size-[26rem] opacity-25 lg:opacity-15"
          style={{ background: "var(--gradient-brand)" }}
        />
        <div
          aria-hidden
          className="aurora-blob aurora-blob-slow pointer-events-none bottom-[-8rem] left-[-6rem] size-[24rem] opacity-20 lg:opacity-10"
          style={{ background: "var(--gradient-orange)" }}
        />
        <div aria-hidden className="bg-dots pointer-events-none absolute inset-0 opacity-40" />

        <Card className="animate-scale-in relative w-full max-w-sm border-gradient shadow-brand-xl">
          <CardHeader>
            {/* En móvil el panel de marca no existe: el logo aquí es lo único
                que identifica a la aplicación, así que solo aparece ahí. */}
            <div
              className="mb-1 flex size-11 items-center justify-center rounded-xl text-base font-bold text-white lg:hidden"
              style={{ background: "var(--gradient-brand)", boxShadow: "var(--sh-purple)" }}
            >
              DT
            </div>
            <CardTitle className="text-2xl">Bienvenido de vuelta</CardTitle>
            <CardDescription>Inicia sesión con tu cuenta corporativa.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Correo</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          autoComplete="email"
                          placeholder="tu@empresa.com"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <FormLabel>Contraseña</FormLabel>
                        <Link
                          to="/forgot-password"
                          className="text-xs text-muted-foreground transition-colors hover:text-primary hover:underline"
                        >
                          ¿Olvidaste tu contraseña?
                        </Link>
                      </div>
                      <FormControl>
                        <Input type="password" autoComplete="current-password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  size="lg"
                  disabled={submitting}
                  className="shine-hover group mt-2 w-full"
                >
                  {submitting ? "Ingresando…" : "Ingresar"}
                  {!submitting && (
                    <ArrowRight className="transition-transform duration-300 group-hover:translate-x-0.5" />
                  )}
                </Button>
              </form>
            </Form>

            <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="size-3.5 text-success" />
              Acceso restringido al equipo de CEINFES
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

import { useEffect, useMemo, useRef } from "react"
import { useLocation, useNavigate } from "react-router"
import { ArrowLeft, ArrowRight, Check, Compass, PartyPopper, X, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSidebar } from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"
import { NAV_ITEMS, SETUP_ITEMS, visibleFor } from "@/lib/navigation"
import { ACCOUNT_TARGET, useOnboardingStore } from "@/stores/onboardingStore"
import { useSessionStore } from "@/stores/sessionStore"
import { roleLabel } from "@/lib/roles"

interface TourStep {
  icon: LucideIcon
  /** Etiqueta corta de sección: dice en qué parte del recorrido va. */
  kicker: string
  title: string
  body: string
  /** Cosas concretas que se hacen en la pantalla del paso. */
  tips: string[]
  /** Ítem de la barra que brilla durante este paso. */
  highlight: string | null
  /** Ruta que se abre al llegar al paso, para leerlo sobre la pantalla real. */
  route: string | null
}

// Recorrido de bienvenida. Se arma con los MISMOS módulos que ve la persona
// (visibleFor sobre su rol), así que un Analista de Tecnología recibe un
// recorrido de tres pasos y no uno que le promete pantallas que no puede
// abrir.
//
// Además de contar, muestra: cada paso de módulo navega a su pantalla y
// resalta su ítem en la barra, de modo que se lee la explicación con la
// pantalla de la que habla a la vista. Al cerrarlo se vuelve a donde estaba
// la persona antes de empezar.
export default function OnboardingTour() {
  const profile = useSessionStore((s) => s.profile)
  const { open, step, close, setStep, setHighlight } = useOnboardingStore()
  const { isMobile, setOpen: setSidebarOpen, setOpenMobile } = useSidebar()
  const navigate = useNavigate()
  const location = useLocation()

  const steps = useMemo<TourStep[]>(() => {
    const role = profile?.role
    const modules = visibleFor(NAV_ITEMS, role)
    const setup = visibleFor(SETUP_ITEMS, role)

    return [
      {
        icon: Compass,
        kicker: "Bienvenida",
        title: `Hola, ${profile?.full_name?.split(" ")[0] ?? ""}`.trim(),
        body: `Esta es la plataforma de Distribución de Trabajo. Entraste como ${
          role ? roleLabel[role] : "usuario"
        }, así que tienes ${modules.length} módulo${
          modules.length === 1 ? "" : "s"
        } en el menú de la izquierda.`,
        tips: [
          "Te vamos a abrir uno por uno y te contamos para qué sirve.",
          "Toma menos de un minuto y puedes salirte cuando quieras.",
        ],
        highlight: null,
        route: null,
      },
      ...modules.map<TourStep>((item, index) => ({
        icon: item.icon,
        kicker: `Módulo ${index + 1} de ${modules.length}`,
        title: item.label,
        body: item.description,
        tips: item.tips,
        highlight: item.to,
        route: item.to,
      })),
      ...(setup.length > 0
        ? [
            {
              icon: SETUP_ITEMS[0].icon,
              kicker: "Configuración",
              title: "Lo que se deja listo una vez",
              body: `${setup
                .map((s) => s.label)
                .join(", ")
                .replace(
                  /, ([^,]*)$/,
                  " y $1"
                )} no están en la barra: viven en el menú de tu cuenta, abajo a la izquierda, porque se entra a ellos para dejar todo listo y no todos los días.`,
              tips: setup.map((s) => `${s.label}: ${s.tips[0] ?? s.description}`),
              highlight: ACCOUNT_TARGET,
              route: null,
            } satisfies TourStep,
          ]
        : []),
      {
        icon: PartyPopper,
        kicker: "Listo",
        title: "Eso es todo",
        body: "Ya sabes dónde está cada cosa. Te dejamos donde estabas antes de empezar.",
        tips: [
          "¿Se te olvidó algo? El recorrido queda en el menú de tu cuenta, como “Ver el recorrido”.",
        ],
        highlight: null,
        route: null,
      },
    ]
  }, [profile])

  const current = steps[Math.min(step, steps.length - 1)]
  const isLast = step >= steps.length - 1

  // La ruta desde la que se lanzó el recorrido, para devolver a la persona
  // ahí al terminar: pasear por seis módulos y quedar tirado en el último es
  // justo lo que hacía difícil entender dónde estaba uno.
  const routeBeforeTour = useRef<string | null>(null)
  useEffect(() => {
    if (open && routeBeforeTour.current === null) {
      routeBeforeTour.current = location.pathname
    }
  }, [open, location.pathname])

  const finish = () => {
    const back = routeBeforeTour.current
    routeBeforeTour.current = null
    close()
    if (back && back !== location.pathname) navigate(back)
  }

  // El resaltado vive en el store para que lo lea el Sidebar. Se sincroniza
  // acá porque este componente es el que sabe en qué paso va el recorrido.
  useEffect(() => {
    if (!open) return
    setHighlight(current?.highlight ?? null)
  }, [open, current, setHighlight])

  // Cada paso de módulo abre su pantalla: se explica sobre lo real, no sobre
  // una descripción a ciegas. Solo al cambiar de paso — si alguien se va a
  // otra pantalla en mitad de un paso, el recorrido no lo arrastra de vuelta.
  const navigatedForStep = useRef<number | null>(null)
  useEffect(() => {
    if (!open) {
      navigatedForStep.current = null
      return
    }
    if (navigatedForStep.current === step) return
    navigatedForStep.current = step
    const route = current?.route
    if (route) navigate(route)
  }, [open, step, current, navigate])

  // Con la barra colapsada (o cerrada en móvil) el resaltado no se vería:
  // se abre al arrancar el recorrido para que haya algo que señalar.
  useEffect(() => {
    if (!open) return
    if (isMobile) setOpenMobile(true)
    else setSidebarOpen(true)
  }, [open, isMobile, setOpenMobile, setSidebarOpen])

  if (!open || !current) return null

  const Icon = current.icon

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Recorrido de bienvenida"
      className="animate-scale-in fixed right-4 bottom-4 z-50 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border bg-popover shadow-brand-xl"
    >
      <div className="h-1 w-full bg-muted">
        <div
          className="h-full transition-all duration-500"
          style={{
            width: `${((step + 1) / steps.length) * 100}%`,
            background: "var(--gradient-orange)",
          }}
        />
      </div>

      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-start gap-3">
          <div
            aria-hidden
            className="grid size-10 shrink-0 place-content-center rounded-xl text-white"
            style={{ background: "var(--gradient-brand)", boxShadow: "var(--sh-purple)" }}
          >
            <Icon className="size-5" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-eyebrow text-muted-foreground">
              {current.kicker} · paso {step + 1} de {steps.length}
            </span>
            <h2 className="text-base leading-tight font-semibold">{current.title}</h2>
          </div>
          <Button variant="ghost" size="icon-sm" aria-label="Cerrar el recorrido" onClick={finish}>
            <X />
          </Button>
        </div>

        <p className="text-sm text-muted-foreground">{current.body}</p>

        {current.tips.length > 0 && (
          <ul className="flex flex-col gap-1.5 rounded-xl bg-muted/60 p-3">
            {current.tips.map((tip) => (
              <li key={tip} className="flex items-start gap-2 text-sm">
                <Check className="mt-0.5 size-3.5 shrink-0 text-primary" />
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center justify-between gap-2 pt-1">
          {/* Salir tiene que ser tan visible como seguir: una X en la esquina
              se lee como "cerrar por error", no como "esto es opcional". */}
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={finish}
          >
            {isLast ? "Cerrar" : "Saltar recorrido"}
          </Button>
          <div className="flex items-center gap-1.5">
            {step > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setStep(step - 1)}>
                <ArrowLeft /> Atrás
              </Button>
            )}
            <Button
              size="sm"
              className="btn-press"
              onClick={() => (isLast ? finish() : setStep(step + 1))}
            >
              {isLast ? "Empezar a trabajar" : "Siguiente"}
              {!isLast && <ArrowRight />}
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-center gap-1" aria-hidden>
          {steps.map((_, i) => (
            <button
              key={i}
              type="button"
              tabIndex={-1}
              onClick={() => setStep(i)}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === step ? "w-4 bg-primary" : "w-1.5 bg-muted-foreground/25"
              )}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

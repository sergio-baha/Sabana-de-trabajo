import { useEffect, useMemo } from "react"
import { ArrowLeft, ArrowRight, Compass, PartyPopper, X, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSidebar } from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"
import { NAV_ITEMS, SETUP_ITEMS, visibleFor } from "@/lib/navigation"
import { ACCOUNT_TARGET, useOnboardingStore } from "@/stores/onboardingStore"
import { useSessionStore } from "@/stores/sessionStore"
import { roleLabel } from "@/lib/roles"

interface TourStep {
  icon: LucideIcon
  title: string
  body: string
  /** Ítem de la barra que brilla durante este paso. */
  highlight: string | null
}

// Recorrido de bienvenida. Se arma con los MISMOS módulos que ve la persona
// (visibleFor sobre su rol), así que un Analista de Tecnología recibe un
// recorrido de tres pasos y no uno que le promete pantallas que no puede
// abrir.
export default function OnboardingTour() {
  const profile = useSessionStore((s) => s.profile)
  const { open, step, close, setStep, setHighlight } = useOnboardingStore()
  const { isMobile, setOpen: setSidebarOpen, setOpenMobile } = useSidebar()

  const steps = useMemo<TourStep[]>(() => {
    const role = profile?.role
    const modules = visibleFor(NAV_ITEMS, role)
    const setup = visibleFor(SETUP_ITEMS, role)

    return [
      {
        icon: Compass,
        title: `Te damos la bienvenida, ${profile?.full_name?.split(" ")[0] ?? ""}`.trim(),
        body: `Esta es la plataforma de Distribución de Trabajo. Entraste como ${
          role ? roleLabel[role] : "usuario"
        }, así que verás ${modules.length} módulo${modules.length === 1 ? "" : "s"} en el menú. Te los explicamos en un minuto — puedes salirte cuando quieras.`,
        highlight: null,
      },
      ...modules.map<TourStep>((item) => ({
        icon: item.icon,
        title: item.label,
        body: item.description,
        highlight: item.to,
      })),
      ...(setup.length > 0
        ? [
            {
              icon: SETUP_ITEMS[0].icon,
              title: "Configuración del espacio",
              body: `Debajo de tu nombre, en el menú de la cuenta, están ${setup
                .map((s) => s.label)
                .join(", ")
                .replace(/, ([^,]*)$/, " y $1")}. Se usan para dejar todo listo, no todos los días, por eso no ocupan lugar en la barra.`,
              highlight: ACCOUNT_TARGET,
            } satisfies TourStep,
          ]
        : []),
      {
        icon: PartyPopper,
        title: "Listo para empezar",
        body: "Eso es todo. Si en algún momento quieres repasarlo, el recorrido queda guardado en el menú de tu cuenta, como “Ver el recorrido”.",
        highlight: null,
      },
    ]
  }, [profile])

  const current = steps[Math.min(step, steps.length - 1)]
  const isLast = step >= steps.length - 1

  // El resaltado vive en el store para que lo lea el Sidebar. Se sincroniza
  // acá porque este componente es el que sabe en qué paso va el recorrido.
  useEffect(() => {
    if (!open) return
    setHighlight(current?.highlight ?? null)
  }, [open, current, setHighlight])

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
      className="animate-scale-in fixed right-4 bottom-4 z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border bg-popover shadow-brand-xl"
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
              Paso {step + 1} de {steps.length}
            </span>
            <h2 className="text-base leading-tight font-semibold">{current.title}</h2>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Cerrar el recorrido"
            onClick={close}
          >
            <X />
          </Button>
        </div>

        <p className="text-sm text-muted-foreground">{current.body}</p>

        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-1" aria-hidden>
            {steps.map((_, i) => (
              <span
                key={i}
                className={cn(
                  "size-1.5 rounded-full transition-colors",
                  i === step ? "bg-primary" : "bg-muted-foreground/25"
                )}
              />
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            {step > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setStep(step - 1)}>
                <ArrowLeft /> Atrás
              </Button>
            )}
            <Button size="sm" className="shine-hover" onClick={() => (isLast ? close() : setStep(step + 1))}>
              {isLast ? "Empezar" : "Siguiente"}
              {!isLast && <ArrowRight />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

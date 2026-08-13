import type { CSSProperties, ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import AnimatedNumber from "@/components/shared/AnimatedNumber"

export interface HeroStat {
  label: string
  /** Número (se anima al entrar) o texto ya formateado. */
  value: number | string
  suffix?: string
  decimals?: number
}

interface PageHeaderProps {
  icon: LucideIcon
  /** Etiqueta corta en mayúsculas sobre el título: dice en qué módulo estás. */
  eyebrow: string
  title: string
  description?: string
  /** Cifras clave del módulo, en la misma banda del título. */
  stats?: HeroStat[]
  /** Botones de acción principal, arriba a la derecha. */
  actions?: ReactNode
  /** Enlace de "volver", encima del título (páginas de detalle). */
  backLink?: ReactNode
}

// Encabezado de módulo. Sustituye el `<h1>` plano que abría cada página:
// además de la identidad de marca, sube las cifras clave al primer golpe de
// vista para que la pantalla se pueda leer sin recorrer la tabla entera —
// que era el problema real de densidad, no la falta de color.
export default function PageHeader({
  icon: Icon,
  eyebrow,
  title,
  description,
  stats,
  actions,
  backLink,
}: PageHeaderProps) {
  return (
    <header className="page-hero animate-fade-in">
      {backLink && <div className="mb-3">{backLink}</div>}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          {/* Ícono del módulo en un cuadro de tinte naranja: es el acento de
              marca del encabezado, ahora que la banda es superficie clara. */}
          <div
            aria-hidden
            className="hidden size-12 shrink-0 place-content-center rounded-xl bg-accent text-primary sm:grid"
          >
            <Icon className="size-6" />
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-eyebrow text-muted-foreground">{eyebrow}</span>
            <h1 className="text-display truncate text-xl font-extrabold sm:text-2xl">{title}</h1>
            {description && (
              <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
            )}
          </div>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>

      {stats && stats.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-x-8 gap-y-3 border-t border-border pt-4">
          {stats.map((stat, index) => (
            <div
              key={stat.label}
              className="reveal flex flex-col"
              style={{ "--i": index } as CSSProperties}
            >
              {/* Cifra destacada de Experia: 22–30px, peso 900 */}
              <span className="text-display text-2xl font-black tabular-nums">
                {typeof stat.value === "number" ? (
                  <AnimatedNumber
                    value={stat.value}
                    decimals={stat.decimals ?? 0}
                    suffix={stat.suffix}
                  />
                ) : (
                  stat.value
                )}
              </span>
              <span className="text-eyebrow text-muted-foreground">{stat.label}</span>
            </div>
          ))}
        </div>
      )}
    </header>
  )
}

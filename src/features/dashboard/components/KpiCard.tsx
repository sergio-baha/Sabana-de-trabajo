import type { ReactNode } from "react"
import { Card, CardContent } from "@/components/ui/card"
import AnimatedNumber from "@/components/shared/AnimatedNumber"
import { cn } from "@/lib/utils"

export type KpiTone = "default" | "brand" | "success" | "warning" | "danger"

interface KpiCardProps {
  label: string
  value: number
  icon: ReactNode
  /** Texto de apoyo bajo el número (ej. "de 833 h disponibles"). */
  hint?: string
  suffix?: string
  decimals?: number
  tone?: KpiTone
  /** Índice para la entrada escalonada (stagger-item). */
  index?: number
}

// El ícono es lo único que lleva color: neutro cuando el dato es puramente
// informativo, y de estado (danger/warning) solo cuando el número en sí
// significa un problema. Nunca color decorativo sin significado.
const TONE_CLASS: Record<KpiTone, string> = {
  default: "bg-muted text-muted-foreground",
  brand: "text-white",
  success: "bg-success-muted text-success",
  warning: "bg-warning-muted text-warning",
  danger: "bg-danger-muted text-danger",
}

export default function KpiCard({
  label,
  value,
  icon,
  hint,
  suffix,
  decimals = 0,
  tone = "default",
  index = 0,
}: KpiCardProps) {
  return (
    <Card
      className="stagger-item card-lift overflow-hidden"
      style={{ "--i": index } as React.CSSProperties}
    >
      <CardContent className="flex items-center gap-3">
        <div
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-xl",
            TONE_CLASS[tone]
          )}
          style={
            tone === "brand"
              ? { background: "var(--gradient-brand)", boxShadow: "var(--sh-purple)" }
              : undefined
          }
        >
          {icon}
        </div>
        <div className="flex min-w-0 flex-col">
          <span className="text-eyebrow truncate text-muted-foreground">{label}</span>
          <span className="text-display text-2xl font-semibold">
            <AnimatedNumber value={value} decimals={decimals} suffix={suffix} />
          </span>
          {hint && <span className="truncate text-xs text-muted-foreground">{hint}</span>}
        </div>
      </CardContent>
    </Card>
  )
}

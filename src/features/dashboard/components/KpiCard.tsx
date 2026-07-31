import type { ReactNode } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface KpiCardProps {
  label: string
  value: string | number
  icon: ReactNode
  tone?: "default" | "success" | "warning" | "danger"
}

const TONE_CLASS: Record<NonNullable<KpiCardProps["tone"]>, string> = {
  default: "bg-muted text-muted-foreground",
  success: "bg-success-muted text-success",
  warning: "bg-warning-muted text-warning",
  danger: "bg-danger-muted text-danger",
}

// Tile de KPI: etiqueta muted + número grande (tabular-nums), ícono con
// acento de color solo cuando el dato representa un estado (sobreasignación,
// disponibilidad) — nunca color decorativo sin significado.
export default function KpiCard({ label, value, icon, tone = "default" }: KpiCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3">
        <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", TONE_CLASS[tone])}>
          {icon}
        </div>
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground">{label}</span>
          <span className="text-2xl font-semibold tabular-nums">{value}</span>
        </div>
      </CardContent>
    </Card>
  )
}

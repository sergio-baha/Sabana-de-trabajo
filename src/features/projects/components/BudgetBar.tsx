import { cn } from "@/lib/utils"
import { budgetTone, consumedPct } from "@/features/projects/lib/projectLabels"

interface BudgetBarProps {
  label: string
  /** Lo consumido, ya sea en horas o en dinero. */
  spent: number
  /** El techo. `null` = sin presupuesto definido. */
  budget: number | null | undefined
  /** Cómo se escribe cada cifra (formatMoney o formatHours). */
  format: (value: number | null | undefined) => string
  className?: string
}

const TONE_BAR: Record<ReturnType<typeof budgetTone>, string> = {
  neutral: "bg-muted-foreground/30",
  ok: "bg-success",
  warn: "bg-warning",
  over: "bg-danger",
}

const TONE_TEXT: Record<ReturnType<typeof budgetTone>, string> = {
  neutral: "text-muted-foreground",
  ok: "text-muted-foreground",
  warn: "text-warning",
  over: "text-danger",
}

/**
 * Barra de consumo contra presupuesto.
 *
 * Sin presupuesto definido no pinta barra: muestra solo lo consumido. Una
 * barra al 0% se leería como "no has gastado", que es una afirmación
 * distinta de "no hay techo contra el cual medir".
 */
export default function BudgetBar({
  label,
  spent,
  budget,
  format,
  className,
}: BudgetBarProps) {
  const pct = consumedPct(spent, budget)
  const tone = budgetTone(pct)
  const hasBudget = pct !== null

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-eyebrow text-muted-foreground">{label}</span>
        <span className="text-sm font-semibold tabular-nums">
          {format(spent)}
          {hasBudget && (
            <span className="font-normal text-muted-foreground"> / {format(budget)}</span>
          )}
        </span>
      </div>

      {hasBudget ? (
        <>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            {/* La barra se limita al 100% de ancho aunque el consumo lo
                supere: el sobregiro se comunica con el color y la cifra, no
                desbordando la caja. */}
            <div
              className={cn("animate-bar h-full rounded-full", TONE_BAR[tone])}
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
          <div className={cn("text-xs tabular-nums", TONE_TEXT[tone])}>
            {pct.toFixed(0)}% consumido
            {tone === "over" && ` · sobregiro de ${format(spent - (budget as number))}`}
          </div>
        </>
      ) : (
        <div className="text-xs text-muted-foreground">Sin presupuesto definido</div>
      )}
    </div>
  )
}

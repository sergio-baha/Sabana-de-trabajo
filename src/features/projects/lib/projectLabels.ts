import type { PhaseStatus, ProjectCategory } from "@/types/database.types"

// Las tres categorías de proyecto. "Emergente" es trabajo que apareció sin
// estar planeado: consume horas igual que un proyecto, pero se navega aparte
// para que no compita con el portafolio.
export const CATEGORY_LABEL: Record<ProjectCategory, string> = {
  proyecto: "Proyecto",
  institucional: "Tiempo institucional",
  emergente: "Emergente",
}

export const PHASE_STATUS_LABEL: Record<PhaseStatus, string> = {
  pendiente: "Pendiente",
  en_curso: "En curso",
  completada: "Completada",
}

export const PHASE_STATUS_OPTIONS = Object.entries(PHASE_STATUS_LABEL) as [
  PhaseStatus,
  string,
][]

// Clases del punto de estado de una fase. Se reutilizan los tokens
// semánticos de la grilla (success/warning) en vez de los de marca: acá
// "completada" es un estado, no identidad visual.
export const PHASE_STATUS_DOT: Record<PhaseStatus, string> = {
  pendiente: "bg-muted-foreground/40",
  en_curso: "bg-warning",
  completada: "bg-success",
}

// Los montos se muestran sin decimales: son presupuestos en pesos, donde los
// centavos son ruido. El dato sí los guarda (numeric(14,2)) — esto es
// presentación, no redondeo del valor.
export function formatMoney(amount: number | null | undefined, currency = "COP") {
  if (amount === null || amount === undefined) return "—"
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatHours(hours: number | null | undefined) {
  if (hours === null || hours === undefined) return "—"
  // Las horas sí llevan decimal cuando lo tienen (media hora es media hora),
  // pero no se fuerza ",00" en los enteros.
  return `${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 }).format(hours)} h`
}

// Porcentaje consumido. Devuelve null cuando no hay presupuesto definido —
// que es distinto de 0%: sin techo no hay nada contra qué medir, y la UI
// debe mostrar un guion en vez de una barra vacía que sugiere "no has
// gastado nada".
export function consumedPct(spent: number, budget: number | null | undefined) {
  if (budget === null || budget === undefined || budget <= 0) return null
  return (spent / budget) * 100
}

// Umbrales de alerta del consumo. 90% es aviso y >100% es sobregiro; por
// debajo no se pinta nada para que el color signifique algo cuando aparece.
export function budgetTone(pct: number | null) {
  if (pct === null) return "neutral" as const
  if (pct > 100) return "over" as const
  if (pct >= 90) return "warn" as const
  return "ok" as const
}

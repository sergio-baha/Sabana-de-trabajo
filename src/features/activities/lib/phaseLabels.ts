import type { ActivityPhase } from "@/types/database.types"

// Fases de la metodología de innovación (spec-planificador-horas-mensual.md).
export const PHASE_LABELS: Record<ActivityPhase, string> = {
  descubrir: "Descubrir",
  definir: "Definir",
  desarrollar: "Desarrollar",
  producto: "Producto",
  entregar: "Entregar",
}

export const PHASE_OPTIONS = Object.entries(PHASE_LABELS) as [ActivityPhase, string][]

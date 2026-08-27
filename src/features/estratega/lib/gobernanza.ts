import type { Database } from "@/types/database.types"

export type EntregaEstado = Database["public"]["Enums"]["estratega_entrega_estado"]
export type Celula = Database["public"]["Enums"]["estratega_celula"]
export type Fase = Database["public"]["Enums"]["estratega_fase"]

// ── Períodos ────────────────────────────────────────────────────────────
// El origen guardaba el mes como texto ("MARZO") y necesitaba un arreglo con
// los doce nombres solo para poder ordenarlos. Aquí el mes es un número: se
// ordena solo y esta tabla es únicamente para mostrarlo.
export const MES_LABEL = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
] as const

export const periodoLabel = (anio: number, mes: number) =>
  `${MES_LABEL[mes - 1] ?? mes} ${anio}`

/** Clave estable de un período, para selects y agrupaciones. */
export const periodoKey = (anio: number, mes: number) =>
  `${anio}-${String(mes).padStart(2, "0")}`

export const parsePeriodoKey = (key: string) => {
  const [anio, mes] = key.split("-")
  return { anio: Number(anio), mes: Number(mes) }
}

// ── Dinero ──────────────────────────────────────────────────────────────
// Pesos colombianos sin decimales: son cifras de millones y el centavo no
// significa nada aquí. Mismo formato que el dashboard de origen.
const copFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
})

export const formatCOP = (valor: number) => copFormatter.format(valor)

/** Abreviatura para ejes de gráfica, donde no cabe la cifra completa. */
export const formatCOPCorto = (valor: number) =>
  valor >= 1_000_000 ? `$${(valor / 1_000_000).toFixed(1)}M` : `$${Math.round(valor / 1000)}K`

// ── Semáforo de ejecución presupuestal ──────────────────────────────────
// Los cortes son los del tablero original y no se negocian: es el lenguaje
// con el que el equipo directivo ya lee estas cifras.
//
//   > 100 %  azul     sobre-ejecución (gastó más de lo presupuestado)
//   ≥  90 %  verde    ejecución adecuada
//   ≥  70 %  amarillo requiere seguimiento
//   >   0 %  rojo     atención requerida
//     nada   gris     sin ejecución
//
// La sobre-ejecución va en AZUL y no en rojo a propósito: no es un error, es
// una decisión de gasto que alguien tiene que revisar.
export type SemaforoTono = "sobre" | "bien" | "seguimiento" | "atencion" | "sin"

export interface Semaforo {
  tono: SemaforoTono
  label: string
  /** Token de color del sistema, para fondo de barra y punto. */
  color: string
  /** Clases de la insignia. */
  badge: string
}

const SEMAFOROS: Record<SemaforoTono, Semaforo> = {
  sobre: {
    tono: "sobre",
    label: "Sobre-ejecución",
    color: "var(--viz-1)",
    badge: "bg-[color-mix(in_oklch,var(--viz-1)_15%,transparent)] text-[var(--viz-1)]",
  },
  bien: {
    tono: "bien",
    label: "Ejecución adecuada",
    color: "var(--success)",
    badge: "bg-success-muted text-success",
  },
  seguimiento: {
    tono: "seguimiento",
    label: "Requiere seguimiento",
    color: "var(--warning)",
    badge: "bg-warning-muted text-warning",
  },
  atencion: {
    tono: "atencion",
    label: "Atención requerida",
    color: "var(--danger)",
    badge: "bg-danger-muted text-danger",
  },
  sin: {
    tono: "sin",
    label: "Sin ejecución",
    color: "var(--muted-foreground)",
    badge: "bg-muted text-muted-foreground",
  },
}

export function semaforoEjecucion(porcentaje: number): Semaforo {
  if (porcentaje > 100) return SEMAFOROS.sobre
  if (porcentaje >= 90) return SEMAFOROS.bien
  if (porcentaje >= 70) return SEMAFOROS.seguimiento
  if (porcentaje > 0) return SEMAFOROS.atencion
  return SEMAFOROS.sin
}

export const porcentajeEjecucion = (presupuestado: number, ejecutado: number) =>
  presupuestado > 0 ? (ejecutado / presupuestado) * 100 : 0

// ── Estados de entregable ───────────────────────────────────────────────
// `aplazado` es el estado que el Excel escribía como el nombre del mes al que
// se corrió el compromiso, y que el dashboard original terminaba pintando de
// gris por un mapa de colores redeclarado. Aquí tiene nombre y color propios.
export const ESTADO_LABEL: Record<EntregaEstado, string> = {
  entregado: "Entregado",
  en_proceso: "En proceso",
  no_entregado: "No entregado",
  detenido: "Detenido",
  aplazado: "Aplazado",
}

/** Color de cada estado en la dona y en las píldoras de la tabla. */
export const ESTADO_COLOR: Record<EntregaEstado, string> = {
  entregado: "var(--success)",
  en_proceso: "var(--warning)",
  no_entregado: "var(--danger)",
  detenido: "var(--viz-1)",
  aplazado: "var(--viz-7)",
}

export const ESTADO_BADGE: Record<EntregaEstado, string> = {
  entregado: "bg-success-muted text-success",
  en_proceso: "bg-warning-muted text-warning",
  no_entregado: "bg-danger-muted text-danger",
  detenido: "bg-[color-mix(in_oklch,var(--viz-1)_15%,transparent)] text-[var(--viz-1)]",
  aplazado: "bg-[color-mix(in_oklch,var(--viz-7)_15%,transparent)] text-[var(--viz-7)]",
}

export const ESTADOS: EntregaEstado[] = [
  "entregado",
  "en_proceso",
  "no_entregado",
  "detenido",
  "aplazado",
]

/** Etiqueta de "sin estado" (las filas que llegaron en blanco del Excel). */
export const SIN_ESTADO_LABEL = "Sin estado"

// ── Pipeline ────────────────────────────────────────────────────────────
export const CELULA_LABEL: Record<Celula, string> = {
  evaluacion: "Evaluación",
  gestion_academica: "Gestión Académica",
  sostenibilidad: "Sostenibilidad",
}

export const CELULAS: Celula[] = ["evaluacion", "gestion_academica", "sostenibilidad"]

export const FASES: Fase[] = ["descubrir", "definir", "desarrollar", "entregar"]

export const FASE_LABEL: Record<Fase, string> = {
  descubrir: "Descubrir",
  definir: "Definir",
  desarrollar: "Desarrollar",
  entregar: "Entregar",
}

/** Numeración F1–F4 del Doble Diamante, como la nombra el equipo. */
export const FASE_CORTA: Record<Fase, string> = {
  descubrir: "F1",
  definir: "F2",
  desarrollar: "F3",
  entregar: "F4",
}

export const FASE_COLOR: Record<Fase, string> = {
  descubrir: "var(--viz-1)",
  definir: "var(--viz-7)",
  desarrollar: "var(--primary)",
  entregar: "var(--success)",
}

// ── Urgencia de lanzamiento (SLA) ───────────────────────────────────────
// Cuatro estados, en el orden en que hay que mirarlos:
//   vencido   la fecha ya pasó y todavía faltan entregables
//   riesgo    quedan 30 días o menos
//   lanzado   las cuatro fases al 100 %
//   en_fecha  el resto
//
// "Lanzado" gana sobre "vencido": un producto completo no está en falta
// aunque haya salido tarde — ya salió.
export type Urgencia = "vencido" | "riesgo" | "lanzado" | "en_fecha"

export interface EstadoUrgencia {
  codigo: Urgencia
  label: string
  /** Días que faltan para la fecha límite; negativo si ya pasó. */
  dias: number
  badge: string
  color: string
}

export const URGENCIA_LABEL: Record<Urgencia, string> = {
  vencido: "Vencido",
  riesgo: "Riesgo alto",
  lanzado: "Lanzado",
  en_fecha: "En progreso",
}

/** Peso para ordenar por "mayor urgencia primero". */
const URGENCIA_PESO: Record<Urgencia, number> = {
  vencido: 4,
  riesgo: 3,
  en_fecha: 2,
  lanzado: 1,
}

export const pesoUrgencia = (codigo: Urgencia) => URGENCIA_PESO[codigo]

export function calcularUrgencia(
  fechaLimite: string,
  hechos: number,
  totales: number,
  hoy = new Date()
): EstadoUrgencia {
  // La fecha viene como 'YYYY-MM-DD'. Se le pega la hora local a propósito:
  // `new Date('2026-03-16')` se interpreta como UTC y en Colombia (UTC-5)
  // retrocede al día 15, corriendo todos los vencimientos un día.
  const limite = new Date(`${fechaLimite}T00:00:00`)
  const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
  const dias = Math.ceil((limite.getTime() - inicioHoy.getTime()) / 86_400_000)

  if (totales > 0 && hechos >= totales) {
    return {
      codigo: "lanzado",
      label: URGENCIA_LABEL.lanzado,
      dias,
      badge: "bg-success-muted text-success",
      color: "var(--success)",
    }
  }
  if (dias < 0) {
    return {
      codigo: "vencido",
      label: `SLA vencido · ${Math.abs(dias)} d`,
      dias,
      badge: "bg-danger-muted text-danger",
      color: "var(--danger)",
    }
  }
  if (dias <= 30) {
    return {
      codigo: "riesgo",
      label: `Riesgo · ${dias} d`,
      dias,
      badge: "bg-accent text-accent-foreground",
      color: "var(--primary)",
    }
  }
  return {
    codigo: "en_fecha",
    label: `En fecha · ${dias} d`,
    dias,
    badge: "bg-[color-mix(in_oklch,var(--viz-1)_15%,transparent)] text-[var(--viz-1)]",
    color: "var(--viz-1)",
  }
}

/**
 * El texto del panel de diagnóstico del detalle de producto. Son reglas, no
 * un modelo: el mismo estado siempre dice lo mismo, y por eso se puede
 * confiar en él para tomar una decisión.
 */
export function diagnostico(estado: EstadoUrgencia, porcentaje: number) {
  switch (estado.codigo) {
    case "vencido":
      return {
        titulo: "Alerta crítica · fuera de SLA",
        texto: `La fecha límite pasó hace ${Math.abs(estado.dias)} días y el producto va en ${porcentaje}% sin completar los entregables comprometidos. Requiere decisión gerencial: mover la fecha o recortar el alcance.`,
      }
    case "riesgo":
      return {
        titulo: "Ventana crítica · acción requerida",
        texto: `Quedan ${estado.dias} días para el lanzamiento y el avance va en ${porcentaje}%. Conviene concentrar el esfuerzo en la fase con menor progreso.`,
      }
    case "lanzado":
      return {
        titulo: "Producto lanzado · 100% certificado",
        texto:
          "Las cuatro fases del Doble Diamante están completas. El producto está activo en el mercado.",
      }
    default:
      return {
        titulo: "En progreso · dentro de fecha",
        texto: `Quedan ${estado.dias} días de margen con un avance de ${porcentaje}%. Mantener la certificación continua de entregables.`,
      }
  }
}

/**
 * Un gestor elegible en los formularios: el nombre que se guarda y, si tiene
 * cuenta en la plataforma, el perfil con el que se vincula la fila.
 */
export interface GestorOption {
  nombre: string
  profileId: string | null
}

/** Iniciales para el avatar de un gestor. Mismo criterio que el AppShell. */
export function inicialesDe(nombre: string) {
  const partes = nombre.trim().split(/\s+/)
  return (
    (partes[0]?.[0] ?? "").concat(partes.length > 1 ? (partes[partes.length - 1][0] ?? "") : "")
      .toUpperCase() || "?"
  )
}

/**
 * Color de avatar estable por nombre. Determinístico —el mismo gestor siempre
 * sale del mismo color, en cualquier pantalla y sesión— y sacado de la paleta
 * de gráficas del sistema, no de una lista suelta.
 */
export function colorDeGestor(nombre: string) {
  let hash = 0
  for (let i = 0; i < nombre.length; i += 1) {
    hash = (hash * 31 + nombre.charCodeAt(i)) % 997
  }
  return `var(--viz-${(hash % 8) + 1})`
}

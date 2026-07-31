import { useEffect, useState } from "react"
import AnimatedNumber from "@/components/shared/AnimatedNumber"

interface UtilizationGaugeProps {
  /** Porcentaje 0–100+ (puede pasarse de 100 si el equipo está sobreasignado). */
  percent: number
  size?: number
}

// Donut SVG en vez de recharts: es un solo arco, no justifica cargar la
// librería de gráficos en el chunk del Dashboard (recharts ya viaja en el de
// Reportes). El arco se anima con stroke-dashoffset, que el navegador
// interpola en el compositor — más fluido que redibujar un path.
export default function UtilizationGauge({ percent, size = 168 }: UtilizationGaugeProps) {
  const stroke = 14
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  // El arco se llena hasta 100% como máximo; el exceso se comunica con el
  // color y el número, no dando más de una vuelta (sería ilegible).
  const clamped = Math.max(0, Math.min(percent, 100))

  const [drawn, setDrawn] = useState(0)
  useEffect(() => {
    const id = requestAnimationFrame(() => setDrawn(clamped))
    return () => cancelAnimationFrame(id)
  }, [clamped])

  const strokeColor =
    percent > 100 ? "var(--danger)" : percent >= 95 ? "var(--success)" : "var(--warning)"

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - (drawn / 100) * circumference}
          style={{ transition: "stroke-dashoffset 1.1s var(--ease-out), stroke 0.3s var(--ease)" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-3xl font-semibold">
          <AnimatedNumber value={percent} suffix="%" />
        </span>
        <span className="text-xs text-muted-foreground">utilización</span>
      </div>
    </div>
  )
}

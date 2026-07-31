import { useEffect, useRef, useState } from "react"

interface AnimatedNumberProps {
  value: number
  /** Duración del conteo en ms. */
  duration?: number
  decimals?: number
  suffix?: string
}

const prefersReducedMotion = () => {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches
  } catch {
    return false
  }
}

// Conteo animado hasta el valor final. Anima también cuando el valor cambia
// (no solo al montar), así una edición en la grilla se ve "subir" el KPI en
// el Dashboard en vez de saltar de golpe. Respeta prefers-reduced-motion:
// en ese caso pinta el número final directo, sin animación.
export default function AnimatedNumber({
  value,
  duration = 900,
  decimals = 0,
  suffix = "",
}: AnimatedNumberProps) {
  const [display, setDisplay] = useState(() => (prefersReducedMotion() ? value : 0))
  const fromRef = useRef(0)
  const frameRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (prefersReducedMotion()) {
      setDisplay(value)
      return
    }

    const from = fromRef.current
    const delta = value - from
    if (delta === 0) return

    const start = performance.now()
    // easeOutExpo — arranca rápido y se asienta suave, igual que --ease-out.
    const easeOutExpo = (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t))

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1)
      const current = from + delta * easeOutExpo(progress)
      setDisplay(current)
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick)
      } else {
        fromRef.current = value
      }
    }

    frameRef.current = requestAnimationFrame(tick)
    return () => {
      if (frameRef.current !== undefined) cancelAnimationFrame(frameRef.current)
      fromRef.current = value
    }
  }, [value, duration])

  return (
    <span className="tabular-nums">
      {display.toLocaleString("es-CO", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  )
}

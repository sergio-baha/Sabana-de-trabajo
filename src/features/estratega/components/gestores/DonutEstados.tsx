import { Cell, Pie, PieChart } from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  ESTADO_COLOR,
  ESTADO_LABEL,
  SIN_ESTADO_LABEL,
  type EntregaEstado,
} from "@/features/estratega/lib/gobernanza"

export interface ConteoEstado {
  estado: EntregaEstado | null
  total: number
}

const chartConfig: ChartConfig = { total: { label: "Entregables" } }

const colorDe = (estado: EntregaEstado | null) =>
  estado ? ESTADO_COLOR[estado] : "var(--muted-foreground)"

const labelDe = (estado: EntregaEstado | null) =>
  estado ? ESTADO_LABEL[estado] : SIN_ESTADO_LABEL

// Distribución de los entregables por estado. La cifra del centro es el total
// del filtro activo: sin ella hay que sumar la leyenda a ojo para saber sobre
// cuántos compromisos se está mirando el reparto.
export default function DonutEstados({ conteos }: { conteos: ConteoEstado[] }) {
  const total = conteos.reduce((suma, c) => suma + c.total, 0)

  if (total === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Sin entregables para este filtro.
      </p>
    )
  }

  const data = conteos.map((c) => ({
    name: labelDe(c.estado),
    total: c.total,
    color: colorDe(c.estado),
  }))

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-52">
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
            <Pie
              data={data}
              dataKey="total"
              nameKey="name"
              innerRadius="66%"
              outerRadius="94%"
              paddingAngle={2}
              stroke="var(--card)"
              strokeWidth={3}
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
        <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
          <span className="text-display text-2xl font-black tabular-nums">{total}</span>
          <span className="text-eyebrow text-muted-foreground">Total</span>
        </div>
      </div>

      <ul className="grid grid-cols-2 gap-x-4 gap-y-2">
        {data.map((entry) => (
          <li key={entry.name} className="flex items-center gap-2 text-xs">
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: entry.color }}
            />
            <span className="truncate text-muted-foreground">{entry.name}</span>
            <span className="ml-auto font-bold tabular-nums">{entry.total}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

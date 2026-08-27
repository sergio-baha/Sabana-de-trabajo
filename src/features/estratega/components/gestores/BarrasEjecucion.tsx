import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { formatCOP, formatCOPCorto } from "@/features/estratega/lib/gobernanza"

export interface TotalGestor {
  colaborador: string
  presupuestado: number
  ejecutado: number
}

// Presupuestado en gris de superficie y ejecutado en naranja de marca: lo que
// se compara de un vistazo es cuánto del riel se llenó, así que el ejecutado
// es el que lleva el color.
const chartConfig: ChartConfig = {
  presupuestado: { label: "Presupuestado", color: "var(--muted-foreground)" },
  ejecutado: { label: "Ejecutado", color: "var(--primary)" },
}

export default function BarrasEjecucion({ totales }: { totales: TotalGestor[] }) {
  if (totales.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Sin ejecución financiera para este filtro.
      </p>
    )
  }

  // Solo el primer nombre en el eje: con el nombre completo las etiquetas se
  // pisan a partir de tres gestores y recortarlas con "…" no deja identificar
  // a nadie. El nombre completo sigue estando en el tooltip.
  const data = totales.map((t) => ({
    nombre: t.colaborador.split(" ")[0],
    completo: t.colaborador,
    presupuestado: t.presupuestado,
    ejecutado: t.ejecutado,
  }))

  return (
    <ChartContainer config={chartConfig} className="h-56 w-full">
      <BarChart data={data} margin={{ left: 4, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
        <XAxis
          dataKey="nombre"
          tickLine={false}
          axisLine={false}
          stroke="var(--muted-foreground)"
          fontSize={12}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={52}
          stroke="var(--muted-foreground)"
          fontSize={11}
          tickFormatter={(valor: number) => formatCOPCorto(valor)}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(_, payload) => payload?.[0]?.payload?.completo ?? ""}
              formatter={(valor, name) => (
                <div className="flex w-full items-center justify-between gap-4">
                  <span className="text-muted-foreground">
                    {chartConfig[name as keyof typeof chartConfig]?.label as string}
                  </span>
                  <span className="font-semibold tabular-nums">{formatCOP(Number(valor))}</span>
                </div>
              )}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="presupuestado" fill="var(--color-presupuestado)" radius={4} maxBarSize={26} fillOpacity={0.35} />
        <Bar dataKey="ejecutado" fill="var(--color-ejecutado)" radius={4} maxBarSize={26} />
      </BarChart>
    </ChartContainer>
  )
}

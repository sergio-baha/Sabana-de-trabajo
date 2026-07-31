import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import type { ManagerMonthTotal } from "@/features/reports/api/reportsApi"

const chartConfig: ChartConfig = {
  allocated_hours: { label: "Horas bajo su gestión", color: "var(--chart-1)" },
}

// Una sola serie/medida → un solo color (tratamiento secuencial), sin
// necesidad de leyenda — el título del gráfico ya nombra la serie.
export default function ManagerHoursChart({ managers }: { managers: ManagerMonthTotal[] }) {
  const data = [...managers]
    .sort((a, b) => b.allocated_hours - a.allocated_hours)
    .map((m) => ({ name: m.manager_name, allocated_hours: m.allocated_hours }))

  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">Todavía no hay gerentes asignados a proyectos.</p>
  }

  return (
    <ChartContainer config={chartConfig} className="h-full w-full">
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
        <CartesianGrid horizontal={false} stroke="var(--border)" strokeDasharray="3 3" />
        <XAxis type="number" tickLine={false} axisLine={false} stroke="var(--muted-foreground)" fontSize={12} />
        <YAxis
          type="category"
          dataKey="name"
          tickLine={false}
          axisLine={false}
          width={110}
          stroke="var(--muted-foreground)"
          fontSize={12}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="allocated_hours" fill="var(--color-allocated_hours)" radius={4} barSize={16} />
      </BarChart>
    </ChartContainer>
  )
}

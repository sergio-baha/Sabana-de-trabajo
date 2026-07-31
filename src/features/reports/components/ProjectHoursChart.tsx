import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import type { ProjectMonthTotal } from "@/features/dashboard/api/dashboardApi"

const chartConfig: ChartConfig = {
  allocated_hours: { label: "Horas asignadas" },
}

// Cada barra usa el color real del proyecto (el mismo que pinta su columna
// en la grilla) — es identidad de marca ya establecida en la app, no una
// paleta categórica genérica, así que no rota colores por índice.
export default function ProjectHoursChart({ projects }: { projects: ProjectMonthTotal[] }) {
  const data = [...projects]
    .sort((a, b) => b.allocated_hours - a.allocated_hours)
    .map((p) => ({ name: p.name, allocated_hours: p.allocated_hours, color: p.color }))

  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin proyectos con horas asignadas.</p>
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
        <Bar dataKey="allocated_hours" radius={4} barSize={16}>
          {data.map((entry) => (
            <Cell key={entry.name} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}

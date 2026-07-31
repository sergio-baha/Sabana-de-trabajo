import { Bar, BarChart, CartesianGrid, Cell, LabelList, XAxis, YAxis } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import type { PersonMonthTotal } from "@/features/dashboard/api/dashboardApi"

const chartConfig: ChartConfig = {
  allocated_hours: { label: "Horas asignadas" },
}

const STATUS_COLOR: Record<PersonMonthTotal["status_color"], string> = {
  verde: "var(--success)",
  amarillo: "var(--warning)",
  rojo: "var(--danger)",
}

// Ranking de carga laboral + % de utilización en un solo gráfico (en vez de
// dos), para no duplicar la misma medida por persona dos veces. El color es
// de estado (reservado: verde/amarillo/rojo), no identidad — coincide con
// el mismo semáforo que ya usa la grilla.
export default function WorkloadRankingChart({ people }: { people: PersonMonthTotal[] }) {
  const data = [...people]
    .sort((a, b) => b.allocated_hours - a.allocated_hours)
    .map((p) => ({
      name: p.name,
      allocated_hours: p.allocated_hours,
      available_hours: p.available_hours,
      utilization: p.available_hours > 0 ? Math.round((p.allocated_hours / p.available_hours) * 100) : 0,
      statusColor: p.status_color,
    }))

  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">Todavía no hay personas en este mes.</p>
  }

  return (
    <ChartContainer
      config={chartConfig}
      className="w-full"
      style={{ height: Math.max(180, data.length * 32) }}
    >
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 40 }}>
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
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, _name, item) => (
                <div className="flex flex-col">
                  <span>{value} h asignadas de {item.payload.available_hours} h</span>
                  <span className="text-muted-foreground">{item.payload.utilization}% de utilización</span>
                </div>
              )}
            />
          }
        />
        <Bar dataKey="allocated_hours" radius={4} barSize={16}>
          {data.map((entry) => (
            <Cell key={entry.name} fill={STATUS_COLOR[entry.statusColor]} />
          ))}
          <LabelList
            dataKey="utilization"
            position="right"
            formatter={(label: unknown) => (label == null ? "" : `${label}%`)}
            className="fill-muted-foreground text-xs"
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}

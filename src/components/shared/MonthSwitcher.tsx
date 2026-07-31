import { useEffect } from "react"
import { CalendarRange } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useMonths } from "@/features/months/hooks/useMonthsQueries"
import { useActiveMonthStore } from "@/stores/activeMonthStore"

// Selector de "mes activo" visible en toda la app (header), para no obligar
// a pasar por /meses cada vez que se quiere cambiar de contexto.
export default function MonthSwitcher() {
  const { data: months, isLoading } = useMonths()
  const { activeMonthId, setActiveMonthId } = useActiveMonthStore()

  useEffect(() => {
    if (!activeMonthId && months && months.length > 0) {
      setActiveMonthId(months[0].id)
    }
  }, [activeMonthId, months, setActiveMonthId])

  if (isLoading) return null

  if (!months || months.length === 0) {
    return <span className="text-sm text-muted-foreground">Sin meses todavía</span>
  }

  return (
    <Select value={activeMonthId ?? undefined} onValueChange={setActiveMonthId}>
      <SelectTrigger className="w-56">
        <CalendarRange className="text-muted-foreground" />
        <SelectValue placeholder="Selecciona un mes" />
      </SelectTrigger>
      <SelectContent>
        {months.map((month) => (
          <SelectItem key={month.id} value={month.id}>
            {month.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

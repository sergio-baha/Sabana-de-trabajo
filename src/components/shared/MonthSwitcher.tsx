import { useEffect } from "react"
import { useNavigate } from "react-router"
import { CalendarRange, Settings2 } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useMonths } from "@/features/months/hooks/useMonthsQueries"
import { useActiveMonthStore } from "@/stores/activeMonthStore"
import { useSessionStore } from "@/stores/sessionStore"
import { canManageMonths } from "@/lib/roles"

// Valor centinela: no es un mes, es la acción "ir a gestionar los meses".
// Mismo patrón que el "+ Crear proyecto nuevo" del diálogo de tareas.
const MANAGE_MONTHS = "__manage__"

// Selector de "mes activo" visible en toda la app (header), para no obligar
// a pasar por /meses cada vez que se quiere cambiar de contexto.
//
// Lleva además el atajo a la gestión de meses (duplicar, crear, cerrar):
// duplicar el mes es una tarea que se hace TODOS los meses, así que tenerla
// solo dentro del menú de la cuenta la dejaba demasiado escondida. Acá cae
// justo donde ya se está pensando en meses.
export default function MonthSwitcher() {
  const { data: months, isLoading } = useMonths()
  const { activeMonthId, setActiveMonthId } = useActiveMonthStore()
  const profile = useSessionStore((s) => s.profile)
  const navigate = useNavigate()

  // El atajo a la gestión de meses solo tiene sentido para quien puede
  // gestionarlos: el Administrador. Los demás usan este selector para
  // *elegir* el mes en el que trabajan, que es todo lo que necesitan.
  const showManageShortcut = canManageMonths(profile?.role)

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
    <Select
      value={activeMonthId ?? undefined}
      onValueChange={(value) => {
        if (value === MANAGE_MONTHS) {
          navigate("/meses")
          return
        }
        setActiveMonthId(value)
      }}
    >
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
        {showManageShortcut && (
          <>
            <SelectSeparator />
            <SelectItem value={MANAGE_MONTHS} className="text-primary">
              <Settings2 />
              Gestionar meses
            </SelectItem>
          </>
        )}
      </SelectContent>
    </Select>
  )
}

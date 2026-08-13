import { Link } from "react-router"
import { CalendarRange } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useSessionStore } from "@/stores/sessionStore"
import { canManageMonths } from "@/lib/roles"

// Estado vacío compartido por todos los módulos que dependen del mes activo
// (Proyectos, Personas, Distribución, Reportes) cuando todavía no hay
// ninguno creado o seleccionado.
export default function NoActiveMonth() {
  const profile = useSessionStore((s) => s.profile)
  // Crear meses es del Administrador: a los demás roles mandarlos a /meses
  // sería mandarlos a una pantalla a la que no pueden entrar.
  const canCreate = canManageMonths(profile?.role)

  return (
    <Card>
      <CardHeader>
        <CalendarRange className="mb-2 size-8 text-muted-foreground" />
        <CardTitle>No hay un mes activo</CardTitle>
        <CardDescription>
          {canCreate
            ? "Crea o selecciona un mes para empezar a trabajar en este módulo."
            : "Selecciona un mes en el encabezado para empezar. Si todavía no hay ninguno, pídele a un administrador que lo cree."}
        </CardDescription>
      </CardHeader>
      {canCreate && (
        <CardContent>
          <Button asChild>
            <Link to="/meses">Ir a Gestión de meses</Link>
          </Button>
        </CardContent>
      )}
    </Card>
  )
}

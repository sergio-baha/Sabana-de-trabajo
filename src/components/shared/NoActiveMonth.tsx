import { Link } from "react-router"
import { CalendarRange } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

// Estado vacío compartido por todos los módulos que dependen del mes activo
// (Proyectos, Personas, Distribución, Reportes) cuando todavía no hay
// ninguno creado o seleccionado.
export default function NoActiveMonth() {
  return (
    <Card>
      <CardHeader>
        <CalendarRange className="mb-2 size-8 text-muted-foreground" />
        <CardTitle>No hay un mes activo</CardTitle>
        <CardDescription>
          Crea o selecciona un mes para empezar a trabajar en este módulo.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild>
          <Link to="/meses">Ir a Gestión de meses</Link>
        </Button>
      </CardContent>
    </Card>
  )
}

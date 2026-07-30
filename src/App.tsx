import { useState } from "react"
import { Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { applyTheme, getSavedTheme, type Theme } from "@/lib/theme"

function App() {
  const [theme, setTheme] = useState<Theme>(getSavedTheme)

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark"
    setTheme(next)
    applyTheme(next)
  }

  return (
    <div className="min-h-svh bg-background p-8">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              Distribución de Trabajo
            </h1>
            <p className="text-sm text-muted-foreground">
              Andamiaje del proyecto — Fase 0
            </p>
          </div>
          <Button variant="outline" size="icon" onClick={toggleTheme}>
            {theme === "dark" ? <Sun /> : <Moon />}
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Línea gráfica CEINFES</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button>Primario</Button>
            <Button variant="secondary">Secundario</Button>
            <Button
              className="bg-brand-green text-white hover:bg-brand-green/90"
            >
              Verde marca
            </Button>
            <Button
              className="bg-brand-orange text-white hover:bg-brand-orange/90"
            >
              Acento naranja
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Estados de asignación de horas</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Badge className="border-transparent bg-success text-success-foreground">
              Verde · Horas exactas
            </Badge>
            <Badge className="border-transparent bg-warning text-warning-foreground">
              Amarillo · Faltan horas
            </Badge>
            <Badge className="border-transparent bg-danger text-danger-foreground">
              Rojo · Horas de más
            </Badge>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default App

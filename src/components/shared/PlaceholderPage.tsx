import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface PlaceholderPageProps {
  title: string
  description: string
  phase: string
}

// Marcador temporal para módulos que aún no se han construido — ver
// docs/ARQUITECTURA.md para la secuencia de fases. Se reemplaza módulo por
// módulo a medida que avanza el plan.
export default function PlaceholderPage({ title, description, phase }: PlaceholderPageProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">Disponible en {phase}.</p>
      </CardContent>
    </Card>
  )
}

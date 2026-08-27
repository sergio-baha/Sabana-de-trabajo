import { useSearchParams } from "react-router"
import { Compass, LayoutGrid, LineChart } from "lucide-react"
import PageHeader from "@/components/shared/PageHeader"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import GestoresTab from "@/features/estratega/components/gestores/GestoresTab"
import PipelineTab from "@/features/estratega/components/pipeline/PipelineTab"

const TABS = ["gestores", "pipeline"] as const
type TabId = (typeof TABS)[number]

// Gobernanza: la vista ejecutiva del portafolio.
//
// DOS PESTAÑAS Y NO DOS RUTAS: son las dos caras de la misma pregunta —"¿cómo
// vamos?"— y quien las mira las alterna todo el tiempo. La pestaña sí vive en
// la URL (`?tab=pipeline`) para que un enlace lleve a donde uno quiere y el
// botón de atrás haga lo esperable.
//
// LA GESTIÓN DEL DATO VA DENTRO DE CADA PESTAÑA, no en una pantalla de
// administración aparte: el dato se corrige donde se ve que está mal. Un
// tablero que solo se puede mirar obliga a volver al Excel, y entonces el
// Excel vuelve a ser la verdad.
export default function GobernanzaPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const requested = searchParams.get("tab")
  const tab: TabId = TABS.includes(requested as TabId) ? (requested as TabId) : "gestores"

  const setTab = (value: string) => {
    // `replace`: alternar pestañas no debería llenar el historial de pasos
    // que hay que deshacer uno por uno para salir del módulo.
    setSearchParams(value === "gestores" ? {} : { tab: value }, { replace: true })
  }

  return (
    <>
      <PageHeader
        icon={Compass}
        eyebrow="Gobernanza"
        title="Portafolio de producto"
        description="Ejecución presupuestal y entregables de cada gestor, y avance de las iniciativas comerciales por las cuatro fases del Doble Diamante."
      />

      <Tabs value={tab} onValueChange={setTab} className="gap-4">
        <TabsList variant="line">
          <TabsTrigger value="gestores">
            <LineChart />
            Seguimiento de gestores
          </TabsTrigger>
          <TabsTrigger value="pipeline">
            <LayoutGrid />
            Pipeline comercial
          </TabsTrigger>
        </TabsList>

        {/* Las dos pestañas se montan bajo demanda: cada una trae sus propias
            consultas, y cargar el pipeline entero para quien solo viene a
            mirar la ejecución del mes sería trabajo tirado. */}
        <TabsContent value="gestores">{tab === "gestores" && <GestoresTab />}</TabsContent>
        <TabsContent value="pipeline">{tab === "pipeline" && <PipelineTab />}</TabsContent>
      </Tabs>
    </>
  )
}

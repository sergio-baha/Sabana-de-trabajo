import { Settings } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import PageHeader from "@/components/shared/PageHeader"
import GeneralSettingsForm from "@/features/settings/components/GeneralSettingsForm"
import UsersTable from "@/features/settings/components/UsersTable"
import InvitationsPanel from "@/features/settings/components/InvitationsPanel"
import RatesCard from "@/features/projects/components/RatesCard"
import NoActiveMonth from "@/components/shared/NoActiveMonth"
import { usePeople } from "@/features/people/hooks/usePeopleQueries"
import { useActiveMonthStore } from "@/stores/activeMonthStore"

export default function ConfiguracionPage() {
  const { activeMonthId } = useActiveMonthStore()
  const { data: people } = usePeople(activeMonthId)

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        icon={Settings}
        eyebrow="Administración"
        title="Configuración"
        description="Datos de la empresa, horas por defecto, usuarios e invitaciones."
      />

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="usuarios">Usuarios</TabsTrigger>
          <TabsTrigger value="invitaciones">Invitaciones</TabsTrigger>
          <TabsTrigger value="tarifas">Tarifas</TabsTrigger>
        </TabsList>
        <TabsContent value="general" className="mt-4">
          <GeneralSettingsForm />
        </TabsContent>
        <TabsContent value="usuarios" className="mt-4">
          <UsersTable />
        </TabsContent>
        <TabsContent value="invitaciones" className="mt-4">
          <InvitationsPanel />
        </TabsContent>
        {/* Las tarifas vivían en Personas, que ya no existe. Aquí quedan
            mejor: son dato de nómina, no de planeación, y esta pantalla ya
            es solo de Administrador. Siguen siendo por persona-mes, así que
            se editan las del mes activo. */}
        <TabsContent value="tarifas" className="mt-4">
          {activeMonthId ? (
            <RatesCard monthId={activeMonthId} people={people ?? []} />
          ) : (
            <NoActiveMonth />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import GeneralSettingsForm from "@/features/settings/components/GeneralSettingsForm"
import UsersTable from "@/features/settings/components/UsersTable"
import InvitationsPanel from "@/features/settings/components/InvitationsPanel"

export default function ConfiguracionPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Configuración</h1>
        <p className="text-sm text-muted-foreground">
          Datos de la empresa, horas por defecto, usuarios e invitaciones.
        </p>
      </div>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="usuarios">Usuarios</TabsTrigger>
          <TabsTrigger value="invitaciones">Invitaciones</TabsTrigger>
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
      </Tabs>
    </div>
  )
}

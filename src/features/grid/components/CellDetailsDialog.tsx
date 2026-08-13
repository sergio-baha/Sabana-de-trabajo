import { useEffect, useState } from "react"
import { ListChecks, MessageSquare } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import CellCommentsPanel from "@/features/comments/components/CellCommentsPanel"
import ActivityBreakdownPanel from "@/features/activities/components/ActivityBreakdownPanel"
import type { CommentWithCell } from "@/features/comments/api/commentsApi"
import type { ActivityWithCell } from "@/features/activities/api/activitiesApi"

export type CellTab = "actividades" | "comentarios"

interface CellDetailsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Pestaña con la que abre — la elige el ítem del menú de la celda. */
  initialTab: CellTab
  monthId: string
  personId: string
  projectId: string
  personName: string
  projectName: string
  comments: CommentWithCell[]
  activities: ActivityWithCell[]
  readOnly: boolean
}

// Un único diálogo para todo lo que cuelga de una celda. Antes eran dos
// botoncitos casi idénticos en cada celda (globo y checklist) que nadie
// distinguía; ahora la celda tiene un solo acceso y acá se elige entre
// desglosar horas o comentar, con la diferencia escrita en cada pestaña.
export default function CellDetailsDialog({
  open,
  onOpenChange,
  initialTab,
  monthId,
  personId,
  projectId,
  personName,
  projectName,
  comments,
  activities,
  readOnly,
}: CellDetailsDialogProps) {
  const [tab, setTab] = useState<CellTab>(initialTab)

  // Reabrir desde otro ítem del menú debe respetar esa elección, aunque el
  // diálogo ya se hubiera usado antes en otra pestaña.
  useEffect(() => {
    if (open) setTab(initialTab)
  }, [open, initialTab])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {personName} · {projectName}
          </DialogTitle>
          <DialogDescription>
            Detalle de la celda: el desglose de sus horas y la conversación del equipo.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as CellTab)}>
          <TabsList className="w-full">
            <TabsTrigger value="actividades">
              <ListChecks /> Actividades ({activities.length})
            </TabsTrigger>
            <TabsTrigger value="comentarios">
              <MessageSquare /> Comentarios ({comments.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="actividades" className="pt-2">
            <ActivityBreakdownPanel
              open={open && tab === "actividades"}
              monthId={monthId}
              personId={personId}
              projectId={projectId}
              activities={activities}
              readOnly={readOnly}
            />
          </TabsContent>

          <TabsContent value="comentarios" className="pt-2">
            <CellCommentsPanel
              monthId={monthId}
              personId={personId}
              projectId={projectId}
              comments={comments}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

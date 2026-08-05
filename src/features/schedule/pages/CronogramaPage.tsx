import { useEffect, useMemo, useState } from "react"
import { UserRoundX } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import NoActiveMonth from "@/components/shared/NoActiveMonth"
import GanttChart from "@/features/schedule/components/GanttChart"
import TimeCalendar from "@/features/schedule/components/TimeCalendar"
import { useMyPerson } from "@/features/schedule/hooks/useMyPerson"
import TaskFormDialog from "@/features/tasks/components/TaskFormDialog"
import { useTasks } from "@/features/tasks/hooks/useTasksQueries"
import { useRealtimeTasks } from "@/features/tasks/hooks/useRealtimeTasks"
import type { Task } from "@/features/tasks/api/tasksApi"
import {
  useActivitiesForMonth,
  useRealtimeActivities,
} from "@/features/activities/hooks/useActivitiesQueries"
import { useProjects } from "@/features/projects/hooks/useProjectsQueries"
import { usePeople } from "@/features/people/hooks/usePeopleQueries"
import { useActiveMonthStore } from "@/stores/activeMonthStore"
import { useSessionStore } from "@/stores/sessionStore"
import {
  canLogOwnTime,
  canManageTasks,
  isAnalistaTecnologia,
  writesOwnWorkOnly,
} from "@/lib/roles"

export default function CronogramaPage() {
  const { activeMonthId } = useActiveMonthStore()
  const profile = useSessionStore((s) => s.profile)
  const restrictedToSelf = isAnalistaTecnologia(profile?.role)

  const { data: tasks, isLoading: tasksLoading } = useTasks(activeMonthId)
  const { data: activities, isLoading: activitiesLoading } = useActivitiesForMonth(activeMonthId)
  const { data: projects } = useProjects(activeMonthId)
  const { data: people } = usePeople(activeMonthId)
  const { myPerson } = useMyPerson(activeMonthId)
  useRealtimeTasks(activeMonthId)
  useRealtimeActivities(activeMonthId)

  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null)
  const [editingTask, setEditingTask] = useState<Task | null>(null)

  // El cronograma siempre es "el de alguien". Por defecto, el propio: es lo
  // que un analista quiere ver al entrar, y para un gestor es el punto de
  // partida más natural antes de mirar el de otra persona.
  useEffect(() => {
    if (selectedPersonId) return
    if (myPerson) setSelectedPersonId(myPerson.id)
    else if (!restrictedToSelf && people && people.length > 0) setSelectedPersonId(people[0].id)
  }, [myPerson, people, restrictedToSelf, selectedPersonId])

  // Un Analista de Tecnología no elige de quién es el cronograma: RLS solo
  // le devuelve lo suyo, así que un selector le mostraría listas vacías.
  const personId = restrictedToSelf ? (myPerson?.id ?? null) : selectedPersonId

  const personTasks = useMemo(
    () => (tasks ?? []).filter((task) => task.assigned_person_id === personId),
    [tasks, personId]
  )

  const personActivities = useMemo(
    () => (activities ?? []).filter((a) => a.allocation.person_id === personId),
    [activities, personId]
  )

  const isOwnSchedule = Boolean(myPerson && personId === myPerson.id)
  // Registrar tiempo es siempre sobre el cronograma que se está viendo: un
  // gestor puede registrar el de cualquiera (ya podía desde la grilla), un
  // analista de tecnología solo el suyo.
  const canLog = canLogOwnTime(profile?.role) && (isOwnSchedule || !restrictedToSelf)

  if (!activeMonthId) return <NoActiveMonth />

  // Sin vínculo cuenta ↔ roster no hay "mi" cronograma que mostrar. Es un
  // estado de configuración, no un error: se explica cómo resolverlo.
  if (restrictedToSelf && !myPerson) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <UserRoundX className="size-10 text-muted-foreground" />
        <h1 className="text-lg font-semibold">Tu cuenta no está vinculada a este mes</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Para ver tu cronograma, un administrador o gestor debe vincular tu cuenta con tu
          persona del roster del mes activo, desde Personas → editar → Cuenta vinculada.
        </p>
      </div>
    )
  }

  const selectedPerson = people?.find((p) => p.id === personId)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Cronograma</h1>
          <p className="text-sm text-muted-foreground">
            Planeación de tareas en el tiempo y horas realmente registradas
            {selectedPerson ? ` · ${selectedPerson.name}` : ""}.
          </p>
        </div>
        {!restrictedToSelf && (
          <Select value={personId ?? ""} onValueChange={setSelectedPersonId}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Elige una persona" />
            </SelectTrigger>
            <SelectContent>
              {(people ?? []).map((person) => (
                <SelectItem key={person.id} value={person.id}>
                  {person.name}
                  {myPerson?.id === person.id ? " (yo)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {tasksLoading || activitiesLoading ? (
        <Skeleton className="h-72 w-full" />
      ) : !personId ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          El mes activo todavía no tiene personas en el roster.
        </p>
      ) : (
        <Tabs defaultValue="gantt">
          <TabsList>
            <TabsTrigger value="gantt">Gantt de tareas</TabsTrigger>
            <TabsTrigger value="horas">Calendario de horas</TabsTrigger>
          </TabsList>
          <TabsContent value="gantt" className="mt-4">
            <Card>
              <CardContent>
                <GanttChart
                  tasks={personTasks}
                  projects={projects ?? []}
                  onOpenTask={setEditingTask}
                />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="horas" className="mt-4">
            <Card>
              <CardContent>
                <TimeCalendar
                  monthId={activeMonthId}
                  personId={personId}
                  activities={personActivities}
                  projects={projects ?? []}
                  canLog={canLog}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      <TaskFormDialog
        open={Boolean(editingTask)}
        onOpenChange={(open) => !open && setEditingTask(null)}
        monthId={activeMonthId}
        task={editingTask}
        tasks={tasks ?? []}
        projects={projects ?? []}
        people={people ?? []}
        readOnly={!canManageTasks(profile?.role)}
        lockedPersonId={writesOwnWorkOnly(profile?.role) ? myPerson?.id : null}
      />
    </div>
  )
}

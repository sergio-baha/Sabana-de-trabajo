import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router"
import { Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  useClearPersonRate,
  usePersonRates,
  useSetPersonRate,
} from "@/features/projects/hooks/useProjectBudgetQueries"
import { formatMoney } from "@/features/projects/lib/projectLabels"
import type { Person } from "@/features/people/api/peopleApi"

interface RatesCardProps {
  monthId: string
  people: Person[]
}

/**
 * Tarifa por hora de cada persona, para calcular el costo de nómina de los
 * proyectos.
 *
 * Solo se monta para Administrador. No es solo gating de UI: `person_rates`
 * tiene una política RLS que niega la lectura a cualquier otro rol, así que
 * para un Gestor esta tabla vendría vacía de todos modos
 * (*_rates_and_expenses.sql).
 */
export default function RatesCard({ monthId, people }: RatesCardProps) {
  const { data: rates } = usePersonRates(monthId)
  const setRate = useSetPersonRate(monthId)
  const clearRate = useClearPersonRate(monthId)

  // Borrador local por persona: sin esto cada tecla dispararía un guardado.
  // Se confirma con Enter o al salir del campo.
  const [drafts, setDrafts] = useState<Record<string, string>>({})

  const rateByPerson = useMemo(() => {
    const map = new Map<string, number>()
    for (const rate of rates ?? []) map.set(rate.person_id, rate.hourly_rate)
    return map
  }, [rates])

  // Al cambiar de mes (o al llegar las tarifas) se resiembra el borrador con
  // lo guardado, para no arrastrar lo tecleado en el mes anterior.
  useEffect(() => {
    const next: Record<string, string> = {}
    for (const person of people) {
      next[person.id] = rateByPerson.get(person.id)?.toString() ?? ""
    }
    setDrafts(next)
  }, [people, rateByPerson])

  const commit = (personId: string) => {
    const raw = drafts[personId]?.trim() ?? ""
    const saved = rateByPerson.get(personId)

    // Vaciar el campo borra la tarifa. Es la única forma de deshacer una
    // carga equivocada; guardar 0 no sirve porque significa "cuesta cero",
    // y con eso el costo del proyecto quedaría mal en silencio.
    if (raw === "") {
      if (saved !== undefined) clearRate.mutate(personId)
      return
    }

    const value = Number(raw)
    if (!Number.isFinite(value) || value < 0) return
    if (saved === value) return

    setRate.mutate({ personId, hourlyRate: value })
  }

  const activePeople = people.filter((p) => p.status === "activo")

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="size-4" /> Tarifas por hora
        </CardTitle>
        <CardDescription>
          Con esto se calcula el costo de nómina de cada proyecto. Es dato sensible: solo un
          Administrador puede verlo o cambiarlo, y la tarifa se guarda por mes — un aumento no
          reescribe el costo de los meses ya cerrados.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Persona</TableHead>
              <TableHead className="w-48">Tarifa por hora (COP)</TableHead>
              <TableHead className="w-40 text-right">Costo del mes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activePeople.map((person) => {
              const rate = rateByPerson.get(person.id)
              return (
                <TableRow key={person.id}>
                  <TableCell className="font-medium">{person.name}</TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="0"
                      step="1000"
                      placeholder="Sin tarifa"
                      value={drafts[person.id] ?? ""}
                      onChange={(e) =>
                        setDrafts((d) => ({ ...d, [person.id]: e.target.value }))
                      }
                      onBlur={() => commit(person.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          commit(person.id)
                        }
                      }}
                    />
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {/* Referencia rápida: lo que costaría su capacidad completa
                        del mes. No es lo asignado a proyectos — eso sale en la
                        ficha de cada proyecto. */}
                    {rate === undefined
                      ? "—"
                      : formatMoney(rate * person.available_hours)}
                  </TableCell>
                </TableRow>
              )
            })}
            {activePeople.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  No hay personas activas en este mes.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <Button variant="link" size="sm" className="mt-2 px-0" asChild>
          <Link to="/proyectos">Ver el costo por proyecto en Proyectos</Link>
        </Button>
      </CardContent>
    </Card>
  )
}

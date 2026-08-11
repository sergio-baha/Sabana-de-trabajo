import { useState } from "react"
import { ChevronDown, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { Person } from "@/features/people/api/peopleApi"

interface PersonMultiSelectProps {
  people: Person[]
  value: string[]
  onChange: (personIds: string[]) => void
  disabled?: boolean
  placeholder?: string
}

// Selector de varias personas del roster, sin filtrar por rol a propósito:
// cualquiera puede sumarse a un proyecto como colaborador, sin importar si
// hoy es analista, gestor o administrador.
export function PersonMultiSelect({
  people,
  value,
  onChange,
  disabled = false,
  placeholder = "Agregar personas…",
}: PersonMultiSelectProps) {
  const [open, setOpen] = useState(false)
  const selected = people.filter((p) => value.includes(p.id))

  const toggle = (personId: string) => {
    onChange(
      value.includes(personId) ? value.filter((id) => id !== personId) : [...value, personId]
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className="w-full justify-between font-normal"
          >
            <span className="text-muted-foreground">{placeholder}</span>
            <ChevronDown className="text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="p-1">
          <ScrollArea className="h-56">
            <div className="flex flex-col gap-0.5 p-1">
              {people.length === 0 && (
                <p className="p-2 text-sm text-muted-foreground">
                  No hay personas en el mes activo.
                </p>
              )}
              {people.map((person) => (
                <label
                  key={person.id}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                >
                  <Checkbox
                    checked={value.includes(person.id)}
                    onCheckedChange={() => toggle(person.id)}
                  />
                  {person.name}
                </label>
              ))}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((person) => (
            <Badge key={person.id} variant="secondary" className="gap-1 pr-1">
              {person.name}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => toggle(person.id)}
                  aria-label={`Quitar a ${person.name}`}
                  className="rounded-full p-0.5 hover:bg-foreground/10"
                >
                  <X className="size-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}

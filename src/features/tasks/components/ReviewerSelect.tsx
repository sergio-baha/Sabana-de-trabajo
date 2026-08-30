import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { ReviewerOptions } from "@/features/tasks/lib/reviewerOptions"

interface ReviewerSelectProps {
  options: ReviewerOptions
  value: string
  onChange: (personId: string) => void
  disabled?: boolean
  placeholder?: string
}

// Selector de revisor: gestores del proyecto primero, luego el resto del
// equipo — mismo criterio ya usado para elegir responsable de una tarea
// (usePeopleByRole), pero acotado al equipo del proyecto en cuestión.
export default function ReviewerSelect({
  options,
  value,
  onChange,
  disabled,
  placeholder = "Elige quién revisa…",
}: ReviewerSelectProps) {
  const empty = options.owners.length === 0 && options.rest.length === 0

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled || empty}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={empty ? "Este proyecto no tiene equipo asignado" : placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.owners.length > 0 && (
          <SelectGroup>
            <SelectLabel>Gestores</SelectLabel>
            {options.owners.map((person) => (
              <SelectItem key={person.id} value={person.id}>
                {person.name}
              </SelectItem>
            ))}
          </SelectGroup>
        )}
        {options.rest.length > 0 && (
          <SelectGroup>
            <SelectLabel>Equipo</SelectLabel>
            {options.rest.map((person) => (
              <SelectItem key={person.id} value={person.id}>
                {person.name}
              </SelectItem>
            ))}
          </SelectGroup>
        )}
      </SelectContent>
    </Select>
  )
}

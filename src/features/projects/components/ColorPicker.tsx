import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

const PRESET_COLORS = [
  "#5E4F9C", // morado (marca)
  "#3A5BA7", // azul (marca)
  "#024B4E", // verde (marca)
  "#EC671A", // naranja (marca)
  "#C0538A", // magenta
  "#0EA5E9", // celeste
  "#16A34A", // verde vivo
  "#DC2626", // rojo
  "#CA8A04", // dorado
  "#6B7280", // gris
]

interface ColorPickerProps {
  value: string
  onChange: (color: string) => void
}

export default function ColorPicker({ value, onChange }: ColorPickerProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {PRESET_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          className={cn(
            "flex size-7 items-center justify-center rounded-full border border-black/10 transition-transform hover:scale-110",
            value.toLowerCase() === color.toLowerCase() && "ring-2 ring-ring ring-offset-2 ring-offset-background"
          )}
          style={{ backgroundColor: color }}
          onClick={() => onChange(color)}
          aria-label={`Color ${color}`}
        >
          {value.toLowerCase() === color.toLowerCase() && <Check className="size-3.5 text-white" />}
        </button>
      ))}
      <label className="flex size-7 cursor-pointer items-center justify-center rounded-full border border-dashed border-border text-[10px] text-muted-foreground">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="size-0 opacity-0"
        />
        +
      </label>
    </div>
  )
}

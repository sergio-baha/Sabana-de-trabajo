// Elige texto blanco/negro según la luminancia del color de fondo (para que
// el nombre del proyecto sea legible sobre cualquier color elegido en el
// selector de color de Proyectos).
export function getContrastText(hex: string): string {
  const clean = hex.replace("#", "")
  if (clean.length !== 6) return "#ffffff"
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.6 ? "#1a1a1a" : "#ffffff"
}

export function tintBackground(hex: string, alphaHex = "14"): string {
  return `${hex}${alphaHex}`
}

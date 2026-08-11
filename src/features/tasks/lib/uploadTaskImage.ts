import { supabase } from "@/lib/supabaseClient"

const BUCKET = "task-images"
const MAX_SIZE_BYTES = 5 * 1024 * 1024

export class TaskImageUploadError extends Error {}

// Se guarda bajo un uuid random (crypto.randomUUID, disponible en todo
// navegador moderno) en vez del nombre original: evita colisiones entre
// tarjetas distintas y filtra cualquier carácter raro del filename del
// usuario en la ruta del objeto.
export async function uploadTaskImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new TaskImageUploadError("Solo se pueden subir imágenes")
  }
  if (file.size > MAX_SIZE_BYTES) {
    throw new TaskImageUploadError("La imagen no puede superar 5 MB")
  }

  const extension = file.name.includes(".") ? file.name.split(".").pop() : "png"
  const path = `${crypto.randomUUID()}.${extension}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  })
  if (error) {
    throw new TaskImageUploadError(error.message)
  }

  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

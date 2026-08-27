import { supabase } from "@/lib/supabaseClient"
import type { Database } from "@/types/database.types"
import type { Fase } from "@/features/estratega/lib/gobernanza"

type Tables = Database["public"]["Tables"]

export type Finanza = Tables["estratega_finanzas"]["Row"]
export type Entregable = Tables["estratega_entregables"]["Row"]
export type Producto = Tables["estratega_productos"]["Row"]
export type ProductoItem = Tables["estratega_producto_items"]["Row"]

export type FinanzaInput = Tables["estratega_finanzas"]["Insert"]
export type EntregableInput = Tables["estratega_entregables"]["Insert"]
export type ProductoInput = Tables["estratega_productos"]["Insert"]

// Todo el módulo es de lectura completa: no hay filtro por rol ni por fila
// aquí porque la RLS ya decide quién ve el módulo entero (`sees_gobernanza()`
// en *_estratega_esquema.sql). Filtrar de nuevo en el cliente solo agregaría
// una segunda regla que mantener en línea con la primera.
//
// Tampoco se filtra por período en la consulta: son unos cientos de filas al
// año y el tablero necesita el consolidado acumulado además del mes suelto.
// Traerlo todo una vez y filtrar en memoria evita una consulta por cada
// movimiento de los selectores.

export async function listFinanzas(): Promise<Finanza[]> {
  const { data, error } = await supabase
    .from("estratega_finanzas")
    .select("*")
    .order("anio", { ascending: true })
    .order("mes", { ascending: true })
    .order("colaborador", { ascending: true })
  if (error) throw error
  return data
}

export async function listEntregables(): Promise<Entregable[]> {
  const { data, error } = await supabase
    .from("estratega_entregables")
    .select("*")
    .order("anio", { ascending: true })
    .order("mes", { ascending: true })
    .order("colaborador", { ascending: true })
  if (error) throw error
  return data
}

export async function listProductos(): Promise<Producto[]> {
  const { data, error } = await supabase
    .from("estratega_productos")
    .select("*")
    .order("fecha_limite", { ascending: true })
  if (error) throw error
  return data
}

// El checklist de TODOS los productos en una sola consulta. Son ~14 ítems por
// iniciativa: pedirlos por producto al abrir cada detalle serviría para
// ahorrar unas decenas de filas y costaría un estado de carga dentro del
// panel, además de dejar sin datos a los porcentajes de la tabla — que se
// calculan desde aquí, porque el avance no se guarda duplicado en el producto
// (ver el encabezado de la migración del esquema).
export async function listProductoItems(): Promise<ProductoItem[]> {
  const { data, error } = await supabase
    .from("estratega_producto_items")
    .select("*")
    .order("fase", { ascending: true })
    .order("orden", { ascending: true })
  if (error) throw error
  return data
}

// ── Escritura ───────────────────────────────────────────────────────────

export async function upsertFinanza(input: FinanzaInput): Promise<Finanza> {
  // `onConflict` sobre la llave natural (año, mes, gestor): registrar dos
  // veces el mismo mes corrige la cifra en vez de duplicar la fila, que es lo
  // que un usuario espera al "volver a registrar" un período.
  const { data, error } = await supabase
    .from("estratega_finanzas")
    .upsert(input, { onConflict: "anio,mes,colaborador" })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteFinanza(id: string): Promise<void> {
  const { error } = await supabase.from("estratega_finanzas").delete().eq("id", id)
  if (error) throw error
}

export async function createEntregable(input: EntregableInput): Promise<Entregable> {
  const { data, error } = await supabase
    .from("estratega_entregables")
    .insert(input)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateEntregable(
  id: string,
  input: Tables["estratega_entregables"]["Update"]
): Promise<Entregable> {
  const { data, error } = await supabase
    .from("estratega_entregables")
    .update(input)
    .eq("id", id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteEntregable(id: string): Promise<void> {
  const { error } = await supabase.from("estratega_entregables").delete().eq("id", id)
  if (error) throw error
}

// Una iniciativa nueva nace con su checklist de plantilla: las cuatro fases
// con los entregables estándar del Doble Diamante, todos sin marcar. Nacer
// vacía dejaría el producto en 0/0, que la regla de urgencia lee como "sin
// entregables" y no como "recién creada".
const CHECKLIST_PLANTILLA: Record<Fase, string[]> = {
  descubrir: ["Fuentes Primarias", "Benchmark Sectorial", "Mapa de Hipótesis"],
  definir: [
    "Lienzo de Modelo de Negocio",
    "Lienzo de Propuesta de Valor",
    "Customer Journey",
    "Triángulo de Hierro",
    "Caso de Negocio Operativo",
  ],
  desarrollar: [
    "Prototipo Funcional (MVP)",
    "Pruebas de Usuario Real",
    "Benchmark V2 Refinado",
    "Validación Psicométrica / Estructura",
  ],
  entregar: ["Informe de Seguimiento Técnico", "Estrategia de Divulgación y Go-to-Market"],
}

export async function createProducto(input: ProductoInput): Promise<Producto> {
  const { data, error } = await supabase
    .from("estratega_productos")
    .insert(input)
    .select()
    .single()
  if (error) throw error

  const items = (Object.keys(CHECKLIST_PLANTILLA) as Fase[]).flatMap((fase) =>
    CHECKLIST_PLANTILLA[fase].map((titulo, indice) => ({
      producto_id: data.id,
      fase,
      titulo,
      orden: indice + 1,
    }))
  )
  const { error: itemsError } = await supabase.from("estratega_producto_items").insert(items)
  if (itemsError) throw itemsError

  return data
}

export async function updateProducto(
  id: string,
  input: Tables["estratega_productos"]["Update"]
): Promise<Producto> {
  const { data, error } = await supabase
    .from("estratega_productos")
    .update(input)
    .eq("id", id)
    .select()
    .single()
  if (error) throw error
  return data
}

// El checklist se va en cascada con el producto (FK `on delete cascade`).
export async function deleteProducto(id: string): Promise<void> {
  const { error } = await supabase.from("estratega_productos").delete().eq("id", id)
  if (error) throw error
}

// Marcar o desmarcar un ítem. `completado_en` y `completado_por` los pone el
// trigger de la base, no este código: si dependieran del cliente, cualquier
// otra vía de escritura dejaría ítems certificados sin autor.
export async function setItemCompletado(id: string, completado: boolean): Promise<void> {
  const { error } = await supabase
    .from("estratega_producto_items")
    .update({ completado })
    .eq("id", id)
  if (error) throw error
}

export async function createItem(
  producto_id: string,
  fase: Fase,
  titulo: string,
  orden: number
): Promise<void> {
  const { error } = await supabase
    .from("estratega_producto_items")
    .insert({ producto_id, fase, titulo, orden })
  if (error) throw error
}

export async function updateItemTitulo(id: string, titulo: string): Promise<void> {
  const { error } = await supabase
    .from("estratega_producto_items")
    .update({ titulo })
    .eq("id", id)
  if (error) throw error
}

export async function deleteItem(id: string): Promise<void> {
  const { error } = await supabase.from("estratega_producto_items").delete().eq("id", id)
  if (error) throw error
}

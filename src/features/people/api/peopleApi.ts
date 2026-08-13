import { supabase } from "@/lib/supabaseClient"
import type { Database } from "@/types/database.types"

export type Person = Database["public"]["Tables"]["people"]["Row"]
export type PersonInsert = Database["public"]["Tables"]["people"]["Insert"]
export type PersonUpdate = Database["public"]["Tables"]["people"]["Update"]

export async function listPeople(monthId: string): Promise<Person[]> {
  const { data, error } = await supabase
    .from("people")
    .select("*")
    .eq("month_id", monthId)
    .order("name", { ascending: true })
  if (error) throw error
  return data
}

// Trae al mes el equipo activo del mes más reciente que tenga gente. La
// función de la base es idempotente (si el mes ya tiene roster devuelve 0) y
// también corre sola al crear un mes en blanco — ver
// supabase/migrations/*_sembrar_roster_del_mes.sql. Acá se expone para los
// meses que ya existían vacíos.
export async function seedMonthPeople(monthId: string): Promise<number> {
  const { data, error } = await supabase.rpc("seed_month_people", { p_month_id: monthId })
  if (error) throw error
  return data ?? 0
}

export async function createPerson(input: PersonInsert): Promise<Person> {
  const { data, error } = await supabase.from("people").insert(input).select("*").single()
  if (error) throw error
  return data
}

export async function updatePerson(id: string, patch: PersonUpdate): Promise<Person> {
  const { data, error } = await supabase
    .from("people")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single()
  if (error) throw error
  return data
}

export async function deletePerson(id: string): Promise<void> {
  const { error } = await supabase.from("people").delete().eq("id", id)
  if (error) throw error
}

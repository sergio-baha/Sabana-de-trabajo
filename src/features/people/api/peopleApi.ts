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

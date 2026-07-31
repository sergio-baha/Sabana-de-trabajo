import { supabase } from "@/lib/supabaseClient"
import type { ActivityPhase, Database } from "@/types/database.types"

export type Activity = Database["public"]["Tables"]["activities"]["Row"]

export interface ActivityWithCell extends Activity {
  allocation: { person_id: string; project_id: string; month_id: string }
}

// select con recurso embebido — igual que listCommentsForMonth en
// commentsApi.ts, el resultado se castea porque database.types.ts no
// describe FKs para inferencia de embeds (ver nota ahí).
export async function listActivitiesForMonth(monthId: string): Promise<ActivityWithCell[]> {
  const { data, error } = await supabase
    .from("activities")
    .select("*, allocation:allocations!inner(person_id, project_id, month_id)")
    .eq("allocation.month_id", monthId)
    .order("activity_date", { ascending: true, nullsFirst: false })
  if (error) throw error
  return data as unknown as ActivityWithCell[]
}

export interface CreateActivityInput {
  allocationId: string
  description: string
  phase: ActivityPhase | null
  activityDate: string | null
  hours: number
  monthId: string
}

export async function createActivity(input: CreateActivityInput): Promise<Activity> {
  const { data, error } = await supabase
    .from("activities")
    .insert({
      allocation_id: input.allocationId,
      month_id: input.monthId,
      description: input.description,
      phase: input.phase,
      activity_date: input.activityDate,
      hours: input.hours,
    })
    .select("*")
    .single()
  if (error) throw error
  return data
}

export async function updateActivity(
  id: string,
  patch: Database["public"]["Tables"]["activities"]["Update"]
): Promise<Activity> {
  const { data, error } = await supabase
    .from("activities")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single()
  if (error) throw error
  return data
}

export async function deleteActivity(id: string): Promise<void> {
  const { error } = await supabase.from("activities").delete().eq("id", id)
  if (error) throw error
}

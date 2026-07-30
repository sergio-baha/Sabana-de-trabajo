import { create } from "zustand"
import type { Session } from "@supabase/supabase-js"
import type { Database } from "@/types/database.types"

type Profile = Database["public"]["Tables"]["profiles"]["Row"]

interface SessionState {
  session: Session | null
  profile: Profile | null
  status: "loading" | "signed-out" | "signed-in"
  setSession: (session: Session | null) => void
  setProfile: (profile: Profile | null) => void
  setStatus: (status: SessionState["status"]) => void
}

export const useSessionStore = create<SessionState>((set) => ({
  session: null,
  profile: null,
  status: "loading",
  setSession: (session) => set({ session }),
  setProfile: (profile) => set({ profile }),
  setStatus: (status) => set({ status }),
}))

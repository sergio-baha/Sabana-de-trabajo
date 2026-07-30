// Tipos escritos a mano siguiendo el esquema de supabase/migrations/.
// Reemplazar por `supabase gen types typescript --linked` una vez exista un
// proyecto Supabase real (ver docs/INSTALACION.md) para mantenerlos exactos.

export type AppRole = "administrador" | "gestor" | "analista"
export type PersonStatus = "activo" | "inactivo"
export type ProjectStatus = "activo" | "pausado" | "finalizado" | "archivado"
export type MonthStatus = "abierto" | "cerrado" | "archivado"
export type TaskStatus = "pendiente" | "en_progreso" | "completada"
export type InvitationStatus = "pendiente" | "aceptada" | "revocada"
export type AuditAction = "insert" | "update" | "delete"
export type StatusColor = "verde" | "amarillo" | "rojo"

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string
          role: AppRole
          is_active: boolean
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database["public"]["Tables"]["profiles"]["Row"]> & {
          id: string
          email: string
          full_name: string
        }
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>
      }
      months: {
        Row: {
          id: string
          name: string
          status: MonthStatus
          default_hours: number
          working_days: number | null
          notes: string | null
          source_month_id: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database["public"]["Tables"]["months"]["Row"]> & {
          name: string
        }
        Update: Partial<Database["public"]["Tables"]["months"]["Row"]>
      }
      people: {
        Row: {
          id: string
          month_id: string
          name: string
          job_title: string | null
          available_hours: number
          status: PersonStatus
          notes: string | null
          cloned_from_id: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database["public"]["Tables"]["people"]["Row"]> & {
          month_id: string
          name: string
        }
        Update: Partial<Database["public"]["Tables"]["people"]["Row"]>
      }
      projects: {
        Row: {
          id: string
          month_id: string
          name: string
          color: string
          status: ProjectStatus
          description: string | null
          cloned_from_id: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database["public"]["Tables"]["projects"]["Row"]> & {
          month_id: string
          name: string
        }
        Update: Partial<Database["public"]["Tables"]["projects"]["Row"]>
      }
      project_managers: {
        Row: {
          id: string
          month_id: string
          project_id: string
          person_id: string
          is_primary: boolean
          created_at: string
        }
        Insert: Partial<Database["public"]["Tables"]["project_managers"]["Row"]> & {
          month_id: string
          project_id: string
          person_id: string
        }
        Update: Partial<Database["public"]["Tables"]["project_managers"]["Row"]>
      }
      tasks: {
        Row: {
          id: string
          month_id: string
          project_id: string
          title: string
          description: string | null
          status: TaskStatus
          assigned_person_id: string | null
          due_date: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database["public"]["Tables"]["tasks"]["Row"]> & {
          month_id: string
          project_id: string
          title: string
        }
        Update: Partial<Database["public"]["Tables"]["tasks"]["Row"]>
      }
      allocations: {
        Row: {
          id: string
          month_id: string
          person_id: string
          project_id: string
          hours: number
          updated_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database["public"]["Tables"]["allocations"]["Row"]> & {
          month_id: string
          person_id: string
          project_id: string
        }
        Update: Partial<Database["public"]["Tables"]["allocations"]["Row"]>
      }
      comments: {
        Row: {
          id: string
          allocation_id: string
          parent_comment_id: string | null
          author_id: string
          body: string
          resolved: boolean
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database["public"]["Tables"]["comments"]["Row"]> & {
          allocation_id: string
          author_id: string
          body: string
        }
        Update: Partial<Database["public"]["Tables"]["comments"]["Row"]>
      }
      settings: {
        Row: {
          id: number
          company_name: string
          logo_url: string | null
          default_hours: number
          default_hours_options: number[]
          default_working_days: number
          updated_by: string | null
          updated_at: string
        }
        Insert: Partial<Database["public"]["Tables"]["settings"]["Row"]>
        Update: Partial<Database["public"]["Tables"]["settings"]["Row"]>
      }
      invitations: {
        Row: {
          id: string
          email: string
          role: AppRole
          status: InvitationStatus
          invited_by: string | null
          invited_at: string
          accepted_at: string | null
          revoked_at: string | null
        }
        Insert: Partial<Database["public"]["Tables"]["invitations"]["Row"]> & {
          email: string
        }
        Update: Partial<Database["public"]["Tables"]["invitations"]["Row"]>
      }
      audit_logs: {
        Row: {
          id: string
          table_name: string
          record_id: string
          action: AuditAction
          field_name: string | null
          old_value: string | null
          new_value: string | null
          changed_by: string | null
          month_id: string | null
          changed_at: string
        }
        Insert: never
        Update: never
      }
      month_snapshots: {
        Row: {
          id: string
          month_id: string
          label: string | null
          snapshot: unknown
          created_by: string | null
          created_at: string
        }
        Insert: never
        Update: never
      }
    }
    Views: {
      v_person_month_totals: {
        Row: {
          month_id: string
          person_id: string
          name: string
          job_title: string | null
          status: PersonStatus
          available_hours: number
          allocated_hours: number
          difference_hours: number
          status_color: StatusColor
        }
      }
      v_project_month_totals: {
        Row: {
          month_id: string
          project_id: string
          name: string
          color: string
          status: ProjectStatus
          allocated_hours: number
          people_count: number
        }
      }
      v_manager_month_totals: {
        Row: {
          month_id: string
          manager_id: string
          manager_name: string
          allocated_hours: number
          projects_count: number
        }
      }
    }
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean }
      is_gestor_or_admin: { Args: Record<string, never>; Returns: boolean }
      is_month_locked: { Args: { p_month_id: string }; Returns: boolean }
      can_write_month: { Args: { p_month_id: string }; Returns: boolean }
      create_month_from_previous: {
        Args: { p_source_month_id: string; p_new_name: string }
        Returns: string
      }
      create_month_snapshot: {
        Args: { p_month_id: string; p_label?: string | null }
        Returns: string
      }
      restore_month_snapshot: {
        Args: { p_snapshot_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: AppRole
      person_status: PersonStatus
      project_status: ProjectStatus
      month_status: MonthStatus
      task_status: TaskStatus
      invitation_status: InvitationStatus
      audit_action: AuditAction
    }
  }
}

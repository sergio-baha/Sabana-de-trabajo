// Tipos escritos a mano siguiendo el esquema de supabase/migrations/.
// Reemplazar por `supabase gen types typescript --linked` una vez exista un
// proyecto Supabase real (ver docs/INSTALACION.md) para mantenerlos exactos.
//
// Los tipos Insert/Update se escriben como objetos planos (no como
// `Partial<Row> & {...}` autorreferenciado): supabase-js necesita esa forma
// exacta para poder inferir correctamente los genéricos de `.insert()`,
// `.update()` y `.rpc()` — una intersección autorreferenciada rompe esa
// inferencia y todo el cliente tipado degrada a `never`.

export type AppRole = "administrador" | "gestor" | "analista"
export type PersonStatus = "activo" | "inactivo"
export type ProjectStatus = "activo" | "pausado" | "finalizado" | "archivado"
export type MonthStatus = "abierto" | "cerrado" | "archivado"
export type TaskStatus = "pendiente" | "en_progreso" | "completada"
export type InvitationStatus = "pendiente" | "aceptada" | "revocada"
export type AuditAction = "insert" | "update" | "delete"
export type StatusColor = "verde" | "amarillo" | "rojo"

// GenericTable/GenericView (postgrest-js) exigen un campo Relationships
// aunque esté vacío — sin él, TS no reconoce el objeto como
// GenericTable/GenericView y toda la inferencia de
// .insert()/.update()/.select() colapsa a `never`.

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
        Insert: {
          id: string
          email: string
          full_name: string
          role?: AppRole
          is_active?: boolean
          avatar_url?: string | null
        }
        Update: {
          role?: AppRole
          is_active?: boolean
          avatar_url?: string | null
          full_name?: string
        }
        Relationships: []
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
        Insert: {
          name: string
          status?: MonthStatus
          default_hours?: number
          working_days?: number | null
          notes?: string | null
          source_month_id?: string | null
          created_by?: string | null
        }
        Update: {
          name?: string
          status?: MonthStatus
          default_hours?: number
          working_days?: number | null
          notes?: string | null
        }
        Relationships: []
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
        Insert: {
          month_id: string
          name: string
          job_title?: string | null
          available_hours?: number
          status?: PersonStatus
          notes?: string | null
          created_by?: string | null
        }
        Update: {
          name?: string
          job_title?: string | null
          available_hours?: number
          status?: PersonStatus
          notes?: string | null
        }
        Relationships: []
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
        Insert: {
          month_id: string
          name: string
          color?: string
          status?: ProjectStatus
          description?: string | null
          created_by?: string | null
        }
        Update: {
          name?: string
          color?: string
          status?: ProjectStatus
          description?: string | null
        }
        Relationships: []
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
        Insert: {
          month_id: string
          project_id: string
          person_id: string
          is_primary?: boolean
        }
        Update: {
          is_primary?: boolean
        }
        Relationships: []
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
        Insert: {
          month_id: string
          project_id: string
          title: string
          description?: string | null
          status?: TaskStatus
          assigned_person_id?: string | null
          due_date?: string | null
          created_by?: string | null
        }
        Update: {
          title?: string
          description?: string | null
          status?: TaskStatus
          assigned_person_id?: string | null
          due_date?: string | null
        }
        Relationships: []
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
        Insert: {
          month_id: string
          person_id: string
          project_id: string
          hours?: number
        }
        Update: {
          hours?: number
        }
        Relationships: []
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
        Insert: {
          allocation_id: string
          parent_comment_id?: string | null
          author_id: string
          body: string
          resolved?: boolean
        }
        Update: {
          body?: string
          resolved?: boolean
        }
        Relationships: []
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
        Insert: {
          company_name?: string
          logo_url?: string | null
          default_hours?: number
          default_hours_options?: number[]
          default_working_days?: number
        }
        Update: {
          company_name?: string
          logo_url?: string | null
          default_hours?: number
          default_hours_options?: number[]
          default_working_days?: number
        }
        Relationships: []
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
        Insert: {
          email: string
          role?: AppRole
          status?: InvitationStatus
          invited_by?: string | null
        }
        Update: {
          status?: InvitationStatus
          accepted_at?: string | null
          revoked_at?: string | null
        }
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
      }
      v_manager_month_totals: {
        Row: {
          month_id: string
          manager_id: string
          manager_name: string
          allocated_hours: number
          projects_count: number
        }
        Relationships: []
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

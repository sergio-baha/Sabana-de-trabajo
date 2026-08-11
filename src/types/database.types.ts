export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      activities: {
        Row: {
          activity_date: string | null
          allocation_id: string
          created_at: string
          created_by: string | null
          description: string
          hours: number
          id: string
          month_id: string
          phase_id: string | null
          updated_at: string
        }
        Insert: {
          activity_date?: string | null
          allocation_id: string
          created_at?: string
          created_by?: string | null
          description: string
          hours?: number
          id?: string
          month_id: string
          phase_id?: string | null
          updated_at?: string
        }
        Update: {
          activity_date?: string | null
          allocation_id?: string
          created_at?: string
          created_by?: string | null
          description?: string
          hours?: number
          id?: string
          month_id?: string
          phase_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_allocation_id_fkey"
            columns: ["allocation_id"]
            isOneToOne: false
            referencedRelation: "allocations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_month_id_fkey"
            columns: ["month_id"]
            isOneToOne: false
            referencedRelation: "months"
            referencedColumns: ["id"]
          },
        ]
      }
      allocations: {
        Row: {
          created_at: string
          hours: number
          id: string
          month_id: string
          person_id: string
          project_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          hours?: number
          id?: string
          month_id: string
          person_id: string
          project_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          hours?: number
          id?: string
          month_id?: string
          person_id?: string
          project_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "allocations_month_id_fkey"
            columns: ["month_id"]
            isOneToOne: false
            referencedRelation: "months"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allocations_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allocations_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "v_person_month_totals"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "allocations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allocations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_month_totals"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "allocations_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"]
          changed_at: string
          changed_by: string | null
          field_name: string | null
          id: string
          month_id: string | null
          new_value: string | null
          old_value: string | null
          record_id: string
          table_name: string
        }
        Insert: {
          action: Database["public"]["Enums"]["audit_action"]
          changed_at?: string
          changed_by?: string | null
          field_name?: string | null
          id?: string
          month_id?: string | null
          new_value?: string | null
          old_value?: string | null
          record_id: string
          table_name: string
        }
        Update: {
          action?: Database["public"]["Enums"]["audit_action"]
          changed_at?: string
          changed_by?: string | null
          field_name?: string | null
          id?: string
          month_id?: string | null
          new_value?: string | null
          old_value?: string | null
          record_id?: string
          table_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          allocation_id: string
          author_id: string
          body: string
          created_at: string
          id: string
          parent_comment_id: string | null
          resolved: boolean
          updated_at: string
        }
        Insert: {
          allocation_id: string
          author_id: string
          body: string
          created_at?: string
          id?: string
          parent_comment_id?: string | null
          resolved?: boolean
          updated_at?: string
        }
        Update: {
          allocation_id?: string
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          parent_comment_id?: string | null
          resolved?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_allocation_id_fkey"
            columns: ["allocation_id"]
            isOneToOne: false
            referencedRelation: "allocations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          email: string
          id: string
          invited_at: string
          invited_by: string | null
          revoked_at: string | null
          role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["invitation_status"]
        }
        Insert: {
          accepted_at?: string | null
          email: string
          id?: string
          invited_at?: string
          invited_by?: string | null
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["invitation_status"]
        }
        Update: {
          accepted_at?: string | null
          email?: string
          id?: string
          invited_at?: string
          invited_by?: string | null
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["invitation_status"]
        }
        Relationships: [
          {
            foreignKeyName: "invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      month_snapshots: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          label: string | null
          month_id: string
          snapshot: Json
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string | null
          month_id: string
          snapshot: Json
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string | null
          month_id?: string
          snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "month_snapshots_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "month_snapshots_month_id_fkey"
            columns: ["month_id"]
            isOneToOne: false
            referencedRelation: "months"
            referencedColumns: ["id"]
          },
        ]
      }
      months: {
        Row: {
          created_at: string
          created_by: string | null
          default_hours: number
          id: string
          name: string
          notes: string | null
          source_month_id: string | null
          status: Database["public"]["Enums"]["month_status"]
          updated_at: string
          working_days: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          default_hours?: number
          id?: string
          name: string
          notes?: string | null
          source_month_id?: string | null
          status?: Database["public"]["Enums"]["month_status"]
          updated_at?: string
          working_days?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          default_hours?: number
          id?: string
          name?: string
          notes?: string | null
          source_month_id?: string | null
          status?: Database["public"]["Enums"]["month_status"]
          updated_at?: string
          working_days?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "months_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "months_source_month_id_fkey"
            columns: ["source_month_id"]
            isOneToOne: false
            referencedRelation: "months"
            referencedColumns: ["id"]
          },
        ]
      }
      people: {
        Row: {
          available_hours: number
          cloned_from_id: string | null
          created_at: string
          created_by: string | null
          id: string
          job_title: string | null
          month_id: string
          name: string
          notes: string | null
          profile_id: string | null
          status: Database["public"]["Enums"]["person_status"]
          updated_at: string
        }
        Insert: {
          available_hours?: number
          cloned_from_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          job_title?: string | null
          month_id: string
          name: string
          notes?: string | null
          profile_id?: string | null
          status?: Database["public"]["Enums"]["person_status"]
          updated_at?: string
        }
        Update: {
          available_hours?: number
          cloned_from_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          job_title?: string | null
          month_id?: string
          name?: string
          notes?: string | null
          profile_id?: string | null
          status?: Database["public"]["Enums"]["person_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "people_cloned_from_id_fkey"
            columns: ["cloned_from_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_cloned_from_id_fkey"
            columns: ["cloned_from_id"]
            isOneToOne: false
            referencedRelation: "v_person_month_totals"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "people_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_month_id_fkey"
            columns: ["month_id"]
            isOneToOne: false
            referencedRelation: "months"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          onboarded_at: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name: string
          id: string
          is_active?: boolean
          onboarded_at?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          onboarded_at?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      project_managers: {
        Row: {
          created_at: string
          id: string
          is_primary: boolean
          month_id: string
          person_id: string
          project_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_primary?: boolean
          month_id: string
          person_id: string
          project_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_primary?: boolean
          month_id?: string
          person_id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_managers_month_id_fkey"
            columns: ["month_id"]
            isOneToOne: false
            referencedRelation: "months"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_managers_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_managers_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "v_person_month_totals"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "project_managers_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_managers_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_month_totals"
            referencedColumns: ["project_id"]
          },
        ]
      }
      task_assignees: {
        Row: {
          created_at: string
          id: string
          month_id: string
          person_id: string
          task_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          month_id: string
          person_id: string
          task_id: string
        }
        Update: {
          created_at?: string
          id?: string
          month_id?: string
          person_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_assignees_month_id_fkey"
            columns: ["month_id"]
            isOneToOne: false
            referencedRelation: "months"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignees_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignees_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "v_person_month_totals"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "task_assignees_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      project_members: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          month_id: string
          person_id: string
          project_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          month_id: string
          person_id: string
          project_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          month_id?: string
          person_id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_month_id_fkey"
            columns: ["month_id"]
            isOneToOne: false
            referencedRelation: "months"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "v_person_month_totals"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_month_totals"
            referencedColumns: ["project_id"]
          },
        ]
      }
      person_rates: {
        Row: {
          created_at: string
          hourly_rate: number
          month_id: string
          person_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          hourly_rate: number
          month_id: string
          person_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          hourly_rate?: number
          month_id?: string
          person_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "person_rates_month_id_fkey"
            columns: ["month_id"]
            isOneToOne: false
            referencedRelation: "months"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_rates_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: true
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_projects: {
        Row: {
          budget_amount: number | null
          budget_hours: number | null
          category: Database["public"]["Enums"]["project_category"]
          color: string
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          end_date: string | null
          id: string
          name: string
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"]
          updated_at: string
        }
        Insert: {
          budget_amount?: number | null
          budget_hours?: number | null
          category?: Database["public"]["Enums"]["project_category"]
          color?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          end_date?: string | null
          id?: string
          name: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Update: {
          budget_amount?: number | null
          budget_hours?: number | null
          category?: Database["public"]["Enums"]["project_category"]
          color?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          end_date?: string | null
          id?: string
          name?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_expenses: {
        Row: {
          amount: number
          concept: string
          created_at: string
          created_by: string | null
          id: string
          incurred_on: string
          month_id: string | null
          notes: string | null
          phase_id: string | null
          portfolio_project_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          concept: string
          created_at?: string
          created_by?: string | null
          id?: string
          incurred_on?: string
          month_id?: string | null
          notes?: string | null
          phase_id?: string | null
          portfolio_project_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          concept?: string
          created_at?: string
          created_by?: string | null
          id?: string
          incurred_on?: string
          month_id?: string | null
          notes?: string | null
          phase_id?: string | null
          portfolio_project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_expenses_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "project_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_expenses_portfolio_project_id_fkey"
            columns: ["portfolio_project_id"]
            isOneToOne: false
            referencedRelation: "portfolio_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_phases: {
        Row: {
          budget_amount: number | null
          budget_hours: number | null
          created_at: string
          created_by: string | null
          end_date: string | null
          id: string
          name: string
          phase_key: Database["public"]["Enums"]["activity_phase"] | null
          portfolio_project_id: string
          position: number
          start_date: string | null
          status: Database["public"]["Enums"]["phase_status"]
          updated_at: string
        }
        Insert: {
          budget_amount?: number | null
          budget_hours?: number | null
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          id?: string
          name: string
          phase_key?: Database["public"]["Enums"]["activity_phase"] | null
          portfolio_project_id: string
          position?: number
          start_date?: string | null
          status?: Database["public"]["Enums"]["phase_status"]
          updated_at?: string
        }
        Update: {
          budget_amount?: number | null
          budget_hours?: number | null
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          id?: string
          name?: string
          phase_key?: Database["public"]["Enums"]["activity_phase"] | null
          portfolio_project_id?: string
          position?: number
          start_date?: string | null
          status?: Database["public"]["Enums"]["phase_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_phases_portfolio_project_id_fkey"
            columns: ["portfolio_project_id"]
            isOneToOne: false
            referencedRelation: "portfolio_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          category: Database["public"]["Enums"]["project_category"]
          cloned_from_id: string | null
          color: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          month_id: string
          name: string
          portfolio_project_id: string | null
          status: Database["public"]["Enums"]["project_status"]
          updated_at: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["project_category"]
          cloned_from_id?: string | null
          color?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          month_id: string
          name: string
          portfolio_project_id?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["project_category"]
          cloned_from_id?: string | null
          color?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          month_id?: string
          name?: string
          portfolio_project_id?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_cloned_from_id_fkey"
            columns: ["cloned_from_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_cloned_from_id_fkey"
            columns: ["cloned_from_id"]
            isOneToOne: false
            referencedRelation: "v_project_month_totals"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_month_id_fkey"
            columns: ["month_id"]
            isOneToOne: false
            referencedRelation: "months"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          company_name: string
          default_hours: number
          default_hours_options: number[]
          default_working_days: number
          id: number
          logo_url: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          company_name?: string
          default_hours?: number
          default_hours_options?: number[]
          default_working_days?: number
          id?: number
          logo_url?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          company_name?: string
          default_hours?: number
          default_hours_options?: number[]
          default_working_days?: number
          id?: number
          logo_url?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          board_order: number
          completed_at: string | null
          completed_hours: number | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          estimated_hours: number | null
          id: string
          month_id: string
          parent_task_id: string | null
          phase_id: string | null
          priority: number
          project_id: string
          start_date: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["task_status"]
          tags: string[]
          title: string
          updated_at: string
          work_item_type: Database["public"]["Enums"]["work_item_type"]
        }
        Insert: {
          board_order?: number
          completed_at?: string | null
          completed_hours?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          id?: string
          month_id: string
          parent_task_id?: string | null
          phase_id?: string | null
          priority?: number
          project_id: string
          start_date?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          tags?: string[]
          title: string
          updated_at?: string
          work_item_type?: Database["public"]["Enums"]["work_item_type"]
        }
        Update: {
          board_order?: number
          completed_at?: string | null
          completed_hours?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          id?: string
          month_id?: string
          parent_task_id?: string | null
          phase_id?: string | null
          priority?: number
          project_id?: string
          start_date?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          tags?: string[]
          title?: string
          updated_at?: string
          work_item_type?: Database["public"]["Enums"]["work_item_type"]
        }
        Relationships: [
          {
            foreignKeyName: "tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_month_id_fkey"
            columns: ["month_id"]
            isOneToOne: false
            referencedRelation: "months"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_month_totals"
            referencedColumns: ["project_id"]
          },
        ]
      }
    }
    Views: {
      // Row corregido a mano: gen types marca las columnas de vistas como
      // nullable por defecto, pero estas nunca lo son en la práctica (vienen
      // de columnas not null agrupadas/joinadas — ver *_reporting_views.sql).
      v_manager_month_totals: {
        Row: {
          allocated_hours: number
          manager_id: string
          manager_name: string
          month_id: string
          projects_count: number
        }
        Relationships: [
          {
            foreignKeyName: "project_managers_month_id_fkey"
            columns: ["month_id"]
            isOneToOne: false
            referencedRelation: "months"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_managers_person_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_managers_person_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "v_person_month_totals"
            referencedColumns: ["person_id"]
          },
        ]
      }
      v_person_month_totals: {
        Row: {
          allocated_hours: number
          available_hours: number
          difference_hours: number
          job_title: string | null
          month_id: string
          name: string
          person_id: string
          status: Database["public"]["Enums"]["person_status"]
          status_color: "verde" | "amarillo" | "rojo"
        }
        Relationships: [
          {
            foreignKeyName: "people_month_id_fkey"
            columns: ["month_id"]
            isOneToOne: false
            referencedRelation: "months"
            referencedColumns: ["id"]
          },
        ]
      }
      // Las vistas *_cost son SECURITY DEFINER y filtran a Gestor/
      // Administrador dentro del propio SQL: para el resto de roles no
      // devuelven filas, no devuelven ceros (ver
      // *_portfolio_reporting_views.sql).
      v_portfolio_project_cost: {
        Row: {
          labor_cost: number
          portfolio_project_id: string
          unrated_hours: number
        }
        Relationships: [
          {
            foreignKeyName: "projects_portfolio_project_id_fkey"
            columns: ["portfolio_project_id"]
            isOneToOne: false
            referencedRelation: "portfolio_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      v_portfolio_project_totals: {
        Row: {
          allocated_hours: number
          budget_amount: number | null
          budget_hours: number | null
          category: Database["public"]["Enums"]["project_category"]
          color: string
          currency: string
          end_date: string | null
          expense_total: number
          months_count: number
          name: string
          people_count: number
          portfolio_project_id: string
          remaining_hours: number | null
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"]
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_projects_id_fkey"
            columns: ["portfolio_project_id"]
            isOneToOne: true
            referencedRelation: "portfolio_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      v_project_phase_cost: {
        Row: {
          labor_cost: number
          phase_id: string
          unrated_hours: number
        }
        Relationships: []
      }
      v_project_phase_totals: {
        Row: {
          allocated_hours: number
          budget_amount: number | null
          budget_hours: number | null
          end_date: string | null
          expense_total: number
          name: string
          phase_id: string
          phase_key: Database["public"]["Enums"]["activity_phase"] | null
          portfolio_project_id: string
          position: number
          remaining_hours: number | null
          start_date: string | null
          status: Database["public"]["Enums"]["phase_status"]
        }
        Relationships: [
          {
            foreignKeyName: "project_phases_portfolio_project_id_fkey"
            columns: ["portfolio_project_id"]
            isOneToOne: false
            referencedRelation: "portfolio_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      v_project_month_totals: {
        Row: {
          allocated_hours: number
          category: Database["public"]["Enums"]["project_category"]
          color: string
          month_id: string
          name: string
          people_count: number
          project_id: string
          status: Database["public"]["Enums"]["project_status"]
        }
        Relationships: [
          {
            foreignKeyName: "projects_month_id_fkey"
            columns: ["month_id"]
            isOneToOne: false
            referencedRelation: "months"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      can_write_month: { Args: { p_month_id: string }; Returns: boolean }
      create_month_from_previous: {
        Args: { p_new_name: string; p_source_month_id: string }
        Returns: string
      }
      create_month_snapshot: {
        Args: { p_label?: string; p_month_id: string }
        Returns: string
      }
      is_admin: { Args: never; Returns: boolean }
      is_gestor_or_admin: { Args: never; Returns: boolean }
      is_month_locked: { Args: { p_month_id: string }; Returns: boolean }
      restore_month_snapshot: {
        Args: { p_snapshot_id: string }
        Returns: undefined
      }
    }
    Enums: {
      activity_phase:
        | "descubrir"
        | "definir"
        | "desarrollar"
        | "producto"
        | "entregar"
      app_role:
        | "administrador"
        | "gestor"
        | "analista"
        | "analista_tecnologia"
      audit_action: "insert" | "update" | "delete"
      invitation_status: "pendiente" | "aceptada" | "revocada"
      month_status: "abierto" | "cerrado" | "archivado"
      person_status: "activo" | "inactivo"
      phase_status: "pendiente" | "en_curso" | "completada"
      project_category: "proyecto" | "institucional"
      project_status: "activo" | "pausado" | "finalizado" | "archivado"
      task_status:
        | "pendiente"
        | "en_progreso"
        | "en_revision"
        | "bloqueada"
        | "completada"
      work_item_type: "epica" | "historia" | "tarea" | "bug"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      activity_phase: [
        "descubrir",
        "definir",
        "desarrollar",
        "producto",
        "entregar",
      ],
      app_role: [
        "administrador",
        "gestor",
        "analista",
        "analista_tecnologia",
      ],
      audit_action: ["insert", "update", "delete"],
      invitation_status: ["pendiente", "aceptada", "revocada"],
      month_status: ["abierto", "cerrado", "archivado"],
      person_status: ["activo", "inactivo"],
      phase_status: ["pendiente", "en_curso", "completada"],
      project_category: ["proyecto", "institucional"],
      project_status: ["activo", "pausado", "finalizado", "archivado"],
      task_status: [
        "pendiente",
        "en_progreso",
        "en_revision",
        "bloqueada",
        "completada",
      ],
      work_item_type: ["epica", "historia", "tarea", "bug"],
    },
  },
} as const

// Alias de conveniencia usados en toda la app (features/*/api, componentes)
// — generados a mano porque `supabase gen types` no produce nombres cortos
// para los enums, solo `Database["public"]["Enums"]["app_role"]`, etc.
export type AppRole = Database["public"]["Enums"]["app_role"]
export type PersonStatus = Database["public"]["Enums"]["person_status"]
export type ProjectStatus = Database["public"]["Enums"]["project_status"]
export type ProjectCategory = Database["public"]["Enums"]["project_category"]
export type MonthStatus = Database["public"]["Enums"]["month_status"]
export type TaskStatus = Database["public"]["Enums"]["task_status"]
export type WorkItemType = Database["public"]["Enums"]["work_item_type"]
export type InvitationStatus = Database["public"]["Enums"]["invitation_status"]
export type AuditAction = Database["public"]["Enums"]["audit_action"]
export type ActivityPhase = Database["public"]["Enums"]["activity_phase"]
export type PhaseStatus = Database["public"]["Enums"]["phase_status"]
// No es un enum real de Postgres (viene de un CASE WHEN en la vista de
// reporte), así que no existe en Database["public"]["Enums"] — se define
// a mano, igual que antes.
export type StatusColor = "verde" | "amarillo" | "rojo"

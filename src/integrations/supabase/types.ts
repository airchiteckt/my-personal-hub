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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ai_prompts: {
        Row: {
          created_at: string
          description: string | null
          function_key: string
          id: string
          is_active: boolean
          label: string
          system_prompt: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          function_key: string
          id?: string
          is_active?: boolean
          label: string
          system_prompt: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          function_key?: string
          id?: string
          is_active?: boolean
          label?: string
          system_prompt?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      appointments: {
        Row: {
          color: string | null
          created_at: string
          date: string
          description: string | null
          end_time: string
          enterprise_id: string | null
          id: string
          start_time: string
          title: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          date: string
          description?: string | null
          end_time: string
          enterprise_id?: string | null
          id?: string
          start_time: string
          title: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          date?: string
          description?: string | null
          end_time?: string
          enterprise_id?: string | null
          id?: string
          start_time?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprises: {
        Row: {
          business_category: string
          color: string
          created_at: string
          growth_potential: number
          id: string
          name: string
          phase: string
          priority_until: string | null
          status: Database["public"]["Enums"]["enterprise_status"]
          strategic_importance: number
          time_horizon: string
          user_id: string | null
        }
        Insert: {
          business_category?: string
          color?: string
          created_at?: string
          growth_potential?: number
          id?: string
          name: string
          phase?: string
          priority_until?: string | null
          status?: Database["public"]["Enums"]["enterprise_status"]
          strategic_importance?: number
          time_horizon?: string
          user_id?: string | null
        }
        Update: {
          business_category?: string
          color?: string
          created_at?: string
          growth_potential?: number
          id?: string
          name?: string
          phase?: string
          priority_until?: string | null
          status?: Database["public"]["Enums"]["enterprise_status"]
          strategic_importance?: number
          time_horizon?: string
          user_id?: string | null
        }
        Relationships: []
      }
      focus_periods: {
        Row: {
          created_at: string
          end_date: string
          enterprise_id: string
          id: string
          name: string
          start_date: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          end_date: string
          enterprise_id: string
          id?: string
          name: string
          start_date: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          end_date?: string
          enterprise_id?: string
          id?: string
          name?: string
          start_date?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "focus_periods_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
        ]
      }
      key_results: {
        Row: {
          created_at: string
          current_value: number
          deadline: string | null
          enterprise_id: string
          id: string
          metric_type: string
          objective_id: string
          status: string
          target_value: number
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_value?: number
          deadline?: string | null
          enterprise_id: string
          id?: string
          metric_type?: string
          objective_id: string
          status?: string
          target_value?: number
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_value?: number
          deadline?: string | null
          enterprise_id?: string
          id?: string
          metric_type?: string
          objective_id?: string
          status?: string
          target_value?: number
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "key_results_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_results_objective_id_fkey"
            columns: ["objective_id"]
            isOneToOne: false
            referencedRelation: "objectives"
            referencedColumns: ["id"]
          },
        ]
      }
      objectives: {
        Row: {
          created_at: string
          description: string | null
          enterprise_id: string
          focus_period_id: string
          id: string
          status: string
          title: string
          user_id: string
          weight: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          enterprise_id: string
          focus_period_id: string
          id?: string
          status?: string
          title: string
          user_id: string
          weight?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          enterprise_id?: string
          focus_period_id?: string
          id?: string
          status?: string
          title?: string
          user_id?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "objectives_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "objectives_focus_period_id_fkey"
            columns: ["focus_period_id"]
            isOneToOne: false
            referencedRelation: "focus_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      priority_settings: {
        Row: {
          created_at: string
          deadline_attention_boost: number
          deadline_attention_hours: number
          deadline_boost_enabled: boolean
          deadline_critical_boost: number
          deadline_critical_hours: number
          deadline_high_boost: number
          deadline_high_hours: number
          effort_penalty: number
          id: string
          impact_effort_enabled: boolean
          impact_multiplier: number
          maintenance_weight: number
          operational_weight: number
          strategic_weight: number
          strategic_weight_enabled: boolean
          user_id: string | null
        }
        Insert: {
          created_at?: string
          deadline_attention_boost?: number
          deadline_attention_hours?: number
          deadline_boost_enabled?: boolean
          deadline_critical_boost?: number
          deadline_critical_hours?: number
          deadline_high_boost?: number
          deadline_high_hours?: number
          effort_penalty?: number
          id?: string
          impact_effort_enabled?: boolean
          impact_multiplier?: number
          maintenance_weight?: number
          operational_weight?: number
          strategic_weight?: number
          strategic_weight_enabled?: boolean
          user_id?: string | null
        }
        Update: {
          created_at?: string
          deadline_attention_boost?: number
          deadline_attention_hours?: number
          deadline_boost_enabled?: boolean
          deadline_critical_boost?: number
          deadline_critical_hours?: number
          deadline_high_boost?: number
          deadline_high_hours?: number
          effort_penalty?: number
          id?: string
          impact_effort_enabled?: boolean
          impact_multiplier?: number
          maintenance_weight?: number
          operational_weight?: number
          strategic_weight?: number
          strategic_weight_enabled?: boolean
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          created_at: string
          enterprise_id: string
          id: string
          is_strategic_lever: boolean
          key_result_id: string | null
          name: string
          type: Database["public"]["Enums"]["project_type"]
          user_id: string | null
        }
        Insert: {
          created_at?: string
          enterprise_id: string
          id?: string
          is_strategic_lever?: boolean
          key_result_id?: string | null
          name: string
          type?: Database["public"]["Enums"]["project_type"]
          user_id?: string | null
        }
        Update: {
          created_at?: string
          enterprise_id?: string
          id?: string
          is_strategic_lever?: boolean
          key_result_id?: string | null
          name?: string
          type?: Database["public"]["Enums"]["project_type"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_key_result_id_fkey"
            columns: ["key_result_id"]
            isOneToOne: false
            referencedRelation: "key_results"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          completed_at: string | null
          created_at: string
          deadline: string | null
          effort: number | null
          enterprise_id: string
          estimated_minutes: number
          id: string
          impact: number | null
          is_recurring: boolean
          priority: Database["public"]["Enums"]["task_priority"]
          project_id: string
          recurring_frequency: string | null
          scheduled_date: string | null
          scheduled_time: string | null
          status: Database["public"]["Enums"]["task_status"]
          title: string
          user_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          deadline?: string | null
          effort?: number | null
          enterprise_id: string
          estimated_minutes?: number
          id?: string
          impact?: number | null
          is_recurring?: boolean
          priority?: Database["public"]["Enums"]["task_priority"]
          project_id: string
          recurring_frequency?: string | null
          scheduled_date?: string | null
          scheduled_time?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          user_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          deadline?: string | null
          effort?: number | null
          enterprise_id?: string
          estimated_minutes?: number
          id?: string
          impact?: number | null
          is_recurring?: boolean
          priority?: Database["public"]["Enums"]["task_priority"]
          project_id?: string
          recurring_frequency?: string | null
          scheduled_date?: string | null
          scheduled_time?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      enterprise_status: "active" | "development" | "paused"
      project_type: "strategic" | "operational" | "maintenance"
      task_priority: "high" | "medium" | "low"
      task_status: "backlog" | "scheduled" | "done"
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
  public: {
    Enums: {
      enterprise_status: ["active", "development", "paused"],
      project_type: ["strategic", "operational", "maintenance"],
      task_priority: ["high", "medium", "low"],
      task_status: ["backlog", "scheduled", "done"],
    },
  },
} as const

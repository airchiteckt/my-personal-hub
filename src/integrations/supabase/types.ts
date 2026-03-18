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
      activity_logs: {
        Row: {
          action: string
          changes: Json | null
          created_at: string
          entity_id: string
          entity_name: string | null
          entity_type: string
          id: string
          metadata: Json | null
          user_id: string
        }
        Insert: {
          action: string
          changes?: Json | null
          created_at?: string
          entity_id: string
          entity_name?: string | null
          entity_type: string
          id?: string
          metadata?: Json | null
          user_id: string
        }
        Update: {
          action?: string
          changes?: Json | null
          created_at?: string
          entity_id?: string
          entity_name?: string | null
          entity_type?: string
          id?: string
          metadata?: Json | null
          user_id?: string
        }
        Relationships: []
      }
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
      ai_voice_settings: {
        Row: {
          created_at: string
          id: string
          llm_max_tokens: number
          llm_model: string
          llm_system_prompt: string
          llm_temperature: number
          stt_diarize: boolean
          stt_language_code: string
          stt_model: string
          tts_model: string
          tts_similarity_boost: number
          tts_speed: number
          tts_stability: number
          tts_style: number
          tts_use_speaker_boost: boolean
          tts_voice_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          llm_max_tokens?: number
          llm_model?: string
          llm_system_prompt?: string
          llm_temperature?: number
          stt_diarize?: boolean
          stt_language_code?: string
          stt_model?: string
          tts_model?: string
          tts_similarity_boost?: number
          tts_speed?: number
          tts_stability?: number
          tts_style?: number
          tts_use_speaker_boost?: boolean
          tts_voice_id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          llm_max_tokens?: number
          llm_model?: string
          llm_system_prompt?: string
          llm_temperature?: number
          stt_diarize?: boolean
          stt_language_code?: string
          stt_model?: string
          tts_model?: string
          tts_similarity_boost?: number
          tts_speed?: number
          tts_stability?: number
          tts_style?: number
          tts_use_speaker_boost?: boolean
          tts_voice_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      appointment_reminders: {
        Row: {
          appointment_id: string
          created_at: string
          error_message: string | null
          id: string
          reminder_type: string
          scheduled_for: string
          sent_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          appointment_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          reminder_type: string
          scheduled_for: string
          sent_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          appointment_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          reminder_type?: string
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_reminders_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
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
      booking_requests: {
        Row: {
          created_at: string
          duration_minutes: number
          guest_email: string
          guest_name: string
          host_user_id: string
          id: string
          location: string | null
          meeting_type: string
          message: string | null
          requested_date: string
          requested_end_time: string
          requested_start_time: string
          status: string
        }
        Insert: {
          created_at?: string
          duration_minutes?: number
          guest_email: string
          guest_name: string
          host_user_id: string
          id?: string
          location?: string | null
          meeting_type?: string
          message?: string | null
          requested_date: string
          requested_end_time: string
          requested_start_time: string
          status?: string
        }
        Update: {
          created_at?: string
          duration_minutes?: number
          guest_email?: string
          guest_name?: string
          host_user_id?: string
          id?: string
          location?: string | null
          meeting_type?: string
          message?: string | null
          requested_date?: string
          requested_end_time?: string
          requested_start_time?: string
          status?: string
        }
        Relationships: []
      }
      enterprises: {
        Row: {
          business_category: string
          color: string
          created_at: string
          description: string | null
          enterprise_type: string
          growth_potential: number
          id: string
          is_public: boolean
          name: string
          phase: string
          priority_until: string | null
          public_slug: string | null
          status: Database["public"]["Enums"]["enterprise_status"]
          strategic_importance: number
          time_horizon: string
          user_id: string | null
        }
        Insert: {
          business_category?: string
          color?: string
          created_at?: string
          description?: string | null
          enterprise_type?: string
          growth_potential?: number
          id?: string
          is_public?: boolean
          name: string
          phase?: string
          priority_until?: string | null
          public_slug?: string | null
          status?: Database["public"]["Enums"]["enterprise_status"]
          strategic_importance?: number
          time_horizon?: string
          user_id?: string | null
        }
        Update: {
          business_category?: string
          color?: string
          created_at?: string
          description?: string | null
          enterprise_type?: string
          growth_potential?: number
          id?: string
          is_public?: boolean
          name?: string
          phase?: string
          priority_until?: string | null
          public_slug?: string | null
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
          description: string | null
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
          description?: string | null
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
          description?: string | null
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
      journal_entries: {
        Row: {
          content: string
          created_at: string
          energy_afternoon: number | null
          energy_evening: number | null
          energy_level: number | null
          energy_morning: number | null
          entry_date: string
          id: string
          lunar_data: Json | null
          mood: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          energy_afternoon?: number | null
          energy_evening?: number | null
          energy_level?: number | null
          energy_morning?: number | null
          entry_date: string
          id?: string
          lunar_data?: Json | null
          mood?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          energy_afternoon?: number | null
          energy_evening?: number | null
          energy_level?: number | null
          energy_morning?: number | null
          entry_date?: string
          id?: string
          lunar_data?: Json | null
          mood?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      key_results: {
        Row: {
          created_at: string
          current_value: number
          deadline: string | null
          description: string | null
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
          description?: string | null
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
          description?: string | null
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
          work_days: number[]
          work_end_time: string
          work_start_time: string
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
          work_days?: number[]
          work_end_time?: string
          work_start_time?: string
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
          work_days?: number[]
          work_end_time?: string
          work_start_time?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          public_slug: string | null
          showcase_enabled: boolean
          showcase_password: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          public_slug?: string | null
          showcase_enabled?: boolean
          showcase_password?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          public_slug?: string | null
          showcase_enabled?: boolean
          showcase_password?: string | null
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
      reminders: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          enterprise_id: string | null
          id: string
          is_dismissed: boolean
          is_follow_up: boolean
          reminder_date: string
          reminder_time: string | null
          task_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          enterprise_id?: string | null
          id?: string
          is_dismissed?: boolean
          is_follow_up?: boolean
          reminder_date: string
          reminder_time?: string | null
          task_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          enterprise_id?: string | null
          id?: string
          is_dismissed?: boolean
          is_follow_up?: boolean
          reminder_date?: string
          reminder_time?: string | null
          task_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminders_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      ritual_completions: {
        Row: {
          completed_date: string
          completed_time: string | null
          created_at: string
          id: string
          notes: string | null
          ritual_id: string
          status: string
          user_id: string
        }
        Insert: {
          completed_date: string
          completed_time?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          ritual_id: string
          status?: string
          user_id: string
        }
        Update: {
          completed_date?: string
          completed_time?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          ritual_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ritual_completions_ritual_id_fkey"
            columns: ["ritual_id"]
            isOneToOne: false
            referencedRelation: "rituals"
            referencedColumns: ["id"]
          },
        ]
      }
      rituals: {
        Row: {
          category: string
          created_at: string
          custom_frequency_days: number[] | null
          description: string | null
          enterprise_id: string | null
          estimated_minutes: number
          frequency: string
          id: string
          is_active: boolean
          name: string
          planning_mode: string
          suggested_day: number | null
          suggested_time: string | null
          updated_at: string
          user_id: string
          weekly_specific_days: number[] | null
          weekly_times_per_week: number | null
        }
        Insert: {
          category?: string
          created_at?: string
          custom_frequency_days?: number[] | null
          description?: string | null
          enterprise_id?: string | null
          estimated_minutes?: number
          frequency?: string
          id?: string
          is_active?: boolean
          name: string
          planning_mode?: string
          suggested_day?: number | null
          suggested_time?: string | null
          updated_at?: string
          user_id: string
          weekly_specific_days?: number[] | null
          weekly_times_per_week?: number | null
        }
        Update: {
          category?: string
          created_at?: string
          custom_frequency_days?: number[] | null
          description?: string | null
          enterprise_id?: string | null
          estimated_minutes?: number
          frequency?: string
          id?: string
          is_active?: boolean
          name?: string
          planning_mode?: string
          suggested_day?: number | null
          suggested_time?: string | null
          updated_at?: string
          user_id?: string
          weekly_specific_days?: number[] | null
          weekly_times_per_week?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rituals_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
        ]
      }
      slot_invitations: {
        Row: {
          created_at: string
          duration_minutes: number
          expires_at: string | null
          extra_dates: Json
          id: string
          meeting_type: string
          slots: Json
          slug: string
          status: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_minutes?: number
          expires_at?: string | null
          extra_dates?: Json
          id?: string
          meeting_type?: string
          slots?: Json
          slug?: string
          status?: string
          title?: string
          user_id: string
        }
        Update: {
          created_at?: string
          duration_minutes?: number
          expires_at?: string | null
          extra_dates?: Json
          id?: string
          meeting_type?: string
          slots?: Json
          slug?: string
          status?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      slot_responses: {
        Row: {
          created_at: string
          extra_availability: Json
          id: string
          invitation_id: string
          notes: string | null
          respondent_email: string
          respondent_name: string
          selected_slot: Json | null
        }
        Insert: {
          created_at?: string
          extra_availability?: Json
          id?: string
          invitation_id: string
          notes?: string | null
          respondent_email: string
          respondent_name: string
          selected_slot?: Json | null
        }
        Update: {
          created_at?: string
          extra_availability?: Json
          id?: string
          invitation_id?: string
          notes?: string | null
          respondent_email?: string
          respondent_name?: string
          selected_slot?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "slot_responses_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "slot_invitations"
            referencedColumns: ["id"]
          },
        ]
      }
      task_requests: {
        Row: {
          admin_notes: string | null
          created_at: string
          description: string | null
          enterprise_id: string | null
          host_user_id: string
          id: string
          requester_email: string
          requester_name: string
          resolved_at: string | null
          status: string
          suggested_deadline: string | null
          suggested_priority: string | null
          title: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          description?: string | null
          enterprise_id?: string | null
          host_user_id: string
          id?: string
          requester_email: string
          requester_name: string
          resolved_at?: string | null
          status?: string
          suggested_deadline?: string | null
          suggested_priority?: string | null
          title: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          description?: string | null
          enterprise_id?: string | null
          host_user_id?: string
          id?: string
          requester_email?: string
          requester_name?: string
          resolved_at?: string | null
          status?: string
          suggested_deadline?: string | null
          suggested_priority?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_requests_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          completed_at: string | null
          created_at: string
          deadline: string | null
          description: string | null
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
          description?: string | null
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
          description?: string | null
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
      time_entries: {
        Row: {
          created_at: string
          description: string | null
          duration_minutes: number | null
          ended_at: string | null
          enterprise_id: string
          id: string
          project_id: string
          started_at: string
          task_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          ended_at?: string | null
          enterprise_id: string
          id?: string
          project_id: string
          started_at?: string
          task_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          ended_at?: string | null
          enterprise_id?: string
          id?: string
          project_id?: string
          started_at?: string
          task_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wizard_conversations: {
        Row: {
          created_at: string
          enterprise_id: string
          id: string
          messages: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enterprise_id: string
          id?: string
          messages?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enterprise_id?: string
          id?: string
          messages?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wizard_conversations_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_email: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
      enterprise_status: ["active", "development", "paused"],
      project_type: ["strategic", "operational", "maintenance"],
      task_priority: ["high", "medium", "low"],
      task_status: ["backlog", "scheduled", "done"],
    },
  },
} as const

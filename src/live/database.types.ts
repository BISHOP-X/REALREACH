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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      businesses: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
        }
        Relationships: []
      }
      campaign_drafts: {
        Row: {
          action: string
          business_id: string
          created_at: string
          id: string
          owner_id: string
          quantity: number
          title: string
          updated_at: string
        }
        Insert: {
          action?: string
          business_id: string
          created_at?: string
          id?: string
          owner_id: string
          quantity: number
          title: string
          updated_at?: string
        }
        Update: {
          action?: string
          business_id?: string
          created_at?: string
          id?: string
          owner_id?: string
          quantity?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_drafts_business_id_owner_id_fkey"
            columns: ["business_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id", "owner_id"]
          },
        ]
      }
      instagram_bindings: {
        Row: {
          business_id: string
          sender_id: string
          worker_id: string
        }
        Insert: {
          business_id: string
          sender_id: string
          worker_id: string
        }
        Update: {
          business_id?: string
          sender_id?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "instagram_bindings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_connect_attempts: {
        Row: {
          connection_id: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          owner_id: string
          state_hash: string
        }
        Insert: {
          connection_id: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          owner_id: string
          state_hash: string
        }
        Update: {
          connection_id?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          owner_id?: string
          state_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "instagram_connect_attempts_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "instagram_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_connections: {
        Row: {
          business_id: string
          id: string
          owner_id: string
          provider_account_id: string | null
          provider_profile_id: string | null
          status: string
          updated_at: string
          username: string | null
        }
        Insert: {
          business_id: string
          id?: string
          owner_id: string
          provider_account_id?: string | null
          provider_profile_id?: string | null
          status?: string
          updated_at?: string
          username?: string | null
        }
        Update: {
          business_id?: string
          id?: string
          owner_id?: string
          provider_account_id?: string | null
          provider_profile_id?: string | null
          status?: string
          updated_at?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instagram_connections_business_id_owner_id_fkey"
            columns: ["business_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id", "owner_id"]
          },
        ]
      }
      instagram_events: {
        Row: {
          account_id: string | null
          event_type: string
          id: string
          received_at: string
        }
        Insert: {
          account_id?: string | null
          event_type: string
          id: string
          received_at?: string
        }
        Update: {
          account_id?: string | null
          event_type?: string
          id?: string
          received_at?: string
        }
        Relationships: []
      }
      instagram_evidence: {
        Row: {
          id: string
          observed_at: string
          phase: string
          pilot_id: string
          reason: string | null
          result: string
        }
        Insert: {
          id?: string
          observed_at?: string
          phase: string
          pilot_id: string
          reason?: string | null
          result: string
        }
        Update: {
          id?: string
          observed_at?: string
          phase?: string
          pilot_id?: string
          reason?: string | null
          result?: string
        }
        Relationships: [
          {
            foreignKeyName: "instagram_evidence_pilot_id_fkey"
            columns: ["pilot_id"]
            isOneToOne: false
            referencedRelation: "instagram_pilots"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_jobs: {
        Row: {
          attempts: number
          due_at: string
          id: string
          lease_id: string | null
          lease_until: string | null
          phase: string
          pilot_id: string
          state: string
        }
        Insert: {
          attempts?: number
          due_at?: string
          id?: string
          lease_id?: string | null
          lease_until?: string | null
          phase: string
          pilot_id: string
          state?: string
        }
        Update: {
          attempts?: number
          due_at?: string
          id?: string
          lease_id?: string | null
          lease_until?: string | null
          phase?: string
          pilot_id?: string
          state?: string
        }
        Relationships: [
          {
            foreignKeyName: "instagram_jobs_pilot_id_fkey"
            columns: ["pilot_id"]
            isOneToOne: false
            referencedRelation: "instagram_pilots"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_pilots: {
        Row: {
          business_id: string
          business_name: string
          challenge: string
          connection_id: string
          created_at: string
          expires_at: string
          hold_until: string | null
          id: string
          instagram_username: string
          owner_id: string
          reason: string | null
          sender_id: string | null
          status: string
          updated_at: string
          worker_id: string
        }
        Insert: {
          business_id: string
          business_name: string
          challenge: string
          connection_id: string
          created_at?: string
          expires_at?: string
          hold_until?: string | null
          id?: string
          instagram_username: string
          owner_id: string
          reason?: string | null
          sender_id?: string | null
          status?: string
          updated_at?: string
          worker_id: string
        }
        Update: {
          business_id?: string
          business_name?: string
          challenge?: string
          connection_id?: string
          created_at?: string
          expires_at?: string
          hold_until?: string | null
          id?: string
          instagram_username?: string
          owner_id?: string
          reason?: string | null
          sender_id?: string | null
          status?: string
          updated_at?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "instagram_pilots_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instagram_pilots_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "instagram_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      pilot_invites: {
        Row: {
          connection_id: string
          expires_at: string
          id: string
          token_hash: string
          uses: number
        }
        Insert: {
          connection_id: string
          expires_at?: string
          id?: string
          token_hash: string
          uses?: number
        }
        Update: {
          connection_id?: string
          expires_at?: string
          id?: string
          token_hash?: string
          uses?: number
        }
        Relationships: [
          {
            foreignKeyName: "pilot_invites_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "instagram_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_type: string | null
          city: string
          created_at: string
          display_name: string
          id: string
          preferred_front: string
        }
        Insert: {
          account_type?: string | null
          city?: string
          created_at?: string
          display_name?: string
          id: string
          preferred_front?: string
        }
        Update: {
          account_type?: string | null
          city?: string
          created_at?: string
          display_name?: string
          id?: string
          preferred_front?: string
        }
        Relationships: []
      }
      sole_admin: {
        Row: {
          assigned_at: string
          singleton: boolean
          user_id: string
        }
        Insert: {
          assigned_at?: string
          singleton?: boolean
          user_id: string
        }
        Update: {
          assigned_at?: string
          singleton?: boolean
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      rr_claim_pilot: {
        Args: { p_actor: string; p_challenge: string; p_hash: string }
        Returns: string
      }
      rr_complete_onboarding: {
        Args: {
          p_business_name?: string
          p_city?: string
          p_name: string
          p_type: string
        }
        Returns: string
      }
      rr_finish_check: {
        Args: {
          p_job: string
          p_lease: string
          p_reason: string
          p_result: string
        }
        Returns: undefined
      }
      rr_ingest_instagram: {
        Args: {
          p_account: string
          p_challenge: string
          p_event: string
          p_occurred: string
          p_sender: string
          p_type: string
        }
        Returns: undefined
      }
      rr_job_authorized: { Args: { p_hash: string }; Returns: boolean }
      rr_lease_jobs: {
        Args: never
        Returns: {
          attempts: number
          due_at: string
          id: string
          lease_id: string | null
          lease_until: string | null
          phase: string
          pilot_id: string
          state: string
        }[]
        SetofOptions: {
          from: "*"
          to: "instagram_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      rr_request_check: {
        Args: { p_actor: string; p_pilot: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

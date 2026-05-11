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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      application_questions: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_required: boolean
          label: string
          program_id: string
          sort_order: number
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_required?: boolean
          label: string
          program_id: string
          sort_order?: number
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_required?: boolean
          label?: string
          program_id?: string
          sort_order?: number
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_questions_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      application_responses: {
        Row: {
          answers: Json
          applicant_email: string | null
          applicant_info: Json | null
          created_at: string
          id: string
          program_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_at: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          answers?: Json
          applicant_email?: string | null
          applicant_info?: Json | null
          created_at?: string
          id?: string
          program_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          answers?: Json
          applicant_email?: string | null
          applicant_info?: Json | null
          created_at?: string
          id?: string
          program_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "application_responses_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_responses_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_responses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_records: {
        Row: {
          checked_in_at: string | null
          checked_in_by: string | null
          contact_id: string
          created_at: string
          event_id: string
          id: string
          method: string
          notes: string | null
          status: string
        }
        Insert: {
          checked_in_at?: string | null
          checked_in_by?: string | null
          contact_id: string
          created_at?: string
          event_id: string
          id?: string
          method?: string
          notes?: string | null
          status?: string
        }
        Update: {
          checked_in_at?: string | null
          checked_in_by?: string | null
          contact_id?: string
          created_at?: string
          event_id?: string
          id?: string
          method?: string
          notes?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_checked_in_by_fkey"
            columns: ["checked_in_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          changes: Json | null
          created_at: string
          id: string
          resource_id: string
          resource_type: string
          user_id: string | null
        }
        Insert: {
          action: string
          changes?: Json | null
          created_at?: string
          id?: string
          resource_id: string
          resource_type: string
          user_id?: string | null
        }
        Update: {
          action?: string
          changes?: Json | null
          created_at?: string
          id?: string
          resource_id?: string
          resource_type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          address_line_1: string | null
          address_line_2: string | null
          city: string | null
          country: string | null
          created_at: string
          email: string | null
          first_name: string
          id: string
          last_name: string
          notes: string | null
          phone: string | null
          postal_code: string | null
          preferred_name: string | null
          province: string | null
          status: string
          updated_at: string
        }
        Insert: {
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          first_name: string
          id?: string
          last_name: string
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          preferred_name?: string | null
          province?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          first_name?: string
          id?: string
          last_name?: string
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          preferred_name?: string | null
          province?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      country_tiers: {
        Row: {
          country_name: string
          created_at: string
          id: string
          tier: string
          updated_at: string
        }
        Insert: {
          country_name: string
          created_at?: string
          id?: string
          tier: string
          updated_at?: string
        }
        Update: {
          country_name?: string
          created_at?: string
          id?: string
          tier?: string
          updated_at?: string
        }
        Relationships: []
      }
      courses: {
        Row: {
          code: string
          created_at: string
          credit_hours: number
          description: string | null
          id: string
          name: string
          program_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          credit_hours?: number
          description?: string | null
          id?: string
          name: string
          program_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          credit_hours?: number
          description?: string | null
          id?: string
          name?: string
          program_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollments: {
        Row: {
          completed_at: string | null
          created_at: string
          enrolled_at: string
          enrolled_by: string | null
          id: string
          notes: string | null
          program_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          enrolled_at?: string
          enrolled_by?: string | null
          id?: string
          notes?: string | null
          program_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          enrolled_at?: string
          enrolled_by?: string | null
          id?: string
          notes?: string | null
          program_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_enrolled_by_fkey"
            columns: ["enrolled_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      event_registrations: {
        Row: {
          contact_id: string
          event_id: string
          id: string
          notes: string | null
          registered_at: string
          registered_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          contact_id: string
          event_id: string
          id?: string
          notes?: string | null
          registered_at?: string
          registered_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          contact_id?: string
          event_id?: string
          id?: string
          notes?: string | null
          registered_at?: string
          registered_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_registrations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_registered_by_fkey"
            columns: ["registered_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          end_date: string | null
          end_time: string | null
          id: string
          is_public: boolean
          location: string | null
          max_capacity: number | null
          registration_required: boolean
          start_date: string
          start_time: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          end_date?: string | null
          end_time?: string | null
          id?: string
          is_public?: boolean
          location?: string | null
          max_capacity?: number | null
          registration_required?: boolean
          start_date: string
          start_time?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          end_date?: string | null
          end_time?: string | null
          id?: string
          is_public?: boolean
          location?: string | null
          max_capacity?: number | null
          registration_required?: boolean
          start_date?: string
          start_time?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      grades: {
        Row: {
          course_id: string
          created_at: string
          enrollment_id: string
          graded_at: string | null
          graded_by: string | null
          id: string
          letter_grade: string | null
          notes: string | null
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          enrollment_id: string
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          letter_grade?: string | null
          notes?: string | null
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          enrollment_id?: string
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          letter_grade?: string | null
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "grades_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grades_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grades_graded_by_fkey"
            columns: ["graded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      outreach_budget_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_default: boolean
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      outreach_cash_batches: {
        Row: {
          bank_fee: number
          batch_date: string
          created_at: string
          created_by: string
          exchange_rate: number
          id: string
          local_currency: string
          local_currency_received: number
          notes: string | null
          team_id: string
          updated_at: string
          zar_withdrawn: number
        }
        Insert: {
          bank_fee?: number
          batch_date?: string
          created_at?: string
          created_by: string
          exchange_rate: number
          id?: string
          local_currency: string
          local_currency_received: number
          notes?: string | null
          team_id: string
          updated_at?: string
          zar_withdrawn: number
        }
        Update: {
          bank_fee?: number
          batch_date?: string
          created_at?: string
          created_by?: string
          exchange_rate?: number
          id?: string
          local_currency?: string
          local_currency_received?: number
          notes?: string | null
          team_id?: string
          updated_at?: string
          zar_withdrawn?: number
        }
        Relationships: [
          {
            foreignKeyName: "outreach_cash_batches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_cash_batches_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "outreach_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      outreach_closeouts: {
        Row: {
          admin_notes: string | null
          cash_remaining: number
          closed_at: string | null
          closed_by: string | null
          created_at: string
          funds_returned: number
          id: string
          status: string
          team_id: string
          total_funds_sent: number
          total_spent: number
          updated_at: string
          variance: number
          variance_pct: number
        }
        Insert: {
          admin_notes?: string | null
          cash_remaining?: number
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          funds_returned?: number
          id?: string
          status?: string
          team_id: string
          total_funds_sent?: number
          total_spent?: number
          updated_at?: string
          variance?: number
          variance_pct?: number
        }
        Update: {
          admin_notes?: string | null
          cash_remaining?: number
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          funds_returned?: number
          id?: string
          status?: string
          team_id?: string
          total_funds_sent?: number
          total_spent?: number
          updated_at?: string
          variance?: number
          variance_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "outreach_closeouts_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_closeouts_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "outreach_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      outreach_expenses: {
        Row: {
          cash_batch_id: string | null
          category_id: string
          country: string | null
          created_at: string
          created_by: string
          description: string
          exchange_rate: number
          expense_date: string
          id: string
          local_amount: number
          local_currency: string
          notes: string | null
          payment_method: string
          purchaser: string | null
          receipt_code: string | null
          receipt_path: string | null
          team_id: string
          updated_at: string
          vendor: string | null
          zar_amount: number
        }
        Insert: {
          cash_batch_id?: string | null
          category_id: string
          country?: string | null
          created_at?: string
          created_by: string
          description: string
          exchange_rate?: number
          expense_date?: string
          id?: string
          local_amount: number
          local_currency?: string
          notes?: string | null
          payment_method?: string
          purchaser?: string | null
          receipt_code?: string | null
          receipt_path?: string | null
          team_id: string
          updated_at?: string
          vendor?: string | null
          zar_amount: number
        }
        Update: {
          cash_batch_id?: string | null
          category_id?: string
          country?: string | null
          created_at?: string
          created_by?: string
          description?: string
          exchange_rate?: number
          expense_date?: string
          id?: string
          local_amount?: number
          local_currency?: string
          notes?: string | null
          payment_method?: string
          purchaser?: string | null
          receipt_code?: string | null
          receipt_path?: string | null
          team_id?: string
          updated_at?: string
          vendor?: string | null
          zar_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "outreach_expenses_cash_batch_id_fkey"
            columns: ["cash_batch_id"]
            isOneToOne: false
            referencedRelation: "outreach_cash_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "outreach_budget_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_expenses_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "outreach_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      outreach_fund_releases: {
        Row: {
          amount_zar: number
          created_at: string
          created_by: string
          currency: string
          id: string
          label: string
          method: string
          notes: string | null
          recipient: string | null
          release_date: string
          team_id: string
          updated_at: string
        }
        Insert: {
          amount_zar: number
          created_at?: string
          created_by: string
          currency?: string
          id?: string
          label: string
          method?: string
          notes?: string | null
          recipient?: string | null
          release_date?: string
          team_id: string
          updated_at?: string
        }
        Update: {
          amount_zar?: number
          created_at?: string
          created_by?: string
          currency?: string
          id?: string
          label?: string
          method?: string
          notes?: string | null
          recipient?: string | null
          release_date?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "outreach_fund_releases_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_fund_releases_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "outreach_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      outreach_receipts: {
        Row: {
          expense_id: string
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          mime_type: string | null
          uploaded_at: string
          uploaded_by: string
        }
        Insert: {
          expense_id: string
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          uploaded_at?: string
          uploaded_by: string
        }
        Update: {
          expense_id?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          uploaded_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "outreach_receipts_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "outreach_expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_receipts_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      outreach_team_budgets: {
        Row: {
          budget_amount_zar: number
          category_id: string
          created_at: string
          id: string
          notes: string | null
          people_count: number | null
          team_id: string
          updated_at: string
        }
        Insert: {
          budget_amount_zar?: number
          category_id: string
          created_at?: string
          id?: string
          notes?: string | null
          people_count?: number | null
          team_id: string
          updated_at?: string
        }
        Update: {
          budget_amount_zar?: number
          category_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          people_count?: number | null
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "outreach_team_budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "outreach_budget_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_team_budgets_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "outreach_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      outreach_team_members: {
        Row: {
          id: string
          joined_at: string
          role: string
          team_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          role?: string
          team_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          role?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "outreach_team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "outreach_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_team_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      outreach_teams: {
        Row: {
          country: string | null
          created_at: string
          created_by: string
          currency: string
          drive_folder_url: string | null
          end_date: string | null
          id: string
          location: string | null
          notes: string | null
          people_count: number
          program_id: string
          start_date: string | null
          status: string
          team_name: string
          total_budget_zar: number
          updated_at: string
        }
        Insert: {
          country?: string | null
          created_at?: string
          created_by: string
          currency?: string
          drive_folder_url?: string | null
          end_date?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          people_count?: number
          program_id: string
          start_date?: string | null
          status?: string
          team_name: string
          total_budget_zar?: number
          updated_at?: string
        }
        Update: {
          country?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          drive_folder_url?: string | null
          end_date?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          people_count?: number
          program_id?: string
          start_date?: string | null
          status?: string
          team_name?: string
          total_budget_zar?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "outreach_teams_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_teams_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          created_at: string
          display_name: string
          id: string
          key: string
          module: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          display_name: string
          id?: string
          key: string
          module: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          key?: string
          module?: string
          sort_order?: number
        }
        Relationships: []
      }
      person_tags: {
        Row: {
          contact_id: string
          tag_id: string
        }
        Insert: {
          contact_id: string
          tag_id: string
        }
        Update: {
          contact_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "person_tags_person_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      person_type_assignments: {
        Row: {
          assigned_at: string
          contact_id: string
          id: string
          person_type_id: string
        }
        Insert: {
          assigned_at?: string
          contact_id: string
          id?: string
          person_type_id: string
        }
        Update: {
          assigned_at?: string
          contact_id?: string
          id?: string
          person_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "person_type_assignments_person_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_type_assignments_person_type_id_fkey"
            columns: ["person_type_id"]
            isOneToOne: false
            referencedRelation: "person_types"
            referencedColumns: ["id"]
          },
        ]
      }
      person_types: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      prayer_room_eval_requests: {
        Row: {
          background: string | null
          created_at: string
          id: string
          instruments: string[] | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          role: string
          status: string
          user_id: string
        }
        Insert: {
          background?: string | null
          created_at?: string
          id?: string
          instruments?: string[] | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          role: string
          status?: string
          user_id: string
        }
        Update: {
          background?: string | null
          created_at?: string
          id?: string
          instruments?: string[] | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          role?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prayer_room_eval_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prayer_room_eval_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      prayer_room_series: {
        Row: {
          commitment_type: string
          created_at: string
          created_by: string
          day_of_week: number | null
          end_date: string | null
          end_time: string
          id: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          start_date: string
          start_time: string
          status: string
          title: string | null
          updated_at: string
        }
        Insert: {
          commitment_type: string
          created_at?: string
          created_by: string
          day_of_week?: number | null
          end_date?: string | null
          end_time: string
          id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date: string
          start_time: string
          status?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          commitment_type?: string
          created_at?: string
          created_by?: string
          day_of_week?: number | null
          end_date?: string | null
          end_time?: string
          id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date?: string
          start_time?: string
          status?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prayer_room_series_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prayer_room_series_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      prayer_room_slot_members: {
        Row: {
          assigned_by: string | null
          created_at: string
          id: string
          instrument: string | null
          role: string
          slot_id: string
          user_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          instrument?: string | null
          role: string
          slot_id: string
          user_id: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          instrument?: string | null
          role?: string
          slot_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prayer_room_slot_members_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prayer_room_slot_members_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "prayer_room_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prayer_room_slot_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      prayer_room_slots: {
        Row: {
          color: string | null
          completed_at: string | null
          created_at: string
          end_time: string
          id: string
          notes: string | null
          series_id: string | null
          slot_date: string
          start_time: string
          status: string
          title: string | null
          updated_at: string
        }
        Insert: {
          color?: string | null
          completed_at?: string | null
          created_at?: string
          end_time: string
          id?: string
          notes?: string | null
          series_id?: string | null
          slot_date: string
          start_time: string
          status?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          color?: string | null
          completed_at?: string | null
          created_at?: string
          end_time?: string
          id?: string
          notes?: string | null
          series_id?: string | null
          slot_date?: string
          start_time?: string
          status?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prayer_room_slots_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "prayer_room_series"
            referencedColumns: ["id"]
          },
        ]
      }
      programs: {
        Row: {
          application_open: boolean
          code: string
          created_at: string
          created_by: string
          credit_hours: number
          description: string | null
          id: string
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          application_open?: boolean
          code: string
          created_at?: string
          created_by: string
          credit_hours?: number
          description?: string | null
          id?: string
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          application_open?: boolean
          code?: string
          created_at?: string
          created_by?: string
          credit_hours?: number
          description?: string | null
          id?: string
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "programs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          description: string | null
          display_name: string
          id: string
          is_system: boolean
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_name: string
          id?: string
          is_system?: boolean
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_name?: string
          id?: string
          is_system?: boolean
          name?: string
        }
        Relationships: []
      }
      school_fee_structures: {
        Row: {
          accommodation_zar: number
          created_at: string
          id: string
          materials_zar: number
          meals_zar: number
          notes: string | null
          program_id: string
          tier: string
          total_zar: number | null
          tuition_zar: number
          updated_at: string
        }
        Insert: {
          accommodation_zar?: number
          created_at?: string
          id?: string
          materials_zar?: number
          meals_zar?: number
          notes?: string | null
          program_id: string
          tier: string
          total_zar?: number | null
          tuition_zar?: number
          updated_at?: string
        }
        Update: {
          accommodation_zar?: number
          created_at?: string
          id?: string
          materials_zar?: number
          meals_zar?: number
          notes?: string | null
          program_id?: string
          tier?: string
          total_zar?: number | null
          tuition_zar?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_fee_structures_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      student_fees: {
        Row: {
          accommodation_zar: number
          amount_paid_zar: number
          created_at: string
          discount_zar: number
          enrollment_id: string
          final_amount_zar: number | null
          id: string
          materials_zar: number
          meals_zar: number
          notes: string | null
          program_id: string
          scholarship_zar: number
          status: string
          tier: string
          tier_override: boolean
          total_due_zar: number
          tuition_zar: number
          updated_at: string
          user_id: string
          xero_invoice_id: string | null
          xero_invoice_number: string | null
          xero_invoice_url: string | null
        }
        Insert: {
          accommodation_zar?: number
          amount_paid_zar?: number
          created_at?: string
          discount_zar?: number
          enrollment_id: string
          final_amount_zar?: number | null
          id?: string
          materials_zar?: number
          meals_zar?: number
          notes?: string | null
          program_id: string
          scholarship_zar?: number
          status?: string
          tier: string
          tier_override?: boolean
          total_due_zar?: number
          tuition_zar?: number
          updated_at?: string
          user_id: string
          xero_invoice_id?: string | null
          xero_invoice_number?: string | null
          xero_invoice_url?: string | null
        }
        Update: {
          accommodation_zar?: number
          amount_paid_zar?: number
          created_at?: string
          discount_zar?: number
          enrollment_id?: string
          final_amount_zar?: number | null
          id?: string
          materials_zar?: number
          meals_zar?: number
          notes?: string | null
          program_id?: string
          scholarship_zar?: number
          status?: string
          tier?: string
          tier_override?: boolean
          total_due_zar?: number
          tuition_zar?: number
          updated_at?: string
          user_id?: string
          xero_invoice_id?: string | null
          xero_invoice_number?: string | null
          xero_invoice_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_fees_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: true
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_fees_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_fees_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      student_payments: {
        Row: {
          amount_zar: number
          created_at: string
          currency_amount: number | null
          currency_paid: string | null
          exchange_rate: number | null
          id: string
          notes: string | null
          payment_date: string
          payment_method: string
          receipt_path: string | null
          recorded_by: string
          reference: string | null
          student_fee_id: string
        }
        Insert: {
          amount_zar: number
          created_at?: string
          currency_amount?: number | null
          currency_paid?: string | null
          exchange_rate?: number | null
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method: string
          receipt_path?: string | null
          recorded_by: string
          reference?: string | null
          student_fee_id: string
        }
        Update: {
          amount_zar?: number
          created_at?: string
          currency_amount?: number | null
          currency_paid?: string | null
          exchange_rate?: number | null
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string
          receipt_path?: string | null
          recorded_by?: string
          reference?: string | null
          student_fee_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_payments_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_payments_student_fee_id_fkey"
            columns: ["student_fee_id"]
            isOneToOne: false
            referencedRelation: "student_fees"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          category: string | null
          created_at: string
          id: string
          name: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      user_label_assignments: {
        Row: {
          assigned_by: string | null
          created_at: string
          id: string
          label_id: string
          user_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          label_id: string
          user_id: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          label_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_label_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_label_assignments_label_id_fkey"
            columns: ["label_id"]
            isOneToOne: false
            referencedRelation: "user_labels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_label_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_labels: {
        Row: {
          category: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          granted_at: string
          granted_by: string | null
          id: string
          permission_id: string
          scope_id: string | null
          scope_type: string | null
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          permission_id: string
          scope_id?: string | null
          scope_type?: string | null
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          permission_id?: string
          scope_id?: string | null
          scope_type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permissions_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          id: string
          role_id: string
          scope_id: string | null
          scope_type: string | null
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          role_id: string
          scope_id?: string | null
          scope_type?: string | null
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          role_id?: string
          scope_id?: string | null
          scope_type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          accepted_at: string | null
          address_line_1: string | null
          address_line_2: string | null
          avatar_url: string | null
          city: string | null
          contact_id: string | null
          country: string | null
          created_at: string
          date_of_birth: string | null
          display_name: string | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          emergency_contact_relationship: string | null
          first_name: string | null
          gender: string | null
          health_insurance_expiry_date: string | null
          health_insurance_policy_number: string | null
          health_insurance_provider: string | null
          id: string
          invited_at: string | null
          is_active: boolean
          is_international: boolean | null
          job_title: string | null
          last_name: string | null
          last_sign_in_at: string | null
          marital_status: string | null
          nationality: string | null
          passport_country: string | null
          passport_number: string | null
          phone: string | null
          postal_code: string | null
          preferred_name: string | null
          province: string | null
          status: string
          updated_at: string
          visa_category: string | null
          visa_expiry_date: string | null
          visa_type: string | null
        }
        Insert: {
          accepted_at?: string | null
          address_line_1?: string | null
          address_line_2?: string | null
          avatar_url?: string | null
          city?: string | null
          contact_id?: string | null
          country?: string | null
          created_at?: string
          date_of_birth?: string | null
          display_name?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relationship?: string | null
          first_name?: string | null
          gender?: string | null
          health_insurance_expiry_date?: string | null
          health_insurance_policy_number?: string | null
          health_insurance_provider?: string | null
          id: string
          invited_at?: string | null
          is_active?: boolean
          is_international?: boolean | null
          job_title?: string | null
          last_name?: string | null
          last_sign_in_at?: string | null
          marital_status?: string | null
          nationality?: string | null
          passport_country?: string | null
          passport_number?: string | null
          phone?: string | null
          postal_code?: string | null
          preferred_name?: string | null
          province?: string | null
          status?: string
          updated_at?: string
          visa_category?: string | null
          visa_expiry_date?: string | null
          visa_type?: string | null
        }
        Update: {
          accepted_at?: string | null
          address_line_1?: string | null
          address_line_2?: string | null
          avatar_url?: string | null
          city?: string | null
          contact_id?: string | null
          country?: string | null
          created_at?: string
          date_of_birth?: string | null
          display_name?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relationship?: string | null
          first_name?: string | null
          gender?: string | null
          health_insurance_expiry_date?: string | null
          health_insurance_policy_number?: string | null
          health_insurance_provider?: string | null
          id?: string
          invited_at?: string | null
          is_active?: boolean
          is_international?: boolean | null
          job_title?: string | null
          last_name?: string | null
          last_sign_in_at?: string | null
          marital_status?: string | null
          nationality?: string | null
          passport_country?: string | null
          passport_number?: string | null
          phone?: string | null
          postal_code?: string | null
          preferred_name?: string | null
          province?: string | null
          status?: string
          updated_at?: string
          visa_category?: string | null
          visa_expiry_date?: string | null
          visa_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      xero_tokens: {
        Row: {
          access_token: string
          connected_by: string | null
          created_at: string
          expires_at: string
          id: string
          refresh_token: string
          region: string
          tenant_id: string
          tenant_name: string | null
          token_set: Json | null
          updated_at: string
        }
        Insert: {
          access_token: string
          connected_by?: string | null
          created_at?: string
          expires_at: string
          id?: string
          refresh_token: string
          region?: string
          tenant_id: string
          tenant_name?: string | null
          token_set?: Json | null
          updated_at?: string
        }
        Update: {
          access_token?: string
          connected_by?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          refresh_token?: string
          region?: string
          tenant_id?: string
          tenant_name?: string | null
          token_set?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "xero_tokens_connected_by_fkey"
            columns: ["connected_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_my_contact_id: { Args: never; Returns: string }
      grade_to_points: { Args: { grade: string }; Returns: number }
      has_any_role: { Args: { required_roles: string[] }; Returns: boolean }
      has_permission: {
        Args: { required_permission: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          check_scope_id?: string
          check_scope_type?: string
          required_role: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_outreach_finance_admin: {
        Args: { check_team_id: string }
        Returns: boolean
      }
      is_outreach_team_member: {
        Args: { check_team_id: string }
        Returns: boolean
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
    Enums: {},
  },
} as const

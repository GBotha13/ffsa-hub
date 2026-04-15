export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      contacts: {
        Row: {
          id: string;
          first_name: string;
          last_name: string;
          preferred_name: string | null;
          email: string | null;
          phone: string | null;
          address_line_1: string | null;
          address_line_2: string | null;
          city: string | null;
          province: string | null;
          country: string | null;
          postal_code: string | null;
          notes: string | null;
          status: "active" | "inactive" | "archived";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          first_name: string;
          last_name: string;
          preferred_name?: string | null;
          email?: string | null;
          phone?: string | null;
          address_line_1?: string | null;
          address_line_2?: string | null;
          city?: string | null;
          province?: string | null;
          country?: string | null;
          postal_code?: string | null;
          notes?: string | null;
          status?: "active" | "inactive" | "archived";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          first_name?: string;
          last_name?: string;
          preferred_name?: string | null;
          email?: string | null;
          phone?: string | null;
          address_line_1?: string | null;
          address_line_2?: string | null;
          city?: string | null;
          province?: string | null;
          country?: string | null;
          postal_code?: string | null;
          notes?: string | null;
          status?: "active" | "inactive" | "archived";
          updated_at?: string;
        };
        Relationships: [];
      };
      person_types: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          name?: string;
          description?: string | null;
        };
        Relationships: [];
      };
      person_type_assignments: {
        Row: {
          id: string;
          contact_id: string;
          person_type_id: string;
          assigned_at: string;
        };
        Insert: {
          id?: string;
          contact_id: string;
          person_type_id: string;
          assigned_at?: string;
        };
        Update: {
          contact_id?: string;
          person_type_id?: string;
        };
        Relationships: [];
      };
      tags: {
        Row: {
          id: string;
          name: string;
          category: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          category?: string | null;
          created_at?: string;
        };
        Update: {
          name?: string;
          category?: string | null;
        };
        Relationships: [];
      };
      person_tags: {
        Row: {
          contact_id: string;
          tag_id: string;
        };
        Insert: {
          contact_id: string;
          tag_id: string;
        };
        Update: {
          contact_id?: string;
          tag_id?: string;
        };
        Relationships: [];
      };
      users: {
        Row: {
          id: string;
          contact_id: string | null;
          display_name: string | null;
          avatar_url: string | null;
          is_active: boolean;
          invited_at: string | null;
          accepted_at: string | null;
          last_sign_in_at: string | null;
          first_name: string | null;
          last_name: string | null;
          preferred_name: string | null;
          email: string | null;
          phone: string | null;
          date_of_birth: string | null;
          gender: string | null;
          marital_status: string | null;
          nationality: string | null;
          address_line_1: string | null;
          address_line_2: string | null;
          city: string | null;
          province: string | null;
          country: string | null;
          postal_code: string | null;
          is_international: boolean;
          visa_category: string | null;
          passport_country: string | null;
          passport_number: string | null;
          visa_type: string | null;
          visa_expiry_date: string | null;
          emergency_contact_name: string | null;
          emergency_contact_phone: string | null;
          emergency_contact_relationship: string | null;
          health_insurance_provider: string | null;
          health_insurance_policy_number: string | null;
          health_insurance_expiry_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          contact_id?: string | null;
          display_name?: string | null;
          avatar_url?: string | null;
          is_active?: boolean;
          invited_at?: string | null;
          accepted_at?: string | null;
          last_sign_in_at?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          preferred_name?: string | null;
          email?: string | null;
          phone?: string | null;
          date_of_birth?: string | null;
          gender?: string | null;
          marital_status?: string | null;
          nationality?: string | null;
          address_line_1?: string | null;
          address_line_2?: string | null;
          city?: string | null;
          province?: string | null;
          country?: string | null;
          postal_code?: string | null;
          is_international?: boolean;
          visa_category?: string | null;
          passport_country?: string | null;
          passport_number?: string | null;
          visa_type?: string | null;
          visa_expiry_date?: string | null;
          emergency_contact_name?: string | null;
          emergency_contact_phone?: string | null;
          emergency_contact_relationship?: string | null;
          health_insurance_provider?: string | null;
          health_insurance_policy_number?: string | null;
          health_insurance_expiry_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          contact_id?: string | null;
          display_name?: string | null;
          avatar_url?: string | null;
          is_active?: boolean;
          invited_at?: string | null;
          accepted_at?: string | null;
          last_sign_in_at?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          preferred_name?: string | null;
          email?: string | null;
          phone?: string | null;
          date_of_birth?: string | null;
          gender?: string | null;
          marital_status?: string | null;
          nationality?: string | null;
          address_line_1?: string | null;
          address_line_2?: string | null;
          city?: string | null;
          province?: string | null;
          country?: string | null;
          postal_code?: string | null;
          is_international?: boolean;
          visa_category?: string | null;
          passport_country?: string | null;
          passport_number?: string | null;
          visa_type?: string | null;
          visa_expiry_date?: string | null;
          emergency_contact_name?: string | null;
          emergency_contact_phone?: string | null;
          emergency_contact_relationship?: string | null;
          health_insurance_provider?: string | null;
          health_insurance_policy_number?: string | null;
          health_insurance_expiry_date?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      roles: {
        Row: {
          id: string;
          name: string;
          display_name: string;
          description: string | null;
          is_system: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          display_name: string;
          description?: string | null;
          is_system?: boolean;
          created_at?: string;
        };
        Update: {
          name?: string;
          display_name?: string;
          description?: string | null;
          is_system?: boolean;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          id: string;
          user_id: string;
          role_id: string;
          scope_type: string | null;
          scope_id: string | null;
          assigned_at: string;
          assigned_by: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          role_id: string;
          scope_type?: string | null;
          scope_id?: string | null;
          assigned_at?: string;
          assigned_by?: string | null;
        };
        Update: {
          user_id?: string;
          role_id?: string;
          scope_type?: string | null;
          scope_id?: string | null;
          assigned_by?: string | null;
        };
        Relationships: [];
      };
      events: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          location: string | null;
          start_date: string;
          end_date: string | null;
          start_time: string | null;
          end_time: string | null;
          is_public: boolean;
          registration_required: boolean;
          max_capacity: number | null;
          status: "draft" | "published" | "cancelled" | "completed";
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          location?: string | null;
          start_date: string;
          end_date?: string | null;
          start_time?: string | null;
          end_time?: string | null;
          is_public?: boolean;
          registration_required?: boolean;
          max_capacity?: number | null;
          status?: "draft" | "published" | "cancelled" | "completed";
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          description?: string | null;
          location?: string | null;
          start_date?: string;
          end_date?: string | null;
          start_time?: string | null;
          end_time?: string | null;
          is_public?: boolean;
          registration_required?: boolean;
          max_capacity?: number | null;
          status?: "draft" | "published" | "cancelled" | "completed";
          updated_at?: string;
        };
        Relationships: [];
      };
      event_registrations: {
        Row: {
          id: string;
          contact_id: string;
          event_id: string;
          status: "pending" | "confirmed" | "waitlisted" | "cancelled";
          registered_by: string | null;
          notes: string | null;
          registered_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          contact_id: string;
          event_id: string;
          status?: "pending" | "confirmed" | "waitlisted" | "cancelled";
          registered_by?: string | null;
          notes?: string | null;
          registered_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: "pending" | "confirmed" | "waitlisted" | "cancelled";
          notes?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      attendance_records: {
        Row: {
          id: string;
          contact_id: string;
          event_id: string;
          status: "present" | "absent" | "late" | "excused";
          checked_in_at: string | null;
          checked_in_by: string | null;
          method: "manual" | "self";
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          contact_id: string;
          event_id: string;
          status?: "present" | "absent" | "late" | "excused";
          checked_in_at?: string | null;
          checked_in_by?: string | null;
          method?: "manual" | "self";
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          status?: "present" | "absent" | "late" | "excused";
          checked_in_at?: string | null;
          checked_in_by?: string | null;
          method?: "manual" | "self";
          notes?: string | null;
        };
        Relationships: [];
      };
      programs: {
        Row: {
          id: string;
          name: string;
          code: string;
          description: string | null;
          credit_hours: number;
          status: "active" | "archived";
          application_open: boolean;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          code: string;
          description?: string | null;
          credit_hours?: number;
          status?: "active" | "archived";
          application_open?: boolean;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          code?: string;
          description?: string | null;
          credit_hours?: number;
          status?: "active" | "archived";
          application_open?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      application_questions: {
        Row: {
          id: string;
          program_id: string;
          label: string;
          description: string | null;
          type: "short_answer" | "long_answer";
          sort_order: number;
          is_required: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          program_id: string;
          label: string;
          description?: string | null;
          type?: "short_answer" | "long_answer";
          sort_order?: number;
          is_required?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          label?: string;
          description?: string | null;
          type?: "short_answer" | "long_answer";
          sort_order?: number;
          is_required?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      application_responses: {
        Row: {
          id: string;
          program_id: string;
          user_id: string;
          answers: Array<{ question_id: string; question_label: string; answer: string }>;
          status: "submitted" | "accepted" | "rejected" | "waitlisted";
          reviewed_by: string | null;
          reviewed_at: string | null;
          submitted_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          program_id: string;
          user_id: string;
          answers: Array<{ question_id: string; question_label: string; answer: string }>;
          status?: "submitted" | "accepted" | "rejected" | "waitlisted";
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          submitted_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          answers?: Array<{ question_id: string; question_label: string; answer: string }>;
          status?: "submitted" | "accepted" | "rejected" | "waitlisted";
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      courses: {
        Row: {
          id: string;
          program_id: string;
          name: string;
          code: string;
          description: string | null;
          credit_hours: number;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          program_id: string;
          name: string;
          code: string;
          description?: string | null;
          credit_hours?: number;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          program_id?: string;
          name?: string;
          code?: string;
          description?: string | null;
          credit_hours?: number;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      enrollments: {
        Row: {
          id: string;
          user_id: string;
          program_id: string;
          status: "active" | "completed" | "withdrawn" | "on_hold";
          enrolled_at: string;
          completed_at: string | null;
          enrolled_by: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          program_id: string;
          status?: "active" | "completed" | "withdrawn" | "on_hold";
          enrolled_at?: string;
          completed_at?: string | null;
          enrolled_by?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: "active" | "completed" | "withdrawn" | "on_hold";
          completed_at?: string | null;
          notes?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      grades: {
        Row: {
          id: string;
          enrollment_id: string;
          course_id: string;
          letter_grade: string | null;
          graded_by: string | null;
          graded_at: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          enrollment_id: string;
          course_id: string;
          letter_grade?: string | null;
          graded_by?: string | null;
          graded_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          letter_grade?: string | null;
          graded_by?: string | null;
          graded_at?: string | null;
          notes?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          user_id: string | null;
          action: string;
          resource_type: string;
          resource_id: string;
          changes: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          action: string;
          resource_type: string;
          resource_id: string;
          changes?: Json | null;
          created_at?: string;
        };
        Update: never;
      };
      outreach_teams: {
        Row: {
          id: string;
          program_id: string;
          team_name: string;
          location: string | null;
          country: string | null;
          start_date: string | null;
          end_date: string | null;
          status: "planning" | "active" | "review" | "closed";
          people_count: number;
          total_budget_zar: number;
          currency: string;
          notes: string | null;
          drive_folder_url: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          program_id: string;
          team_name: string;
          location?: string | null;
          country?: string | null;
          start_date?: string | null;
          end_date?: string | null;
          status?: "planning" | "active" | "review" | "closed";
          people_count?: number;
          total_budget_zar?: number;
          currency?: string;
          notes?: string | null;
          drive_folder_url?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          team_name?: string;
          location?: string | null;
          country?: string | null;
          start_date?: string | null;
          end_date?: string | null;
          status?: "planning" | "active" | "review" | "closed";
          people_count?: number;
          total_budget_zar?: number;
          currency?: string;
          notes?: string | null;
          drive_folder_url?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      outreach_team_members: {
        Row: {
          id: string;
          team_id: string;
          user_id: string;
          role: "outreach_leader" | "finance_student" | "school_leader" | "finance_admin" | "team_member";
          joined_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          user_id: string;
          role?: "outreach_leader" | "finance_student" | "school_leader" | "finance_admin" | "team_member";
          joined_at?: string;
        };
        Update: {
          role?: "outreach_leader" | "finance_student" | "school_leader" | "finance_admin" | "team_member";
        };
        Relationships: [];
      };
      outreach_budget_categories: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          is_default: boolean;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          description?: string | null;
          is_default?: boolean;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          name?: string;
          slug?: string;
          description?: string | null;
          sort_order?: number;
        };
        Relationships: [];
      };
      outreach_team_budgets: {
        Row: {
          id: string;
          team_id: string;
          category_id: string;
          people_count: number | null;
          budget_amount_zar: number;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          category_id: string;
          people_count?: number | null;
          budget_amount_zar?: number;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          people_count?: number | null;
          budget_amount_zar?: number;
          notes?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      outreach_fund_releases: {
        Row: {
          id: string;
          team_id: string;
          label: string;
          release_date: string;
          amount_zar: number;
          currency: string;
          method: "bank_transfer" | "cash";
          recipient: string | null;
          notes: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          label: string;
          release_date?: string;
          amount_zar: number;
          currency?: string;
          method?: "bank_transfer" | "cash";
          recipient?: string | null;
          notes?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          label?: string;
          release_date?: string;
          amount_zar?: number;
          currency?: string;
          method?: "bank_transfer" | "cash";
          recipient?: string | null;
          notes?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      outreach_cash_batches: {
        Row: {
          id: string;
          team_id: string;
          batch_date: string;
          zar_withdrawn: number;
          bank_fee: number;
          local_currency: string;
          local_currency_received: number;
          exchange_rate: number;
          notes: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          batch_date?: string;
          zar_withdrawn: number;
          bank_fee?: number;
          local_currency: string;
          local_currency_received: number;
          exchange_rate: number;
          notes?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          batch_date?: string;
          zar_withdrawn?: number;
          bank_fee?: number;
          local_currency?: string;
          local_currency_received?: number;
          exchange_rate?: number;
          notes?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      outreach_expenses: {
        Row: {
          id: string;
          team_id: string;
          category_id: string;
          expense_date: string;
          receipt_code: string | null;
          vendor: string | null;
          description: string;
          purchaser: string | null;
          payment_method: "cash" | "card" | "bank_transfer" | "reimbursement" | "prepayment";
          country: string | null;
          local_currency: string;
          local_amount: number;
          zar_amount: number;
          exchange_rate: number;
          cash_batch_id: string | null;
          receipt_path: string | null;
          notes: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          category_id: string;
          expense_date?: string;
          receipt_code?: string | null;
          vendor?: string | null;
          description: string;
          purchaser?: string | null;
          payment_method?: "cash" | "card" | "bank_transfer" | "reimbursement" | "prepayment";
          country?: string | null;
          local_currency?: string;
          local_amount: number;
          zar_amount: number;
          exchange_rate?: number;
          cash_batch_id?: string | null;
          receipt_path?: string | null;
          notes?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          category_id?: string;
          expense_date?: string;
          receipt_code?: string | null;
          vendor?: string | null;
          description?: string;
          purchaser?: string | null;
          payment_method?: "cash" | "card" | "bank_transfer" | "reimbursement" | "prepayment";
          country?: string | null;
          local_currency?: string;
          local_amount?: number;
          zar_amount?: number;
          exchange_rate?: number;
          cash_batch_id?: string | null;
          receipt_path?: string | null;
          notes?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      outreach_receipts: {
        Row: {
          id: string;
          expense_id: string;
          file_path: string;
          file_name: string;
          file_size: number | null;
          mime_type: string | null;
          uploaded_by: string;
          uploaded_at: string;
        };
        Insert: {
          id?: string;
          expense_id: string;
          file_path: string;
          file_name: string;
          file_size?: number | null;
          mime_type?: string | null;
          uploaded_by: string;
          uploaded_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      outreach_closeouts: {
        Row: {
          id: string;
          team_id: string;
          total_funds_sent: number;
          total_spent: number;
          cash_remaining: number;
          funds_returned: number;
          variance: number;
          variance_pct: number;
          status: "pending" | "auto_closed" | "admin_override" | "rejected";
          admin_notes: string | null;
          closed_by: string | null;
          closed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          total_funds_sent?: number;
          total_spent?: number;
          cash_remaining?: number;
          funds_returned?: number;
          variance?: number;
          variance_pct?: number;
          status?: "pending" | "auto_closed" | "admin_override" | "rejected";
          admin_notes?: string | null;
          closed_by?: string | null;
          closed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          total_funds_sent?: number;
          total_spent?: number;
          cash_remaining?: number;
          funds_returned?: number;
          variance?: number;
          variance_pct?: number;
          status?: "pending" | "auto_closed" | "admin_override" | "rejected";
          admin_notes?: string | null;
          closed_by?: string | null;
          closed_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {};
    Functions: {
      has_role: {
        Args: {
          required_role: string;
          check_scope_type?: string | null;
          check_scope_id?: string | null;
        };
        Returns: boolean;
      };
      has_any_role: {
        Args: {
          required_roles: string[];
        };
        Returns: boolean;
      };
      get_my_contact_id: {
        Args: Record<string, never>;
        Returns: string | null;
      };
    };
    Enums: {};
  };
}

// Convenience types
export type Contact = Database["public"]["Tables"]["contacts"]["Row"];
export type ContactInsert = Database["public"]["Tables"]["contacts"]["Insert"];
export type ContactUpdate = Database["public"]["Tables"]["contacts"]["Update"];

export type User = Database["public"]["Tables"]["users"]["Row"];
export type UserInsert = Database["public"]["Tables"]["users"]["Insert"];
export type UserUpdate = Database["public"]["Tables"]["users"]["Update"];

export type Role = Database["public"]["Tables"]["roles"]["Row"];
export type UserRole = Database["public"]["Tables"]["user_roles"]["Row"];
export type UserRoleInsert = Database["public"]["Tables"]["user_roles"]["Insert"];

export type PersonType = Database["public"]["Tables"]["person_types"]["Row"];
export type Tag = Database["public"]["Tables"]["tags"]["Row"];

export type Event = Database["public"]["Tables"]["events"]["Row"];
export type EventInsert = Database["public"]["Tables"]["events"]["Insert"];
export type EventUpdate = Database["public"]["Tables"]["events"]["Update"];

export type EventRegistration = Database["public"]["Tables"]["event_registrations"]["Row"];
export type EventRegistrationInsert = Database["public"]["Tables"]["event_registrations"]["Insert"];

export type AttendanceRecord = Database["public"]["Tables"]["attendance_records"]["Row"];
export type AttendanceRecordInsert = Database["public"]["Tables"]["attendance_records"]["Insert"];

export type AuditLog = Database["public"]["Tables"]["audit_logs"]["Row"];

export type Program = Database["public"]["Tables"]["programs"]["Row"];
export type ProgramInsert = Database["public"]["Tables"]["programs"]["Insert"];
export type ProgramUpdate = Database["public"]["Tables"]["programs"]["Update"];

export type Course = Database["public"]["Tables"]["courses"]["Row"];
export type CourseInsert = Database["public"]["Tables"]["courses"]["Insert"];
export type CourseUpdate = Database["public"]["Tables"]["courses"]["Update"];

export type Enrollment = Database["public"]["Tables"]["enrollments"]["Row"];
export type EnrollmentInsert = Database["public"]["Tables"]["enrollments"]["Insert"];

export type Grade = Database["public"]["Tables"]["grades"]["Row"];
export type GradeInsert = Database["public"]["Tables"]["grades"]["Insert"];

export type ApplicationQuestion = Database["public"]["Tables"]["application_questions"]["Row"];
export type ApplicationQuestionInsert = Database["public"]["Tables"]["application_questions"]["Insert"];
export type ApplicationQuestionUpdate = Database["public"]["Tables"]["application_questions"]["Update"];

export type ApplicationResponse = Database["public"]["Tables"]["application_responses"]["Row"];
export type ApplicationResponseInsert = Database["public"]["Tables"]["application_responses"]["Insert"];
export type ApplicationResponseUpdate = Database["public"]["Tables"]["application_responses"]["Update"];

export type OutreachTeam = Database["public"]["Tables"]["outreach_teams"]["Row"];
export type OutreachTeamInsert = Database["public"]["Tables"]["outreach_teams"]["Insert"];
export type OutreachTeamUpdate = Database["public"]["Tables"]["outreach_teams"]["Update"];

export type OutreachTeamMember = Database["public"]["Tables"]["outreach_team_members"]["Row"];
export type OutreachTeamMemberInsert = Database["public"]["Tables"]["outreach_team_members"]["Insert"];

export type OutreachBudgetCategory = Database["public"]["Tables"]["outreach_budget_categories"]["Row"];

export type OutreachTeamBudget = Database["public"]["Tables"]["outreach_team_budgets"]["Row"];
export type OutreachTeamBudgetInsert = Database["public"]["Tables"]["outreach_team_budgets"]["Insert"];

export type OutreachFundRelease = Database["public"]["Tables"]["outreach_fund_releases"]["Row"];
export type OutreachCashBatch = Database["public"]["Tables"]["outreach_cash_batches"]["Row"];
export type OutreachExpense = Database["public"]["Tables"]["outreach_expenses"]["Row"];
export type OutreachReceipt = Database["public"]["Tables"]["outreach_receipts"]["Row"];
export type OutreachCloseout = Database["public"]["Tables"]["outreach_closeouts"]["Row"];

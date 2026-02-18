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
      activity_feed: {
        Row: {
          action: string
          category: string
          id: string
          metadata: Json | null
          status: string
          timestamp: string
        }
        Insert: {
          action: string
          category: string
          id?: string
          metadata?: Json | null
          status?: string
          timestamp?: string
        }
        Update: {
          action?: string
          category?: string
          id?: string
          metadata?: Json | null
          status?: string
          timestamp?: string
        }
        Relationships: []
      }
      ai_usage_log: {
        Row: {
          created_at: string | null
          estimated_cost_usd: number | null
          id: string
          input_tokens: number | null
          metadata: Json | null
          model: string
          output_tokens: number | null
          task_id: string | null
          workflow: string
        }
        Insert: {
          created_at?: string | null
          estimated_cost_usd?: number | null
          id?: string
          input_tokens?: number | null
          metadata?: Json | null
          model: string
          output_tokens?: number | null
          task_id?: string | null
          workflow: string
        }
        Update: {
          created_at?: string | null
          estimated_cost_usd?: number | null
          id?: string
          input_tokens?: number | null
          metadata?: Json | null
          model?: string
          output_tokens?: number | null
          task_id?: string | null
          workflow?: string
        }
        Relationships: []
      }
      breezeway_properties: {
        Row: {
          address: string | null
          breezeway_id: number
          city: string | null
          created_at: string | null
          display: string | null
          id: string
          latitude: number | null
          longitude: number | null
          name: string | null
          reference_external_property_id: string | null
          reference_property_id: string | null
          state: string | null
          status: string | null
          updated_at: string | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          breezeway_id: number
          city?: string | null
          created_at?: string | null
          display?: string | null
          id: string
          latitude?: number | null
          longitude?: number | null
          name?: string | null
          reference_external_property_id?: string | null
          reference_property_id?: string | null
          state?: string | null
          status?: string | null
          updated_at?: string | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          breezeway_id?: number
          city?: string | null
          created_at?: string | null
          display?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string | null
          reference_external_property_id?: string | null
          reference_property_id?: string | null
          state?: string | null
          status?: string | null
          updated_at?: string | null
          zip?: string | null
        }
        Relationships: []
      }
      breezeway_task_assignments: {
        Row: {
          assignee_id: number | null
          assignee_name: string | null
          employee_code: string | null
          expires_at: string | null
          id: number
          status: string | null
          task_id: number | null
        }
        Insert: {
          assignee_id?: number | null
          assignee_name?: string | null
          employee_code?: string | null
          expires_at?: string | null
          id: number
          status?: string | null
          task_id?: number | null
        }
        Update: {
          assignee_id?: number | null
          assignee_name?: string | null
          employee_code?: string | null
          expires_at?: string | null
          id?: number
          status?: string | null
          task_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "breezeway_task_assignments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "breezeway_tasks"
            referencedColumns: ["breezeway_id"]
          },
          {
            foreignKeyName: "breezeway_task_assignments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "v_cleaner_efficiency"
            referencedColumns: ["task_id"]
          },
          {
            foreignKeyName: "breezeway_task_assignments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "v_cleaner_ratings"
            referencedColumns: ["clean_task_id"]
          },
          {
            foreignKeyName: "breezeway_task_assignments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "v_cleaner_ratings"
            referencedColumns: ["inspection_task_id"]
          },
          {
            foreignKeyName: "breezeway_task_assignments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "v_stale_tasks"
            referencedColumns: ["task_id"]
          },
          {
            foreignKeyName: "breezeway_task_assignments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "v_tasks"
            referencedColumns: ["task_id"]
          },
        ]
      }
      breezeway_task_costs: {
        Row: {
          cost: number | null
          cost_type_code: string | null
          cost_type_name: string | null
          created_at: string | null
          description: string | null
          id: number
          task_id: number | null
        }
        Insert: {
          cost?: number | null
          cost_type_code?: string | null
          cost_type_name?: string | null
          created_at?: string | null
          description?: string | null
          id: number
          task_id?: number | null
        }
        Update: {
          cost?: number | null
          cost_type_code?: string | null
          cost_type_name?: string | null
          created_at?: string | null
          description?: string | null
          id?: number
          task_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "breezeway_task_costs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "breezeway_tasks"
            referencedColumns: ["breezeway_id"]
          },
          {
            foreignKeyName: "breezeway_task_costs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "v_cleaner_efficiency"
            referencedColumns: ["task_id"]
          },
          {
            foreignKeyName: "breezeway_task_costs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "v_cleaner_ratings"
            referencedColumns: ["clean_task_id"]
          },
          {
            foreignKeyName: "breezeway_task_costs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "v_cleaner_ratings"
            referencedColumns: ["inspection_task_id"]
          },
          {
            foreignKeyName: "breezeway_task_costs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "v_stale_tasks"
            referencedColumns: ["task_id"]
          },
          {
            foreignKeyName: "breezeway_task_costs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "v_tasks"
            referencedColumns: ["task_id"]
          },
        ]
      }
      breezeway_tasks: {
        Row: {
          ai_complexity: string | null
          ai_description: string | null
          ai_enriched_at: string | null
          ai_estimated_repair_cost: number | null
          ai_follow_up_needed: boolean | null
          ai_follow_up_reason: string | null
          ai_guest_impact: boolean | null
          ai_issues: Json | null
          ai_photo_compliance_pct: number | null
          ai_proactive_flags: number | null
          ai_property_health_signal: string | null
          ai_recurring_risk: boolean | null
          ai_response_quality: number | null
          ai_skill_category: string | null
          ai_summary: string | null
          ai_tags: string[] | null
          ai_title: string | null
          ai_worker_performance_note: string | null
          breezeway_id: number
          comments: Json | null
          created_at: string | null
          created_by_id: number | null
          created_by_name: string | null
          department: string | null
          description: string | null
          efficiency_ratio: number | null
          finished_at: string | null
          finished_by_id: number | null
          finished_by_name: string | null
          home_id: number | null
          linked_reservation_external_id: string | null
          linked_reservation_id: number | null
          name: string | null
          original_description: string | null
          original_title: string | null
          paused: boolean | null
          photo_count: number | null
          priority: string | null
          property_name: string | null
          rate_paid: number | null
          rate_type: string | null
          raw_json: Json | null
          reference_property_id: string | null
          report_url: string | null
          requested_by: string | null
          requirements: Json | null
          response_time_minutes: number | null
          scheduled_date: string | null
          scheduled_time: string | null
          started_at: string | null
          status_code: string | null
          status_name: string | null
          status_stage: string | null
          summary: string | null
          synced_at: string | null
          tag_list: string | null
          template_id: number | null
          total_cost: number | null
          total_time: string | null
          total_time_minutes: number | null
          updated_at: string | null
          webhook_updated_at: string | null
          work_duration_minutes: number | null
        }
        Insert: {
          ai_complexity?: string | null
          ai_description?: string | null
          ai_enriched_at?: string | null
          ai_estimated_repair_cost?: number | null
          ai_follow_up_needed?: boolean | null
          ai_follow_up_reason?: string | null
          ai_guest_impact?: boolean | null
          ai_issues?: Json | null
          ai_photo_compliance_pct?: number | null
          ai_proactive_flags?: number | null
          ai_property_health_signal?: string | null
          ai_recurring_risk?: boolean | null
          ai_response_quality?: number | null
          ai_skill_category?: string | null
          ai_summary?: string | null
          ai_tags?: string[] | null
          ai_title?: string | null
          ai_worker_performance_note?: string | null
          breezeway_id: number
          comments?: Json | null
          created_at?: string | null
          created_by_id?: number | null
          created_by_name?: string | null
          department?: string | null
          description?: string | null
          efficiency_ratio?: number | null
          finished_at?: string | null
          finished_by_id?: number | null
          finished_by_name?: string | null
          home_id?: number | null
          linked_reservation_external_id?: string | null
          linked_reservation_id?: number | null
          name?: string | null
          original_description?: string | null
          original_title?: string | null
          paused?: boolean | null
          photo_count?: number | null
          priority?: string | null
          property_name?: string | null
          rate_paid?: number | null
          rate_type?: string | null
          raw_json?: Json | null
          reference_property_id?: string | null
          report_url?: string | null
          requested_by?: string | null
          requirements?: Json | null
          response_time_minutes?: number | null
          scheduled_date?: string | null
          scheduled_time?: string | null
          started_at?: string | null
          status_code?: string | null
          status_name?: string | null
          status_stage?: string | null
          summary?: string | null
          synced_at?: string | null
          tag_list?: string | null
          template_id?: number | null
          total_cost?: number | null
          total_time?: string | null
          total_time_minutes?: number | null
          updated_at?: string | null
          webhook_updated_at?: string | null
          work_duration_minutes?: number | null
        }
        Update: {
          ai_complexity?: string | null
          ai_description?: string | null
          ai_enriched_at?: string | null
          ai_estimated_repair_cost?: number | null
          ai_follow_up_needed?: boolean | null
          ai_follow_up_reason?: string | null
          ai_guest_impact?: boolean | null
          ai_issues?: Json | null
          ai_photo_compliance_pct?: number | null
          ai_proactive_flags?: number | null
          ai_property_health_signal?: string | null
          ai_recurring_risk?: boolean | null
          ai_response_quality?: number | null
          ai_skill_category?: string | null
          ai_summary?: string | null
          ai_tags?: string[] | null
          ai_title?: string | null
          ai_worker_performance_note?: string | null
          breezeway_id?: number
          comments?: Json | null
          created_at?: string | null
          created_by_id?: number | null
          created_by_name?: string | null
          department?: string | null
          description?: string | null
          efficiency_ratio?: number | null
          finished_at?: string | null
          finished_by_id?: number | null
          finished_by_name?: string | null
          home_id?: number | null
          linked_reservation_external_id?: string | null
          linked_reservation_id?: number | null
          name?: string | null
          original_description?: string | null
          original_title?: string | null
          paused?: boolean | null
          photo_count?: number | null
          priority?: string | null
          property_name?: string | null
          rate_paid?: number | null
          rate_type?: string | null
          raw_json?: Json | null
          reference_property_id?: string | null
          report_url?: string | null
          requested_by?: string | null
          requirements?: Json | null
          response_time_minutes?: number | null
          scheduled_date?: string | null
          scheduled_time?: string | null
          started_at?: string | null
          status_code?: string | null
          status_name?: string | null
          status_stage?: string | null
          summary?: string | null
          synced_at?: string | null
          tag_list?: string | null
          template_id?: number | null
          total_cost?: number | null
          total_time?: string | null
          total_time_minutes?: number | null
          updated_at?: string | null
          webhook_updated_at?: string | null
          work_duration_minutes?: number | null
        }
        Relationships: []
      }
      clean_analysis: {
        Row: {
          ai_compliance_score: number | null
          ai_flags: string[] | null
          ai_issues: Json | null
          ai_summary: string | null
          attention_reason: string | null
          breezeway_task_id: string
          clean_duration_minutes: number | null
          cleaner_names: string | null
          completed_at: string | null
          condition_notes: string | null
          created_at: string | null
          damaged_or_missing: boolean | null
          damaged_or_missing_notes: string | null
          est_duration_minutes: number | null
          guest_checkout_rating: number | null
          id: string
          issues_count: number | null
          lost_and_found: boolean | null
          lost_and_found_notes: string | null
          photo_count: number | null
          property_name: string | null
          property_overall_rating: number | null
          raw_payload: Json | null
          report_url: string | null
          requires_attention: boolean | null
          supplies_low: string | null
          task_url: string | null
        }
        Insert: {
          ai_compliance_score?: number | null
          ai_flags?: string[] | null
          ai_issues?: Json | null
          ai_summary?: string | null
          attention_reason?: string | null
          breezeway_task_id: string
          clean_duration_minutes?: number | null
          cleaner_names?: string | null
          completed_at?: string | null
          condition_notes?: string | null
          created_at?: string | null
          damaged_or_missing?: boolean | null
          damaged_or_missing_notes?: string | null
          est_duration_minutes?: number | null
          guest_checkout_rating?: number | null
          id?: string
          issues_count?: number | null
          lost_and_found?: boolean | null
          lost_and_found_notes?: string | null
          photo_count?: number | null
          property_name?: string | null
          property_overall_rating?: number | null
          raw_payload?: Json | null
          report_url?: string | null
          requires_attention?: boolean | null
          supplies_low?: string | null
          task_url?: string | null
        }
        Update: {
          ai_compliance_score?: number | null
          ai_flags?: string[] | null
          ai_issues?: Json | null
          ai_summary?: string | null
          attention_reason?: string | null
          breezeway_task_id?: string
          clean_duration_minutes?: number | null
          cleaner_names?: string | null
          completed_at?: string | null
          condition_notes?: string | null
          created_at?: string | null
          damaged_or_missing?: boolean | null
          damaged_or_missing_notes?: string | null
          est_duration_minutes?: number | null
          guest_checkout_rating?: number | null
          id?: string
          issues_count?: number | null
          lost_and_found?: boolean | null
          lost_and_found_notes?: string | null
          photo_count?: number | null
          property_name?: string | null
          property_overall_rating?: number | null
          raw_payload?: Json | null
          report_url?: string | null
          requires_attention?: boolean | null
          supplies_low?: string | null
          task_url?: string | null
        }
        Relationships: []
      }
      cleaner_identity_map: {
        Row: {
          breezeway_assignee_id: string | null
          breezeway_assignee_name: string | null
          created_at: string | null
          id: number
          timeero_first_name: string | null
          timeero_last_name: string | null
          timeero_user_id: string | null
        }
        Insert: {
          breezeway_assignee_id?: string | null
          breezeway_assignee_name?: string | null
          created_at?: string | null
          id?: number
          timeero_first_name?: string | null
          timeero_last_name?: string | null
          timeero_user_id?: string | null
        }
        Update: {
          breezeway_assignee_id?: string | null
          breezeway_assignee_name?: string | null
          created_at?: string | null
          id?: number
          timeero_first_name?: string | null
          timeero_last_name?: string | null
          timeero_user_id?: string | null
        }
        Relationships: []
      }
      cleaner_ratings_mat: {
        Row: {
          assignee_id: number
          assignee_name: string | null
          attribution_status: string | null
          attribution_type: string
          check_in_date: string | null
          clean_to_checkin_days: number | null
          cleanliness_rating: number | null
          had_inspection: boolean | null
          id: number
          overall_rating: number | null
          property_id: string | null
          property_name: string | null
          reservation_id: string | null
          review_date: string | null
          review_id: string
          review_platform: string | null
          review_text: string | null
          reviewer_name: string | null
          source_system: string | null
          task_date: string | null
          task_id: number | null
        }
        Insert: {
          assignee_id: number
          assignee_name?: string | null
          attribution_status?: string | null
          attribution_type: string
          check_in_date?: string | null
          clean_to_checkin_days?: number | null
          cleanliness_rating?: number | null
          had_inspection?: boolean | null
          id?: number
          overall_rating?: number | null
          property_id?: string | null
          property_name?: string | null
          reservation_id?: string | null
          review_date?: string | null
          review_id: string
          review_platform?: string | null
          review_text?: string | null
          reviewer_name?: string | null
          source_system?: string | null
          task_date?: string | null
          task_id?: number | null
        }
        Update: {
          assignee_id?: number
          assignee_name?: string | null
          attribution_status?: string | null
          attribution_type?: string
          check_in_date?: string | null
          clean_to_checkin_days?: number | null
          cleanliness_rating?: number | null
          had_inspection?: boolean | null
          id?: number
          overall_rating?: number | null
          property_id?: string | null
          property_name?: string | null
          reservation_id?: string | null
          review_date?: string | null
          review_id?: string
          review_platform?: string | null
          review_text?: string | null
          reviewer_name?: string | null
          source_system?: string | null
          task_date?: string | null
          task_id?: number | null
        }
        Relationships: []
      }
      daily_snapshots: {
        Row: {
          active_listings: number | null
          avg_cleanliness_score_30d: number | null
          avg_daily_rate: number | null
          avg_review_score_30d: number | null
          cleans_completed_today: number | null
          cleans_scheduled_today: number | null
          confirmed_future_revenue: number | null
          created_at: string | null
          gap_nights_next_14d: number | null
          id: number
          listings_with_zero_bookings_30d: number | null
          mtd_commission: number | null
          mtd_revenue: number | null
          net_new_nights_today: number | null
          occupancy_rate: number | null
          occupied_tonight: number | null
          open_maintenance_tickets: number | null
          reservations_canceled_today: number | null
          reservations_created_today: number | null
          reviews_received_today: number | null
          snapshot_date: string
          total_properties: number | null
          trailing_30d_revenue: number | null
        }
        Insert: {
          active_listings?: number | null
          avg_cleanliness_score_30d?: number | null
          avg_daily_rate?: number | null
          avg_review_score_30d?: number | null
          cleans_completed_today?: number | null
          cleans_scheduled_today?: number | null
          confirmed_future_revenue?: number | null
          created_at?: string | null
          gap_nights_next_14d?: number | null
          id?: number
          listings_with_zero_bookings_30d?: number | null
          mtd_commission?: number | null
          mtd_revenue?: number | null
          net_new_nights_today?: number | null
          occupancy_rate?: number | null
          occupied_tonight?: number | null
          open_maintenance_tickets?: number | null
          reservations_canceled_today?: number | null
          reservations_created_today?: number | null
          reviews_received_today?: number | null
          snapshot_date: string
          total_properties?: number | null
          trailing_30d_revenue?: number | null
        }
        Update: {
          active_listings?: number | null
          avg_cleanliness_score_30d?: number | null
          avg_daily_rate?: number | null
          avg_review_score_30d?: number | null
          cleans_completed_today?: number | null
          cleans_scheduled_today?: number | null
          confirmed_future_revenue?: number | null
          created_at?: string | null
          gap_nights_next_14d?: number | null
          id?: number
          listings_with_zero_bookings_30d?: number | null
          mtd_commission?: number | null
          mtd_revenue?: number | null
          net_new_nights_today?: number | null
          occupancy_rate?: number | null
          occupied_tonight?: number | null
          open_maintenance_tickets?: number | null
          reservations_canceled_today?: number | null
          reservations_created_today?: number | null
          reviews_received_today?: number | null
          snapshot_date?: string
          total_properties?: number | null
          trailing_30d_revenue?: number | null
        }
        Relationships: []
      }
      guest_registry: {
        Row: {
          avg_rating_given: number | null
          created_at: string | null
          email: string | null
          first_stay_date: string | null
          full_name: string | null
          guest_id: string
          guesty_guest_id: string | null
          is_vip: boolean | null
          last_stay_date: string | null
          notes: string | null
          phone: string | null
          total_nights: number | null
          total_revenue: number | null
          total_stays: number | null
          updated_at: string | null
        }
        Insert: {
          avg_rating_given?: number | null
          created_at?: string | null
          email?: string | null
          first_stay_date?: string | null
          full_name?: string | null
          guest_id?: string
          guesty_guest_id?: string | null
          is_vip?: boolean | null
          last_stay_date?: string | null
          notes?: string | null
          phone?: string | null
          total_nights?: number | null
          total_revenue?: number | null
          total_stays?: number | null
          updated_at?: string | null
        }
        Update: {
          avg_rating_given?: number | null
          created_at?: string | null
          email?: string | null
          first_stay_date?: string | null
          full_name?: string | null
          guest_id?: string
          guesty_guest_id?: string | null
          is_vip?: boolean | null
          last_stay_date?: string | null
          notes?: string | null
          phone?: string | null
          total_nights?: number | null
          total_revenue?: number | null
          total_stays?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      guesty_calendar: {
        Row: {
          available: boolean | null
          date: string
          listing_id: string
          min_nights: number | null
          price: number | null
          raw_data: Json | null
          reservation_id: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          available?: boolean | null
          date: string
          listing_id: string
          min_nights?: number | null
          price?: number | null
          raw_data?: Json | null
          reservation_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          available?: boolean | null
          date?: string
          listing_id?: string
          min_nights?: number | null
          price?: number | null
          raw_data?: Json | null
          reservation_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      guesty_guests: {
        Row: {
          created_at: string | null
          email: string | null
          first_name: string | null
          first_stay_date: string | null
          full_name: string | null
          id: string
          last_name: string | null
          last_stay_date: string | null
          phone: string | null
          raw_data: Json | null
          source: string | null
          tags: string[] | null
          total_bookings: number | null
          total_revenue: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          first_stay_date?: string | null
          full_name?: string | null
          id: string
          last_name?: string | null
          last_stay_date?: string | null
          phone?: string | null
          raw_data?: Json | null
          source?: string | null
          tags?: string[] | null
          total_bookings?: number | null
          total_revenue?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          first_stay_date?: string | null
          full_name?: string | null
          id?: string
          last_name?: string | null
          last_stay_date?: string | null
          phone?: string | null
          raw_data?: Json | null
          source?: string | null
          tags?: string[] | null
          total_bookings?: number | null
          total_revenue?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      guesty_invoice_items: {
        Row: {
          amount: number | null
          created_at: string | null
          currency: string | null
          id: string
          is_tax: boolean | null
          listing_id: string | null
          normal_type: string | null
          raw_data: Json | null
          reservation_id: string | null
          title: string | null
          type: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          currency?: string | null
          id: string
          is_tax?: boolean | null
          listing_id?: string | null
          normal_type?: string | null
          raw_data?: Json | null
          reservation_id?: string | null
          title?: string | null
          type?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          currency?: string | null
          id?: string
          is_tax?: boolean | null
          listing_id?: string | null
          normal_type?: string | null
          raw_data?: Json | null
          reservation_id?: string | null
          title?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guesty_invoice_items_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "guesty_reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guesty_invoice_items_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "v_reservations"
            referencedColumns: ["reservation_id"]
          },
          {
            foreignKeyName: "guesty_invoice_items_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "v_reservations_public"
            referencedColumns: ["reservation_id"]
          },
        ]
      }
      guesty_listings: {
        Row: {
          accommodates: number | null
          active: boolean | null
          address_city: string | null
          address_country: string | null
          address_full: string | null
          address_state: string | null
          base_price: number | null
          bathrooms: number | null
          bedrooms: number | null
          currency: string | null
          id: string
          nickname: string | null
          picture_url: string | null
          property_type: string | null
          published: boolean | null
          raw_data: Json
          synced_at: string | null
          title: string | null
        }
        Insert: {
          accommodates?: number | null
          active?: boolean | null
          address_city?: string | null
          address_country?: string | null
          address_full?: string | null
          address_state?: string | null
          base_price?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          currency?: string | null
          id: string
          nickname?: string | null
          picture_url?: string | null
          property_type?: string | null
          published?: boolean | null
          raw_data: Json
          synced_at?: string | null
          title?: string | null
        }
        Update: {
          accommodates?: number | null
          active?: boolean | null
          address_city?: string | null
          address_country?: string | null
          address_full?: string | null
          address_state?: string | null
          base_price?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          currency?: string | null
          id?: string
          nickname?: string | null
          picture_url?: string | null
          property_type?: string | null
          published?: boolean | null
          raw_data?: Json
          synced_at?: string | null
          title?: string | null
        }
        Relationships: []
      }
      guesty_reservations: {
        Row: {
          balance_due: number | null
          canceled_at: string | null
          check_in: string | null
          check_out: string | null
          commission: number | null
          confirmation_code: string | null
          confirmed_at: string | null
          currency: string | null
          fare_accommodation: number | null
          fare_accommodation_adjusted: number | null
          guest_email: string | null
          guest_id: string | null
          guest_name: string | null
          guest_phone: string | null
          guests_count: number | null
          host_payout: number | null
          host_service_fee: number | null
          id: string
          integration_platform: string | null
          invoice_items: Json | null
          listing_id: string | null
          nights_count: number | null
          platform: string | null
          raw_data: Json | null
          source: string | null
          status: string | null
          synced_at: string | null
          total_paid: number | null
          total_price: number | null
          total_taxes: number | null
        }
        Insert: {
          balance_due?: number | null
          canceled_at?: string | null
          check_in?: string | null
          check_out?: string | null
          commission?: number | null
          confirmation_code?: string | null
          confirmed_at?: string | null
          currency?: string | null
          fare_accommodation?: number | null
          fare_accommodation_adjusted?: number | null
          guest_email?: string | null
          guest_id?: string | null
          guest_name?: string | null
          guest_phone?: string | null
          guests_count?: number | null
          host_payout?: number | null
          host_service_fee?: number | null
          id: string
          integration_platform?: string | null
          invoice_items?: Json | null
          listing_id?: string | null
          nights_count?: number | null
          platform?: string | null
          raw_data?: Json | null
          source?: string | null
          status?: string | null
          synced_at?: string | null
          total_paid?: number | null
          total_price?: number | null
          total_taxes?: number | null
        }
        Update: {
          balance_due?: number | null
          canceled_at?: string | null
          check_in?: string | null
          check_out?: string | null
          commission?: number | null
          confirmation_code?: string | null
          confirmed_at?: string | null
          currency?: string | null
          fare_accommodation?: number | null
          fare_accommodation_adjusted?: number | null
          guest_email?: string | null
          guest_id?: string | null
          guest_name?: string | null
          guest_phone?: string | null
          guests_count?: number | null
          host_payout?: number | null
          host_service_fee?: number | null
          id?: string
          integration_platform?: string | null
          invoice_items?: Json | null
          listing_id?: string | null
          nights_count?: number | null
          platform?: string | null
          raw_data?: Json | null
          source?: string | null
          status?: string | null
          synced_at?: string | null
          total_paid?: number | null
          total_price?: number | null
          total_taxes?: number | null
        }
        Relationships: []
      }
      guesty_reviews: {
        Row: {
          accuracy_rating: number | null
          checkin_rating: number | null
          cleanliness_rating: number | null
          comment: string | null
          communication_rating: number | null
          created_at: string | null
          id: string
          listing_id: string | null
          location_rating: number | null
          platform: string | null
          rating: number | null
          raw_data: Json | null
          replied_at: string | null
          reply: string | null
          reservation_id: string | null
          reviewer_name: string | null
          value_rating: number | null
        }
        Insert: {
          accuracy_rating?: number | null
          checkin_rating?: number | null
          cleanliness_rating?: number | null
          comment?: string | null
          communication_rating?: number | null
          created_at?: string | null
          id: string
          listing_id?: string | null
          location_rating?: number | null
          platform?: string | null
          rating?: number | null
          raw_data?: Json | null
          replied_at?: string | null
          reply?: string | null
          reservation_id?: string | null
          reviewer_name?: string | null
          value_rating?: number | null
        }
        Update: {
          accuracy_rating?: number | null
          checkin_rating?: number | null
          cleanliness_rating?: number | null
          comment?: string | null
          communication_rating?: number | null
          created_at?: string | null
          id?: string
          listing_id?: string | null
          location_rating?: number | null
          platform?: string | null
          rating?: number | null
          raw_data?: Json | null
          replied_at?: string | null
          reply?: string | null
          reservation_id?: string | null
          reviewer_name?: string | null
          value_rating?: number | null
        }
        Relationships: []
      }
      leaderboard_exclusions: {
        Row: {
          assignee_id: string
          assignee_name: string | null
          excluded_at: string | null
          excluded_by: string | null
          id: number
          reason: string | null
        }
        Insert: {
          assignee_id: string
          assignee_name?: string | null
          excluded_at?: string | null
          excluded_by?: string | null
          id?: number
          reason?: string | null
        }
        Update: {
          assignee_id?: string
          assignee_name?: string | null
          excluded_at?: string | null
          excluded_by?: string | null
          id?: number
          reason?: string | null
        }
        Relationships: []
      }
      properties: {
        Row: {
          active: boolean | null
          address: string | null
          bathrooms: number | null
          bedrooms: number | null
          beds: number | null
          city: string | null
          created_at: string | null
          guesty_id: string
          id: string
          name: string | null
          nickname: string | null
          property_type: string | null
          state: string | null
          updated_at: string | null
          zip: string | null
        }
        Insert: {
          active?: boolean | null
          address?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          beds?: number | null
          city?: string | null
          created_at?: string | null
          guesty_id: string
          id: string
          name?: string | null
          nickname?: string | null
          property_type?: string | null
          state?: string | null
          updated_at?: string | null
          zip?: string | null
        }
        Update: {
          active?: boolean | null
          address?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          beds?: number | null
          city?: string | null
          created_at?: string | null
          guesty_id?: string
          id?: string
          name?: string | null
          nickname?: string | null
          property_type?: string | null
          state?: string | null
          updated_at?: string | null
          zip?: string | null
        }
        Relationships: []
      }
      property_registry: {
        Row: {
          address: string | null
          airbnb_listing_id: string | null
          airroi_listing_id: string | null
          bathrooms: number | null
          bedrooms: number | null
          breezeway_property_id: string | null
          city: string | null
          created_at: string | null
          guesty_listing_id: string | null
          latitude: number | null
          longitude: number | null
          max_guests: number | null
          notes: string | null
          owner_name: string | null
          property_id: string
          property_name: string
          property_tier: string | null
          ramp_merchant_id: string | null
          state: string | null
          status: string | null
          task_system: string | null
          updated_at: string | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          airbnb_listing_id?: string | null
          airroi_listing_id?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          breezeway_property_id?: string | null
          city?: string | null
          created_at?: string | null
          guesty_listing_id?: string | null
          latitude?: number | null
          longitude?: number | null
          max_guests?: number | null
          notes?: string | null
          owner_name?: string | null
          property_id?: string
          property_name: string
          property_tier?: string | null
          ramp_merchant_id?: string | null
          state?: string | null
          status?: string | null
          task_system?: string | null
          updated_at?: string | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          airbnb_listing_id?: string | null
          airroi_listing_id?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          breezeway_property_id?: string | null
          city?: string | null
          created_at?: string | null
          guesty_listing_id?: string | null
          latitude?: number | null
          longitude?: number | null
          max_guests?: number | null
          notes?: string | null
          owner_name?: string | null
          property_id?: string
          property_name?: string
          property_tier?: string | null
          ramp_merchant_id?: string | null
          state?: string | null
          status?: string | null
          task_system?: string | null
          updated_at?: string | null
          zip?: string | null
        }
        Relationships: []
      }
      reservation_history: {
        Row: {
          change_type: string
          changed_at: string | null
          field_name: string | null
          id: number
          new_status: string | null
          new_value: string | null
          old_raw_data: Json | null
          old_status: string | null
          old_value: string | null
          reservation_id: string
          sync_source: string | null
        }
        Insert: {
          change_type: string
          changed_at?: string | null
          field_name?: string | null
          id?: number
          new_status?: string | null
          new_value?: string | null
          old_raw_data?: Json | null
          old_status?: string | null
          old_value?: string | null
          reservation_id: string
          sync_source?: string | null
        }
        Update: {
          change_type?: string
          changed_at?: string | null
          field_name?: string | null
          id?: number
          new_status?: string | null
          new_value?: string | null
          old_raw_data?: Json | null
          old_status?: string | null
          old_value?: string | null
          reservation_id?: string
          sync_source?: string | null
        }
        Relationships: []
      }
      review_exclusions: {
        Row: {
          assignee_id: string | null
          excluded_at: string | null
          excluded_by: string | null
          id: number
          reason: string | null
          review_id: string
        }
        Insert: {
          assignee_id?: string | null
          excluded_at?: string | null
          excluded_by?: string | null
          id?: number
          reason?: string | null
          review_id: string
        }
        Update: {
          assignee_id?: string | null
          excluded_at?: string | null
          excluded_by?: string | null
          id?: number
          reason?: string | null
          review_id?: string
        }
        Relationships: []
      }
      sync_log: {
        Row: {
          api_calls_used: number | null
          completed_at: string | null
          created_at: string | null
          duration_seconds: number | null
          errors: Json | null
          id: number
          notes: string | null
          records_created: number | null
          records_processed: number | null
          records_unchanged: number | null
          records_updated: number | null
          started_at: string
          status: string
          workflow_id: string | null
          workflow_name: string
        }
        Insert: {
          api_calls_used?: number | null
          completed_at?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          errors?: Json | null
          id?: number
          notes?: string | null
          records_created?: number | null
          records_processed?: number | null
          records_unchanged?: number | null
          records_updated?: number | null
          started_at: string
          status: string
          workflow_id?: string | null
          workflow_name: string
        }
        Update: {
          api_calls_used?: number | null
          completed_at?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          errors?: Json | null
          id?: number
          notes?: string | null
          records_created?: number | null
          records_processed?: number | null
          records_unchanged?: number | null
          records_updated?: number | null
          started_at?: string
          status?: string
          workflow_id?: string | null
          workflow_name?: string
        }
        Relationships: []
      }
      sync_metadata: {
        Row: {
          key: string
          updated_at: string | null
          value: string | null
        }
        Insert: {
          key: string
          updated_at?: string | null
          value?: string | null
        }
        Update: {
          key?: string
          updated_at?: string | null
          value?: string | null
        }
        Relationships: []
      }
      tag_assignments: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          entity_id: string
          entity_type: string
          id: string
          tag_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          entity_id: string
          entity_type: string
          id?: string
          tag_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tag_assignments_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          category: string
          created_at: string | null
          description: string | null
          id: string
          value: string
        }
        Insert: {
          category: string
          created_at?: string | null
          description?: string | null
          id?: string
          value: string
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string | null
          id?: string
          value?: string
        }
        Relationships: []
      }
      task_history: {
        Row: {
          change_type: string
          changed_at: string | null
          field_name: string | null
          id: number
          new_value: string | null
          old_value: string | null
          sync_source: string | null
          task_id: string
        }
        Insert: {
          change_type: string
          changed_at?: string | null
          field_name?: string | null
          id?: number
          new_value?: string | null
          old_value?: string | null
          sync_source?: string | null
          task_id: string
        }
        Update: {
          change_type?: string
          changed_at?: string | null
          field_name?: string | null
          id?: number
          new_value?: string | null
          old_value?: string | null
          sync_source?: string | null
          task_id?: string
        }
        Relationships: []
      }
      task_team_sizes: {
        Row: {
          task_id: number | null
          team_size: number | null
        }
        Insert: {
          task_id?: number | null
          team_size?: number | null
        }
        Update: {
          task_id?: number | null
          team_size?: number | null
        }
        Relationships: []
      }
      timeero_jobs: {
        Row: {
          active: boolean | null
          address: string | null
          created_at: string | null
          description: string | null
          job_code: string | null
          latitude: number | null
          longitude: number | null
          name: string | null
          rate_per_hour: number | null
          require_geofence: boolean | null
          synced_at: string | null
          timeero_id: number
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          address?: string | null
          created_at?: string | null
          description?: string | null
          job_code?: string | null
          latitude?: number | null
          longitude?: number | null
          name?: string | null
          rate_per_hour?: number | null
          require_geofence?: boolean | null
          synced_at?: string | null
          timeero_id: number
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          address?: string | null
          created_at?: string | null
          description?: string | null
          job_code?: string | null
          latitude?: number | null
          longitude?: number | null
          name?: string | null
          rate_per_hour?: number | null
          require_geofence?: boolean | null
          synced_at?: string | null
          timeero_id?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      timeero_schedules: {
        Row: {
          created_at: string | null
          end_time: string | null
          first_name: string | null
          job_id: number | null
          job_name: string | null
          last_name: string | null
          notes: string | null
          start_time: string | null
          synced_at: string | null
          timeero_id: number
          updated_at: string | null
          user_id: number | null
        }
        Insert: {
          created_at?: string | null
          end_time?: string | null
          first_name?: string | null
          job_id?: number | null
          job_name?: string | null
          last_name?: string | null
          notes?: string | null
          start_time?: string | null
          synced_at?: string | null
          timeero_id: number
          updated_at?: string | null
          user_id?: number | null
        }
        Update: {
          created_at?: string | null
          end_time?: string | null
          first_name?: string | null
          job_id?: number | null
          job_name?: string | null
          last_name?: string | null
          notes?: string | null
          start_time?: string | null
          synced_at?: string | null
          timeero_id?: number
          updated_at?: string | null
          user_id?: number | null
        }
        Relationships: []
      }
      timeero_timesheets: {
        Row: {
          approved: boolean | null
          approved_by: string | null
          break_seconds: number | null
          clock_in_address: string | null
          clock_in_latitude: number | null
          clock_in_longitude: number | null
          clock_in_time: string | null
          clock_in_timezone: string | null
          clock_out_address: string | null
          clock_out_latitude: number | null
          clock_out_longitude: number | null
          clock_out_time: string | null
          created_at: string | null
          duration: string | null
          first_name: string | null
          flagged: boolean | null
          job_id: number | null
          job_name: string | null
          last_name: string | null
          mileage: number | null
          notes: string | null
          synced_at: string | null
          task_id: number | null
          task_name: string | null
          timeero_id: number
          updated_at: string | null
          user_id: number | null
        }
        Insert: {
          approved?: boolean | null
          approved_by?: string | null
          break_seconds?: number | null
          clock_in_address?: string | null
          clock_in_latitude?: number | null
          clock_in_longitude?: number | null
          clock_in_time?: string | null
          clock_in_timezone?: string | null
          clock_out_address?: string | null
          clock_out_latitude?: number | null
          clock_out_longitude?: number | null
          clock_out_time?: string | null
          created_at?: string | null
          duration?: string | null
          first_name?: string | null
          flagged?: boolean | null
          job_id?: number | null
          job_name?: string | null
          last_name?: string | null
          mileage?: number | null
          notes?: string | null
          synced_at?: string | null
          task_id?: number | null
          task_name?: string | null
          timeero_id: number
          updated_at?: string | null
          user_id?: number | null
        }
        Update: {
          approved?: boolean | null
          approved_by?: string | null
          break_seconds?: number | null
          clock_in_address?: string | null
          clock_in_latitude?: number | null
          clock_in_longitude?: number | null
          clock_in_time?: string | null
          clock_in_timezone?: string | null
          clock_out_address?: string | null
          clock_out_latitude?: number | null
          clock_out_longitude?: number | null
          clock_out_time?: string | null
          created_at?: string | null
          duration?: string | null
          first_name?: string | null
          flagged?: boolean | null
          job_id?: number | null
          job_name?: string | null
          last_name?: string | null
          mileage?: number | null
          notes?: string | null
          synced_at?: string | null
          task_id?: number | null
          task_name?: string | null
          timeero_id?: number
          updated_at?: string | null
          user_id?: number | null
        }
        Relationships: []
      }
      timeero_users: {
        Row: {
          active: boolean | null
          created_at: string | null
          email: string | null
          employee_code: string | null
          first_name: string | null
          last_name: string | null
          notes: string | null
          pay_rate: number | null
          phone: string | null
          role_name: string | null
          synced_at: string | null
          timeero_id: number
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          email?: string | null
          employee_code?: string | null
          first_name?: string | null
          last_name?: string | null
          notes?: string | null
          pay_rate?: number | null
          phone?: string | null
          role_name?: string | null
          synced_at?: string | null
          timeero_id: number
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          email?: string | null
          employee_code?: string | null
          first_name?: string | null
          last_name?: string | null
          notes?: string | null
          pay_rate?: number | null
          phone?: string | null
          role_name?: string | null
          synced_at?: string | null
          timeero_id?: number
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      property_clean_benchmarks: {
        Row: {
          deviation_flag: boolean | null
          last_clean_date: string | null
          last_clean_duration_minutes: number | null
          property_id: string | null
          property_name: string | null
          rolling_avg_duration_minutes: number | null
          rolling_max: number | null
          rolling_median_duration_minutes: number | null
          rolling_min: number | null
          sample_size: number | null
          total_departure_cleans_completed: number | null
        }
        Relationships: []
      }
      property_health_weekly: {
        Row: {
          avg_guest_checkout_rating: number | null
          health_signal: string | null
          housekeeping_count: number | null
          inspection_count: number | null
          maintenance_count: number | null
          property_id: string | null
          property_name: string | null
          recurring_issues: string | null
          total_costs: number | null
          total_tasks: number | null
          week_start: string | null
        }
        Relationships: []
      }
      v_cleaner_efficiency: {
        Row: {
          assignee_id: number | null
          assignee_name: string | null
          per_person_minutes: number | null
          property_id: string | null
          property_name: string | null
          scheduled_date: string | null
          source_system: string | null
          status_code: string | null
          task_category: string | null
          task_id: number | null
          team_size: number | null
          total_time_minutes: number | null
        }
        Relationships: []
      }
      v_cleaner_leaderboard: {
        Row: {
          assignee_id: number | null
          assignee_name: string | null
          avg_minutes: number | null
          fastest_minutes: number | null
          first_clean: string | null
          last_clean: string | null
          median_minutes: number | null
          slowest_minutes: number | null
          total_cleans: number | null
        }
        Relationships: []
      }
      v_cleaner_ratings: {
        Row: {
          attribution_status: string | null
          check_in_date: string | null
          check_out_date: string | null
          clean_completed_date: string | null
          clean_task_id: number | null
          clean_task_name: string | null
          clean_to_checkin_days: number | null
          cleanliness_rating: number | null
          had_inspection: boolean | null
          inspection_completed_date: string | null
          inspection_task_id: number | null
          inspection_task_name: string | null
          overall_rating: number | null
          property_id: string | null
          property_name: string | null
          reservation_id: string | null
          review_id: string | null
          review_platform: string | null
          review_text: string | null
          reviewed_at: string | null
          reviewer_name: string | null
          source_system: string | null
        }
        Relationships: []
      }
      v_competitor_intelligence: {
        Row: {
          active_nights: number | null
          air_conditioning: boolean | null
          airroi_vs_pricelabs_pct: number | null
          ar_avg_rate: number | null
          ar_cleaning_fee: number | null
          ar_occupancy: number | null
          ar_pro_managed: boolean | null
          ar_pull_date: string | null
          ar_revenue: number | null
          avg_los: number | null
          bathrooms: number | null
          bedrooms: number | null
          booking_window: number | null
          canc_policy: string | null
          cleaning_fee: number | null
          cohost_names: Json | null
          county: string | null
          data_source: string | null
          dynamic_pricing: string | null
          ev_charger: boolean | null
          guest_favorite: boolean | null
          guests: number | null
          host_id: string | null
          host_name: string | null
          hot_tub: boolean | null
          instant_book: boolean | null
          is_renjoy: boolean | null
          kitchen: boolean | null
          l90d_avg_rate: number | null
          l90d_occupancy: number | null
          l90d_revenue: number | null
          lat: number | null
          listing_id: string | null
          listing_name: string | null
          listing_type: string | null
          lng: number | null
          locality: string | null
          min_stay: number | null
          new_listing: boolean | null
          parking: boolean | null
          pets_allowed: boolean | null
          pl_current_price: number | null
          pl_mgmt_size: string | null
          pl_occupancy: number | null
          pl_pull_date: string | null
          pl_revenue: number | null
          pool: boolean | null
          rating_cleanliness: number | null
          rating_overall: number | null
          rating_value: number | null
          star_rating: number | null
          superhost: boolean | null
          zipcode: string | null
        }
        Relationships: []
      }
      v_cost_summary: {
        Row: {
          avg_per_entry: number | null
          cost_entries: number | null
          first_cost: string | null
          labor_cost: number | null
          last_cost: string | null
          material_cost: number | null
          property_id: string | null
          property_name: string | null
          total_cost: number | null
        }
        Relationships: []
      }
      v_maintenance_hotspots: {
        Row: {
          avg_cost: number | null
          currently_open: number | null
          high_count: number | null
          last_30_days: number | null
          last_90_days: number | null
          property_id: string | null
          property_name: string | null
          total_cost: number | null
          total_maint_tasks: number | null
          urgent_count: number | null
        }
        Relationships: []
      }
      v_monthly_volume: {
        Row: {
          avg_minutes: number | null
          department: string | null
          finished: number | null
          month: string | null
          still_open: number | null
          task_count: number | null
        }
        Relationships: []
      }
      v_occupancy_by_listing: {
        Row: {
          avg_price: number | null
          booked_days: number | null
          listing_id: string | null
          month: string | null
          occupancy_rate: number | null
          total_days: number | null
        }
        Relationships: []
      }
      v_properties: {
        Row: {
          address: string | null
          base_price: number | null
          bathrooms: number | null
          bedrooms: number | null
          breezeway_property_id: string | null
          city: string | null
          created_at: string | null
          guesty_listing_id: string | null
          is_published: boolean | null
          latitude: number | null
          longitude: number | null
          max_guests: number | null
          notes: string | null
          owner_name: string | null
          picture_url: string | null
          property_id: string | null
          property_name: string | null
          property_tier: string | null
          property_type: string | null
          ramp_merchant_id: string | null
          source_system: string | null
          state: string | null
          status: string | null
          updated_at: string | null
          zip: string | null
        }
        Relationships: []
      }
      v_property_difficulty: {
        Row: {
          avg_clean_minutes: number | null
          avg_last_90_days: number | null
          cleans_over_4hrs: number | null
          median_clean_minutes: number | null
          property_id: string | null
          property_name: string | null
          total_cleans: number | null
        }
        Relationships: []
      }
      v_renjoy_vs_market: {
        Row: {
          adr_vs_market_pct: number | null
          airbnb_listing_id: string | null
          airroi_rating: number | null
          airroi_reviews: number | null
          airroi_ttm_adr: number | null
          airroi_ttm_occupancy: number | null
          airroi_ttm_revenue: number | null
          airroi_ttm_revpar: number | null
          airroi_vs_guesty_gap: number | null
          bedrooms: number | null
          city: string | null
          guesty_adr: number | null
          guesty_fare_accommodation: number | null
          guesty_host_payout: number | null
          guesty_nights: number | null
          guesty_occupancy: number | null
          guesty_reservations: number | null
          guesty_revpar: number | null
          guesty_total_paid: number | null
          market_adr: number | null
          market_occupancy: number | null
          market_revpar: number | null
          market_supply: number | null
          occupancy_vs_market_pct: number | null
          pl_cleaning_fee: number | null
          pl_occupancy: number | null
          pl_price: number | null
          pl_revenue: number | null
          property_id: string | null
          property_name: string | null
          revpar_vs_market_pct: number | null
        }
        Relationships: []
      }
      v_repeat_guests: {
        Row: {
          avg_booking_value: number | null
          email: string | null
          full_name: string | null
          id: string | null
          total_bookings: number | null
          total_revenue: number | null
        }
        Insert: {
          avg_booking_value?: never
          email?: string | null
          full_name?: string | null
          id?: string | null
          total_bookings?: number | null
          total_revenue?: number | null
        }
        Update: {
          avg_booking_value?: never
          email?: string | null
          full_name?: string | null
          id?: string | null
          total_bookings?: number | null
          total_revenue?: number | null
        }
        Relationships: []
      }
      v_reservations: {
        Row: {
          adjusted_revenue: number | null
          balance_due: number | null
          booked_at: string | null
          canceled_at: string | null
          channel: string | null
          check_in: string | null
          check_out: string | null
          commission: number | null
          confirmation_code: string | null
          confirmed_at: string | null
          currency: string | null
          guest_email: string | null
          guest_first_stay: string | null
          guest_id: string | null
          guest_name: string | null
          guest_phone: string | null
          guest_total_nights: number | null
          guest_total_stays: number | null
          guests_count: number | null
          guesty_guest_id: string | null
          guesty_listing_id: string | null
          host_payout: number | null
          host_service_fee: number | null
          integration_platform: string | null
          invoice_items: Json | null
          is_returning_guest: boolean | null
          is_vip_guest: boolean | null
          last_updated_at: string | null
          nights_count: number | null
          property_id: string | null
          property_name: string | null
          reservation_id: string | null
          revenue: number | null
          source: string | null
          source_system: string | null
          status: string | null
          synced_at: string | null
          total_paid: number | null
          total_taxes: number | null
        }
        Relationships: []
      }
      v_reservations_public: {
        Row: {
          adjusted_revenue: number | null
          balance_due: number | null
          booked_at: string | null
          canceled_at: string | null
          channel: string | null
          check_in: string | null
          check_out: string | null
          commission: number | null
          confirmation_code: string | null
          confirmed_at: string | null
          currency: string | null
          guest_total_stays: number | null
          guests_count: number | null
          guesty_listing_id: string | null
          host_payout: number | null
          host_service_fee: number | null
          integration_platform: string | null
          is_returning_guest: boolean | null
          is_vip_guest: boolean | null
          last_updated_at: string | null
          nights_count: number | null
          property_id: string | null
          property_name: string | null
          reservation_id: string | null
          revenue: number | null
          source: string | null
          source_system: string | null
          status: string | null
          synced_at: string | null
          total_paid: number | null
          total_taxes: number | null
        }
        Relationships: []
      }
      v_reviews: {
        Row: {
          accuracy_rating: number | null
          booking_channel: string | null
          check_in: string | null
          check_out: string | null
          checkin_rating: number | null
          cleanliness_rating: number | null
          communication_rating: number | null
          guest_name: string | null
          guesty_listing_id: string | null
          has_response: boolean | null
          location_rating: number | null
          overall_rating: number | null
          property_id: string | null
          property_name: string | null
          raw_data: Json | null
          reservation_id: string | null
          responded_at: string | null
          response_text: string | null
          review_id: string | null
          review_platform: string | null
          review_text: string | null
          reviewed_at: string | null
          reviewer_name: string | null
          source_system: string | null
          value_rating: number | null
        }
        Relationships: []
      }
      v_stale_tasks: {
        Row: {
          assignees: string | null
          created_at: string | null
          days_overdue: number | null
          days_since_created: number | null
          department: string | null
          priority: string | null
          property_id: string | null
          property_name: string | null
          scheduled_date: string | null
          source_system: string | null
          started_at: string | null
          status_code: string | null
          task_id: number | null
          task_name: string | null
        }
        Relationships: []
      }
      v_task_assignments: {
        Row: {
          assignee_id: number | null
          assignee_name: string | null
          assignment_id: number | null
          assignment_status: string | null
          department: string | null
          employee_code: string | null
          expires_at: string | null
          per_person_minutes: number | null
          property_id: string | null
          property_name: string | null
          scheduled_date: string | null
          source_system: string | null
          task_category: string | null
          task_id: number | null
          task_name: string | null
          task_status: string | null
          team_size: number | null
          total_time_minutes: number | null
        }
        Relationships: [
          {
            foreignKeyName: "breezeway_task_assignments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "breezeway_tasks"
            referencedColumns: ["breezeway_id"]
          },
          {
            foreignKeyName: "breezeway_task_assignments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "v_cleaner_efficiency"
            referencedColumns: ["task_id"]
          },
          {
            foreignKeyName: "breezeway_task_assignments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "v_cleaner_ratings"
            referencedColumns: ["clean_task_id"]
          },
          {
            foreignKeyName: "breezeway_task_assignments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "v_cleaner_ratings"
            referencedColumns: ["inspection_task_id"]
          },
          {
            foreignKeyName: "breezeway_task_assignments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "v_stale_tasks"
            referencedColumns: ["task_id"]
          },
          {
            foreignKeyName: "breezeway_task_assignments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "v_tasks"
            referencedColumns: ["task_id"]
          },
        ]
      }
      v_task_team_size: {
        Row: {
          task_id: number | null
          team_size: number | null
        }
        Relationships: [
          {
            foreignKeyName: "breezeway_task_assignments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "breezeway_tasks"
            referencedColumns: ["breezeway_id"]
          },
          {
            foreignKeyName: "breezeway_task_assignments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "v_cleaner_efficiency"
            referencedColumns: ["task_id"]
          },
          {
            foreignKeyName: "breezeway_task_assignments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "v_cleaner_ratings"
            referencedColumns: ["clean_task_id"]
          },
          {
            foreignKeyName: "breezeway_task_assignments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "v_cleaner_ratings"
            referencedColumns: ["inspection_task_id"]
          },
          {
            foreignKeyName: "breezeway_task_assignments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "v_stale_tasks"
            referencedColumns: ["task_id"]
          },
          {
            foreignKeyName: "breezeway_task_assignments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "v_tasks"
            referencedColumns: ["task_id"]
          },
        ]
      }
      v_tasks: {
        Row: {
          breezeway_home_id: number | null
          created_at: string | null
          created_by_name: string | null
          department: string | null
          description: string | null
          finished_at: string | null
          finished_by_name: string | null
          guesty_listing_id: string | null
          linked_reservation_external_id: string | null
          linked_reservation_id: number | null
          original_description: string | null
          original_task_name: string | null
          paused: boolean | null
          photo_count: number | null
          priority: string | null
          property_id: string | null
          property_name_canonical: string | null
          property_name_source: string | null
          rate_paid: number | null
          rate_type: string | null
          report_url: string | null
          requested_by: string | null
          scheduled_date: string | null
          scheduled_time: string | null
          source_system: string | null
          started_at: string | null
          status_code: string | null
          status_name: string | null
          status_stage: string | null
          summary: string | null
          synced_at: string | null
          tag_list: string | null
          task_category: string | null
          task_id: number | null
          task_name: string | null
          task_type: string | null
          template_id: number | null
          total_cost: number | null
          total_time: string | null
          total_time_minutes: number | null
          updated_at: string | null
        }
        Relationships: []
      }
      v_team_workload: {
        Row: {
          assignee_id: number | null
          assignee_name: string | null
          completed: number | null
          currently_active: number | null
          housekeeping_tasks: number | null
          inspection_tasks: number | null
          last_30_days: number | null
          last_7_days: number | null
          last_task_date: string | null
          maintenance_tasks: number | null
          total_assigned: number | null
        }
        Relationships: []
      }
      v_timesheets: {
        Row: {
          approved: boolean | null
          approved_by: string | null
          break_seconds: number | null
          breezeway_assignee_id: string | null
          breezeway_assignee_name: string | null
          clock_in: string | null
          clock_in_address: string | null
          clock_out: string | null
          clock_out_address: string | null
          duration: string | null
          duration_minutes: number | null
          first_name: string | null
          flagged: boolean | null
          job_id: number | null
          job_name: string | null
          last_name: string | null
          mileage: number | null
          notes: string | null
          source_system: string | null
          timeero_id: number | null
          timeero_task_id: number | null
          timeero_task_name: string | null
          user_id: number | null
          work_date: string | null
          worker_name: string | null
        }
        Relationships: []
      }
      v_top_maintenance_issues: {
        Row: {
          avg_cost: number | null
          avg_minutes: number | null
          currently_open: number | null
          occurrences: number | null
          properties_affected: number | null
          task_type: string | null
          total_cost_all_time: number | null
        }
        Relationships: []
      }
      v_weekly_efficiency: {
        Row: {
          assignee_id: number | null
          assignee_name: string | null
          avg_minutes: number | null
          clean_count: number | null
          stddev_minutes: number | null
          week_start: string | null
        }
        Relationships: []
      }
      worker_performance_weekly: {
        Row: {
          avg_efficiency_ratio: number | null
          avg_photo_compliance_pct: number | null
          avg_response_quality: number | null
          avg_response_time_minutes: number | null
          avg_work_duration_minutes: number | null
          callback_count: number | null
          callback_rate: number | null
          completeness_score: number | null
          tasks_completed: number | null
          total_proactive_flags: number | null
          week_start: string | null
          worker_id: number | null
          worker_name: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _tmp_idx: { Args: never; Returns: Json }
      airroi_exec: { Args: { p_sql: string }; Returns: Json }
      airroi_insert_metrics: { Args: { p_data: Json }; Returns: number }
      airroi_insert_pacing: { Args: { p_data: Json }; Returns: number }
      airroi_insert_summary: {
        Args: {
          p_adr: number
          p_filter_segment: string
          p_lead_time: number
          p_listings: number
          p_los: number
          p_market_id: string
          p_occupancy: number
          p_revenue: number
          p_revpar: number
        }
        Returns: string
      }
      airroi_query: { Args: { q: string }; Returns: Json }
      airroi_upsert_market: {
        Args: {
          p_active_listings_count: number
          p_country: string
          p_county: string
          p_district: string
          p_full_name: string
          p_is_active: boolean
          p_locality: string
          p_region: string
          p_tier?: string
        }
        Returns: string
      }
      exec_sql: { Args: { sql: string }; Returns: undefined }
      get_bad_reviews_with_cleaners: {
        Args: { p_since: string; p_until?: string }
        Returns: {
          channel: string
          check_in: string
          cleaner_names: string
          cleanliness_rating: number
          comment: string
          guest_name: string
          overall_rating: number
          property_name: string
          review_date: string
          review_id: string
        }[]
      }
      get_booking_pace: {
        Args: { p_date?: string }
        Returns: {
          last_week_bookings: number
          last_week_cancels: number
          last_week_nights: number
          last_week_revenue: number
          yesterday_bookings: number
          yesterday_cancels: number
          yesterday_nights: number
          yesterday_revenue: number
        }[]
      }
      get_clean_streaks: {
        Args: never
        Returns: {
          assignee_id: number
          assignee_name: string
          best_streak: number
          current_streak: number
          last_clean_date: string
          streak_start_date: string
        }[]
      }
      get_cleaner_detail: {
        Args: { p_assignee_id: number; p_end?: string; p_start?: string }
        Returns: {
          clean_date: string
          clean_to_checkin_days: number
          cleanliness_rating: number
          co_cleaners: string
          had_inspection: boolean
          inspector_name: string
          is_excluded: boolean
          low_confidence: boolean
          overall_rating: number
          per_person_minutes: number
          property_name: string
          review_date: string
          review_text: string
          task_time_minutes: number
          team_size: number
        }[]
      }
      get_cleaner_efficiency: {
        Args: { end_date: string; start_date: string }
        Returns: {
          assignee_id: string
          assignee_name: string
          days_worked: number
          efficiency_pct: number
          first_day: string
          last_day: string
          total_clocked_minutes: number
          total_task_minutes: number
          total_tasks: number
          unaccounted_minutes: number
        }[]
      }
      get_cleanliness_shoutouts: {
        Args: { since_date?: string }
        Returns: {
          cleaner_names: string
          cleanliness_rating: number
          inspection_task_name: string
          inspector_name: string
          overall_rating: number
          property_name: string
          review_id: string
          review_platform: string
          review_text: string
          reviewed_at: string
          reviewer_name: string
        }[]
      }
      get_function_source: { Args: { fname: string }; Returns: string }
      get_inspector_leaderboard: {
        Args: { p_end: string; p_start: string }
        Returns: {
          avg_cleanliness: number
          avg_overall: number
          bad_reviews: number
          cleanliness_rated: number
          inspector_id: number
          inspector_name: string
          perfect_reviews: number
          rated_inspections: number
          total_inspections: number
        }[]
      }
      get_leaderboard: {
        Args: {
          p_end: string
          p_min_rated?: number
          p_start: string
          p_worker_type?: string
        }
        Returns: {
          assignee_id: number
          assignee_name: string
          avg_cleanliness: number
          avg_minutes: number
          avg_overall: number
          cleanliness_rated_cleans: number
          efficiency_pct: number
          has_ratings: boolean
          has_timeero: boolean
          last_clean_date: string
          rated_cleans: number
          total_cleans: number
          worker_type: string
        }[]
      }
      get_today_stats: {
        Args: { p_date?: string }
        Returns: {
          avg_completion_minutes: number
          cleaners_active: number
          cleans_completed: number
          cleans_in_progress: number
          cleans_upcoming: number
          total_scheduled: number
        }[]
      }
      get_today_tasks: {
        Args: { p_date?: string }
        Returns: {
          all_assignees: string
          assignee_id: number
          assignee_name: string
          property_name: string
          status: string
          task_id: string
          team_size: number
          total_time_minutes: number
        }[]
      }
      get_view_def: { Args: { vname: string }; Returns: string }
      get_weekly_shoutouts: {
        Args: { p_week_start?: string }
        Returns: {
          assignee_id: number
          assignee_name: string
          description: string
          metric_value: number
          shoutout_type: string
        }[]
      }
      pricelabs_exec: { Args: { p_sql: string }; Returns: Json }
      pricelabs_query: { Args: { q: string }; Returns: Json }
      refresh_materialized_data: { Args: never; Returns: string }
      run_query: { Args: { sql_text: string }; Returns: Json }
      test_rls_bypass: { Args: never; Returns: number }
      tmp_cols: { Args: never; Returns: Json }
      tmp_debug: { Args: never; Returns: Json }
      tmp_debug2: { Args: never; Returns: Json }
      tmp_debug3: { Args: never; Returns: Json }
      tmp_fix_airroi: { Args: never; Returns: Json }
      tmp_fix_ids: { Args: never; Returns: Json }
      tmp_unmatched: { Args: never; Returns: Json }
      tmp_verify_match: { Args: never; Returns: Json }
      tmp_verify_views: { Args: never; Returns: Json }
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

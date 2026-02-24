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
      acquisition_targets: {
        Row: {
          assigned_to: string | null
          avg_occupancy: number | null
          avg_rating: number | null
          created_at: string | null
          host_id: string | null
          host_name: string | null
          id: string
          listing_count: number | null
          mgmt_size: string | null
          outreach_notes: string | null
          outreach_status: string | null
          pct_no_dynamic_pricing: number | null
          target_category: string | null
          top_listing_urls: string[] | null
          total_estimated_revenue: number | null
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          avg_occupancy?: number | null
          avg_rating?: number | null
          created_at?: string | null
          host_id?: string | null
          host_name?: string | null
          id?: string
          listing_count?: number | null
          mgmt_size?: string | null
          outreach_notes?: string | null
          outreach_status?: string | null
          pct_no_dynamic_pricing?: number | null
          target_category?: string | null
          top_listing_urls?: string[] | null
          total_estimated_revenue?: number | null
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          avg_occupancy?: number | null
          avg_rating?: number | null
          created_at?: string | null
          host_id?: string | null
          host_name?: string | null
          id?: string
          listing_count?: number | null
          mgmt_size?: string | null
          outreach_notes?: string | null
          outreach_status?: string | null
          pct_no_dynamic_pricing?: number | null
          target_category?: string | null
          top_listing_urls?: string[] | null
          total_estimated_revenue?: number | null
          updated_at?: string | null
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
          ai_breezeway_tags: string[] | null
          ai_complexity: string | null
          ai_description: string | null
          ai_enriched_at: string | null
          ai_estimated_repair_cost: number | null
          ai_follow_up_needed: boolean | null
          ai_follow_up_reason: string | null
          ai_guest_impact: boolean | null
          ai_issues: Json | null
          ai_photo_compliance_pct: number | null
          ai_priority_override: string | null
          ai_proactive_flags: number | null
          ai_property_health_level: string | null
          ai_property_health_note: string | null
          ai_property_health_signal: string | null
          ai_recurring_risk: boolean | null
          ai_response_quality: number | null
          ai_skill_category: string | null
          ai_suggested_tags: Json | null
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
          enrichment_hash: string | null
          finished_at: string | null
          finished_by_id: number | null
          finished_by_name: string | null
          home_id: number | null
          last_enriched_at: string | null
          linked_reservation_external_id: string | null
          linked_reservation_id: number | null
          name: string | null
          original_description: string | null
          original_title: string | null
          owner_notify: boolean | null
          owner_notify_reason: string | null
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
          ai_breezeway_tags?: string[] | null
          ai_complexity?: string | null
          ai_description?: string | null
          ai_enriched_at?: string | null
          ai_estimated_repair_cost?: number | null
          ai_follow_up_needed?: boolean | null
          ai_follow_up_reason?: string | null
          ai_guest_impact?: boolean | null
          ai_issues?: Json | null
          ai_photo_compliance_pct?: number | null
          ai_priority_override?: string | null
          ai_proactive_flags?: number | null
          ai_property_health_level?: string | null
          ai_property_health_note?: string | null
          ai_property_health_signal?: string | null
          ai_recurring_risk?: boolean | null
          ai_response_quality?: number | null
          ai_skill_category?: string | null
          ai_suggested_tags?: Json | null
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
          enrichment_hash?: string | null
          finished_at?: string | null
          finished_by_id?: number | null
          finished_by_name?: string | null
          home_id?: number | null
          last_enriched_at?: string | null
          linked_reservation_external_id?: string | null
          linked_reservation_id?: number | null
          name?: string | null
          original_description?: string | null
          original_title?: string | null
          owner_notify?: boolean | null
          owner_notify_reason?: string | null
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
          ai_breezeway_tags?: string[] | null
          ai_complexity?: string | null
          ai_description?: string | null
          ai_enriched_at?: string | null
          ai_estimated_repair_cost?: number | null
          ai_follow_up_needed?: boolean | null
          ai_follow_up_reason?: string | null
          ai_guest_impact?: boolean | null
          ai_issues?: Json | null
          ai_photo_compliance_pct?: number | null
          ai_priority_override?: string | null
          ai_proactive_flags?: number | null
          ai_property_health_level?: string | null
          ai_property_health_note?: string | null
          ai_property_health_signal?: string | null
          ai_recurring_risk?: boolean | null
          ai_response_quality?: number | null
          ai_skill_category?: string | null
          ai_suggested_tags?: Json | null
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
          enrichment_hash?: string | null
          finished_at?: string | null
          finished_by_id?: number | null
          finished_by_name?: string | null
          home_id?: number | null
          last_enriched_at?: string | null
          linked_reservation_external_id?: string | null
          linked_reservation_id?: number | null
          name?: string | null
          original_description?: string | null
          original_title?: string | null
          owner_notify?: boolean | null
          owner_notify_reason?: string | null
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
          assignee_id: number | null
          assignee_name: string | null
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
        Insert: {
          assignee_id?: number | null
          assignee_name?: string | null
          attribution_status?: string | null
          check_in_date?: string | null
          check_out_date?: string | null
          clean_completed_date?: string | null
          clean_task_id?: number | null
          clean_task_name?: string | null
          clean_to_checkin_days?: number | null
          cleanliness_rating?: number | null
          had_inspection?: boolean | null
          inspection_completed_date?: string | null
          inspection_task_id?: number | null
          inspection_task_name?: string | null
          overall_rating?: number | null
          property_id?: string | null
          property_name?: string | null
          reservation_id?: string | null
          review_id?: string | null
          review_platform?: string | null
          review_text?: string | null
          reviewed_at?: string | null
          reviewer_name?: string | null
          source_system?: string | null
        }
        Update: {
          assignee_id?: number | null
          assignee_name?: string | null
          attribution_status?: string | null
          check_in_date?: string | null
          check_out_date?: string | null
          clean_completed_date?: string | null
          clean_task_id?: number | null
          clean_task_name?: string | null
          clean_to_checkin_days?: number | null
          cleanliness_rating?: number | null
          had_inspection?: boolean | null
          inspection_completed_date?: string | null
          inspection_task_id?: number | null
          inspection_task_name?: string | null
          overall_rating?: number | null
          property_id?: string | null
          property_name?: string | null
          reservation_id?: string | null
          review_id?: string | null
          review_platform?: string | null
          review_text?: string | null
          reviewed_at?: string | null
          reviewer_name?: string | null
          source_system?: string | null
        }
        Relationships: []
      }
      daily_health_scores: {
        Row: {
          cleanliness_score: number
          components: Json
          composite_score: number
          created_at: string | null
          date: string
          flag_score: number
          maintenance_score: number
          occupancy_score: number
          review_score: number
          spend_score: number
        }
        Insert: {
          cleanliness_score: number
          components: Json
          composite_score: number
          created_at?: string | null
          date: string
          flag_score: number
          maintenance_score: number
          occupancy_score: number
          review_score: number
          spend_score: number
        }
        Update: {
          cleanliness_score?: number
          components?: Json
          composite_score?: number
          created_at?: string | null
          date?: string
          flag_score?: number
          maintenance_score?: number
          occupancy_score?: number
          review_score?: number
          spend_score?: number
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
      employee_registry: {
        Row: {
          breezeway_assignee_id: string | null
          created_at: string | null
          department: string | null
          email: string | null
          employee_code: string | null
          employment_type: string | null
          first_name: string | null
          full_name: string
          guesty_user_id: string | null
          hire_date: string | null
          id: string
          last_name: string | null
          match_confidence: number | null
          match_method: string | null
          pay_rate: number | null
          phone: string | null
          ramp_user_id: string | null
          role: string | null
          slack_user_id: string | null
          status: string | null
          timeero_user_id: string | null
          updated_at: string | null
        }
        Insert: {
          breezeway_assignee_id?: string | null
          created_at?: string | null
          department?: string | null
          email?: string | null
          employee_code?: string | null
          employment_type?: string | null
          first_name?: string | null
          full_name: string
          guesty_user_id?: string | null
          hire_date?: string | null
          id?: string
          last_name?: string | null
          match_confidence?: number | null
          match_method?: string | null
          pay_rate?: number | null
          phone?: string | null
          ramp_user_id?: string | null
          role?: string | null
          slack_user_id?: string | null
          status?: string | null
          timeero_user_id?: string | null
          updated_at?: string | null
        }
        Update: {
          breezeway_assignee_id?: string | null
          created_at?: string | null
          department?: string | null
          email?: string | null
          employee_code?: string | null
          employment_type?: string | null
          first_name?: string | null
          full_name?: string
          guesty_user_id?: string | null
          hire_date?: string | null
          id?: string
          last_name?: string | null
          match_confidence?: number | null
          match_method?: string | null
          pay_rate?: number | null
          phone?: string | null
          ramp_user_id?: string | null
          role?: string | null
          slack_user_id?: string | null
          status?: string | null
          timeero_user_id?: string | null
          updated_at?: string | null
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
      hiring_applications: {
        Row: {
          ai_flags: Json | null
          ai_recommendation: string | null
          ai_score: number | null
          ai_summary: string | null
          applicant_name: string | null
          created_at: string | null
          email: string | null
          id: string
          job_title: string | null
          phone: string | null
          polymer_application_id: string | null
          polymer_candidate_url: string | null
          raw_payload: Json | null
          resume_url: string | null
          screening_answers: Json | null
          status: string | null
        }
        Insert: {
          ai_flags?: Json | null
          ai_recommendation?: string | null
          ai_score?: number | null
          ai_summary?: string | null
          applicant_name?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          job_title?: string | null
          phone?: string | null
          polymer_application_id?: string | null
          polymer_candidate_url?: string | null
          raw_payload?: Json | null
          resume_url?: string | null
          screening_answers?: Json | null
          status?: string | null
        }
        Update: {
          ai_flags?: Json | null
          ai_recommendation?: string | null
          ai_score?: number | null
          ai_summary?: string | null
          applicant_name?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          job_title?: string | null
          phone?: string | null
          polymer_application_id?: string | null
          polymer_candidate_url?: string | null
          raw_payload?: Json | null
          resume_url?: string | null
          screening_answers?: Json | null
          status?: string | null
        }
        Relationships: []
      }
      hiring_job_descriptions: {
        Row: {
          active: boolean | null
          created_at: string | null
          department: string | null
          description_text: string | null
          id: string
          job_title: string
          location: string | null
          pay_range: string | null
          polymer_job_id: string | null
          polymer_url: string | null
          raw_payload: Json | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          department?: string | null
          description_text?: string | null
          id?: string
          job_title: string
          location?: string | null
          pay_range?: string | null
          polymer_job_id?: string | null
          polymer_url?: string | null
          raw_payload?: Json | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          department?: string | null
          description_text?: string | null
          id?: string
          job_title?: string
          location?: string | null
          pay_range?: string | null
          polymer_job_id?: string | null
          polymer_url?: string | null
          raw_payload?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      infrastructure_snapshots: {
        Row: {
          content: string
          created_at: string | null
          id: number
          metadata: Json | null
          snapshot_date: string
          snapshot_type: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: number
          metadata?: Json | null
          snapshot_date: string
          snapshot_type?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: number
          metadata?: Json | null
          snapshot_date?: string
          snapshot_type?: string | null
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
      n8n_workflows: {
        Row: {
          active: boolean | null
          created_at: string | null
          cron_expression: string | null
          last_n8n_execution_at: string | null
          last_n8n_execution_status: string | null
          name: string
          node_count: number | null
          notes: string | null
          schedule_description: string | null
          synced_at: string | null
          tags: string[] | null
          trigger_type: string | null
          updated_at: string | null
          webhook_path: string | null
          workflow_id: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          cron_expression?: string | null
          last_n8n_execution_at?: string | null
          last_n8n_execution_status?: string | null
          name: string
          node_count?: number | null
          notes?: string | null
          schedule_description?: string | null
          synced_at?: string | null
          tags?: string[] | null
          trigger_type?: string | null
          updated_at?: string | null
          webhook_path?: string | null
          workflow_id: string
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          cron_expression?: string | null
          last_n8n_execution_at?: string | null
          last_n8n_execution_status?: string | null
          name?: string
          node_count?: number | null
          notes?: string | null
          schedule_description?: string | null
          synced_at?: string | null
          tags?: string[] | null
          trigger_type?: string | null
          updated_at?: string | null
          webhook_path?: string | null
          workflow_id?: string
        }
        Relationships: []
      }
      owner_profiles: {
        Row: {
          communication_style: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string | null
          escalation_history: Json | null
          first_message_date: string | null
          id: string
          key_requests: Json | null
          last_message_date: string | null
          notable_quotes: Json | null
          owner_summary: string | null
          primary_concerns: Json | null
          properties_mentioned: Json | null
          raw_payload: Json | null
          sentiment_overall: string | null
          source: string | null
          tags: Json | null
          temperament: string | null
          total_messages: number | null
          updated_at: string | null
        }
        Insert: {
          communication_style?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          escalation_history?: Json | null
          first_message_date?: string | null
          id?: string
          key_requests?: Json | null
          last_message_date?: string | null
          notable_quotes?: Json | null
          owner_summary?: string | null
          primary_concerns?: Json | null
          properties_mentioned?: Json | null
          raw_payload?: Json | null
          sentiment_overall?: string | null
          source?: string | null
          tags?: Json | null
          temperament?: string | null
          total_messages?: number | null
          updated_at?: string | null
        }
        Update: {
          communication_style?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          escalation_history?: Json | null
          first_message_date?: string | null
          id?: string
          key_requests?: Json | null
          last_message_date?: string | null
          notable_quotes?: Json | null
          owner_summary?: string | null
          primary_concerns?: Json | null
          properties_mentioned?: Json | null
          raw_payload?: Json | null
          sentiment_overall?: string | null
          source?: string | null
          tags?: Json | null
          temperament?: string | null
          total_messages?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      pricelabs_listings: {
        Row: {
          active_nights: number | null
          air_conditioning: boolean | null
          balcony: boolean | null
          base_guests: number | null
          bathrooms: number | null
          beachfront: boolean | null
          bedrooms: string | null
          booking_window: number | null
          canc_policy: string | null
          cleaning_fee: number | null
          distance_from_centroid: number | null
          dynamic_pricing: string | null
          ev_charger: boolean | null
          guest_favorite: boolean | null
          host_id: string | null
          hottub: boolean | null
          kitchen: boolean | null
          lakefront: boolean | null
          lat: number | null
          listing_id: string
          listing_link: string | null
          listing_title: string | null
          listing_type: string | null
          lng: number | null
          los: number | null
          min_stay: number | null
          new_listing: boolean | null
          occupancy: number | null
          parking: boolean | null
          pets_allowed: boolean | null
          pool: boolean | null
          price: number | null
          pricelabs_id: number | null
          professionally_managed: string | null
          revenue: number | null
          reviews: number | null
          source_file: string | null
          star_rating: string | null
          updated_at: string | null
          waterfront: boolean | null
          zipcode: string | null
        }
        Insert: {
          active_nights?: number | null
          air_conditioning?: boolean | null
          balcony?: boolean | null
          base_guests?: number | null
          bathrooms?: number | null
          beachfront?: boolean | null
          bedrooms?: string | null
          booking_window?: number | null
          canc_policy?: string | null
          cleaning_fee?: number | null
          distance_from_centroid?: number | null
          dynamic_pricing?: string | null
          ev_charger?: boolean | null
          guest_favorite?: boolean | null
          host_id?: string | null
          hottub?: boolean | null
          kitchen?: boolean | null
          lakefront?: boolean | null
          lat?: number | null
          listing_id: string
          listing_link?: string | null
          listing_title?: string | null
          listing_type?: string | null
          lng?: number | null
          los?: number | null
          min_stay?: number | null
          new_listing?: boolean | null
          occupancy?: number | null
          parking?: boolean | null
          pets_allowed?: boolean | null
          pool?: boolean | null
          price?: number | null
          pricelabs_id?: number | null
          professionally_managed?: string | null
          revenue?: number | null
          reviews?: number | null
          source_file?: string | null
          star_rating?: string | null
          updated_at?: string | null
          waterfront?: boolean | null
          zipcode?: string | null
        }
        Update: {
          active_nights?: number | null
          air_conditioning?: boolean | null
          balcony?: boolean | null
          base_guests?: number | null
          bathrooms?: number | null
          beachfront?: boolean | null
          bedrooms?: string | null
          booking_window?: number | null
          canc_policy?: string | null
          cleaning_fee?: number | null
          distance_from_centroid?: number | null
          dynamic_pricing?: string | null
          ev_charger?: boolean | null
          guest_favorite?: boolean | null
          host_id?: string | null
          hottub?: boolean | null
          kitchen?: boolean | null
          lakefront?: boolean | null
          lat?: number | null
          listing_id?: string
          listing_link?: string | null
          listing_title?: string | null
          listing_type?: string | null
          lng?: number | null
          los?: number | null
          min_stay?: number | null
          new_listing?: boolean | null
          occupancy?: number | null
          parking?: boolean | null
          pets_allowed?: boolean | null
          pool?: boolean | null
          price?: number | null
          pricelabs_id?: number | null
          professionally_managed?: string | null
          revenue?: number | null
          reviews?: number | null
          source_file?: string | null
          star_rating?: string | null
          updated_at?: string | null
          waterfront?: boolean | null
          zipcode?: string | null
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
      pulse_config_thresholds: {
        Row: {
          created_at: string | null
          description: string | null
          key: string
          updated_at: string | null
          value: Json
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          key: string
          updated_at?: string | null
          value: Json
        }
        Update: {
          created_at?: string | null
          description?: string | null
          key?: string
          updated_at?: string | null
          value?: Json
        }
        Relationships: []
      }
      ramp_accounting_records: {
        Row: {
          category: string | null
          id: string
          memo: string | null
          raw_json: Json | null
          synced_at: string | null
          transaction_id: string | null
        }
        Insert: {
          category?: string | null
          id: string
          memo?: string | null
          raw_json?: Json | null
          synced_at?: string | null
          transaction_id?: string | null
        }
        Update: {
          category?: string | null
          id?: string
          memo?: string | null
          raw_json?: Json | null
          synced_at?: string | null
          transaction_id?: string | null
        }
        Relationships: []
      }
      ramp_bank_accounts: {
        Row: {
          id: string
          last_four: string | null
          name: string | null
          raw_json: Json | null
          status: string | null
          synced_at: string | null
          type: string | null
        }
        Insert: {
          id: string
          last_four?: string | null
          name?: string | null
          raw_json?: Json | null
          status?: string | null
          synced_at?: string | null
          type?: string | null
        }
        Update: {
          id?: string
          last_four?: string | null
          name?: string | null
          raw_json?: Json | null
          status?: string | null
          synced_at?: string | null
          type?: string | null
        }
        Relationships: []
      }
      ramp_bills: {
        Row: {
          amount: number | null
          created_at: string | null
          currency_code: string | null
          due_date: string | null
          entity_id: string | null
          id: string
          invoice_date: string | null
          invoice_number: string | null
          line_items: Json | null
          memo: string | null
          payment_date: string | null
          raw_json: Json | null
          status: string | null
          synced_at: string | null
          updated_at: string | null
          vendor_id: string | null
          vendor_name: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          currency_code?: string | null
          due_date?: string | null
          entity_id?: string | null
          id: string
          invoice_date?: string | null
          invoice_number?: string | null
          line_items?: Json | null
          memo?: string | null
          payment_date?: string | null
          raw_json?: Json | null
          status?: string | null
          synced_at?: string | null
          updated_at?: string | null
          vendor_id?: string | null
          vendor_name?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          currency_code?: string | null
          due_date?: string | null
          entity_id?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          line_items?: Json | null
          memo?: string | null
          payment_date?: string | null
          raw_json?: Json | null
          status?: string | null
          synced_at?: string | null
          updated_at?: string | null
          vendor_id?: string | null
          vendor_name?: string | null
        }
        Relationships: []
      }
      ramp_cards: {
        Row: {
          card_program_id: string | null
          display_name: string | null
          id: string
          is_physical: boolean | null
          last_four: string | null
          raw_json: Json | null
          spending_restrictions: Json | null
          state: string | null
          synced_at: string | null
          user_id: string | null
        }
        Insert: {
          card_program_id?: string | null
          display_name?: string | null
          id: string
          is_physical?: boolean | null
          last_four?: string | null
          raw_json?: Json | null
          spending_restrictions?: Json | null
          state?: string | null
          synced_at?: string | null
          user_id?: string | null
        }
        Update: {
          card_program_id?: string | null
          display_name?: string | null
          id?: string
          is_physical?: boolean | null
          last_four?: string | null
          raw_json?: Json | null
          spending_restrictions?: Json | null
          state?: string | null
          synced_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      ramp_cashbacks: {
        Row: {
          amount: number | null
          created_at: string | null
          currency_code: string | null
          id: string
          raw_json: Json | null
          synced_at: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          currency_code?: string | null
          id: string
          raw_json?: Json | null
          synced_at?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          currency_code?: string | null
          id?: string
          raw_json?: Json | null
          synced_at?: string | null
        }
        Relationships: []
      }
      ramp_departments: {
        Row: {
          id: string
          name: string | null
          raw_json: Json | null
          synced_at: string | null
        }
        Insert: {
          id: string
          name?: string | null
          raw_json?: Json | null
          synced_at?: string | null
        }
        Update: {
          id?: string
          name?: string | null
          raw_json?: Json | null
          synced_at?: string | null
        }
        Relationships: []
      }
      ramp_entities: {
        Row: {
          currency_code: string | null
          id: string
          is_primary: boolean | null
          name: string | null
          raw_json: Json | null
          synced_at: string | null
        }
        Insert: {
          currency_code?: string | null
          id: string
          is_primary?: boolean | null
          name?: string | null
          raw_json?: Json | null
          synced_at?: string | null
        }
        Update: {
          currency_code?: string | null
          id?: string
          is_primary?: boolean | null
          name?: string | null
          raw_json?: Json | null
          synced_at?: string | null
        }
        Relationships: []
      }
      ramp_limits: {
        Row: {
          balance_amount: number | null
          balance_currency: string | null
          display_name: string | null
          id: string
          raw_json: Json | null
          spend_program_id: string | null
          state: string | null
          synced_at: string | null
          user_id: string | null
        }
        Insert: {
          balance_amount?: number | null
          balance_currency?: string | null
          display_name?: string | null
          id: string
          raw_json?: Json | null
          spend_program_id?: string | null
          state?: string | null
          synced_at?: string | null
          user_id?: string | null
        }
        Update: {
          balance_amount?: number | null
          balance_currency?: string | null
          display_name?: string | null
          id?: string
          raw_json?: Json | null
          spend_program_id?: string | null
          state?: string | null
          synced_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      ramp_locations: {
        Row: {
          id: string
          name: string | null
          raw_json: Json | null
          synced_at: string | null
        }
        Insert: {
          id: string
          name?: string | null
          raw_json?: Json | null
          synced_at?: string | null
        }
        Update: {
          id?: string
          name?: string | null
          raw_json?: Json | null
          synced_at?: string | null
        }
        Relationships: []
      }
      ramp_memos: {
        Row: {
          created_at: string | null
          id: string
          memo: string | null
          raw_json: Json | null
          synced_at: string | null
          transaction_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id: string
          memo?: string | null
          raw_json?: Json | null
          synced_at?: string | null
          transaction_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          memo?: string | null
          raw_json?: Json | null
          synced_at?: string | null
          transaction_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      ramp_merchants: {
        Row: {
          descriptor: string | null
          id: string
          mcc: string | null
          name: string | null
          raw_json: Json | null
          synced_at: string | null
        }
        Insert: {
          descriptor?: string | null
          id: string
          mcc?: string | null
          name?: string | null
          raw_json?: Json | null
          synced_at?: string | null
        }
        Update: {
          descriptor?: string | null
          id?: string
          mcc?: string | null
          name?: string | null
          raw_json?: Json | null
          synced_at?: string | null
        }
        Relationships: []
      }
      ramp_purchase_orders: {
        Row: {
          amount: number | null
          created_at: string | null
          id: string
          po_number: string | null
          raw_json: Json | null
          status: string | null
          synced_at: string | null
          vendor_id: string | null
          vendor_name: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          id: string
          po_number?: string | null
          raw_json?: Json | null
          status?: string | null
          synced_at?: string | null
          vendor_id?: string | null
          vendor_name?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          id?: string
          po_number?: string | null
          raw_json?: Json | null
          status?: string | null
          synced_at?: string | null
          vendor_id?: string | null
          vendor_name?: string | null
        }
        Relationships: []
      }
      ramp_receipts: {
        Row: {
          created_at: string | null
          id: string
          raw_json: Json | null
          receipt_url: string | null
          synced_at: string | null
          transaction_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id: string
          raw_json?: Json | null
          receipt_url?: string | null
          synced_at?: string | null
          transaction_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          raw_json?: Json | null
          receipt_url?: string | null
          synced_at?: string | null
          transaction_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      ramp_reimbursements: {
        Row: {
          amount: number | null
          created_at: string | null
          currency_code: string | null
          id: string
          memo: string | null
          merchant: string | null
          raw_json: Json | null
          status: string | null
          synced_at: string | null
          transaction_date: string | null
          user_id: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          currency_code?: string | null
          id: string
          memo?: string | null
          merchant?: string | null
          raw_json?: Json | null
          status?: string | null
          synced_at?: string | null
          transaction_date?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          currency_code?: string | null
          id?: string
          memo?: string | null
          merchant?: string | null
          raw_json?: Json | null
          status?: string | null
          synced_at?: string | null
          transaction_date?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      ramp_repayments: {
        Row: {
          amount: number | null
          currency_code: string | null
          id: string
          payment_date: string | null
          raw_json: Json | null
          status: string | null
          synced_at: string | null
        }
        Insert: {
          amount?: number | null
          currency_code?: string | null
          id: string
          payment_date?: string | null
          raw_json?: Json | null
          status?: string | null
          synced_at?: string | null
        }
        Update: {
          amount?: number | null
          currency_code?: string | null
          id?: string
          payment_date?: string | null
          raw_json?: Json | null
          status?: string | null
          synced_at?: string | null
        }
        Relationships: []
      }
      ramp_spend_programs: {
        Row: {
          description: string | null
          display_name: string | null
          id: string
          permitted_spend_types: Json | null
          raw_json: Json | null
          synced_at: string | null
        }
        Insert: {
          description?: string | null
          display_name?: string | null
          id: string
          permitted_spend_types?: Json | null
          raw_json?: Json | null
          synced_at?: string | null
        }
        Update: {
          description?: string | null
          display_name?: string | null
          id?: string
          permitted_spend_types?: Json | null
          raw_json?: Json | null
          synced_at?: string | null
        }
        Relationships: []
      }
      ramp_statements: {
        Row: {
          id: string
          period_end: string | null
          period_start: string | null
          raw_json: Json | null
          status: string | null
          synced_at: string | null
          total_amount: number | null
        }
        Insert: {
          id: string
          period_end?: string | null
          period_start?: string | null
          raw_json?: Json | null
          status?: string | null
          synced_at?: string | null
          total_amount?: number | null
        }
        Update: {
          id?: string
          period_end?: string | null
          period_start?: string | null
          raw_json?: Json | null
          status?: string | null
          synced_at?: string | null
          total_amount?: number | null
        }
        Relationships: []
      }
      ramp_sync_log: {
        Row: {
          completed_at: string | null
          entity_type: string
          error_message: string | null
          id: number
          metadata: Json | null
          records_fetched: number | null
          records_upserted: number | null
          started_at: string | null
          status: string | null
          sync_type: string
        }
        Insert: {
          completed_at?: string | null
          entity_type: string
          error_message?: string | null
          id?: number
          metadata?: Json | null
          records_fetched?: number | null
          records_upserted?: number | null
          started_at?: string | null
          status?: string | null
          sync_type: string
        }
        Update: {
          completed_at?: string | null
          entity_type?: string
          error_message?: string | null
          id?: number
          metadata?: Json | null
          records_fetched?: number | null
          records_upserted?: number | null
          started_at?: string | null
          status?: string | null
          sync_type?: string
        }
        Relationships: []
      }
      ramp_transactions: {
        Row: {
          accounting_categories: Json | null
          amount: number | null
          card_id: string | null
          created_at: string | null
          currency_code: string | null
          department_id: string | null
          id: string
          limit_id: string | null
          line_items: Json | null
          location_id: string | null
          memo: string | null
          merchant_category_code: string | null
          merchant_id: string | null
          merchant_name: string | null
          policy_violations: Json | null
          raw_json: Json | null
          receipts: Json | null
          settled_at: string | null
          sk_category_id: string | null
          sk_category_name: string | null
          spend_program_id: string | null
          state: string | null
          synced_at: string | null
          user_id: string | null
          user_transaction_time: string | null
        }
        Insert: {
          accounting_categories?: Json | null
          amount?: number | null
          card_id?: string | null
          created_at?: string | null
          currency_code?: string | null
          department_id?: string | null
          id: string
          limit_id?: string | null
          line_items?: Json | null
          location_id?: string | null
          memo?: string | null
          merchant_category_code?: string | null
          merchant_id?: string | null
          merchant_name?: string | null
          policy_violations?: Json | null
          raw_json?: Json | null
          receipts?: Json | null
          settled_at?: string | null
          sk_category_id?: string | null
          sk_category_name?: string | null
          spend_program_id?: string | null
          state?: string | null
          synced_at?: string | null
          user_id?: string | null
          user_transaction_time?: string | null
        }
        Update: {
          accounting_categories?: Json | null
          amount?: number | null
          card_id?: string | null
          created_at?: string | null
          currency_code?: string | null
          department_id?: string | null
          id?: string
          limit_id?: string | null
          line_items?: Json | null
          location_id?: string | null
          memo?: string | null
          merchant_category_code?: string | null
          merchant_id?: string | null
          merchant_name?: string | null
          policy_violations?: Json | null
          raw_json?: Json | null
          receipts?: Json | null
          settled_at?: string | null
          sk_category_id?: string | null
          sk_category_name?: string | null
          spend_program_id?: string | null
          state?: string | null
          synced_at?: string | null
          user_id?: string | null
          user_transaction_time?: string | null
        }
        Relationships: []
      }
      ramp_transfers: {
        Row: {
          amount: number | null
          created_at: string | null
          currency_code: string | null
          id: string
          raw_json: Json | null
          status: string | null
          synced_at: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          currency_code?: string | null
          id: string
          raw_json?: Json | null
          status?: string | null
          synced_at?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          currency_code?: string | null
          id?: string
          raw_json?: Json | null
          status?: string | null
          synced_at?: string | null
        }
        Relationships: []
      }
      ramp_users: {
        Row: {
          department_id: string | null
          email: string | null
          employee_id: string | null
          entity_id: string | null
          first_name: string | null
          full_name: string | null
          id: string
          is_manager: boolean | null
          last_name: string | null
          location_id: string | null
          manager_id: string | null
          phone: string | null
          raw_json: Json | null
          role: string | null
          status: string | null
          synced_at: string | null
        }
        Insert: {
          department_id?: string | null
          email?: string | null
          employee_id?: string | null
          entity_id?: string | null
          first_name?: string | null
          full_name?: string | null
          id: string
          is_manager?: boolean | null
          last_name?: string | null
          location_id?: string | null
          manager_id?: string | null
          phone?: string | null
          raw_json?: Json | null
          role?: string | null
          status?: string | null
          synced_at?: string | null
        }
        Update: {
          department_id?: string | null
          email?: string | null
          employee_id?: string | null
          entity_id?: string | null
          first_name?: string | null
          full_name?: string | null
          id?: string
          is_manager?: boolean | null
          last_name?: string | null
          location_id?: string | null
          manager_id?: string | null
          phone?: string | null
          raw_json?: Json | null
          role?: string | null
          status?: string | null
          synced_at?: string | null
        }
        Relationships: []
      }
      ramp_vendors: {
        Row: {
          contact_email: string | null
          id: string
          is_active: boolean | null
          name: string | null
          raw_json: Json | null
          status: string | null
          synced_at: string | null
          tax_id: string | null
        }
        Insert: {
          contact_email?: string | null
          id: string
          is_active?: boolean | null
          name?: string | null
          raw_json?: Json | null
          status?: string | null
          synced_at?: string | null
          tax_id?: string | null
        }
        Update: {
          contact_email?: string | null
          id?: string
          is_active?: boolean | null
          name?: string | null
          raw_json?: Json | null
          status?: string | null
          synced_at?: string | null
          tax_id?: string | null
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
          attachments: number | null
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
          clock_out_timezone: string | null
          company_employee_id: string | null
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
          attachments?: number | null
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
          clock_out_timezone?: string | null
          company_employee_id?: string | null
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
          attachments?: number | null
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
          clock_out_timezone?: string | null
          company_employee_id?: string | null
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
          billing_rate_type: number | null
          can_track_location: boolean | null
          can_track_mileage: boolean | null
          company_employee_id: string | null
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
          billing_rate_type?: number | null
          can_track_location?: boolean | null
          can_track_mileage?: boolean | null
          company_employee_id?: string | null
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
          billing_rate_type?: number | null
          can_track_location?: boolean | null
          can_track_mileage?: boolean | null
          company_employee_id?: string | null
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
      unifi_device_status_log: {
        Row: {
          device_id: string
          id: string
          recorded_at: string | null
          status: string
        }
        Insert: {
          device_id: string
          id?: string
          recorded_at?: string | null
          status: string
        }
        Update: {
          device_id?: string
          id?: string
          recorded_at?: string | null
          status?: string
        }
        Relationships: []
      }
      unifi_devices: {
        Row: {
          adoption_time: string | null
          connected_clients: number | null
          created_at: string | null
          device_id: string
          estimated_guests: number | null
          firmware_status: string | null
          firmware_version: string | null
          id: string
          ip_address: string | null
          is_console: boolean | null
          is_managed: boolean | null
          last_synced_at: string | null
          mac_address: string | null
          model: string | null
          name: string | null
          note: string | null
          property_id: string | null
          shortname: string | null
          site_id: string | null
          startup_time: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          adoption_time?: string | null
          connected_clients?: number | null
          created_at?: string | null
          device_id: string
          estimated_guests?: number | null
          firmware_status?: string | null
          firmware_version?: string | null
          id?: string
          ip_address?: string | null
          is_console?: boolean | null
          is_managed?: boolean | null
          last_synced_at?: string | null
          mac_address?: string | null
          model?: string | null
          name?: string | null
          note?: string | null
          property_id?: string | null
          shortname?: string | null
          site_id?: string | null
          startup_time?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          adoption_time?: string | null
          connected_clients?: number | null
          created_at?: string | null
          device_id?: string
          estimated_guests?: number | null
          firmware_status?: string | null
          firmware_version?: string | null
          id?: string
          ip_address?: string | null
          is_console?: boolean | null
          is_managed?: boolean | null
          last_synced_at?: string | null
          mac_address?: string | null
          model?: string | null
          name?: string | null
          note?: string | null
          property_id?: string | null
          shortname?: string | null
          site_id?: string | null
          startup_time?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "unifi_devices_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "unifi_sites"
            referencedColumns: ["site_id"]
          },
        ]
      }
      unifi_isp_metrics: {
        Row: {
          created_at: string | null
          download_speed_mbps: number | null
          id: string
          interval_type: string
          latency_avg_ms: number | null
          latency_max_ms: number | null
          measured_at: string
          packet_loss_pct: number | null
          site_id: string | null
          upload_speed_mbps: number | null
          uptime_pct: number | null
        }
        Insert: {
          created_at?: string | null
          download_speed_mbps?: number | null
          id?: string
          interval_type: string
          latency_avg_ms?: number | null
          latency_max_ms?: number | null
          measured_at: string
          packet_loss_pct?: number | null
          site_id?: string | null
          upload_speed_mbps?: number | null
          uptime_pct?: number | null
        }
        Update: {
          created_at?: string | null
          download_speed_mbps?: number | null
          id?: string
          interval_type?: string
          latency_avg_ms?: number | null
          latency_max_ms?: number | null
          measured_at?: string
          packet_loss_pct?: number | null
          site_id?: string | null
          upload_speed_mbps?: number | null
          uptime_pct?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "unifi_isp_metrics_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "unifi_sites"
            referencedColumns: ["site_id"]
          },
        ]
      }
      unifi_sites: {
        Row: {
          created_at: string | null
          description: string | null
          guest_clients: number | null
          host_id: string
          id: string
          internet_issues: Json | null
          isp_name: string | null
          isp_organization: string | null
          last_synced_at: string | null
          name: string | null
          offline_devices: number | null
          site_id: string
          timezone: string | null
          total_devices: number | null
          updated_at: string | null
          wifi_clients: number | null
          wifi_devices: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          guest_clients?: number | null
          host_id: string
          id?: string
          internet_issues?: Json | null
          isp_name?: string | null
          isp_organization?: string | null
          last_synced_at?: string | null
          name?: string | null
          offline_devices?: number | null
          site_id: string
          timezone?: string | null
          total_devices?: number | null
          updated_at?: string | null
          wifi_clients?: number | null
          wifi_devices?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          guest_clients?: number | null
          host_id?: string
          id?: string
          internet_issues?: Json | null
          isp_name?: string | null
          isp_organization?: string | null
          last_synced_at?: string | null
          name?: string | null
          offline_devices?: number | null
          site_id?: string
          timezone?: string | null
          total_devices?: number | null
          updated_at?: string | null
          wifi_clients?: number | null
          wifi_devices?: number | null
        }
        Relationships: []
      }
      vendor_services: {
        Row: {
          amount_due: number | null
          breezeway_property_id: string | null
          breezeway_task_id: number | null
          breezeway_task_status: string | null
          created_at: string | null
          id: string
          invoice_number: string | null
          issues_targeted: Json | null
          locations_treated: Json | null
          match_confidence: number | null
          match_method: string | null
          products_used: Json | null
          property_id: string | null
          property_name: string | null
          raw_address_from_email: string | null
          raw_email_body: string | null
          raw_pdf_text: string | null
          service_date: string
          service_summary: string | null
          service_type: string
          source_email_date: string | null
          source_email_from: string | null
          source_email_subject: string | null
          tax_amount: number | null
          technician_name: string | null
          technician_notes: string | null
          updated_at: string | null
          vendor_account_number: string | null
          vendor_email: string | null
          vendor_name: string
          vendor_phone: string | null
        }
        Insert: {
          amount_due?: number | null
          breezeway_property_id?: string | null
          breezeway_task_id?: number | null
          breezeway_task_status?: string | null
          created_at?: string | null
          id?: string
          invoice_number?: string | null
          issues_targeted?: Json | null
          locations_treated?: Json | null
          match_confidence?: number | null
          match_method?: string | null
          products_used?: Json | null
          property_id?: string | null
          property_name?: string | null
          raw_address_from_email?: string | null
          raw_email_body?: string | null
          raw_pdf_text?: string | null
          service_date: string
          service_summary?: string | null
          service_type: string
          source_email_date?: string | null
          source_email_from?: string | null
          source_email_subject?: string | null
          tax_amount?: number | null
          technician_name?: string | null
          technician_notes?: string | null
          updated_at?: string | null
          vendor_account_number?: string | null
          vendor_email?: string | null
          vendor_name: string
          vendor_phone?: string | null
        }
        Update: {
          amount_due?: number | null
          breezeway_property_id?: string | null
          breezeway_task_id?: number | null
          breezeway_task_status?: string | null
          created_at?: string | null
          id?: string
          invoice_number?: string | null
          issues_targeted?: Json | null
          locations_treated?: Json | null
          match_confidence?: number | null
          match_method?: string | null
          products_used?: Json | null
          property_id?: string | null
          property_name?: string | null
          raw_address_from_email?: string | null
          raw_email_body?: string | null
          raw_pdf_text?: string | null
          service_date?: string
          service_summary?: string | null
          service_type?: string
          source_email_date?: string | null
          source_email_from?: string | null
          source_email_subject?: string | null
          tax_amount?: number | null
          technician_name?: string | null
          technician_notes?: string | null
          updated_at?: string | null
          vendor_account_number?: string | null
          vendor_email?: string | null
          vendor_name?: string
          vendor_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_services_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "property_clean_benchmarks"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "vendor_services_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "property_health_weekly"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "vendor_services_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "property_registry"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "vendor_services_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "v_cleaner_efficiency"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "vendor_services_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "v_cost_summary"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "vendor_services_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "v_maintenance_hotspots"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "vendor_services_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "v_properties"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "vendor_services_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "v_property_difficulty"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "vendor_services_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "v_renjoy_vs_market"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "vendor_services_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "v_reservations"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "vendor_services_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "v_reservations_public"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "vendor_services_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "v_stale_tasks"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "vendor_services_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "v_task_assignments"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "vendor_services_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "v_task_costs"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "vendor_services_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "v_tasks"
            referencedColumns: ["property_id"]
          },
        ]
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
      v_acquisition_targets_enriched: {
        Row: {
          accommodates: number | null
          airroi_adr: number | null
          airroi_listing_id: number | null
          airroi_occupancy: number | null
          airroi_rating: number | null
          airroi_revenue: number | null
          airroi_review_count: number | null
          assigned_to: string | null
          avg_occupancy: number | null
          avg_rating: number | null
          bathrooms: number | null
          bedrooms: number | null
          estimated_revenue: number | null
          host_id: string | null
          host_name: string | null
          listing_count: number | null
          listing_name: string | null
          listing_type: string | null
          market_name: string | null
          mgmt_size: string | null
          outreach_notes: string | null
          outreach_status: string | null
          pct_no_dynamic_pricing: number | null
          pl_adr: number | null
          pl_dynamic_pricing: string | null
          pl_hot_tub: boolean | null
          pl_managed: string | null
          pl_occupancy: number | null
          pl_pet_friendly: boolean | null
          pl_pool: boolean | null
          pl_revenue: number | null
          pl_zipcode: string | null
          target_category: string | null
          target_id: string | null
          total_estimated_revenue: number | null
        }
        Relationships: []
      }
      v_calendar: {
        Row: {
          available: boolean | null
          date: string | null
          listing_id: string | null
          min_nights: number | null
          price: number | null
          reservation_id: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          available?: boolean | null
          date?: string | null
          listing_id?: string | null
          min_nights?: number | null
          price?: number | null
          reservation_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          available?: boolean | null
          date?: string | null
          listing_id?: string | null
          min_nights?: number | null
          price?: number | null
          reservation_id?: string | null
          status?: string | null
          updated_at?: string | null
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
          accommodates: number | null
          airroi_adr: number | null
          airroi_listing_id: number | null
          airroi_occupancy: number | null
          airroi_rating: number | null
          airroi_revenue: number | null
          airroi_review_count: number | null
          bathrooms: number | null
          bedrooms: number | null
          host_id: number | null
          host_name: string | null
          is_renjoy: boolean | null
          listing_name: string | null
          listing_type: string | null
          market_id: string | null
          market_name: string | null
          pl_adr: number | null
          pl_dynamic_pricing: string | null
          pl_ev_charger: boolean | null
          pl_hot_tub: boolean | null
          pl_listing_id: number | null
          pl_managed: string | null
          pl_occupancy: number | null
          pl_pet_friendly: boolean | null
          pl_pool: boolean | null
          pl_revenue: number | null
          pl_zipcode: string | null
          snapshot_at: string | null
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
      v_currently_clocked_in: {
        Row: {
          clock_in_time: string | null
          first_name: string | null
          job_name: string | null
          last_name: string | null
          time_on_clock: unknown
          user_id: number | null
        }
        Relationships: []
      }
      v_employee_directory: {
        Row: {
          breezeway_assignee_id: string | null
          created_at: string | null
          department: string | null
          email: string | null
          employee_code: string | null
          employment_type: string | null
          first_name: string | null
          full_name: string | null
          guesty_user_id: string | null
          hire_date: string | null
          id: string | null
          in_breezeway: string | null
          in_guesty: string | null
          in_ramp: string | null
          in_slack: string | null
          in_timeero: string | null
          last_name: string | null
          match_confidence: number | null
          match_method: string | null
          pay_rate: number | null
          phone: string | null
          ramp_user_id: string | null
          role: string | null
          slack_user_id: string | null
          status: string | null
          systems_count: number | null
          timeero_user_id: string | null
          updated_at: string | null
        }
        Insert: {
          breezeway_assignee_id?: string | null
          created_at?: string | null
          department?: string | null
          email?: string | null
          employee_code?: string | null
          employment_type?: string | null
          first_name?: string | null
          full_name?: string | null
          guesty_user_id?: string | null
          hire_date?: string | null
          id?: string | null
          in_breezeway?: never
          in_guesty?: never
          in_ramp?: never
          in_slack?: never
          in_timeero?: never
          last_name?: string | null
          match_confidence?: number | null
          match_method?: string | null
          pay_rate?: number | null
          phone?: string | null
          ramp_user_id?: string | null
          role?: string | null
          slack_user_id?: string | null
          status?: string | null
          systems_count?: never
          timeero_user_id?: string | null
          updated_at?: string | null
        }
        Update: {
          breezeway_assignee_id?: string | null
          created_at?: string | null
          department?: string | null
          email?: string | null
          employee_code?: string | null
          employment_type?: string | null
          first_name?: string | null
          full_name?: string | null
          guesty_user_id?: string | null
          hire_date?: string | null
          id?: string | null
          in_breezeway?: never
          in_guesty?: never
          in_ramp?: never
          in_slack?: never
          in_timeero?: never
          last_name?: string | null
          match_confidence?: number | null
          match_method?: string | null
          pay_rate?: number | null
          phone?: string | null
          ramp_user_id?: string | null
          role?: string | null
          slack_user_id?: string | null
          status?: string | null
          systems_count?: never
          timeero_user_id?: string | null
          updated_at?: string | null
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
      v_maintenance_spend: {
        Row: {
          amount: number | null
          category: string | null
          currency_code: string | null
          department: string | null
          has_receipt: boolean | null
          memo: string | null
          merchant_name: string | null
          raw_json: Json | null
          receipts: Json | null
          spender: string | null
          state: string | null
          transaction_id: string | null
          transaction_time_mt: string | null
          user_transaction_time: string | null
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
      v_ramp_bills: {
        Row: {
          amount: number | null
          created_at: string | null
          currency_code: string | null
          due_date: string | null
          entity_id: string | null
          id: string | null
          invoice_date: string | null
          invoice_number: string | null
          line_items: Json | null
          memo: string | null
          payment_date: string | null
          raw_json: Json | null
          status: string | null
          synced_at: string | null
          updated_at: string | null
          vendor_id: string | null
          vendor_name: string | null
        }
        Insert: {
          amount?: never
          created_at?: string | null
          currency_code?: string | null
          due_date?: string | null
          entity_id?: string | null
          id?: string | null
          invoice_date?: string | null
          invoice_number?: string | null
          line_items?: Json | null
          memo?: string | null
          payment_date?: string | null
          raw_json?: Json | null
          status?: string | null
          synced_at?: string | null
          updated_at?: string | null
          vendor_id?: string | null
          vendor_name?: string | null
        }
        Update: {
          amount?: never
          created_at?: string | null
          currency_code?: string | null
          due_date?: string | null
          entity_id?: string | null
          id?: string | null
          invoice_date?: string | null
          invoice_number?: string | null
          line_items?: Json | null
          memo?: string | null
          payment_date?: string | null
          raw_json?: Json | null
          status?: string | null
          synced_at?: string | null
          updated_at?: string | null
          vendor_id?: string | null
          vendor_name?: string | null
        }
        Relationships: []
      }
      v_ramp_bills_dollars: {
        Row: {
          amount_dollars: number | null
          created_at: string | null
          currency_code: string | null
          due_date: string | null
          entity_id: string | null
          id: string | null
          invoice_date: string | null
          invoice_number: string | null
          line_items: Json | null
          memo: string | null
          payment_date: string | null
          raw_json: Json | null
          status: string | null
          synced_at: string | null
          updated_at: string | null
          vendor_id: string | null
          vendor_name: string | null
        }
        Insert: {
          amount_dollars?: never
          created_at?: string | null
          currency_code?: string | null
          due_date?: string | null
          entity_id?: string | null
          id?: string | null
          invoice_date?: string | null
          invoice_number?: string | null
          line_items?: Json | null
          memo?: string | null
          payment_date?: string | null
          raw_json?: Json | null
          status?: string | null
          synced_at?: string | null
          updated_at?: string | null
          vendor_id?: string | null
          vendor_name?: string | null
        }
        Update: {
          amount_dollars?: never
          created_at?: string | null
          currency_code?: string | null
          due_date?: string | null
          entity_id?: string | null
          id?: string | null
          invoice_date?: string | null
          invoice_number?: string | null
          line_items?: Json | null
          memo?: string | null
          payment_date?: string | null
          raw_json?: Json | null
          status?: string | null
          synced_at?: string | null
          updated_at?: string | null
          vendor_id?: string | null
          vendor_name?: string | null
        }
        Relationships: []
      }
      v_ramp_missing_receipts: {
        Row: {
          amount: number | null
          department: string | null
          email: string | null
          id: string | null
          memo: string | null
          merchant_name: string | null
          state: string | null
          user_name: string | null
          user_transaction_time: string | null
        }
        Relationships: []
      }
      v_ramp_spend_by_department: {
        Row: {
          avg_transaction: number | null
          department: string | null
          earliest_transaction: string | null
          latest_transaction: string | null
          total_spend: number | null
          transaction_count: number | null
        }
        Relationships: []
      }
      v_ramp_spend_by_user: {
        Row: {
          avg_transaction: number | null
          department: string | null
          email: string | null
          latest_transaction: string | null
          missing_receipts: number | null
          total_spend: number | null
          transaction_count: number | null
          user_name: string | null
        }
        Relationships: []
      }
      v_ramp_spend_by_user_v2: {
        Row: {
          avg_transaction_amount: number | null
          department: string | null
          email: string | null
          employee_id: string | null
          first_transaction_date: string | null
          full_name: string | null
          last_transaction_date: string | null
          ramp_status: string | null
          ramp_user_id: string | null
          total_spend: number | null
          total_transactions: number | null
        }
        Relationships: []
      }
      v_ramp_transactions: {
        Row: {
          accounting_categories: Json | null
          amount: number | null
          card_id: string | null
          card_last_four: string | null
          card_name: string | null
          created_at: string | null
          currency_code: string | null
          department_id: string | null
          department_name: string | null
          id: string | null
          limit_id: string | null
          line_items: Json | null
          location_id: string | null
          location_name: string | null
          memo: string | null
          merchant_category_code: string | null
          merchant_id: string | null
          merchant_name: string | null
          policy_violations: Json | null
          raw_json: Json | null
          receipts: Json | null
          settled_at: string | null
          sk_category_name: string | null
          spend_program_id: string | null
          state: string | null
          synced_at: string | null
          transaction_time_mt: string | null
          user_email: string | null
          user_id: string | null
          user_name: string | null
          user_transaction_time: string | null
        }
        Relationships: []
      }
      v_renjoy_vs_market: {
        Row: {
          adr_vs_market_pct: number | null
          airbnb_listing_id: string | null
          airroi_adr: number | null
          airroi_bathrooms: number | null
          airroi_bedrooms: number | null
          airroi_listing_id: number | null
          airroi_listing_name: string | null
          airroi_occupancy: number | null
          airroi_property_type: string | null
          airroi_revenue: number | null
          airroi_snapshot_at: string | null
          breezeway_property_id: string | null
          guesty_accommodates: number | null
          guesty_base_price: number | null
          guesty_bathrooms: number | null
          guesty_bedrooms: number | null
          guesty_listing_id: string | null
          guesty_property_type: string | null
          guesty_title: string | null
          market_adr: number | null
          market_avg_revenue: number | null
          market_month: string | null
          market_name: string | null
          market_occupancy: number | null
          pl_adr: number | null
          pl_annual_revenue: number | null
          pl_occupancy: number | null
          pl_professionally_managed: string | null
          property_id: string | null
          property_name: string | null
          revenue_vs_market_pct: number | null
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
      v_task_costs: {
        Row: {
          cost: number | null
          cost_type_code: string | null
          created_at: string | null
          description: string | null
          id: number | null
          property_id: string | null
          property_name_canonical: string | null
          property_name_source: string | null
          task_id: number | null
          task_name: string | null
          task_type: string | null
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
      finance_exec: { Args: { q: string }; Returns: undefined }
      finance_query: { Args: { q: string }; Returns: Json }
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
      get_cleanup_queue: {
        Args: {
          p_category?: string
          p_department?: string
          p_limit?: number
          p_property?: string
        }
        Returns: {
          age_days: number
          assigned_to: string
          breezeway_id: number
          cleanup_category: string
          created_date: string
          days_overdue: number
          department: string
          dupe_count: number
          ghost_completed_date: string
          home_id: number
          property_name: string
          scheduled_date: string
          status_name: string
          status_stage: string
          task_name: string
          template_id: number
        }[]
      }
      get_cleanup_summary: {
        Args: never
        Returns: {
          future_scheduled: number
          ghosts: number
          overdue: number
          overdue_30d: number
          overdue_7d: number
          overdue_90d: number
          overdue_90d_plus: number
          stale_no_schedule: number
          top_overdue_count: number
          top_overdue_task: string
          total_actionable: number
          true_duplicates: number
          unassigned: number
        }[]
      }
      get_department_list: {
        Args: never
        Returns: {
          department_name: string
        }[]
      }
      get_dept_cost_per_property: {
        Args: { p_months?: number }
        Returns: {
          cost_per_property: number
          department: string
          month: string
          total_spend: number
        }[]
      }
      get_duplicate_tasks: {
        Args: never
        Returns: {
          breezeway_ids: number[]
          duplicate_count: number
          newest_created: string
          oldest_created: string
          property_name: string
          statuses: string[]
          task_name: string
        }[]
      }
      get_fastest_growing_merchants: {
        Args: { p_departments?: string[]; p_limit?: number }
        Returns: {
          current_month_spend: number
          growth_pct: number
          merchant_name: string
          prior_month_spend: number
          spend_increase: number
          transaction_count: number
        }[]
      }
      get_function_source: { Args: { fname: string }; Returns: string }
      get_infrastructure_catalog: { Args: never; Returns: Json }
      get_infrastructure_inventory: { Args: never; Returns: Json }
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
      get_monthly_spend_summary: {
        Args: { p_departments?: string[]; p_months?: number }
        Returns: {
          avg_transaction: number
          month: string
          total_spend: number
          transaction_count: number
          unique_merchants: number
        }[]
      }
      get_monthly_spend_trend: {
        Args: { p_departments?: string[]; p_months?: number }
        Returns: {
          avg_transaction: number
          bill_payments: number
          mom_change_pct: number
          month: string
          total_spend: number
          transaction_count: number
        }[]
      }
      get_new_vendors: {
        Args: { p_days?: number; p_departments?: string[] }
        Returns: {
          department: string
          first_seen: string
          merchant_name: string
          total_spend: number
          transaction_count: number
        }[]
      }
      get_property_health: {
        Args: never
        Returns: {
          address: string
          ai_health_signal: string
          avg_completion_minutes: number
          bedrooms: number
          completed_30d: number
          duplicate_count: number
          in_progress: number
          last_task_date: string
          open_tasks: number
          owner_name: string
          property_name: string
          property_tier: string
          stale_tasks: number
          total_tasks: number
        }[]
      }
      get_property_overview: {
        Args: never
        Returns: {
          avg_completion_minutes: number
          completed_30d: number
          duplicate_tasks: number
          ghost_tasks: number
          health_signal: string
          home_id: number
          in_progress_tasks: number
          last_task_date: string
          open_tasks: number
          overdue_tasks: number
          property_name: string
          top_issue: string
        }[]
      }
      get_property_tasks: {
        Args: { p_property: string }
        Returns: {
          age_days: number
          ai_guest_impact: string
          ai_property_health: string
          ai_skill_category: string
          ai_summary: string
          ai_urgency: string
          assigned_to: string
          breezeway_id: number
          created_date: string
          finished_date: string
          is_duplicate: boolean
          is_ghost: boolean
          priority: string
          started_date: string
          status_name: string
          status_stage: string
          task_name: string
        }[]
      }
      get_rating_trend: {
        Args: { p_platform?: string; p_start_date?: string }
        Returns: {
          airbnb_reviews: number
          avg_cleanliness: number
          avg_rating: number
          booking_reviews: number
          is_partial: boolean
          month: string
          total_reviews: number
          vrbo_reviews: number
        }[]
      }
      get_receipt_compliance: {
        Args: {
          p_departments?: string[]
          p_end_date: string
          p_start_date: string
        }
        Returns: {
          compliance_pct: number
          department: string
          dollars_at_risk: number
          missing_receipts: number
          total_transactions: number
          transactions_over_25: number
        }[]
      }
      get_recurring_vendors: {
        Args: {
          p_departments?: string[]
          p_min_occurrences?: number
          p_months?: number
        }
        Returns: {
          avg_monthly_spend: number
          last_transaction: string
          merchant_name: string
          months_active: number
          total_spend: number
        }[]
      }
      get_review_kpis: {
        Args: { p_platform?: string; p_start_date?: string }
        Returns: {
          avg_rating: number
          five_star_pct: number
          latest_review_at: string
          prior_avg_rating: number
          prior_five_star_pct: number
          prior_properties_below_4: number
          prior_total_reviews: number
          properties_below_4: number
          reviews_with_rating: number
          total_reviews: number
        }[]
      }
      get_rolling_spend_comparison: {
        Args: { p_departments?: string[] }
        Returns: {
          current_per_property: number
          current_spend: number
          current_txn_count: number
          period_days: number
          period_label: string
          prior_year_per_property: number
          prior_year_spend: number
          prior_year_txn_count: number
          yoy_change_pct: number
        }[]
      }
      get_spend_anomalies:
        | {
            Args: {
              p_days?: number
              p_departments?: string[]
              p_threshold?: number
            }
            Returns: {
              amount: number
              anomaly_reason: string
              department: string
              merchant_avg: number
              merchant_name: string
              transaction_date: string
              transaction_id: string
              user_avg: number
              user_name: string
            }[]
          }
        | {
            Args: {
              p_departments?: string[]
              p_end_date: string
              p_start_date: string
              p_threshold_multiplier?: number
            }
            Returns: {
              amount: number
              anomaly_type: string
              department: string
              id: string
              memo: string
              merchant_name: string
              times_above_avg: number
              transaction_date: string
              user_avg: number
              user_name: string
            }[]
          }
      get_spend_by_category:
        | {
            Args: {
              p_department?: string
              p_end_date: string
              p_start_date: string
            }
            Returns: {
              category: string
              pct: number
              total_spend: number
              transaction_count: number
            }[]
          }
        | {
            Args: {
              p_departments?: string[]
              p_end_date: string
              p_start_date: string
            }
            Returns: {
              category: string
              pct: number
              total_spend: number
              transaction_count: number
            }[]
          }
      get_spend_by_day_of_week: {
        Args: {
          p_departments?: string[]
          p_end_date: string
          p_start_date: string
        }
        Returns: {
          avg_spend: number
          day_name: string
          day_of_week: number
          total_spend: number
          transaction_count: number
        }[]
      }
      get_spend_by_department: {
        Args: {
          p_departments?: string[]
          p_end_date: string
          p_start_date: string
        }
        Returns: {
          avg_transaction: number
          department: string
          total_spend: number
          transaction_count: number
        }[]
      }
      get_spend_kpis:
        | {
            Args: {
              p_department?: string
              p_end_date: string
              p_prev_end_date: string
              p_prev_start_date: string
              p_start_date: string
            }
            Returns: {
              current_value: number
              delta_pct: number
              metric: string
              prior_value: number
            }[]
          }
        | {
            Args: {
              p_departments?: string[]
              p_end_date: string
              p_prev_end_date: string
              p_prev_start_date: string
              p_start_date: string
            }
            Returns: {
              current_value: number
              delta_pct: number
              metric: string
              prior_value: number
            }[]
          }
      get_spend_over_time:
        | {
            Args: {
              p_department?: string
              p_end_date: string
              p_interval?: string
              p_start_date: string
            }
            Returns: {
              department: string
              period: string
              total_spend: number
              transaction_count: number
            }[]
          }
        | {
            Args: {
              p_departments?: string[]
              p_end_date: string
              p_interval?: string
              p_start_date: string
            }
            Returns: {
              department: string
              period: string
              total_spend: number
              transaction_count: number
            }[]
          }
      get_spend_velocity: {
        Args: { p_departments?: string[] }
        Returns: {
          daily_run_rate: number
          days_elapsed: number
          days_in_month: number
          last_month_total: number
          mtd_spend: number
          pct_of_last_month: number
          projected_month_end: number
        }[]
      }
      get_stale_task_summary: {
        Args: never
        Returns: {
          avg_age_days: number
          oldest_date: string
          open_count: number
          properties_affected: number
          task_name: string
        }[]
      }
      get_tech_daily_efficiency: {
        Args: { p_date: string; p_department?: string }
        Returns: {
          clock_in: string
          clock_out: string
          first_task_start: string
          idle_minutes: number
          is_clocked_in: boolean
          last_task_end: string
          mileage: number
          properties_visited: number
          ramp_daily_spend: number
          ramp_txn_count: number
          shift_minutes: number
          task_count: number
          task_minutes: number
          tech_name: string
          utilization_pct: number
        }[]
      }
      get_tech_day_tasks: {
        Args: { p_date: string; p_tech_name: string }
        Returns: {
          breezeway_id: number
          department: string
          duration_minutes: number
          end_time: string
          finished_at: string
          home_id: number
          is_in_progress: boolean
          property_name: string
          start_time: string
          started_at: string
          status_name: string
          status_stage: string
          task_name: string
        }[]
      }
      get_tech_history: {
        Args: { p_days?: number; p_department?: string; p_tech_name: string }
        Returns: {
          clock_in: string
          clock_out: string
          mileage: number
          properties_visited: number
          shift_approved: boolean
          shift_minutes: number
          task_count: number
          task_minutes: number
          utilization_pct: number
          work_date: string
        }[]
      }
      get_tech_profile: {
        Args: { p_days?: number; p_tech_name: string }
        Returns: {
          avg_cleanliness_rating: number
          avg_daily_mileage: number
          avg_task_duration_minutes: number
          avg_tasks_per_day: number
          avg_utilization: number
          days_worked: number
          fastest_task_minutes: number
          first_active_date: string
          last_active_date: string
          primary_department: string
          slowest_task_minutes: number
          tech_name: string
          top_properties: string[]
          total_mileage: number
          total_properties: number
          total_reviews: number
          total_shift_minutes: number
          total_task_minutes: number
          total_tasks: number
        }[]
      }
      get_timeero_shifts: {
        Args: { p_date: string; p_department?: string }
        Returns: {
          breezeway_name: string
          clock_in: string
          clock_out: string
          is_clocked_in: boolean
          job_name: string
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
      get_top_merchants:
        | {
            Args: {
              p_department?: string
              p_end_date: string
              p_limit?: number
              p_start_date: string
            }
            Returns: {
              merchant_name: string
              total_spend: number
              transaction_count: number
            }[]
          }
        | {
            Args: {
              p_departments?: string[]
              p_end_date: string
              p_limit?: number
              p_start_date: string
            }
            Returns: {
              merchant_name: string
              total_spend: number
              transaction_count: number
            }[]
          }
      get_vendor_concentration: {
        Args: {
          p_departments?: string[]
          p_end_date: string
          p_start_date: string
        }
        Returns: {
          cumulative_pct: number
          departments_using: string
          merchant_name: string
          pct_of_total: number
          primary_category: string
          total_spend: number
          transaction_count: number
        }[]
      }
      get_vendor_consolidation: {
        Args: { p_end_date: string; p_start_date: string }
        Returns: {
          category: string
          merchants: string[]
          potential_savings_pct: number
          total_spend: number
          vendor_count: number
        }[]
      }
      get_view_def: { Args: { vname: string }; Returns: string }
      get_weekly_scorecard: {
        Args: never
        Returns: {
          avg_cleanliness: number
          avg_rating: number
          below_4: number
          five_star_pct: number
          is_partial: boolean
          review_count: number
          unreplied_low: number
          week_label: string
          week_start: string
        }[]
      }
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
      sync_cleaner_identity_map: { Args: never; Returns: undefined }
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

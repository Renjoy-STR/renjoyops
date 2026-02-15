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
            referencedRelation: "v_cleaner_ratings"
            referencedColumns: ["task_id"]
          },
          {
            foreignKeyName: "breezeway_task_assignments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "v_stale_tasks"
            referencedColumns: ["breezeway_id"]
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
            referencedRelation: "v_cleaner_ratings"
            referencedColumns: ["task_id"]
          },
          {
            foreignKeyName: "breezeway_task_costs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "v_stale_tasks"
            referencedColumns: ["breezeway_id"]
          },
        ]
      }
      breezeway_tasks: {
        Row: {
          breezeway_id: number
          created_at: string | null
          created_by_id: number | null
          created_by_name: string | null
          department: string | null
          description: string | null
          finished_at: string | null
          finished_by_id: number | null
          finished_by_name: string | null
          home_id: number | null
          linked_reservation_external_id: string | null
          linked_reservation_id: number | null
          name: string | null
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
        }
        Insert: {
          breezeway_id: number
          created_at?: string | null
          created_by_id?: number | null
          created_by_name?: string | null
          department?: string | null
          description?: string | null
          finished_at?: string | null
          finished_by_id?: number | null
          finished_by_name?: string | null
          home_id?: number | null
          linked_reservation_external_id?: string | null
          linked_reservation_id?: number | null
          name?: string | null
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
        }
        Update: {
          breezeway_id?: number
          created_at?: string | null
          created_by_id?: number | null
          created_by_name?: string | null
          department?: string | null
          description?: string | null
          finished_at?: string | null
          finished_by_id?: number | null
          finished_by_name?: string | null
          home_id?: number | null
          linked_reservation_external_id?: string | null
          linked_reservation_id?: number | null
          name?: string | null
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
            referencedRelation: "v_cleaner_ratings"
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
          check_in: string | null
          check_out: string | null
          commission: number | null
          confirmation_code: string | null
          currency: string | null
          fare_accommodation: number | null
          fare_accommodation_adjusted: number | null
          guest_email: string | null
          guest_name: string | null
          guests_count: number | null
          host_payout: number | null
          id: string
          listing_id: string | null
          nights_count: number | null
          platform: string | null
          raw_data: Json
          source: string | null
          status: string | null
          synced_at: string | null
          total_price: number | null
        }
        Insert: {
          balance_due?: number | null
          check_in?: string | null
          check_out?: string | null
          commission?: number | null
          confirmation_code?: string | null
          currency?: string | null
          fare_accommodation?: number | null
          fare_accommodation_adjusted?: number | null
          guest_email?: string | null
          guest_name?: string | null
          guests_count?: number | null
          host_payout?: number | null
          id: string
          listing_id?: string | null
          nights_count?: number | null
          platform?: string | null
          raw_data: Json
          source?: string | null
          status?: string | null
          synced_at?: string | null
          total_price?: number | null
        }
        Update: {
          balance_due?: number | null
          check_in?: string | null
          check_out?: string | null
          commission?: number | null
          confirmation_code?: string | null
          currency?: string | null
          fare_accommodation?: number | null
          fare_accommodation_adjusted?: number | null
          guest_email?: string | null
          guest_name?: string | null
          guests_count?: number | null
          host_payout?: number | null
          id?: string
          listing_id?: string | null
          nights_count?: number | null
          platform?: string | null
          raw_data?: Json
          source?: string | null
          status?: string | null
          synced_at?: string | null
          total_price?: number | null
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
      reservations: {
        Row: {
          check_in: string | null
          check_out: string | null
          confirmation_code: string | null
          created_at: string | null
          guest_id: string | null
          guest_name: string | null
          guests: number | null
          guesty_id: string
          host_payout: number | null
          id: string
          nights: number | null
          platform: string | null
          property_id: string | null
          revenue: number | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          check_in?: string | null
          check_out?: string | null
          confirmation_code?: string | null
          created_at?: string | null
          guest_id?: string | null
          guest_name?: string | null
          guests?: number | null
          guesty_id: string
          host_payout?: number | null
          id: string
          nights?: number | null
          platform?: string | null
          property_id?: string | null
          revenue?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          check_in?: string | null
          check_out?: string | null
          confirmation_code?: string | null
          created_at?: string | null
          guest_id?: string | null
          guest_name?: string | null
          guests?: number | null
          guesty_id?: string
          host_payout?: number | null
          id?: string
          nights?: number | null
          platform?: string | null
          property_id?: string | null
          revenue?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reservations_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
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
      v_cleaner_efficiency: {
        Row: {
          assignee_id: string | null
          assignee_name: string | null
          days_worked: number | null
          efficiency_pct: number | null
          first_day: string | null
          last_day: string | null
          total_clocked_minutes: number | null
          total_task_minutes: number | null
          total_tasks: number | null
          unaccounted_minutes: number | null
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
      v_cleaner_rating_distribution: {
        Row: {
          assignee_id: number | null
          assignee_name: string | null
          five_star: number | null
          four_star: number | null
          one_star: number | null
          three_star: number | null
          total_ratings: number | null
          two_star: number | null
        }
        Relationships: []
      }
      v_cleaner_rating_summary: {
        Row: {
          assignee_id: number | null
          assignee_name: string | null
          avg_cleanliness: number | null
          avg_overall: number | null
          first_review: string | null
          last_review: string | null
          rated_cleans: number | null
        }
        Relationships: []
      }
      v_cleaner_ratings: {
        Row: {
          assignee_id: number | null
          assignee_name: string | null
          clean_date: string | null
          cleanliness_rating: number | null
          guest_checkin: string | null
          home_id: number | null
          overall_rating: number | null
          property_name: string | null
          reservation_id: string | null
          review_date: string | null
          review_id: string | null
          task_id: number | null
        }
        Relationships: []
      }
      v_cleaner_spotlight_reviews: {
        Row: {
          assignee_id: number | null
          assignee_name: string | null
          cleanliness_rating: number | null
          listing_name: string | null
          overall_rating: number | null
          property_name: string | null
          review_date: string | null
          review_text: string | null
        }
        Relationships: []
      }
      v_cost_summary: {
        Row: {
          avg_per_entry: number | null
          cost_entries: number | null
          first_cost: string | null
          home_id: number | null
          labor_cost: number | null
          last_cost: string | null
          material_cost: number | null
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
          home_id: number | null
          last_30_days: number | null
          last_90_days: number | null
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
      v_property_difficulty: {
        Row: {
          avg_clean_minutes: number | null
          avg_last_90_days: number | null
          cleans_over_4hrs: number | null
          home_id: number | null
          median_clean_minutes: number | null
          property_name: string | null
          total_cleans: number | null
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
      v_stale_tasks: {
        Row: {
          assignees: string | null
          breezeway_id: number | null
          created_at: string | null
          days_overdue: number | null
          days_since_created: number | null
          department: string | null
          priority: string | null
          property_name: string | null
          scheduled_date: string | null
          started_at: string | null
          status_code: string | null
          task_name: string | null
        }
        Insert: {
          assignees?: never
          breezeway_id?: number | null
          created_at?: string | null
          days_overdue?: never
          days_since_created?: never
          department?: string | null
          priority?: string | null
          property_name?: string | null
          scheduled_date?: string | null
          started_at?: string | null
          status_code?: string | null
          task_name?: string | null
        }
        Update: {
          assignees?: never
          breezeway_id?: number | null
          created_at?: string | null
          days_overdue?: never
          days_since_created?: never
          department?: string | null
          priority?: string | null
          property_name?: string | null
          scheduled_date?: string | null
          started_at?: string | null
          status_code?: string | null
          task_name?: string | null
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
          people_count: number | null
          team_efficiency_pct: number | null
          total_clocked: number | null
          total_task: number | null
          week_start: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _tmp_defs: { Args: never; Returns: Json }
      _tmp_idx: { Args: never; Returns: Json }
      _tmp_src: { Args: never; Returns: Json }
      exec_sql: { Args: { sql: string }; Returns: undefined }
      get_clean_streaks: {
        Args: never
        Returns: {
          assignee_id: number
          assignee_name: string
          best_streak: number
          current_streak: number
          streak_start_date: string
        }[]
      }
      get_cleaner_detail: {
        Args: { p_assignee_id: number; p_end?: string; p_start?: string }
        Returns: {
          clean_date: string
          cleanliness_rating: number
          co_cleaners: string
          is_excluded: boolean
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
      get_leaderboard: {
        Args: { p_end: string; p_start: string; p_worker_type?: string }
        Returns: {
          assignee_id: number
          assignee_name: string
          avg_cleanliness: number
          avg_minutes: number
          avg_overall: number
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

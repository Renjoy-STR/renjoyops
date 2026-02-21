import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/** Tech profile via RPC */
export function useTechProfile(name: string | undefined, days: number) {
  return useQuery({
    queryKey: ['tech-profile', name, days],
    queryFn: async () => {
      if (!name) return null;
      const { data, error } = await supabase.rpc('get_tech_profile', { p_tech_name: name, p_days: days });
      if (error) throw error;
      return data?.[0] ?? null;
    },
    enabled: !!name,
  });
}

/** Tech history via RPC */
export function useTechHistory(name: string | undefined, days: number, department?: string) {
  return useQuery({
    queryKey: ['tech-history', name, days, department],
    queryFn: async () => {
      if (!name) return [];
      const params: any = { p_tech_name: name, p_days: days };
      if (department) params.p_department = department;
      const { data, error } = await supabase.rpc('get_tech_history', params);
      if (error) throw error;
      return data || [];
    },
    enabled: !!name,
  });
}

/** Tech day tasks via RPC */
export function useTechDayTasks(name: string | undefined, date: string, enabled = true) {
  return useQuery({
    queryKey: ['tech-day-tasks', name, date],
    queryFn: async () => {
      if (!name) return [];
      const { data, error } = await supabase.rpc('get_tech_day_tasks', { p_tech_name: name, p_date: date });
      if (error) throw error;
      return data || [];
    },
    enabled: !!name && enabled,
  });
}

/** Tech daily efficiency via RPC */
export function useTechDailyEfficiency(date: string, department: string | null) {
  return useQuery({
    queryKey: ['tech-daily-efficiency', date, department],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_tech_daily_efficiency', { p_date: date, p_department: department });
      if (error) throw error;
      return data || [];
    },
  });
}

/** Timeero shifts via RPC */
export function useTimeeroShifts(date: string, department: string | null) {
  return useQuery({
    queryKey: ['maint-timeero-shifts', date, department],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_timeero_shifts', { p_date: date, p_department: department });
      if (error) throw error;
      return data || [];
    },
  });
}

/** Property overview via RPC */
export function usePropertyOverview() {
  return useQuery({
    queryKey: ['property-overview'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_property_overview');
      if (error) throw error;
      return data || [];
    },
  });
}

/** Cleanup summary via RPC */
export function useCleanupSummary() {
  return useQuery({
    queryKey: ['cleanup-summary-v2'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_cleanup_summary');
      if (error) throw error;
      return data || [];
    },
  });
}

/** Cleanup queue via RPC */
export function useCleanupQueue(category?: string, department?: string) {
  return useQuery({
    queryKey: ['cleanup-queue', category, department],
    queryFn: async () => {
      const params: any = {};
      if (category) params.p_category = category;
      if (department) params.p_department = department;
      const { data, error } = await supabase.rpc('get_cleanup_queue', params);
      if (error) throw error;
      return data || [];
    },
  });
}

/** Property tasks via RPC */
export function usePropertyTasks(property: string | undefined) {
  return useQuery({
    queryKey: ['property-tasks', property],
    queryFn: async () => {
      if (!property) return [];
      const { data, error } = await supabase.rpc('get_property_tasks', { p_property: property });
      if (error) throw error;
      return data || [];
    },
    enabled: !!property,
  });
}

/** Tech reviews from cleaner_ratings_mat */
export function useTechReviews(name: string | undefined) {
  return useQuery({
    queryKey: ['tech-reviews', name],
    queryFn: async () => {
      if (!name) return [];
      const { data, error } = await supabase
        .from('cleaner_ratings_mat')
        .select('assignee_name, property_name, check_in_date, cleanliness_rating, overall_rating, review_text, reviewer_name, review_platform')
        .eq('assignee_name', name)
        .not('cleanliness_rating', 'is', null)
        .order('check_in_date', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!name,
  });
}

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/** Breezeway properties with external property mapping — used for bz↔guesty cross-reference */
export function useBreezewayPropertyMapping() {
  return useQuery({
    queryKey: ['property-mapping'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from('breezeway_properties')
        .select('breezeway_id, reference_external_property_id')
        .not('reference_external_property_id', 'is', null);
      const bzToGuesty: Record<string, string> = {};
      const guestyToBz: Record<string, string> = {};
      data?.forEach(p => {
        if (p.reference_external_property_id) {
          bzToGuesty[String(p.breezeway_id)] = p.reference_external_property_id;
          guestyToBz[p.reference_external_property_id] = String(p.breezeway_id);
        }
      });
      return { bzToGuesty, guestyToBz };
    },
  });
}

/** Property registry: guesty_listing_id → breezeway cross-reference */
export function usePropertyRegistry() {
  return useQuery({
    queryKey: ['property-registry-map'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from('property_registry')
        .select('guesty_listing_id, breezeway_property_id, property_name')
        .not('guesty_listing_id', 'is', null);
      const map: Record<string, { bwId: string; name: string }> = {};
      data?.forEach(p => {
        if (p.guesty_listing_id) {
          map[p.guesty_listing_id] = { bwId: p.breezeway_property_id || '', name: p.property_name };
        }
      });
      return map;
    },
  });
}

/** Property difficulty view — avg clean times per property */
export function usePropertyDifficulty() {
  return useQuery({
    queryKey: ['property-clean-times'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from('v_property_difficulty')
        .select('home_id, property_id, property_name, avg_clean_minutes, total_cleans');
      return data ?? [];
    },
  });
}

/** Operational costs from breezeway_tasks */
export function useOperationalCosts(from: string, to: string) {
  return useQuery({
    queryKey: ['billing-opcosts', from, to],
    queryFn: async () => {
      const { data } = await supabase
        .from('breezeway_tasks')
        .select('home_id, department, total_cost')
        .gte('created_at', from)
        .lte('created_at', to)
        .not('total_cost', 'is', null)
        .limit(1000);
      return data ?? [];
    },
  });
}

/** Monthly costs from breezeway_tasks broken down by department */
export function useMonthlyCosts(from: string, to: string) {
  return useQuery({
    queryKey: ['billing-monthly-costs', from, to],
    queryFn: async () => {
      const { data } = await supabase
        .from('breezeway_tasks')
        .select('department, total_cost, created_at')
        .gte('created_at', from)
        .lte('created_at', to)
        .not('total_cost', 'is', null)
        .limit(1000);
      const months: Record<string, { hk: number; maint: number }> = {};
      data?.forEach(t => {
        const m = t.created_at?.slice(0, 7);
        if (!m) return;
        if (!months[m]) months[m] = { hk: 0, maint: 0 };
        const cost = Number(t.total_cost) || 0;
        if (t.department === 'housekeeping') months[m].hk += cost;
        else if (t.department === 'maintenance') months[m].maint += cost;
      });
      return months;
    },
  });
}

/** Cleaner assignments — used for quality correlation */
export function useCleanerAssignments() {
  return useQuery({
    queryKey: ['cleaner-assignments-quality'],
    queryFn: async () => {
      const { data } = await supabase
        .from('breezeway_task_assignments')
        .select('assignee_name, assignee_id, task_id')
        .not('assignee_name', 'is', null)
        .limit(2000);
      return data ?? [];
    },
  });
}

/** Housekeeping tasks for linking cleaners to properties */
export function useHousekeepingTasks(from: string, to: string) {
  return useQuery({
    queryKey: ['bz-tasks-hk', from, to],
    queryFn: async () => {
      const { data } = await supabase
        .from('breezeway_tasks')
        .select('breezeway_id, reference_property_id, department, finished_at')
        .eq('department', 'housekeeping')
        .gte('created_at', from)
        .lte('created_at', to)
        .limit(2000);
      return data ?? [];
    },
  });
}

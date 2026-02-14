import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface TimeeroSchema {
  tableName: string;
  columns: string[];
}

export function parseDuration(dur: string | null | undefined): number {
  if (!dur) return 0;
  const parts = dur.split(':').map(Number);
  if (parts.some(isNaN)) return 0;
  return parts[0] + (parts[1] || 0) / 60 + (parts[2] || 0) / 3600;
}

export function useTimeeroSchema() {
  return useQuery<TimeeroSchema | null>({
    queryKey: ['timeero-schema'],
    staleTime: Infinity,
    queryFn: async () => {
      // Try the known table directly — information_schema is not available via PostgREST
      const { data, error } = await supabase
        .from('timeero_timesheets')
        .select('*')
        .limit(1);

      if (error || !data) {
        console.warn('timeero_timesheets not found:', error?.message);
        return null;
      }

      const columns = data.length > 0 ? Object.keys(data[0]) : [];
      return { tableName: 'timeero_timesheets', columns };
    },
  });
}

export interface TimeeroEntry {
  employee_name: string;
  clock_in_time: string;
  clock_out_time: string | null;
  duration_hours: number;
  job_name: string | null;
  notes: string | null;
  first_name: string;
  last_name: string;
}

export function useTimeeroData(from: string, to: string, schema: TimeeroSchema | null | undefined) {
  return useQuery<TimeeroEntry[]>({
    queryKey: ['timeero-data', from, to, schema?.tableName],
    enabled: !!schema?.tableName,
    queryFn: async () => {
      if (!schema) return [];
      const { data, error } = await supabase
        .from(schema.tableName)
        .select('first_name, last_name, clock_in_time, clock_out_time, duration, job_name, notes')
        .gte('clock_in_time', from)
        .lte('clock_in_time', to + 'T23:59:59');

      if (error) {
        console.warn('Timeero query error:', error);
        return [];
      }

      return (data ?? []).map((row: any) => ({
        employee_name: `${(row.first_name || '').trim()} ${(row.last_name || '').trim()}`.trim(),
        clock_in_time: row.clock_in_time,
        clock_out_time: row.clock_out_time,
        duration_hours: parseDuration(row.duration),
        job_name: row.job_name,
        notes: row.notes,
        first_name: row.first_name,
        last_name: row.last_name,
      }));
    },
  });
}

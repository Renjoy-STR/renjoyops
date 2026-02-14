import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

interface TimeeroSchema {
  tableName: string;
  columns: string[];
  columnMap: {
    employeeName: string;
    clockIn: string;
    clockOut: string;
    duration: string;
    department: string;
    date: string;
    notes: string;
    jobCode: string;
  };
}

const EXPECTED_MAPPINGS: Record<string, keyof TimeeroSchema['columnMap']> = {
  employee_name: 'employeeName',
  user_name: 'employeeName',
  name: 'employeeName',
  clock_in: 'clockIn',
  start_time: 'clockIn',
  start: 'clockIn',
  clock_out: 'clockOut',
  end_time: 'clockOut',
  end: 'clockOut',
  duration: 'duration',
  total_minutes: 'duration',
  total_hours: 'duration',
  department: 'department',
  group_name: 'department',
  date: 'date',
  entry_date: 'date',
  notes: 'notes',
  job_code: 'jobCode',
  job_name: 'jobCode',
};

export function useTimeeroSchema() {
  return useQuery<TimeeroSchema | null>({
    queryKey: ['timeero-schema'],
    staleTime: Infinity,
    queryFn: async () => {
      // Discover table name
      const { data: tables } = await supabase
        .from('information_schema.tables' as any)
        .select('table_name')
        .eq('table_schema', 'public')
        .or('table_name.ilike.%timeero%,table_name.ilike.%time_entr%');

      // Fallback: try raw SQL via rpc or direct query
      let tableName: string | null = null;

      if (tables && tables.length > 0) {
        tableName = tables[0].table_name;
      } else {
        // Try common names directly
        for (const candidate of ['timeero_entries', 'timeero_time_entries', 'time_entries']) {
          const { data, error } = await supabase.from(candidate).select('*').limit(1);
          if (!error && data) {
            tableName = candidate;
            break;
          }
        }
      }

      if (!tableName) return null;

      // Discover columns
      const { data: cols } = await supabase
        .from('information_schema.columns' as any)
        .select('column_name')
        .eq('table_name', tableName)
        .eq('table_schema', 'public');

      let columnNames: string[] = [];
      if (cols && cols.length > 0) {
        columnNames = cols.map((c: any) => c.column_name);
      } else {
        // Fallback: fetch one row and use keys
        const { data: sample } = await supabase.from(tableName).select('*').limit(1);
        if (sample && sample.length > 0) {
          columnNames = Object.keys(sample[0]);
        }
      }

      // Map columns
      const columnMap: TimeeroSchema['columnMap'] = {
        employeeName: '',
        clockIn: '',
        clockOut: '',
        duration: '',
        department: '',
        date: '',
        notes: '',
        jobCode: '',
      };

      for (const col of columnNames) {
        const lower = col.toLowerCase();
        const mapped = EXPECTED_MAPPINGS[lower];
        if (mapped && !columnMap[mapped]) {
          columnMap[mapped] = col;
        }
      }

      return { tableName, columns: columnNames, columnMap };
    },
  });
}

export function useTimeeroData(from: string, to: string, schema: TimeeroSchema | null | undefined) {
  return useQuery({
    queryKey: ['timeero-data', from, to, schema?.tableName],
    enabled: !!schema?.tableName,
    queryFn: async () => {
      if (!schema) return [];
      const dateCol = schema.columnMap.clockIn || schema.columnMap.date || 'clock_in';
      const { data, error } = await supabase
        .from(schema.tableName)
        .select('*')
        .gte(dateCol, from)
        .lte(dateCol, to);
      if (error) {
        console.warn('Timeero query error:', error);
        return [];
      }
      return data ?? [];
    },
  });
}

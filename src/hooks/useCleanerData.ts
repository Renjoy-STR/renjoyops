import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useDateRange } from '@/contexts/DateRangeContext';

export interface WeeklyAvg {
  week: string;
  avg: number;
}

export interface PropertyClean {
  property_name: string;
  home_id: number;
  count: number;
  avg: number;
}

export interface CleanerData {
  assignee_name: string;
  avg_minutes: number;
  adjusted_avg: number;
  median_minutes: number;
  fastest_minutes: number;
  slowest_minutes: number;
  total_cleans: number;
  std_dev: number;
  properties_cleaned: number;
  weekly_trend: WeeklyAvg[];
  trend_direction: 'improving' | 'stable' | 'worsening';
  schedule_efficiency: number;
  cleans_by_property: PropertyClean[];
}

function getISOWeekStart(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), diff));
  return monday.toISOString().slice(0, 10);
}

function computeTrendDirection(weeklyTrend: WeeklyAvg[]): 'improving' | 'stable' | 'worsening' {
  if (weeklyTrend.length < 4) return 'stable';
  const recent = weeklyTrend.slice(-2);
  const earlier = weeklyTrend.slice(-4, -2);
  const recentAvg = recent.reduce((s, w) => s + w.avg, 0) / recent.length;
  const earlierAvg = earlier.reduce((s, w) => s + w.avg, 0) / earlier.length;
  if (earlierAvg === 0) return 'stable';
  const change = (recentAvg - earlierAvg) / earlierAvg;
  if (change < -0.1) return 'improving';
  if (change > 0.1) return 'worsening';
  return 'stable';
}

export function useCleanerData() {
  const { formatForQuery } = useDateRange();
  const { from, to } = formatForQuery();

  return useQuery({
    queryKey: ['cleaner-performance-v2', from, to],
    queryFn: async () => {
      const { data: tasks } = await supabase
        .from('breezeway_tasks')
        .select('total_time_minutes, home_id, breezeway_id, finished_at, property_name, started_at, scheduled_date')
        .eq('department', 'housekeeping')
        .eq('status_code', 'finished')
        .not('total_time_minutes', 'is', null)
        .gte('finished_at', from)
        .lte('finished_at', to);

      if (!tasks?.length) return [];

      // Fetch property difficulty for adjusted averages
      const { data: propDifficulty } = await supabase
        .from('v_property_difficulty')
        .select('home_id, avg_clean_minutes');

      const propAvgMap = new Map<number, number>();
      if (propDifficulty) {
        for (const p of propDifficulty) {
          if (p.home_id && p.avg_clean_minutes) propAvgMap.set(p.home_id, Number(p.avg_clean_minutes));
        }
      }

      const globalAvg = tasks.reduce((s, t) => s + (Number(t.total_time_minutes) || 0), 0) / tasks.length;

      // Fetch assignments in batches
      const taskIds = tasks.map(t => t.breezeway_id);
      const batchSize = 500;
      let allAssignments: { task_id: number; assignee_name: string }[] = [];
      for (let i = 0; i < taskIds.length; i += batchSize) {
        const batch = taskIds.slice(i, i + batchSize);
        const { data: assignments } = await supabase
          .from('breezeway_task_assignments')
          .select('task_id, assignee_name')
          .in('task_id', batch);
        if (assignments) allAssignments = allAssignments.concat(assignments as any);
      }

      const taskMap = new Map(tasks.map(t => [t.breezeway_id, t]));

      interface CleanEntry {
        time: number;
        home_id: number;
        property_name: string;
        finished_at: string;
      }

      const byAssignee: Record<string, CleanEntry[]> = {};

      for (const a of allAssignments) {
        const task = taskMap.get(a.task_id);
        if (!task || !a.assignee_name || !task.total_time_minutes || !task.finished_at) continue;
        if (!byAssignee[a.assignee_name]) byAssignee[a.assignee_name] = [];
        byAssignee[a.assignee_name].push({
          time: Number(task.total_time_minutes),
          home_id: Number(task.home_id) || 0,
          property_name: task.property_name ?? 'Unknown',
          finished_at: task.finished_at,
        });
      }

      return Object.entries(byAssignee)
        .filter(([_, cleans]) => cleans.length >= 3)
        .map(([name, cleans]) => {
          const times = cleans.map(c => c.time);
          const sorted = [...times].sort((a, b) => a - b);
          const avg = sorted.reduce((s, t) => s + t, 0) / sorted.length;
          const median = sorted[Math.floor(sorted.length / 2)];
          const variance = sorted.reduce((s, t) => s + Math.pow(t - avg, 2), 0) / sorted.length;
          const std_dev = Math.round(Math.sqrt(variance));

          // Property difficulty adjusted average
          let adjustedSum = 0;
          let adjustedCount = 0;
          for (const c of cleans) {
            const propAvg = propAvgMap.get(c.home_id);
            if (propAvg && propAvg > 0) {
              adjustedSum += (c.time / propAvg) * globalAvg;
            } else {
              adjustedSum += c.time;
            }
            adjustedCount++;
          }
          const adjusted_avg = Math.round(adjustedCount > 0 ? adjustedSum / adjustedCount : avg);

          // Weekly trend
          const byWeek: Record<string, number[]> = {};
          for (const c of cleans) {
            const week = getISOWeekStart(c.finished_at);
            if (!byWeek[week]) byWeek[week] = [];
            byWeek[week].push(c.time);
          }
          const weekly_trend = Object.entries(byWeek)
            .map(([week, wTimes]) => ({
              week,
              avg: Math.round(wTimes.reduce((s, t) => s + t, 0) / wTimes.length),
            }))
            .sort((a, b) => a.week.localeCompare(b.week));

          // Cleans by property
          const byProp: Record<string, { name: string; home_id: number; times: number[] }> = {};
          for (const c of cleans) {
            const key = String(c.home_id);
            if (!byProp[key]) byProp[key] = { name: c.property_name, home_id: c.home_id, times: [] };
            byProp[key].times.push(c.time);
          }
          const cleans_by_property = Object.values(byProp)
            .map(p => ({
              property_name: p.name,
              home_id: p.home_id,
              count: p.times.length,
              avg: Math.round(p.times.reduce((s, t) => s + t, 0) / p.times.length),
            }))
            .sort((a, b) => b.count - a.count);

          // Schedule efficiency — % of cleans on days with 2+ cleans
          const cleansByDate: Record<string, number> = {};
          for (const c of cleans) {
            const date = c.finished_at.slice(0, 10);
            cleansByDate[date] = (cleansByDate[date] || 0) + 1;
          }
          const backToBack = Object.values(cleansByDate).filter(n => n >= 2).reduce((s, n) => s + n, 0);
          const schedule_efficiency = Math.round((backToBack / cleans.length) * 100);

          const properties = new Set(cleans.map(c => c.home_id));
          const trend_direction = computeTrendDirection(weekly_trend);

          return {
            assignee_name: name,
            avg_minutes: Math.round(avg),
            adjusted_avg,
            median_minutes: Math.round(median),
            fastest_minutes: sorted[0],
            slowest_minutes: sorted[sorted.length - 1],
            total_cleans: sorted.length,
            std_dev,
            properties_cleaned: properties.size,
            weekly_trend,
            trend_direction,
            schedule_efficiency,
            cleans_by_property,
          } as CleanerData;
        })
        .filter(c => c.avg_minutes >= 5)
        .sort((a, b) => a.avg_minutes - b.avg_minutes);
    },
  });
}

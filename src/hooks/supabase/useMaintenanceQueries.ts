import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

/** Maintenance stats (6 parallel queries) — MaintenanceCommandCenter */
export function useMaintenanceStats(from: string, to: string, timeFilter: string) {
  return useQuery({
    queryKey: ['mcc-stats', timeFilter],
    queryFn: async () => {
      const [newIssues, inProgress, completedToday, unassignedRes, overdueRes, responseRes] = await Promise.all([
        supabase.from('breezeway_tasks').select('breezeway_id')
          .eq('department', 'maintenance').gte('created_at', from).lte('created_at', to).limit(1000),
        supabase.from('breezeway_tasks').select('breezeway_id')
          .eq('department', 'maintenance').eq('status_code', 'in_progress').limit(1000),
        supabase.from('breezeway_tasks').select('breezeway_id')
          .eq('department', 'maintenance').eq('status_code', 'finished').gte('finished_at', from).lte('finished_at', to).limit(1000),
        supabase.from('breezeway_tasks').select('breezeway_id')
          .eq('department', 'maintenance').in('status_code', ['created', 'in_progress']).limit(1000),
        supabase.from('breezeway_tasks').select('breezeway_id')
          .eq('department', 'maintenance').in('status_code', ['created', 'in_progress'])
          .lt('scheduled_date', format(new Date(), 'yyyy-MM-dd')).limit(1000),
        supabase.from('breezeway_tasks').select('response_time_minutes')
          .eq('department', 'maintenance').eq('status_code', 'finished')
          .not('response_time_minutes', 'is', null)
          .gte('finished_at', from).lte('finished_at', to)
          .limit(500),
      ]);

      let unassignedCount = 0;
      if (unassignedRes.data && unassignedRes.data.length > 0) {
        const taskIds = unassignedRes.data.map(t => t.breezeway_id);
        const { data: assignments } = await supabase
          .from('breezeway_task_assignments')
          .select('task_id')
          .in('task_id', taskIds);
        const assignedTaskIds = new Set(assignments?.map(a => a.task_id) ?? []);
        unassignedCount = taskIds.filter(id => !assignedTaskIds.has(id)).length;
      }

      const responseTimes = responseRes.data?.map(t => t.response_time_minutes).filter(Boolean) ?? [];
      const avgResponseMin = responseTimes.length > 0
        ? Math.round(responseTimes.reduce((s, v) => s + (v ?? 0), 0) / responseTimes.length)
        : 0;

      return {
        newIssues: newIssues.data?.length ?? 0,
        inProgress: inProgress.data?.length ?? 0,
        completed: completedToday.data?.length ?? 0,
        unassigned: unassignedCount,
        overdue: overdueRes.data?.length ?? 0,
        avgResponseMin,
      };
    },
  });
}

/** Needs Immediate Attention — MaintenanceCommandCenter */
export function useMaintenanceAttention() {
  return useQuery({
    queryKey: ['mcc-attention'],
    queryFn: async () => {
      const todayDate = format(new Date(), 'yyyy-MM-dd');
      const { data: tasks } = await supabase
        .from('breezeway_tasks')
        .select('breezeway_id, name, ai_title, property_name, home_id, created_at, priority, status_code, scheduled_date, report_url, ai_guest_impact')
        .eq('department', 'maintenance')
        .in('status_code', ['created', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(500);

      if (!tasks || tasks.length === 0) return [];

      const taskIds = tasks.map(t => t.breezeway_id);
      const { data: assignments } = await supabase
        .from('breezeway_task_assignments')
        .select('task_id, assignee_name')
        .in('task_id', taskIds);
      const assignmentMap = new Map<number, string[]>();
      assignments?.forEach(a => {
        if (!assignmentMap.has(a.task_id!)) assignmentMap.set(a.task_id!, []);
        if (a.assignee_name) assignmentMap.get(a.task_id!)!.push(a.assignee_name);
      });

      const { differenceInDays, parseISO } = await import('date-fns');

      return tasks
        .filter(t => {
          const isUnassigned = !assignmentMap.has(t.breezeway_id) || assignmentMap.get(t.breezeway_id)!.length === 0;
          const isOverdue = t.scheduled_date && t.scheduled_date < todayDate;
          const isUrgent = t.priority === 'urgent' || t.ai_guest_impact === true;
          return isUnassigned || isOverdue || isUrgent;
        })
        .map(t => ({
          ...t,
          assignees: assignmentMap.get(t.breezeway_id) ?? [],
          isUnassigned: !assignmentMap.has(t.breezeway_id) || assignmentMap.get(t.breezeway_id)!.length === 0,
          isOverdue: !!(t.scheduled_date && t.scheduled_date < todayDate),
          daysOpen: differenceInDays(new Date(), parseISO(t.created_at!)),
        }))
        .sort((a, b) => {
          const urgA = (a.ai_guest_impact ? 0 : a.priority === 'urgent' ? 1 : 3);
          const urgB = (b.ai_guest_impact ? 0 : b.priority === 'urgent' ? 1 : 3);
          if (urgA !== urgB) return urgA - urgB;
          if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
          return b.daysOpen - a.daysOpen;
        });
    },
  });
}

/** Activity feed — MaintenanceCommandCenter */
export function useMaintenanceActivity(from: string, to: string, timeFilter: string) {
  return useQuery({
    queryKey: ['mcc-activity', timeFilter],
    queryFn: async () => {
      const { data: created } = await supabase
        .from('breezeway_tasks')
        .select('breezeway_id, name, ai_title, property_name, created_at, status_code')
        .eq('department', 'maintenance')
        .gte('created_at', from).lte('created_at', to)
        .order('created_at', { ascending: false })
        .limit(100);

      const { data: started } = await supabase
        .from('breezeway_tasks')
        .select('breezeway_id, name, ai_title, property_name, started_at, status_code')
        .eq('department', 'maintenance')
        .not('started_at', 'is', null)
        .gte('started_at', from).lte('started_at', to)
        .order('started_at', { ascending: false })
        .limit(100);

      const { data: finished } = await supabase
        .from('breezeway_tasks')
        .select('breezeway_id, name, ai_title, property_name, finished_at, status_code')
        .eq('department', 'maintenance')
        .eq('status_code', 'finished')
        .not('finished_at', 'is', null)
        .gte('finished_at', from).lte('finished_at', to)
        .order('finished_at', { ascending: false })
        .limit(100);

      const allIds = new Set<number>();
      created?.forEach(t => allIds.add(t.breezeway_id));
      started?.forEach(t => allIds.add(t.breezeway_id));
      finished?.forEach(t => allIds.add(t.breezeway_id));

      const { data: assignments } = await supabase
        .from('breezeway_task_assignments')
        .select('task_id, assignee_name')
        .in('task_id', Array.from(allIds));
      const assignMap = new Map<number, string>();
      assignments?.forEach(a => {
        if (a.assignee_name) {
          const existing = assignMap.get(a.task_id!) ?? '';
          assignMap.set(a.task_id!, existing ? `${existing}, ${a.assignee_name}` : a.assignee_name);
        }
      });

      type FeedItem = { id: number; title: string; property: string; time: string; type: 'created' | 'started' | 'completed'; tech: string };
      const feed: FeedItem[] = [];

      created?.forEach(t => feed.push({
        id: t.breezeway_id, title: t.ai_title || t.name || 'Untitled',
        property: t.property_name || 'Unknown', time: t.created_at!,
        type: 'created', tech: assignMap.get(t.breezeway_id) ?? 'Unassigned',
      }));
      started?.forEach(t => feed.push({
        id: t.breezeway_id, title: t.ai_title || t.name || 'Untitled',
        property: t.property_name || 'Unknown', time: t.started_at!,
        type: 'started', tech: assignMap.get(t.breezeway_id) ?? 'Unassigned',
      }));
      finished?.forEach(t => feed.push({
        id: t.breezeway_id, title: t.ai_title || t.name || 'Untitled',
        property: t.property_name || 'Unknown', time: t.finished_at!,
        type: 'completed', tech: assignMap.get(t.breezeway_id) ?? 'Unassigned',
      }));

      feed.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
      return feed.slice(0, 50);
    },
  });
}

/** Maintenance counts — MaintenanceTracker */
export function useMaintenanceCounts(from: string, to: string) {
  return useQuery({
    queryKey: ['maintenance-counts', from, to],
    queryFn: async () => {
      const [totalRes, finishedRes] = await Promise.all([
        supabase.from('breezeway_tasks').select('*', { count: 'exact', head: true }).eq('department', 'maintenance').gte('created_at', from).lte('created_at', to),
        supabase.from('breezeway_tasks').select('*', { count: 'exact', head: true }).eq('department', 'maintenance').eq('status_code', 'finished').gte('created_at', from).lte('created_at', to),
      ]);
      return { total: totalRes.count ?? 0, finished: finishedRes.count ?? 0 };
    },
  });
}

/** Sample finished tasks for resolution time calc */
export function useMaintenanceTasksSample(from: string, to: string) {
  return useQuery({
    queryKey: ['maintenance-tasks-sample', from, to],
    queryFn: async () => {
      const { data } = await supabase
        .from('breezeway_tasks')
        .select('name, department, priority, status_code, total_cost, total_time_minutes, created_at, finished_at')
        .eq('department', 'maintenance')
        .eq('status_code', 'finished')
        .not('finished_at', 'is', null)
        .gte('created_at', from)
        .lte('created_at', to)
        .limit(500);
      return data ?? [];
    },
  });
}

/** Top maintenance issues view */
export function useTopMaintenanceIssues() {
  return useQuery({
    queryKey: ['top-maintenance-issues'],
    queryFn: async () => {
      const { data } = await supabase.from('v_top_maintenance_issues').select('*').order('occurrences', { ascending: false }).limit(20);
      return data ?? [];
    },
  });
}

/** Stale/overdue tasks view */
export function useStaleTasks() {
  return useQuery({
    queryKey: ['stale-tasks'],
    queryFn: async () => {
      const { data } = await supabase.from('v_stale_tasks').select('*').order('days_overdue', { ascending: false });
      return data ?? [];
    },
  });
}

/** Cost trend from breezeway_task_costs */
export function useCostTrend(from: string, to: string) {
  return useQuery({
    queryKey: ['cost-trend', from, to],
    queryFn: async () => {
      const { data } = await supabase
        .from('breezeway_task_costs')
        .select('cost, created_at')
        .gte('created_at', from)
        .lte('created_at', to);
      if (!data) return [];
      const byMonth: Record<string, { cost: number; count: number }> = {};
      data.forEach(c => {
        const month = c.created_at?.slice(0, 7) ?? 'unknown';
        if (!byMonth[month]) byMonth[month] = { cost: 0, count: 0 };
        byMonth[month].cost += (c.cost || 0);
        byMonth[month].count++;
      });
      return Object.entries(byMonth).sort().map(([month, v]) => ({
        month,
        cost: Math.round(v.cost),
        entries: v.count,
      }));
    },
  });
}

/** Costs by category (tag_list) */
export function useCostsByCategory(from: string, to: string) {
  return useQuery({
    queryKey: ['costs-by-category', from, to],
    queryFn: async () => {
      const { data } = await supabase
        .from('breezeway_tasks')
        .select('tag_list, total_cost, property_name, home_id')
        .eq('department', 'maintenance')
        .not('total_cost', 'is', null)
        .gte('created_at', from)
        .lte('created_at', to)
        .limit(1000);
      if (!data) return { byCategory: [] as { category: string; cost: number }[], byProperty: [] as { name: string; cost: number }[] };

      const catMap: Record<string, number> = {};
      const propMap: Record<string, { name: string; cost: number }> = {};
      for (const t of data) {
        const cat = t.tag_list || 'Uncategorized';
        catMap[cat] = (catMap[cat] || 0) + (Number(t.total_cost) || 0);
        if (t.home_id) {
          const hid = String(t.home_id);
          if (!propMap[hid]) propMap[hid] = { name: t.property_name || 'Unknown', cost: 0 };
          propMap[hid].cost += Number(t.total_cost) || 0;
        }
      }
      return {
        byCategory: Object.entries(catMap).map(([cat, cost]) => ({ category: cat.slice(0, 30), cost: Math.round(cost) })).sort((a, b) => b.cost - a.cost).slice(0, 10),
        byProperty: Object.values(propMap).sort((a, b) => b.cost - a.cost).slice(0, 10),
      };
    },
  });
}

/** Assignment load (open task count per person) */
export function useAssignmentLoad() {
  return useQuery({
    queryKey: ['assignment-load'],
    queryFn: async () => {
      const { data: openTasks } = await supabase
        .from('breezeway_tasks')
        .select('breezeway_id')
        .eq('department', 'maintenance')
        .not('status_code', 'in', '("finished","closed")')
        .limit(1000);
      if (!openTasks || openTasks.length === 0) return [];

      const taskIds = openTasks.map(t => t.breezeway_id);
      const { data: assignments } = await supabase
        .from('breezeway_task_assignments')
        .select('assignee_name, task_id')
        .in('task_id', taskIds);

      const byPerson: Record<string, number> = {};
      assignments?.forEach(a => {
        if (a.assignee_name) byPerson[a.assignee_name] = (byPerson[a.assignee_name] || 0) + 1;
      });
      return Object.entries(byPerson)
        .map(([name, count]) => ({ name, open_tasks: count }))
        .sort((a, b) => b.open_tasks - a.open_tasks);
    },
  });
}

/** Kanban tasks */
export function useKanbanTasks(from: string, to: string, enabled: boolean) {
  return useQuery({
    queryKey: ['kanban-tasks', from, to],
    enabled,
    queryFn: async () => {
      const { data } = await supabase
        .from('breezeway_tasks')
        .select('breezeway_id, name, property_name, priority, status_code, total_cost, created_at, scheduled_date')
        .eq('department', 'maintenance')
        .gte('created_at', from)
        .lte('created_at', to)
        .order('created_at', { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });
}

/** Recurring/preventive tasks */
export function useRecurringTasks(enabled: boolean) {
  return useQuery({
    queryKey: ['recurring-tasks'],
    enabled,
    queryFn: async () => {
      const { data } = await supabase
        .from('breezeway_tasks')
        .select('name, property_name, scheduled_date, status_code, priority, tag_list')
        .eq('department', 'maintenance')
        .in('tag_list', ['Preventive Maintenance', 'Hot Tub'])
        .not('scheduled_date', 'is', null)
        .order('scheduled_date', { ascending: true })
        .limit(200);
      return data ?? [];
    },
  });
}

/** Cost summary by type code */
export function useCostSummary(from: string, to: string) {
  return useQuery({
    queryKey: ['cost-summary-period', from, to],
    queryFn: async () => {
      const { data } = await supabase
        .from('breezeway_task_costs')
        .select('cost, cost_type_code')
        .gte('created_at', from)
        .lte('created_at', to);
      return data ?? [];
    },
  });
}

/** Tech dispatch — tasks + assignments for technician cards */
export function useTechDispatchTasks(from: string, to: string) {
  return useQuery({
    queryKey: ['tech-dispatch-tasks', from, to],
    queryFn: async () => {
      const { data: tasks, error } = await supabase
        .from('breezeway_tasks')
        .select(`
          breezeway_id, name, ai_title, property_name, status_code,
          priority, ai_guest_impact, scheduled_date, started_at,
          finished_at, created_at, work_duration_minutes, report_url
        `)
        .eq('department', 'maintenance')
        .or(`created_at.gte.${from},started_at.gte.${from},finished_at.gte.${from},status_code.in.(created,in_progress)`)
        .order('created_at', { ascending: false })
        .limit(2000);

      if (error) throw error;
      if (!tasks || tasks.length === 0) return { tasks: [] as any[], assignmentMap: new Map<number, string[]>() };

      const taskIds = tasks.map(t => t.breezeway_id);
      const chunkSize = 500;
      const chunks: typeof taskIds[] = [];
      for (let i = 0; i < taskIds.length; i += chunkSize) chunks.push(taskIds.slice(i, i + chunkSize));

      const allAssignments: { task_id: number | null; assignee_name: string | null }[] = [];
      for (const chunk of chunks) {
        const { data } = await supabase
          .from('breezeway_task_assignments')
          .select('task_id, assignee_name')
          .in('task_id', chunk);
        if (data) allAssignments.push(...data);
      }

      const assignmentMap = new Map<number, string[]>();
      allAssignments.forEach(a => {
        if (!a.task_id || !a.assignee_name) return;
        if (!assignmentMap.has(a.task_id)) assignmentMap.set(a.task_id, []);
        assignmentMap.get(a.task_id)!.push(a.assignee_name);
      });

      return { tasks, assignmentMap };
    },
  });
}

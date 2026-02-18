import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { KPICard } from '@/components/dashboard/KPICard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TaskDetailSheet } from '@/components/maintenance/TaskDetailSheet';
import { AlertTriangle, Clock, CheckCircle2, UserX, CalendarX, Zap, ExternalLink } from 'lucide-react';
import { format, startOfDay, subDays, differenceInDays, parseISO } from 'date-fns';

type TimeFilter = 'today' | '7d' | '30d' | 'all';

function getFilterDates(filter: TimeFilter) {
  const now = new Date();
  const todayStart = startOfDay(now);
  switch (filter) {
    case 'today': return { from: todayStart.toISOString(), to: now.toISOString(), label: 'Today' };
    case '7d': return { from: subDays(todayStart, 7).toISOString(), to: now.toISOString(), label: 'Last 7 Days' };
    case '30d': return { from: subDays(todayStart, 30).toISOString(), to: now.toISOString(), label: 'Last 30 Days' };
    case 'all': return { from: '2024-01-01T00:00:00Z', to: now.toISOString(), label: 'All Time' };
  }
}

const URGENCY_COLORS: Record<string, string> = {
  'guest-impacting': 'bg-destructive text-destructive-foreground',
  urgent: 'bg-destructive text-destructive-foreground',
  elevated: 'bg-[hsl(var(--warning))] text-foreground',
  routine: 'bg-muted text-muted-foreground',
};

const PRIORITY_BADGE: Record<string, 'destructive' | 'default' | 'secondary' | 'outline'> = {
  urgent: 'destructive',
  high: 'default',
  normal: 'secondary',
  low: 'outline',
};

export default function MaintenanceCommandCenter() {
  const [openTaskId, setOpenTaskId] = useState<number | null>(null);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('today');
  const { from, to } = getFilterDates(timeFilter);
  const todayStr = startOfDay(new Date()).toISOString();

  // === STAT CARDS ===
  const { data: stats } = useQuery({
    queryKey: ['mcc-stats', timeFilter],
    queryFn: async () => {
      const [newIssues, inProgress, completedToday, unassignedRes, overdueRes, responseRes] = await Promise.all([
        // 1. New issues in period
        supabase.from('breezeway_tasks').select('breezeway_id')
          .eq('department', 'maintenance').gte('created_at', from).lte('created_at', to).limit(1000),
        // 2. In Progress (always current)
        supabase.from('breezeway_tasks').select('breezeway_id')
          .eq('department', 'maintenance').eq('status_code', 'in_progress').limit(1000),
        // 3. Completed in period
        supabase.from('breezeway_tasks').select('breezeway_id')
          .eq('department', 'maintenance').eq('status_code', 'finished').gte('finished_at', from).lte('finished_at', to).limit(1000),
        // 4. Unassigned active tasks
        supabase.from('breezeway_tasks').select('breezeway_id')
          .eq('department', 'maintenance').in('status_code', ['created', 'in_progress']).limit(1000),
        // 5. Overdue
        supabase.from('breezeway_tasks').select('breezeway_id')
          .eq('department', 'maintenance').in('status_code', ['created', 'in_progress'])
          .lt('scheduled_date', format(new Date(), 'yyyy-MM-dd')).limit(1000),
        // 6. Avg response time for completed tasks in period
        supabase.from('breezeway_tasks').select('response_time_minutes')
          .eq('department', 'maintenance').eq('status_code', 'finished')
          .not('response_time_minutes', 'is', null)
          .gte('finished_at', from).lte('finished_at', to)
          .limit(500),
      ]);

      // For unassigned: check which active tasks have no assignments
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

      // Avg response time
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

  const formatResponseTime = (minutes: number) => {
    if (minutes === 0) return '—';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m}m`;
    return `${h}h ${m}m`;
  };

  // === NEEDS IMMEDIATE ATTENTION ===
  const { data: attentionTasks, isLoading: loadingAttention } = useQuery({
    queryKey: ['mcc-attention'],
    queryFn: async () => {
      const todayDate = format(new Date(), 'yyyy-MM-dd');
      // Get active maintenance tasks that are unassigned, overdue, or urgent
      const { data: tasks } = await supabase
        .from('breezeway_tasks')
        .select('breezeway_id, name, ai_title, property_name, home_id, created_at, priority, status_code, scheduled_date, report_url, ai_guest_impact')
        .eq('department', 'maintenance')
        .in('status_code', ['created', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(500);

      if (!tasks || tasks.length === 0) return [];

      // Get assignments for these tasks
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

  // === ACTIVITY FEED ===
  const { data: activityFeed, isLoading: loadingFeed } = useQuery({
    queryKey: ['mcc-activity', timeFilter],
    queryFn: async () => {
      // Get maintenance tasks with activity in the period
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

      // Collect all task IDs for assignment lookup
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

  const feedDotColor = (type: string) => {
    switch (type) {
      case 'created': return 'bg-[hsl(var(--warning))]';
      case 'started': return 'bg-[hsl(212,72%,59%)]';
      case 'completed': return 'bg-[hsl(var(--success))]';
      default: return 'bg-muted-foreground';
    }
  };

  const feedLabel = (type: string) => {
    switch (type) {
      case 'created': return 'Created';
      case 'started': return 'Started';
      case 'completed': return 'Completed';
      default: return type;
    }
  };

  return (
    <>
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Maintenance Command Center</h2>
          <p className="text-sm text-muted-foreground">Daily operations view — triage, track, resolve</p>
        </div>
        <div className="flex gap-1">
          {([
            { key: 'today' as TimeFilter, label: 'Today' },
            { key: '7d' as TimeFilter, label: '7 Days' },
            { key: '30d' as TimeFilter, label: '30 Days' },
            { key: 'all' as TimeFilter, label: 'All Time' },
          ]).map(f => (
            <Button
              key={f.key}
              variant={timeFilter === f.key ? 'default' : 'ghost'}
              size="sm"
              className="h-7 px-2.5 text-xs"
              onClick={() => setTimeFilter(f.key)}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      {/* STAT CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="glass-card p-3 sm:p-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider">New Issues</p>
              <p className="text-lg sm:text-2xl font-bold text-foreground">{stats?.newIssues ?? '—'}</p>
            </div>
            <div className={`p-1.5 rounded-lg ${(stats?.newIssues ?? 0) > 5 ? 'bg-destructive' : 'bg-accent'}`}>
              <AlertTriangle className={`h-4 w-4 ${(stats?.newIssues ?? 0) > 5 ? 'text-destructive-foreground' : 'text-secondary'}`} />
            </div>
          </div>
          {(stats?.newIssues ?? 0) > 5 && (
            <Badge variant="destructive" className="mt-1 text-[9px] px-1 py-0">High Volume</Badge>
          )}
        </div>

        <div className="glass-card p-3 sm:p-4">
          <div className="space-y-1">
            <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider">In Progress</p>
            <p className="text-lg sm:text-2xl font-bold text-foreground">{stats?.inProgress ?? '—'}</p>
          </div>
        </div>

        <div className="glass-card p-3 sm:p-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider">Completed</p>
              <p className="text-lg sm:text-2xl font-bold text-foreground">{stats?.completed ?? '—'}</p>
            </div>
            <div className="p-1.5 rounded-lg bg-accent hidden sm:block">
              <CheckCircle2 className="h-4 w-4 text-secondary" />
            </div>
          </div>
        </div>

        <div className={`glass-card p-3 sm:p-4 ${(stats?.unassigned ?? 0) > 0 ? 'border-destructive bg-destructive/5' : ''}`}>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider">Unassigned</p>
              <p className={`text-lg sm:text-2xl font-bold ${(stats?.unassigned ?? 0) > 0 ? 'text-destructive' : 'text-foreground'}`}>
                {stats?.unassigned ?? '—'}
              </p>
            </div>
            <div className={`p-1.5 rounded-lg ${(stats?.unassigned ?? 0) > 0 ? 'bg-destructive' : 'bg-accent'}`}>
              <UserX className={`h-4 w-4 ${(stats?.unassigned ?? 0) > 0 ? 'text-destructive-foreground' : 'text-secondary'}`} />
            </div>
          </div>
        </div>

        <div className={`glass-card p-3 sm:p-4 ${(stats?.overdue ?? 0) > 0 ? 'border-destructive bg-destructive/5' : ''}`}>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider">Overdue</p>
              <p className={`text-lg sm:text-2xl font-bold ${(stats?.overdue ?? 0) > 0 ? 'text-destructive' : 'text-foreground'}`}>
                {stats?.overdue ?? '—'}
              </p>
            </div>
            <div className={`p-1.5 rounded-lg ${(stats?.overdue ?? 0) > 0 ? 'bg-destructive' : 'bg-accent'}`}>
              <CalendarX className={`h-4 w-4 ${(stats?.overdue ?? 0) > 0 ? 'text-destructive-foreground' : 'text-secondary'}`} />
            </div>
          </div>
        </div>

        <div className="glass-card p-3 sm:p-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider">Avg Response</p>
              <p className="text-lg sm:text-2xl font-bold text-foreground">{formatResponseTime(stats?.avgResponseMin ?? 0)}</p>
            </div>
            <div className="p-1.5 rounded-lg bg-accent hidden sm:block">
              <Clock className="h-4 w-4 text-secondary" />
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: NEEDS IMMEDIATE ATTENTION */}
      <div className="glass-card rounded-lg">
        <div className="p-4 pb-2 flex items-center gap-2">
          <Zap className="h-4 w-4 text-destructive" />
          <h3 className="text-sm font-bold">Needs Immediate Attention</h3>
          <Badge variant="destructive" className="text-[9px] px-1.5 py-0 h-4 ml-1">
            {attentionTasks?.length ?? 0}
          </Badge>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Property</TableHead>
                <TableHead className="text-xs">Task</TableHead>
                <TableHead className="text-xs hidden sm:table-cell">Created</TableHead>
                <TableHead className="text-xs">Priority</TableHead>
                <TableHead className="text-xs hidden md:table-cell">Urgency</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs text-right">Days Open</TableHead>
                <TableHead className="text-xs w-8"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingAttention ? (
                <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">Loading…</TableCell></TableRow>
              ) : !attentionTasks?.length ? (
                <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">🎉 Nothing needs immediate attention!</TableCell></TableRow>
              ) : (
                attentionTasks.slice(0, 30).map(t => (
                  <TableRow key={`${t.breezeway_id}-attn`} className={`cursor-pointer hover:bg-accent/50 transition-colors ${t.isOverdue ? 'bg-destructive/5' : ''}`} onClick={() => setOpenTaskId(t.breezeway_id)}>
                    <TableCell className="text-xs font-medium max-w-[120px] truncate">{t.property_name || 'Unknown'}</TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate">{t.ai_title || t.name || 'Untitled'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground hidden sm:table-cell">
                      {t.created_at ? format(parseISO(t.created_at), 'MMM d') : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={PRIORITY_BADGE[t.priority ?? 'normal'] ?? 'secondary'} className="text-[9px] capitalize">
                        {t.priority ?? 'normal'}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {t.ai_guest_impact && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium bg-destructive text-destructive-foreground">
                          guest-impacting
                        </span>
                      )}
                      {!t.ai_guest_impact && t.priority === 'urgent' && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium bg-destructive text-destructive-foreground">
                          urgent
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {t.isUnassigned && <Badge variant="destructive" className="text-[8px] px-1 py-0">Unassigned</Badge>}
                        {t.isOverdue && <Badge variant="destructive" className="text-[8px] px-1 py-0">Overdue</Badge>}
                        {!t.isUnassigned && !t.isOverdue && (
                          <span className="text-[10px] text-muted-foreground capitalize">{t.status_code}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-right font-mono">{t.daysOpen}d</TableCell>
                    <TableCell>
                      {t.report_url && (
                        <a href={t.report_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* SECTION 3: ACTIVITY FEED */}
      <div className="glass-card rounded-lg p-4">
        <h3 className="text-sm font-bold mb-4">{getFilterDates(timeFilter).label}'s Activity Feed</h3>
        {loadingFeed ? (
          <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>
        ) : !activityFeed?.length ? (
          <p className="text-sm text-muted-foreground text-center py-8">No maintenance activity in this period.</p>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />
            <div className="space-y-3">
              {activityFeed.map((item, i) => (
                <div key={`${item.id}-${item.type}-${i}`} className="flex gap-3 items-start relative">
                  <div className={`w-[15px] h-[15px] rounded-full shrink-0 mt-0.5 ${feedDotColor(item.type)} ring-2 ring-background z-10`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium text-foreground truncate max-w-[200px]">{item.title}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${feedDotColor(item.type)} text-background`}>
                        {feedLabel(item.type)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                      <span>{format(parseISO(item.time), 'h:mm a')}</span>
                      <span>·</span>
                      <span className="truncate">{item.property}</span>
                      <span>·</span>
                      <span className="truncate">{item.tech}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>

    <TaskDetailSheet taskId={openTaskId} onClose={() => setOpenTaskId(null)} />
    </>
  );
}


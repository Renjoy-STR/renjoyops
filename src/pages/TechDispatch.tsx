import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  User,
  Clock,
  CheckCircle2,
  ListChecks,
  Layers,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  UserX,
} from 'lucide-react';
import { format, startOfDay, subDays, differenceInMinutes, parseISO, isToday } from 'date-fns';
import { Link } from 'react-router-dom';

// ─── Types ─────────────────────────────────────────────────────────────────

type TimeFilter = 'today' | '7d' | '30d';

interface RawTask {
  breezeway_id: number;
  name: string | null;
  ai_title: string | null;
  property_name: string | null;
  status_code: string | null;
  priority: string | null;
  ai_guest_impact: boolean | null;
  scheduled_date: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string | null;
  work_duration_minutes: number | null;
  report_url: string | null;
}

interface TechTask extends RawTask {
  assigneeName: string;
}

interface TechProfile {
  name: string;
  isActive: boolean;
  inProgress: TechTask[];
  queue: TechTask[];
  completedToday: TechTask[];
  allTasks: TechTask[];
  avgTaskMinutes: number | null;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function getFilterDates(filter: TimeFilter) {
  const now = new Date();
  const todayStart = startOfDay(now);
  switch (filter) {
    case 'today': return { from: todayStart.toISOString(), to: now.toISOString() };
    case '7d':    return { from: subDays(todayStart, 7).toISOString(), to: now.toISOString() };
    case '30d':   return { from: subDays(todayStart, 30).toISOString(), to: now.toISOString() };
  }
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m > 0 ? `${m}m` : ''}`.trim();
}

function elapsedSince(isoStr: string | null): string {
  if (!isoStr) return '—';
  const mins = differenceInMinutes(new Date(), parseISO(isoStr));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function statusLabel(code: string | null) {
  switch (code) {
    case 'in_progress': return 'In Progress';
    case 'created':     return 'Queued';
    case 'finished':    return 'Finished';
    case 'closed':      return 'Closed';
    default:            return code ?? '—';
  }
}

const PRIORITY_BADGE: Record<string, 'destructive' | 'default' | 'secondary' | 'outline'> = {
  urgent: 'destructive',
  high:   'default',
  normal: 'secondary',
  low:    'outline',
};

// ─── Tech Card ─────────────────────────────────────────────────────────────

function TechCard({ tech, onClick }: { tech: TechProfile; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="glass-card p-4 text-left w-full hover:border-primary/40 hover:shadow-md transition-all duration-150 group"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${tech.isActive ? 'gradient-accent' : 'bg-muted'}`}>
            <User className={`h-4 w-4 ${tech.isActive ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-sm text-foreground truncate">{tech.name}</p>
            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide ${tech.isActive ? 'text-[hsl(var(--success))]' : 'text-muted-foreground'}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${tech.isActive ? 'bg-[hsl(var(--success))]' : 'bg-muted-foreground'}`} />
              {tech.isActive ? 'Active' : 'Idle'}
            </span>
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-1" />
      </div>

      {/* Currently Working On */}
      {tech.inProgress.length > 0 ? (
        <div className="mb-3 p-2.5 rounded-md bg-[hsl(var(--success)/0.08)] border border-[hsl(var(--success)/0.2)]">
          <p className="text-[10px] font-semibold text-[hsl(var(--success))] uppercase tracking-wide mb-1">Working On</p>
          {tech.inProgress.slice(0, 2).map(t => (
            <div key={t.breezeway_id} className="mb-1 last:mb-0">
              <p className="text-xs font-medium text-foreground truncate">{t.ai_title || t.name || 'Untitled'}</p>
              <p className="text-[10px] text-muted-foreground">{t.property_name || '—'} · {elapsedSince(t.started_at)}</p>
            </div>
          ))}
          {tech.inProgress.length > 2 && (
            <p className="text-[10px] text-muted-foreground">+{tech.inProgress.length - 2} more</p>
          )}
        </div>
      ) : (
        <div className="mb-3 p-2.5 rounded-md bg-muted/40 border border-border">
          <p className="text-[10px] text-muted-foreground italic">No active tasks</p>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-base font-bold text-foreground">{tech.queue.length}</p>
          <p className="text-[10px] text-muted-foreground font-medium">Queue</p>
        </div>
        <div>
          <p className="text-base font-bold text-foreground">{tech.completedToday.length}</p>
          <p className="text-[10px] text-muted-foreground font-medium">Done Today</p>
        </div>
        <div>
          <p className="text-base font-bold text-foreground">
            {tech.avgTaskMinutes != null ? formatDuration(tech.avgTaskMinutes) : '—'}
          </p>
          <p className="text-[10px] text-muted-foreground font-medium">Avg Time</p>
        </div>
      </div>
    </button>
  );
}

// ─── Tech Detail Sheet ──────────────────────────────────────────────────────

function TechDetailSheet({ tech, open, onClose }: { tech: TechProfile | null; open: boolean; onClose: () => void }) {
  if (!tech) return null;

  const ordered = [
    ...tech.inProgress,
    ...tech.queue,
    ...tech.allTasks.filter(t => t.status_code === 'finished' || t.status_code === 'closed'),
  ];

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="pb-4 border-b border-border">
          <SheetTitle className="flex items-center gap-3">
            <div className={`h-9 w-9 rounded-full flex items-center justify-center ${tech.isActive ? 'gradient-accent' : 'bg-muted'}`}>
              <User className={`h-5 w-5 ${tech.isActive ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
            </div>
            <div>
              <p className="text-lg font-bold">{tech.name}</p>
              <span className={`text-xs font-semibold ${tech.isActive ? 'text-[hsl(var(--success))]' : 'text-muted-foreground'}`}>
                {tech.isActive ? '● Active' : '○ Idle'}
              </span>
            </div>
          </SheetTitle>
          <div className="grid grid-cols-3 gap-3 pt-3">
            <div className="text-center glass-card p-2.5">
              <p className="text-xl font-bold">{tech.inProgress.length}</p>
              <p className="text-[10px] text-muted-foreground">In Progress</p>
            </div>
            <div className="text-center glass-card p-2.5">
              <p className="text-xl font-bold">{tech.queue.length}</p>
              <p className="text-[10px] text-muted-foreground">Queued</p>
            </div>
            <div className="text-center glass-card p-2.5">
              <p className="text-xl font-bold">{tech.completedToday.length}</p>
              <p className="text-[10px] text-muted-foreground">Done Today</p>
            </div>
          </div>
        </SheetHeader>

        <div className="py-4 space-y-3">
          {ordered.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">No tasks in this period</p>
          )}
          {ordered.map(t => {
            const isFinished = t.status_code === 'finished' || t.status_code === 'closed';
            const isInProgress = t.status_code === 'in_progress';
            const isQueued = t.status_code === 'created';

            return (
              <div key={`${t.breezeway_id}-${t.assigneeName}`} className="glass-card p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded
                        ${isInProgress ? 'bg-[hsl(var(--success)/0.15)] text-[hsl(var(--success))]' :
                          isQueued    ? 'bg-[hsl(var(--warning)/0.15)] text-[hsl(var(--warning))]' :
                          'bg-muted text-muted-foreground'}`}>
                        {statusLabel(t.status_code)}
                      </span>
                      {(t.priority === 'urgent' || t.ai_guest_impact) && (
                        <Badge variant="destructive" className="text-[9px] px-1 py-0 h-3.5">
                          {t.ai_guest_impact ? 'Guest Impact' : 'Urgent'}
                        </Badge>
                      )}
                      {t.priority && t.priority !== 'urgent' && (
                        <Badge variant={PRIORITY_BADGE[t.priority] ?? 'outline'} className="text-[9px] px-1 py-0 h-3.5">
                          {t.priority}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-foreground truncate">{t.ai_title || t.name || 'Untitled'}</p>
                    <p className="text-xs text-muted-foreground">{t.property_name || '—'}</p>
                    {t.scheduled_date && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Scheduled: {format(parseISO(t.scheduled_date), 'MMM d')}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0 space-y-1">
                    {isInProgress && t.started_at && (
                      <p className="text-[11px] text-[hsl(var(--success))] font-medium">{elapsedSince(t.started_at)}</p>
                    )}
                    {isFinished && t.work_duration_minutes != null && (
                      <p className="text-[11px] text-muted-foreground font-medium">{formatDuration(t.work_duration_minutes)}</p>
                    )}
                    {t.report_url && (
                      <a href={t.report_url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-0.5 text-[10px] text-primary hover:underline">
                        <ExternalLink className="h-2.5 w-2.5" /> View
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────

export default function TechDispatch() {
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('today');
  const [selectedTech, setSelectedTech] = useState<TechProfile | null>(null);

  const { from, to } = getFilterDates(timeFilter);
  const todayStart = startOfDay(new Date()).toISOString();

  const { data: rawTasks, isLoading } = useQuery({
    queryKey: ['tech-dispatch-tasks', timeFilter],
    queryFn: async () => {
      // Fetch all maintenance tasks in range
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
      if (!tasks || tasks.length === 0) return { tasks: [], assignmentMap: new Map<number, string[]>() };

      // Fetch assignments for these tasks
      const taskIds = tasks.map(t => t.breezeway_id);
      // Supabase IN limit — chunk if needed
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

      // Build map: task_id → [names]
      const assignmentMap = new Map<number, string[]>();
      allAssignments.forEach(a => {
        if (!a.task_id || !a.assignee_name) return;
        if (!assignmentMap.has(a.task_id)) assignmentMap.set(a.task_id, []);
        assignmentMap.get(a.task_id)!.push(a.assignee_name);
      });

      return { tasks: tasks as RawTask[], assignmentMap };
    },
  });

  // ── Build per-tech profiles ───────────────────────────────────────────────
  const techProfiles = useMemo<TechProfile[]>(() => {
    if (!rawTasks) return [];
    const { tasks, assignmentMap } = rawTasks;

    // Expand tasks by assignee — one TechTask per assignee per task
    const techTaskMap = new Map<string, TechTask[]>();

    tasks.forEach(task => {
      const names = assignmentMap.get(task.breezeway_id) ?? [];
      if (names.length === 0) return; // skip unassigned

      names.forEach(name => {
        if (!techTaskMap.has(name)) techTaskMap.set(name, []);
        techTaskMap.get(name)!.push({ ...task, assigneeName: name });
      });
    });

    const todayStartStr = startOfDay(new Date()).toISOString();

    return Array.from(techTaskMap.entries())
      .map(([name, techTasks]): TechProfile => {
        const inProgress = techTasks.filter(t => t.status_code === 'in_progress');
        const queue = techTasks.filter(t => t.status_code === 'created');
        const completedToday = techTasks.filter(t =>
          t.status_code === 'finished' && t.finished_at && t.finished_at >= todayStartStr
        );

        // Avg task duration for finished tasks in range
        const finishedWithDuration = techTasks.filter(
          t => (t.status_code === 'finished' || t.status_code === 'closed') && t.work_duration_minutes != null
        );
        const avgTaskMinutes = finishedWithDuration.length > 0
          ? Math.round(
              finishedWithDuration.reduce((s, t) => s + (t.work_duration_minutes ?? 0), 0) /
              finishedWithDuration.length
            )
          : null;

        return {
          name,
          isActive: inProgress.length > 0,
          inProgress,
          queue,
          completedToday,
          allTasks: techTasks,
          avgTaskMinutes,
        };
      })
      .sort((a, b) => {
        // Active first, then by in-progress count desc
        if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
        if (b.inProgress.length !== a.inProgress.length) return b.inProgress.length - a.inProgress.length;
        return a.name.localeCompare(b.name);
      });
  }, [rawTasks]);

  // ── Summary bar computations ──────────────────────────────────────────────
  const summary = useMemo(() => {
    if (!rawTasks) return { activeTechs: 0, totalQueue: 0, completedToday: 0, unassigned: 0 };
    const { tasks, assignmentMap } = rawTasks;

    const todayStartStr = startOfDay(new Date()).toISOString();
    const activeTechs = techProfiles.filter(t => t.isActive).length;
    const totalQueue = techProfiles.reduce((s, t) => s + t.queue.length, 0);
    const completedToday = tasks.filter(
      t => t.status_code === 'finished' && t.finished_at && t.finished_at >= todayStartStr
    ).length;
    const unassigned = tasks.filter(t =>
      (t.status_code === 'created' || t.status_code === 'in_progress') &&
      (!assignmentMap.has(t.breezeway_id) || assignmentMap.get(t.breezeway_id)!.length === 0)
    ).length;

    return { activeTechs, totalQueue, completedToday, unassigned };
  }, [rawTasks, techProfiles]);

  const TIME_FILTERS: { key: TimeFilter; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: '7d',   label: '7 Days' },
    { key: '30d',  label: '30 Days' },
  ];

  return (
    <div className="space-y-6">
      {/* PAGE HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Tech Dispatch</h2>
          <p className="text-sm text-muted-foreground">Live workload and status for every maintenance technician</p>
        </div>
        <div className="flex gap-1">
          {TIME_FILTERS.map(f => (
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

      {/* SUMMARY BAR */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="glass-card p-3 sm:p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg gradient-accent shrink-0">
            <User className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <p className="text-xl font-bold text-foreground">{summary.activeTechs}</p>
            <p className="text-[11px] text-muted-foreground font-medium">Active Techs</p>
          </div>
        </div>
        <div className="glass-card p-3 sm:p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[hsl(var(--warning)/0.15)] shrink-0">
            <ListChecks className="h-4 w-4 text-[hsl(var(--warning))]" />
          </div>
          <div>
            <p className="text-xl font-bold text-foreground">{summary.totalQueue}</p>
            <p className="text-[11px] text-muted-foreground font-medium">Tasks in Queue</p>
          </div>
        </div>
        <div className="glass-card p-3 sm:p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[hsl(var(--success)/0.15)] shrink-0">
            <CheckCircle2 className="h-4 w-4 text-[hsl(var(--success))]" />
          </div>
          <div>
            <p className="text-xl font-bold text-foreground">{summary.completedToday}</p>
            <p className="text-[11px] text-muted-foreground font-medium">Completed Today</p>
          </div>
        </div>
        <Link
          to="/maintenance/command"
          className={`glass-card p-3 sm:p-4 flex items-center gap-3 hover:border-destructive/50 transition-colors group ${summary.unassigned > 0 ? 'border-destructive/40 bg-destructive/5' : ''}`}
        >
          <div className={`p-2 rounded-lg shrink-0 ${summary.unassigned > 0 ? 'bg-destructive' : 'bg-muted'}`}>
            <UserX className={`h-4 w-4 ${summary.unassigned > 0 ? 'text-destructive-foreground' : 'text-muted-foreground'}`} />
          </div>
          <div>
            <p className={`text-xl font-bold ${summary.unassigned > 0 ? 'text-destructive' : 'text-foreground'}`}>{summary.unassigned}</p>
            <p className="text-[11px] text-muted-foreground font-medium group-hover:text-primary transition-colors">Unassigned ↗</p>
          </div>
        </Link>
      </div>

      {/* TECH CARDS GRID */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="glass-card p-4 animate-pulse h-44">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-8 w-8 rounded-full bg-muted" />
                <div className="space-y-1 flex-1">
                  <div className="h-3 bg-muted rounded w-3/4" />
                  <div className="h-2 bg-muted rounded w-1/4" />
                </div>
              </div>
              <div className="h-16 bg-muted rounded mb-3" />
              <div className="grid grid-cols-3 gap-2">
                {[0, 1, 2].map(j => <div key={j} className="h-8 bg-muted rounded" />)}
              </div>
            </div>
          ))}
        </div>
      ) : techProfiles.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Layers className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No assigned maintenance tasks found for this period</p>
          <p className="text-xs text-muted-foreground mt-1">Try switching to "7 Days" or "30 Days"</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Layers className="h-3.5 w-3.5" />
            <span>{techProfiles.length} technicians · {techProfiles.filter(t => t.isActive).length} active</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {techProfiles.map(tech => (
              <TechCard
                key={tech.name}
                tech={tech}
                onClick={() => setSelectedTech(tech)}
              />
            ))}
          </div>
        </>
      )}

      {/* DETAIL SHEET */}
      <TechDetailSheet
        tech={selectedTech}
        open={selectedTech !== null}
        onClose={() => setSelectedTech(null)}
      />
    </div>
  );
}

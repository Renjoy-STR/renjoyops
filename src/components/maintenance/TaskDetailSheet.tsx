import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ExternalLink,
  Clock,
  Calendar,
  User,
  Zap,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Building2,
  Tag,
  DollarSign,
  Activity,
} from 'lucide-react';
import { format, parseISO, differenceInMinutes, differenceInHours } from 'date-fns';

// ─── Types ─────────────────────────────────────────────────────────────────

interface AiIssue {
  title?: string;
  description?: string;
  severity?: string;
  category?: string;
  location?: string;
}

interface FullTask {
  breezeway_id: number;
  name: string | null;
  ai_title: string | null;
  description: string | null;
  ai_description: string | null;
  ai_summary: string | null;
  ai_issues: AiIssue[] | null;
  ai_tags: string[] | null;
  ai_estimated_repair_cost: number | null;
  ai_follow_up_needed: boolean | null;
  ai_follow_up_reason: string | null;
  ai_worker_performance_note: string | null;
  ai_guest_impact: boolean | null;
  ai_complexity: string | null;
  ai_skill_category: string | null;
  ai_property_health_signal: string | null;
  property_name: string | null;
  home_id: number | null;
  reference_property_id: string | null;
  status_code: string | null;
  status_name: string | null;
  priority: string | null;
  created_at: string | null;
  scheduled_date: string | null;
  started_at: string | null;
  finished_at: string | null;
  response_time_minutes: number | null;
  work_duration_minutes: number | null;
  efficiency_ratio: number | null;
  requested_by: string | null;
  report_url: string | null;
  department: string | null;
}

interface Assignment {
  task_id: number | null;
  assignee_id: number | null;
  assignee_name: string | null;
  status: string | null;
}

interface RecentTask {
  breezeway_id: number;
  name: string | null;
  ai_title: string | null;
  status_code: string | null;
  created_at: string | null;
  priority: string | null;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function fmtTimestamp(iso: string | null) {
  if (!iso) return '—';
  return format(parseISO(iso), 'MMM d, yyyy h:mm a');
}

function fmtDuration(minutes: number | null) {
  if (!minutes) return '—';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m > 0 ? `${m}m` : ''}`.trim();
}

function statusBadge(code: string | null) {
  switch (code) {
    case 'in_progress': return <Badge className="bg-[hsl(212,72%,59%)] text-white border-0 text-[10px]">In Progress</Badge>;
    case 'created':     return <Badge variant="secondary" className="text-[10px]">Created</Badge>;
    case 'finished':    return <Badge className="bg-[hsl(var(--success))] text-white border-0 text-[10px]">Finished</Badge>;
    case 'closed':      return <Badge variant="outline" className="text-[10px]">Closed</Badge>;
    default:            return <Badge variant="outline" className="text-[10px] capitalize">{code ?? '—'}</Badge>;
  }
}

function urgencyBadge(task: FullTask) {
  if (task.ai_guest_impact)      return <Badge variant="destructive" className="text-[10px]">Guest Impact</Badge>;
  if (task.priority === 'urgent') return <Badge variant="destructive" className="text-[10px]">Urgent</Badge>;
  if (task.priority === 'high')   return <Badge className="bg-[hsl(var(--warning))] text-foreground border-0 text-[10px]">Elevated</Badge>;
  return <Badge variant="secondary" className="text-[10px]">Routine</Badge>;
}

function severityColor(severity?: string) {
  const s = (severity ?? '').toLowerCase();
  if (s === 'critical' || s === 'high') return 'bg-destructive/10 text-destructive border-destructive/20';
  if (s === 'medium' || s === 'moderate') return 'bg-[hsl(var(--warning)/0.15)] text-[hsl(var(--warning))] border-[hsl(var(--warning)/0.3)]';
  return 'bg-muted text-muted-foreground border-border';
}

function parseAiIssues(raw: unknown): AiIssue[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as AiIssue[];
  if (typeof raw === 'object') {
    // Sometimes it's { issues: [...] }
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.issues)) return obj.issues as AiIssue[];
  }
  return [];
}

// ─── Timeline Step ──────────────────────────────────────────────────────────

function TimelineStep({
  label,
  timestamp,
  done,
  isLast,
  duration,
  durationLabel,
  highlight,
}: {
  label: string;
  timestamp: string | null;
  done: boolean;
  isLast?: boolean;
  duration?: string | null;
  durationLabel?: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 border-2 z-10
          ${done
            ? highlight
              ? 'bg-primary border-primary text-primary-foreground'
              : 'bg-[hsl(var(--success))] border-[hsl(var(--success))] text-white'
            : 'bg-background border-border text-muted-foreground'
          }`}>
          {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <div className="h-2 w-2 rounded-full bg-muted-foreground/40" />}
        </div>
        {!isLast && <div className={`w-px flex-1 mt-1 mb-1 min-h-[2rem] ${done ? 'bg-[hsl(var(--success)/0.4)]' : 'bg-border'}`} />}
      </div>
      <div className="pb-4 min-w-0 flex-1">
        <p className={`text-sm font-semibold ${done ? 'text-foreground' : 'text-muted-foreground'}`}>{label}</p>
        <p className="text-xs text-muted-foreground">{timestamp ? fmtTimestamp(timestamp) : 'Not yet'}</p>
        {duration && (
          <div className={`mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold
            ${highlight ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
            <Clock className="h-2.5 w-2.5" />
            {durationLabel}: {duration}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

interface TaskDetailSheetProps {
  taskId: number | null;
  onClose: () => void;
}

export function TaskDetailSheet({ taskId, onClose }: TaskDetailSheetProps) {
  const open = taskId !== null;

  // Fetch full task details
  const { data: task, isLoading: loadingTask } = useQuery({
    queryKey: ['task-detail', taskId],
    enabled: open && taskId !== null,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('breezeway_tasks')
        .select(`
          breezeway_id, name, ai_title, description, ai_description, ai_summary,
          ai_issues, ai_tags, ai_estimated_repair_cost, ai_follow_up_needed, ai_follow_up_reason,
          ai_worker_performance_note, ai_guest_impact, ai_complexity, ai_skill_category,
          ai_property_health_signal, property_name, home_id, reference_property_id,
          status_code, status_name, priority, created_at, scheduled_date, started_at,
          finished_at, response_time_minutes, work_duration_minutes, efficiency_ratio,
          requested_by, report_url, department
        `)
        .eq('breezeway_id', taskId!)
        .single();
      if (error) throw error;
      return data as FullTask;
    },
  });

  // Fetch assignments
  const { data: assignments } = useQuery({
    queryKey: ['task-assignments', taskId],
    enabled: open && taskId !== null,
    queryFn: async () => {
      const { data } = await supabase
        .from('breezeway_task_assignments')
        .select('task_id, assignee_id, assignee_name, status')
        .eq('task_id', taskId!);
      return (data ?? []) as Assignment[];
    },
  });

  // Fetch recent tasks at same property (when task.home_id is known)
  const homeId = task?.home_id;
  const { data: recentTasks } = useQuery({
    queryKey: ['task-property-recent', homeId],
    enabled: open && !!homeId,
    queryFn: async () => {
      const { data } = await supabase
        .from('breezeway_tasks')
        .select('breezeway_id, name, ai_title, status_code, created_at, priority')
        .eq('home_id', homeId!)
        .eq('department', 'maintenance')
        .neq('breezeway_id', taskId!)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(10);
      return (data ?? []) as RecentTask[];
    },
  });

  // Fetch property health
  const { data: propertyHealth } = useQuery({
    queryKey: ['task-property-health', task?.reference_property_id],
    enabled: open && !!task?.reference_property_id,
    queryFn: async () => {
      const { data } = await supabase
        .from('property_health_weekly' as any)
        .select('*')
        .eq('property_id', task!.reference_property_id!)
        .order('week_start', { ascending: false })
        .limit(4);
      return data ?? [];
    },
  });

  const aiIssues = parseAiIssues(task?.ai_issues);
  const breezewayUrl = taskId ? `https://app.breezeway.io/task/${taskId}` : null;
  const reportUrl = task?.report_url ?? null;

  // Duration calculations
  const responseMin = task?.response_time_minutes ??
    (task?.created_at && task?.started_at
      ? differenceInMinutes(parseISO(task.started_at), parseISO(task.created_at))
      : null);
  const workMin = task?.work_duration_minutes ??
    (task?.started_at && task?.finished_at
      ? differenceInMinutes(parseISO(task.finished_at), parseISO(task.started_at))
      : null);

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <SheetContent
        className="w-full sm:max-w-2xl p-0 flex flex-col overflow-hidden"
        side="right"
      >
        {/* ── HEADER ──────────────────────────────────────────────────────── */}
        {loadingTask ? (
          <div className="p-5 border-b border-border space-y-3">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        ) : task ? (
          <SheetHeader className="p-5 border-b border-border shrink-0">
            <div className="flex items-start gap-2 flex-wrap mb-1">
              {statusBadge(task.status_code)}
              {urgencyBadge(task)}
              {task.ai_skill_category && (
                <Badge variant="outline" className="text-[10px] capitalize">{task.ai_skill_category}</Badge>
              )}
            </div>
            <SheetTitle className="text-lg font-bold leading-tight text-left">
              {task.ai_title || task.name || 'Untitled Task'}
            </SheetTitle>
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 shrink-0" />
              {task.property_name || '—'}
            </p>

            {/* Timestamps row */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Created {task.created_at ? format(parseISO(task.created_at), 'MMM d, yyyy') : '—'}</span>
              {task.scheduled_date && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Scheduled {format(parseISO(task.scheduled_date), 'MMM d, yyyy')}</span>}
              {task.started_at && <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Started {format(parseISO(task.started_at), 'MMM d, h:mm a')}</span>}
              {task.finished_at && <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Finished {format(parseISO(task.finished_at), 'MMM d, h:mm a')}</span>}
            </div>

            {/* Links */}
            <div className="flex gap-3 mt-2">
              {breezewayUrl && (
                <a href={breezewayUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-primary font-medium hover:underline">
                  <ExternalLink className="h-3.5 w-3.5" /> Open in Breezeway
                </a>
              )}
              {reportUrl && (
                <a href={reportUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary font-medium hover:underline">
                  <ExternalLink className="h-3.5 w-3.5" /> Report
                </a>
              )}
            </div>
          </SheetHeader>
        ) : null}

        {/* ── TABS ────────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {loadingTask ? (
            <div className="p-5 space-y-4">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-4 w-full" />)}
            </div>
          ) : task ? (
            <Tabs defaultValue="overview" className="flex flex-col h-full">
              <div className="border-b border-border px-5 pt-1 shrink-0 bg-background sticky top-0 z-10">
                <TabsList className="h-9 bg-transparent gap-0 p-0 rounded-none">
                  {['overview', 'timeline', 'assignment', 'property'].map(tab => (
                    <TabsTrigger
                      key={tab}
                      value={tab}
                      className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none text-xs capitalize h-9 px-3"
                    >
                      {tab === 'property' ? 'Property' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              {/* ── TAB 1: OVERVIEW ─────────────────────────────────────── */}
              <TabsContent value="overview" className="p-5 space-y-5 mt-0 flex-1">
                {/* AI Summary */}
                {task.ai_summary && (
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                      <Zap className="h-3.5 w-3.5 text-primary" /> AI Summary
                    </h4>
                    <div className="glass-card p-3 text-sm text-foreground leading-relaxed bg-primary/5 border-primary/20">
                      {task.ai_summary}
                    </div>
                  </div>
                )}

                {/* Description */}
                {(task.ai_description || task.description) && (
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Description</h4>
                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                      {task.ai_description || task.description}
                    </p>
                  </div>
                )}

                {/* Issues */}
                {aiIssues.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-destructive" /> Issues Found ({aiIssues.length})
                    </h4>
                    <div className="space-y-2">
                      {aiIssues.map((issue, i) => (
                        <div key={i} className={`rounded-lg border p-3 ${severityColor(issue.severity)}`}>
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            {issue.severity && (
                              <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full border border-current">
                                {issue.severity}
                              </span>
                            )}
                            {issue.category && (
                              <span className="text-[10px] font-medium capitalize">{issue.category}</span>
                            )}
                            {issue.location && (
                              <span className="text-[10px] opacity-70">{issue.location}</span>
                            )}
                          </div>
                          {issue.title && <p className="text-sm font-semibold">{issue.title}</p>}
                          {issue.description && <p className="text-xs mt-0.5 opacity-80">{issue.description}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* AI Tags */}
                {task.ai_tags && task.ai_tags.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                      <Tag className="h-3.5 w-3.5" /> Tags
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {task.ai_tags.map(tag => (
                        <span key={tag} className="text-[11px] px-2 py-0.5 rounded-full bg-accent text-accent-foreground border border-border font-medium">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Cost + Follow-up */}
                <div className="grid grid-cols-2 gap-3">
                  {task.ai_estimated_repair_cost != null && (
                    <div className="glass-card p-3">
                      <p className="text-[11px] text-muted-foreground font-medium flex items-center gap-1 mb-1">
                        <DollarSign className="h-3 w-3" /> Est. Repair Cost
                      </p>
                      <p className="text-lg font-bold text-foreground">
                        ${task.ai_estimated_repair_cost.toLocaleString()}
                      </p>
                    </div>
                  )}
                  {task.ai_complexity && (
                    <div className="glass-card p-3">
                      <p className="text-[11px] text-muted-foreground font-medium mb-1">Complexity</p>
                      <p className="text-sm font-semibold capitalize text-foreground">{task.ai_complexity}</p>
                    </div>
                  )}
                </div>

                {/* Follow-up */}
                {task.ai_follow_up_needed && (
                  <div className="rounded-lg border border-[hsl(var(--warning)/0.4)] bg-[hsl(var(--warning)/0.08)] p-3">
                    <p className="text-xs font-bold text-[hsl(var(--warning))] flex items-center gap-1.5 mb-1">
                      <AlertTriangle className="h-3.5 w-3.5" /> Follow-up Required
                    </p>
                    <p className="text-sm text-foreground">{task.ai_follow_up_reason || 'Follow-up needed — check with tech.'}</p>
                  </div>
                )}
              </TabsContent>

              {/* ── TAB 2: TIMELINE ─────────────────────────────────────── */}
              <TabsContent value="timeline" className="p-5 mt-0">
                <div className="space-y-0">
                  <TimelineStep
                    label="Task Created"
                    timestamp={task.created_at}
                    done={!!task.created_at}
                  />
                  <TimelineStep
                    label="Assigned to Tech"
                    timestamp={assignments && assignments.length > 0 ? task.created_at : null}
                    done={!!assignments?.length}
                  />
                  <TimelineStep
                    label="Work Started"
                    timestamp={task.started_at}
                    done={!!task.started_at}
                    duration={fmtDuration(responseMin)}
                    durationLabel="Response time"
                    highlight
                  />
                  <TimelineStep
                    label="Work Completed"
                    timestamp={task.finished_at}
                    done={!!task.finished_at}
                    duration={fmtDuration(workMin)}
                    durationLabel="Work duration"
                    highlight
                    isLast
                  />
                </div>

                {/* Duration summary */}
                {(responseMin || workMin) && (
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    {responseMin != null && (
                      <div className="glass-card p-3 text-center">
                        <p className="text-xl font-bold text-primary">{fmtDuration(responseMin)}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Response Time</p>
                        <p className="text-[10px] text-muted-foreground">Created → Started</p>
                      </div>
                    )}
                    {workMin != null && (
                      <div className="glass-card p-3 text-center">
                        <p className="text-xl font-bold text-[hsl(var(--success))]">{fmtDuration(workMin)}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Work Duration</p>
                        <p className="text-[10px] text-muted-foreground">Started → Finished</p>
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>

              {/* ── TAB 3: ASSIGNMENT ───────────────────────────────────── */}
              <TabsContent value="assignment" className="p-5 space-y-5 mt-0">
                {/* Assigned techs */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5" /> Assigned Technician(s)
                  </h4>
                  {!assignments || assignments.length === 0 ? (
                    <div className="glass-card p-4 text-center">
                      <p className="text-sm text-muted-foreground">⚠ No technician assigned yet</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {assignments.map(a => (
                        <div key={a.assignee_id} className="glass-card p-3 flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full gradient-accent flex items-center justify-center shrink-0">
                            <User className="h-4 w-4 text-primary-foreground" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground">{a.assignee_name}</p>
                            {a.status && <p className="text-[11px] text-muted-foreground capitalize">{a.status}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Performance metrics */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="glass-card p-3 text-center">
                    <p className="text-lg font-bold text-foreground">{fmtDuration(task.response_time_minutes)}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Response Time</p>
                  </div>
                  <div className="glass-card p-3 text-center">
                    <p className="text-lg font-bold text-foreground">{fmtDuration(task.work_duration_minutes)}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Work Duration</p>
                  </div>
                  <div className="glass-card p-3 text-center">
                    <p className="text-lg font-bold text-foreground">
                      {task.efficiency_ratio != null ? `${Math.round(task.efficiency_ratio * 100)}%` : '—'}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Efficiency</p>
                  </div>
                </div>

                {/* Worker performance note */}
                {task.ai_worker_performance_note && (
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                      <Activity className="h-3.5 w-3.5" /> AI Performance Note
                    </h4>
                    <div className="glass-card p-3 text-sm text-foreground leading-relaxed italic">
                      "{task.ai_worker_performance_note}"
                    </div>
                  </div>
                )}

                {/* Requested by */}
                {task.requested_by && (
                  <div className="glass-card p-3">
                    <p className="text-[11px] text-muted-foreground font-medium mb-0.5">Requested By</p>
                    <p className="text-sm font-semibold text-foreground">{task.requested_by}</p>
                  </div>
                )}
              </TabsContent>

              {/* ── TAB 4: PROPERTY CONTEXT ─────────────────────────────── */}
              <TabsContent value="property" className="p-5 space-y-5 mt-0">
                {/* Health signal */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5" /> Property Health Signal
                  </h4>
                  {task.ai_property_health_signal ? (
                    <div className={`glass-card p-3 flex items-center gap-3
                      ${task.ai_property_health_signal === 'declining' ? 'border-destructive/30 bg-destructive/5' :
                        task.ai_property_health_signal === 'watch' ? 'border-[hsl(var(--warning)/0.3)] bg-[hsl(var(--warning)/0.05)]' :
                        'border-[hsl(var(--success)/0.3)] bg-[hsl(var(--success)/0.05)]'}`}>
                      <div className={`h-3 w-3 rounded-full shrink-0
                        ${task.ai_property_health_signal === 'declining' ? 'bg-destructive' :
                          task.ai_property_health_signal === 'watch' ? 'bg-[hsl(var(--warning))]' :
                          'bg-[hsl(var(--success))]'}`} />
                      <p className="text-sm font-semibold capitalize text-foreground">{task.ai_property_health_signal}</p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No health signal available</p>
                  )}
                </div>

                {/* Weekly health trend from mat view */}
                {propertyHealth && propertyHealth.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Weekly History</h4>
                    <div className="space-y-2">
                      {(propertyHealth as any[]).map((row: any, i: number) => (
                        <div key={i} className="glass-card p-2.5 flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">
                            {row.week_start ? format(parseISO(row.week_start), 'MMM d') : `Week ${i + 1}`}
                          </span>
                          <div className="flex items-center gap-3">
                            {row.total_maintenance_tasks != null && (
                              <span className="text-xs"><span className="font-semibold">{row.total_maintenance_tasks}</span> tasks</span>
                            )}
                            {row.health_signal && (
                              <span className={`text-[10px] font-semibold capitalize px-1.5 py-0.5 rounded-full
                                ${row.health_signal === 'declining' ? 'bg-destructive/15 text-destructive' :
                                  row.health_signal === 'watch' ? 'bg-[hsl(var(--warning)/0.15)] text-[hsl(var(--warning))]' :
                                  'bg-[hsl(var(--success)/0.15)] text-[hsl(var(--success))]'}`}>
                                {row.health_signal}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent tasks at this property */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" /> Other Maintenance Last 30 Days
                  </h4>
                  {!recentTasks || recentTasks.length === 0 ? (
                    <p className="text-sm text-muted-foreground glass-card p-3 text-center">No other maintenance tasks in the last 30 days ✓</p>
                  ) : (
                    <div className="space-y-1.5">
                      {recentTasks.map(rt => (
                        <div key={rt.breezeway_id} className="glass-card p-2.5 flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-foreground truncate">{rt.ai_title || rt.name || 'Untitled'}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {rt.created_at ? format(parseISO(rt.created_at), 'MMM d') : '—'}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {rt.priority === 'urgent' || rt.priority === 'high' ? (
                              <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                            ) : null}
                            <span className={`text-[9px] font-medium capitalize px-1.5 py-0.5 rounded-full
                              ${rt.status_code === 'finished' ? 'bg-[hsl(var(--success)/0.15)] text-[hsl(var(--success))]' :
                                rt.status_code === 'in_progress' ? 'bg-[hsl(212,72%,59%)/0.15] text-[hsl(212,72%,59%)]' :
                                'bg-muted text-muted-foreground'}`}>
                              {rt.status_code === 'in_progress' ? 'Active' :
                               rt.status_code === 'finished' ? 'Done' : rt.status_code ?? '—'}
                            </span>
                          </div>
                        </div>
                      ))}
                      <p className="text-[10px] text-muted-foreground text-right pt-1">
                        {recentTasks.length} tasks in last 30 days
                        {recentTasks.filter(t => t.status_code !== 'finished').length > 0 &&
                          ` · ${recentTasks.filter(t => t.status_code !== 'finished').length} still open`}
                      </p>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

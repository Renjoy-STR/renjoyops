import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { TaskDetailSheet } from '@/components/maintenance/TaskDetailSheet';
import {
  Building2, User, Clock, CheckCircle2, AlertTriangle,
  Copy, Ghost, Flame, Activity,
} from 'lucide-react';
import { format, parseISO, isValid, formatDistanceToNow } from 'date-fns';

// ─── Types ───────────────────────────────────────────────────────────────────

interface PropertyTask {
  breezeway_id: number;
  task_name: string | null;
  status_name: string | null;
  status_stage: string | null;
  created_date: string | null;
  started_date: string | null;
  finished_date: string | null;
  assigned_to: string | null;
  age_days: number;
  ai_summary: string | null;
  ai_urgency: string | null;
  ai_skill_category: string | null;
  ai_guest_impact: string | null;
  ai_property_health: string | null;
  is_duplicate: boolean;
  is_ghost: boolean;
  priority: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ageColor(days: number) {
  if (days > 90) return 'text-destructive font-semibold';
  if (days > 30) return 'text-destructive';
  if (days > 14) return 'text-orange-500';
  return 'text-muted-foreground';
}

function statusBadge(stage: string | null, name: string | null) {
  const s = (stage ?? '').toLowerCase();
  if (s === 'in_progress' || name?.toLowerCase().includes('in progress')) {
    return (
      <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-[10px] px-1.5">
        In Progress
      </Badge>
    );
  }
  if (s === 'finished' || s === 'closed') {
    return (
      <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px] px-1.5">
        {name ?? 'Done'}
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="text-[10px] px-1.5">
      {name ?? stage ?? '—'}
    </Badge>
  );
}

function timelineColor(task: PropertyTask) {
  const isOpen = task.status_stage === 'new' || task.status_stage === 'in_progress';
  if (!isOpen) return 'bg-green-500'; // completed
  if (task.status_stage === 'in_progress') return 'bg-blue-500';
  if (task.age_days > 7) return 'bg-destructive'; // overdue open
  return 'bg-orange-400'; // created / open
}

function fmtDate(d: string | null) {
  if (!d) return '—';
  try {
    const parsed = parseISO(d);
    return isValid(parsed) ? format(parsed, 'MMM d, yyyy') : '—';
  } catch {
    return '—';
  }
}

function fmtRelative(d: string | null) {
  if (!d) return '—';
  try {
    const parsed = parseISO(d);
    return isValid(parsed) ? formatDistanceToNow(parsed, { addSuffix: true }) : '—';
  } catch {
    return '—';
  }
}

// ─── Task Card ────────────────────────────────────────────────────────────────

function TaskCard({
  task,
  onOpenTask,
}: {
  task: PropertyTask;
  onOpenTask: (id: number) => void;
}) {
  const hasGuest = task.ai_guest_impact && task.ai_guest_impact !== 'false' && task.ai_guest_impact !== 'null';

  return (
    <div
      className="rounded-lg border bg-card p-3 cursor-pointer hover:border-primary/40 hover:bg-accent/20 transition-colors space-y-2"
      onClick={() => onOpenTask(task.breezeway_id)}
    >
      {/* Row 1: status + flags */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {statusBadge(task.status_stage, task.status_name)}
        {task.is_duplicate && (
          <Badge className="bg-orange-100 text-orange-700 border-orange-200 text-[10px] px-1.5 gap-0.5">
            <Copy className="h-2.5 w-2.5" />
            Duplicate
          </Badge>
        )}
        {task.is_ghost && (
          <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-[10px] px-1.5 gap-0.5"
            title="Same task was already completed on a newer ticket">
            <Ghost className="h-2.5 w-2.5" />
            Ghost
          </Badge>
        )}
        {task.age_days > 90 && (
          <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px] px-1.5 gap-0.5">
            <Flame className="h-2.5 w-2.5" />
            Stale
          </Badge>
        )}
        {hasGuest && (
          <Badge variant="destructive" className="text-[10px] px-1.5">
            Guest Impact
          </Badge>
        )}
      </div>

      {/* Row 2: task name */}
      <p className="text-sm font-semibold text-foreground leading-snug">
        {task.task_name || 'Untitled Task'}
      </p>

      {/* Row 3: AI summary */}
      {task.ai_summary && (
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
          {task.ai_summary}
        </p>
      )}

      {/* Row 4: meta */}
      <div className="flex items-center gap-3 text-xs flex-wrap">
        {/* Age */}
        <span className={ageColor(task.age_days)}>
          <Clock className="h-3 w-3 inline mr-0.5" />
          {task.age_days === 0 ? 'Today' : `${task.age_days}d old`}
        </span>

        {/* Assignee */}
        {task.assigned_to ? (
          <span className="flex items-center gap-0.5 text-muted-foreground">
            <User className="h-3 w-3" />
            {task.assigned_to}
          </span>
        ) : (
          <span className="text-destructive font-medium flex items-center gap-0.5">
            <User className="h-3 w-3" />
            Unassigned
          </span>
        )}

        {/* Skill category */}
        {task.ai_skill_category && (
          <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 capitalize">
            {task.ai_skill_category}
          </Badge>
        )}
      </div>
    </div>
  );
}

// ─── Health Timeline ──────────────────────────────────────────────────────────

function HealthTimeline({ tasks }: { tasks: PropertyTask[] }) {
  // Show last 90 days, sorted oldest-first
  const sorted = useMemo(() => {
    return [...tasks]
      .filter((t) => {
        const ref = t.status_stage === 'finished' ? t.finished_date : t.created_date;
        if (!ref) return false;
        try {
          const d = parseISO(ref);
          const ago90 = new Date();
          ago90.setDate(ago90.getDate() - 90);
          return isValid(d) && d >= ago90;
        } catch {
          return false;
        }
      })
      .sort((a, b) => {
        const aRef = a.created_date ?? '';
        const bRef = b.created_date ?? '';
        return aRef < bRef ? -1 : 1;
      });
  }, [tasks]);

  if (sorted.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        No tasks in the last 90 days
      </p>
    );
  }

  return (
    <div className="relative pl-5 space-y-3">
      {/* Vertical line */}
      <div className="absolute left-2 top-1 bottom-1 w-px bg-border" />

      {sorted.map((task) => {
        const isOpen = task.status_stage === 'new' || task.status_stage === 'in_progress';
        const isOverdue = isOpen && task.age_days > 7;
        const dateRef = task.status_stage === 'finished' ? task.finished_date : task.created_date;

        return (
          <div key={task.breezeway_id} className="relative flex items-start gap-3">
            {/* Dot */}
            <div
              className={`absolute -left-3.5 top-1 h-3 w-3 rounded-full border-2 border-background ${timelineColor(task)}`}
            />

            <div className="min-w-0 flex-1 rounded-lg border bg-card/50 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-foreground truncate">
                  {task.task_name || 'Untitled'}
                </p>
                <span className="text-[10px] text-muted-foreground shrink-0 whitespace-nowrap">
                  {fmtDate(dateRef)}
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                {!isOpen && (
                  <span className="text-[10px] text-green-600 font-medium flex items-center gap-0.5">
                    <CheckCircle2 className="h-2.5 w-2.5" /> Done
                  </span>
                )}
                {task.status_stage === 'in_progress' && (
                  <span className="text-[10px] text-blue-600 font-medium">In Progress</span>
                )}
                {task.status_stage === 'new' && (
                  <span className={`text-[10px] font-medium ${isOverdue ? 'text-destructive' : 'text-orange-500'}`}>
                    {isOverdue ? 'Overdue' : 'Open'}
                  </span>
                )}
                {task.ai_skill_category && (
                  <span className="text-[9px] text-muted-foreground px-1 rounded bg-muted capitalize">
                    {task.ai_skill_category}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface PropertyDetailSheetProps {
  propertyName: string | null;
  onClose: () => void;
}

export function PropertyDetailSheet({ propertyName, onClose }: PropertyDetailSheetProps) {
  const [openTaskId, setOpenTaskId] = useState<number | null>(null);

  const open = !!propertyName;

  const { data: tasks = [], isLoading } = useQuery<PropertyTask[]>({
    queryKey: ['property-tasks', propertyName],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_property_tasks' as any, {
        p_property: propertyName,
      });
      if (error) throw error;
      return (data ?? []) as PropertyTask[];
    },
    staleTime: 2 * 60 * 1000,
  });

  // Derived sets
  const openTasks = useMemo(
    () => tasks.filter((t) => t.status_stage === 'new' || t.status_stage === 'in_progress'),
    [tasks],
  );
  const completedTasks = useMemo(
    () =>
      tasks
        .filter((t) => t.status_stage === 'finished' || t.status_stage === 'closed')
        .sort((a, b) => (b.finished_date ?? '') > (a.finished_date ?? '') ? 1 : -1),
    [tasks],
  );

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
        <SheetContent side="right" className="w-[540px] max-w-full flex flex-col p-0 overflow-hidden">
          {/* Header */}
          <SheetHeader className="px-5 pt-5 pb-3 border-b shrink-0">
            <SheetTitle className="flex items-center gap-2 text-lg">
              <Building2 className="h-5 w-5 text-primary shrink-0" />
              <span className="truncate">{propertyName}</span>
            </SheetTitle>
            {/* Summary stats */}
            {!isLoading && (
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                <span className={openTasks.length > 10 ? 'text-destructive font-semibold' : ''}>
                  <span className="font-semibold text-foreground">{openTasks.length}</span> open
                </span>
                <span>·</span>
                <span>
                  <span className="font-semibold text-foreground">
                    {openTasks.filter((t) => t.status_stage === 'in_progress').length}
                  </span>{' '}
                  in progress
                </span>
                <span>·</span>
                <span>
                  <span className="font-semibold text-foreground">{completedTasks.length}</span>{' '}
                  completed
                </span>
                {tasks.some((t) => t.is_duplicate) && (
                  <>
                    <span>·</span>
                    <span className="text-orange-600 font-semibold">
                      {tasks.filter((t) => t.is_duplicate).length} dupes
                    </span>
                  </>
                )}
                {tasks.some((t) => t.is_ghost) && (
                  <>
                    <span>·</span>
                    <span className="text-purple-600 font-semibold">
                      {tasks.filter((t) => t.is_ghost).length} ghosts
                    </span>
                  </>
                )}
              </div>
            )}
          </SheetHeader>

          {/* Content */}
          <div className="flex-1 overflow-hidden">
            {isLoading ? (
              <div className="p-5 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-lg" />
                ))}
              </div>
            ) : (
              <Tabs defaultValue="open" className="flex flex-col h-full">
                <TabsList className="mx-5 mt-3 shrink-0 w-auto self-start">
                  <TabsTrigger value="open" className="text-xs">
                    Open
                    {openTasks.length > 0 && (
                      <Badge
                        variant="default"
                        className="ml-1.5 text-[9px] px-1 py-0 h-3.5"
                      >
                        {openTasks.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="completed" className="text-xs">
                    Completed
                    {completedTasks.length > 0 && (
                      <Badge
                        variant="secondary"
                        className="ml-1.5 text-[9px] px-1 py-0 h-3.5"
                      >
                        {completedTasks.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="timeline" className="text-xs">
                    <Activity className="h-3 w-3 mr-1" />
                    Timeline
                  </TabsTrigger>
                </TabsList>

                {/* ── OPEN TASKS ─────────────────────────────────────────── */}
                <TabsContent value="open" className="flex-1 overflow-y-auto px-5 pb-5 mt-3 space-y-2">
                  {openTasks.length === 0 ? (
                    <div className="text-center py-12 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
                      No open tasks — all clear!
                    </div>
                  ) : (
                    openTasks.map((task) => (
                      <TaskCard
                        key={task.breezeway_id}
                        task={task}
                        onOpenTask={(id) => setOpenTaskId(id)}
                      />
                    ))
                  )}
                </TabsContent>

                {/* ── COMPLETED ──────────────────────────────────────────── */}
                <TabsContent value="completed" className="flex-1 overflow-y-auto px-5 pb-5 mt-3 space-y-2">
                  {completedTasks.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-12">
                      No completed tasks to show.
                    </p>
                  ) : (
                    completedTasks.map((task) => (
                      <div
                        key={task.breezeway_id}
                        className="rounded-lg border bg-card/60 px-3 py-2.5 cursor-pointer hover:border-primary/30 hover:bg-accent/20 transition-colors"
                        onClick={() => setOpenTaskId(task.breezeway_id)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground truncate">
                              {task.task_name || 'Untitled'}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                              <span>{fmtRelative(task.finished_date)}</span>
                              {task.assigned_to && (
                                <>
                                  <span>·</span>
                                  <span className="flex items-center gap-0.5">
                                    <User className="h-3 w-3" />
                                    {task.assigned_to}
                                  </span>
                                </>
                              )}
                              {task.ai_skill_category && (
                                <>
                                  <span>·</span>
                                  <span className="capitalize">{task.ai_skill_category}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                        </div>
                      </div>
                    ))
                  )}
                </TabsContent>

                {/* ── HEALTH TIMELINE ────────────────────────────────────── */}
                <TabsContent value="timeline" className="flex-1 overflow-y-auto px-5 pb-5 mt-3">
                  <div className="flex items-center gap-3 mb-4 flex-wrap text-[10px]">
                    {[
                      { color: 'bg-green-500', label: 'Completed' },
                      { color: 'bg-blue-500', label: 'In Progress' },
                      { color: 'bg-orange-400', label: 'Open' },
                      { color: 'bg-destructive', label: 'Overdue' },
                    ].map(({ color, label }) => (
                      <span key={label} className="flex items-center gap-1 text-muted-foreground">
                        <span className={`h-2 w-2 rounded-full ${color}`} />
                        {label}
                      </span>
                    ))}
                  </div>
                  <HealthTimeline tasks={tasks} />
                </TabsContent>
              </Tabs>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Nested TaskDetailSheet */}
      <TaskDetailSheet
        taskId={openTaskId}
        onClose={() => setOpenTaskId(null)}
      />
    </>
  );
}

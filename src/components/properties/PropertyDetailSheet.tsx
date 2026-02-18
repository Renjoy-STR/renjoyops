import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

type TaskFilter = 'all' | 'duplicates' | 'ghosts' | 'stale' | 'unassigned';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ageColor(days: number) {
  if (days > 90) return 'text-destructive font-semibold';
  if (days > 30) return 'text-destructive';
  if (days > 14) return 'text-orange-500';
  return 'text-muted-foreground';
}

function cardBorderColor(task: PropertyTask) {
  const isOpen = task.status_stage === 'new' || task.status_stage === 'in_progress';
  if (!isOpen) return 'border-l-border';
  if (task.status_stage === 'in_progress') return 'border-l-blue-500';
  if (task.age_days > 7) return 'border-l-destructive';
  return 'border-l-orange-400';
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

function timelineDotColor(task: PropertyTask) {
  const isOpen = task.status_stage === 'new' || task.status_stage === 'in_progress';
  if (!isOpen) return 'bg-green-500';
  if (task.status_stage === 'in_progress') return 'bg-blue-500';
  if (task.age_days > 7) return 'bg-destructive';
  return 'bg-orange-400';
}

function fmtDate(d: string | null) {
  if (!d) return '—';
  try {
    const parsed = parseISO(d);
    return isValid(parsed) ? format(parsed, 'MMM d, yyyy') : '—';
  } catch { return '—'; }
}

function fmtRelative(d: string | null) {
  if (!d) return '—';
  try {
    const parsed = parseISO(d);
    return isValid(parsed) ? formatDistanceToNow(parsed, { addSuffix: true }) : '—';
  } catch { return '—'; }
}

// ─── Stat Card ───────────────────────────────────────────────────────────────

function StatCard({
  label, value, color,
}: { label: string; value: number; color: string }) {
  return (
    <div className={`rounded-lg border px-3 py-2 text-center min-w-[72px] ${color}`}>
      <p className="text-xl font-bold leading-none">{value}</p>
      <p className="text-[10px] mt-0.5 font-medium opacity-80">{label}</p>
    </div>
  );
}

// ─── Task Card ────────────────────────────────────────────────────────────────

function TaskCard({ task, onOpenTask }: { task: PropertyTask; onOpenTask: (id: number) => void }) {
  const hasGuest = task.ai_guest_impact && task.ai_guest_impact !== 'false' && task.ai_guest_impact !== 'null';

  return (
    <div
      className={`rounded-lg border-l-4 border border-border bg-card p-3.5 cursor-pointer hover:border-primary/40 hover:bg-accent/20 transition-colors ${cardBorderColor(task)}`}
      onClick={() => onOpenTask(task.breezeway_id)}
    >
      {/* Row 1: name + badges right-aligned */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p className="text-base font-medium text-foreground leading-snug flex-1">
          {task.task_name || 'Untitled Task'}
        </p>
        <div className="flex items-center gap-1 flex-wrap justify-end shrink-0">
          {statusBadge(task.status_stage, task.status_name)}
          {task.is_duplicate && (
            <Badge className="bg-orange-100 text-orange-700 border-orange-200 text-[10px] px-1.5 gap-0.5">
              <Copy className="h-2.5 w-2.5" />Dup
            </Badge>
          )}
          {task.is_ghost && (
            <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-[10px] px-1.5 gap-0.5"
              title="Same task was already completed on a newer ticket">
              <Ghost className="h-2.5 w-2.5" />Ghost
            </Badge>
          )}
          {task.age_days > 90 && (
            <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px] px-1.5 gap-0.5">
              <Flame className="h-2.5 w-2.5" />Stale
            </Badge>
          )}
          {hasGuest && (
            <Badge variant="destructive" className="text-[10px] px-1.5">Impact</Badge>
          )}
        </div>
      </div>

      {/* AI summary */}
      {task.ai_summary && (
        <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed mb-2">
          {task.ai_summary}
        </p>
      )}

      {/* Bottom row: meta */}
      <div className="flex items-center gap-3 text-xs flex-wrap">
        <span className={ageColor(task.age_days)}>
          <Clock className="h-3 w-3 inline mr-0.5" />
          {task.age_days === 0 ? 'Today' : `${task.age_days}d old`}
        </span>
        {task.assigned_to ? (
          <span className="flex items-center gap-0.5 text-muted-foreground">
            <User className="h-3 w-3" />{task.assigned_to}
          </span>
        ) : (
          <span className="text-destructive font-medium flex items-center gap-0.5">
            <User className="h-3 w-3" />Unassigned
          </span>
        )}
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

function HealthTimeline({
  tasks,
  onOpenTask,
}: { tasks: PropertyTask[]; onOpenTask: (id: number) => void }) {
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
        } catch { return false; }
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

  let lastMonth = '';

  return (
    <div className="relative pl-6 space-y-0">
      {/* Vertical line */}
      <div className="absolute left-2.5 top-1 bottom-1 w-px bg-border" />

      {sorted.map((task) => {
        const isOpen = task.status_stage === 'new' || task.status_stage === 'in_progress';
        const isOverdue = isOpen && task.age_days > 7;
        const dateRef = task.status_stage === 'finished' ? task.finished_date : task.created_date;
        const month = dateRef ? format(parseISO(dateRef), 'MMM yyyy') : '';
        const showMonth = month !== lastMonth;
        lastMonth = month;

        return (
          <div key={task.breezeway_id}>
            {showMonth && (
              <div className="relative ml-2 mb-1 mt-3 first:mt-0">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {month}
                </span>
              </div>
            )}
            <div
              className="relative flex items-start gap-3 py-1.5 cursor-pointer group"
              onClick={() => onOpenTask(task.breezeway_id)}
            >
              {/* Dot */}
              <div
                className={`absolute -left-3.5 top-2.5 h-3 w-3 rounded-full border-2 border-background shrink-0 ${timelineDotColor(task)}`}
              />
              <div className="min-w-0 flex-1 rounded-lg border bg-card/50 px-3 py-2 group-hover:border-primary/30 group-hover:bg-accent/20 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-foreground leading-snug line-clamp-2 flex-1">
                    {task.task_name || 'Untitled'}
                  </p>
                  <span className="text-[10px] text-muted-foreground shrink-0 whitespace-nowrap mt-0.5">
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
                  {task.assigned_to && (
                    <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                      <User className="h-2.5 w-2.5" />{task.assigned_to}
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
  const [taskFilter, setTaskFilter] = useState<TaskFilter>('all');

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

  // Filtered open tasks based on pill selection
  const filteredOpenTasks = useMemo(() => {
    switch (taskFilter) {
      case 'duplicates': return openTasks.filter((t) => t.is_duplicate);
      case 'ghosts': return openTasks.filter((t) => t.is_ghost);
      case 'stale': return openTasks.filter((t) => t.age_days > 90);
      case 'unassigned': return openTasks.filter((t) => !t.assigned_to);
      default: return openTasks;
    }
  }, [openTasks, taskFilter]);

  const dupCount = openTasks.filter((t) => t.is_duplicate).length;
  const ghostCount = openTasks.filter((t) => t.is_ghost).length;
  const staleCount = openTasks.filter((t) => t.age_days > 90).length;
  const unassignedCount = openTasks.filter((t) => !t.assigned_to).length;

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => { if (!o) { onClose(); setTaskFilter('all'); } }}>
        <SheetContent
          side="right"
          className="w-[600px] max-w-full flex flex-col p-0 overflow-hidden"
        >
          {/* Header */}
          <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
            <SheetTitle className="flex items-center gap-2 text-2xl font-bold">
              <Building2 className="h-6 w-6 text-primary shrink-0" />
              <span className="truncate">{propertyName}</span>
            </SheetTitle>

            {/* Stat cards */}
            {!isLoading && (
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <StatCard
                  label="Open"
                  value={openTasks.length}
                  color={openTasks.length > 10
                    ? 'border-destructive/30 bg-destructive/10 text-destructive'
                    : openTasks.length > 5
                      ? 'border-orange-200 bg-orange-50 text-orange-700'
                      : 'border-border bg-card text-foreground'}
                />
                <StatCard
                  label="In Progress"
                  value={openTasks.filter((t) => t.status_stage === 'in_progress').length}
                  color="border-blue-200 bg-blue-50 text-blue-700"
                />
                <StatCard
                  label="Done (30d)"
                  value={completedTasks.length}
                  color="border-green-200 bg-green-50 text-green-700"
                />
                {dupCount > 0 && (
                  <StatCard
                    label="Dupes"
                    value={dupCount}
                    color="border-orange-200 bg-orange-50 text-orange-700"
                  />
                )}
                {ghostCount > 0 && (
                  <StatCard
                    label="Ghosts"
                    value={ghostCount}
                    color="border-purple-200 bg-purple-50 text-purple-700"
                  />
                )}
              </div>
            )}
          </SheetHeader>

          {/* Content */}
          <div className="flex-1 overflow-hidden">
            {isLoading ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full rounded-lg" />
                ))}
              </div>
            ) : (
              <Tabs defaultValue="open" className="flex flex-col h-full">
                <TabsList className="mx-6 mt-3 shrink-0 w-auto self-start">
                  <TabsTrigger value="open" className="text-xs">
                    Open
                    {openTasks.length > 0 && (
                      <Badge variant="default" className="ml-1.5 text-[9px] px-1 py-0 h-3.5">
                        {openTasks.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="completed" className="text-xs">
                    Completed
                    {completedTasks.length > 0 && (
                      <Badge variant="secondary" className="ml-1.5 text-[9px] px-1 py-0 h-3.5">
                        {completedTasks.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="timeline" className="text-xs">
                    <Activity className="h-3 w-3 mr-1" />Timeline
                  </TabsTrigger>
                </TabsList>

                {/* ── OPEN TASKS ─────────────────────────────────────────── */}
                <TabsContent value="open" className="flex-1 overflow-y-auto px-6 pb-6 mt-3 space-y-2">
                  {/* Filter pills */}
                  {openTasks.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap pb-1">
                      {[
                        { key: 'all' as TaskFilter, label: 'All', count: openTasks.length, color: '' },
                        { key: 'duplicates' as TaskFilter, label: 'Duplicates', count: dupCount, color: 'text-orange-700 border-orange-200 bg-orange-50' },
                        { key: 'ghosts' as TaskFilter, label: 'Ghosts', count: ghostCount, color: 'text-purple-700 border-purple-200 bg-purple-50' },
                        { key: 'stale' as TaskFilter, label: 'Stale', count: staleCount, color: 'text-destructive border-destructive/20 bg-destructive/5' },
                        { key: 'unassigned' as TaskFilter, label: 'Unassigned', count: unassignedCount, color: 'text-yellow-700 border-yellow-200 bg-yellow-50' },
                      ]
                        .filter(f => f.key === 'all' || f.count > 0)
                        .map(({ key, label, count, color }) => (
                          <button
                            key={key}
                            onClick={() => setTaskFilter(key)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors
                              ${taskFilter === key
                                ? 'bg-primary text-primary-foreground border-primary'
                                : `${color || 'border-border bg-muted text-muted-foreground'} hover:opacity-80`
                              }`}
                          >
                            {label}
                            {key !== 'all' && <span className="opacity-70">({count})</span>}
                          </button>
                        ))}
                    </div>
                  )}

                  {filteredOpenTasks.length === 0 ? (
                    <div className="text-center py-12 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
                      {taskFilter === 'all' ? 'No open tasks — all clear!' : `No ${taskFilter} tasks.`}
                    </div>
                  ) : (
                    filteredOpenTasks.map((task) => (
                      <TaskCard
                        key={task.breezeway_id}
                        task={task}
                        onOpenTask={(id) => setOpenTaskId(id)}
                      />
                    ))
                  )}
                </TabsContent>

                {/* ── COMPLETED ──────────────────────────────────────────── */}
                <TabsContent value="completed" className="flex-1 overflow-y-auto px-6 pb-6 mt-3 space-y-2">
                  {completedTasks.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-12">
                      No completed tasks to show.
                    </p>
                  ) : (
                    completedTasks.map((task) => (
                      <div
                        key={task.breezeway_id}
                        className="rounded-lg border bg-card/60 px-3.5 py-3 cursor-pointer hover:border-primary/30 hover:bg-accent/20 transition-colors"
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
                                    <User className="h-3 w-3" />{task.assigned_to}
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
                <TabsContent value="timeline" className="flex-1 overflow-y-auto px-6 pb-6 mt-3">
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
                    <span className="text-muted-foreground ml-1">— Click any item to view details</span>
                  </div>
                  <HealthTimeline tasks={tasks} onOpenTask={(id) => setOpenTaskId(id)} />
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

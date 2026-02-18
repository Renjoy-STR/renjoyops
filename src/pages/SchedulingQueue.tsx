import { useState, useMemo } from 'react';
import { TaskDetailSheet } from '@/components/maintenance/TaskDetailSheet';
import { PropertyDetailSheet } from '@/components/properties/PropertyDetailSheet';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  UserX,
  CalendarX,
  AlertTriangle,
  ExternalLink,
  ArrowUp,
  ArrowDown,
  ChevronsUpDown,
  Search,
  Clock,
  Flame,
} from 'lucide-react';
import {
  differenceInDays,
  format,
  formatDistanceToNow,
  parseISO,
} from 'date-fns';

// ─── Types ─────────────────────────────────────────────────────────────────

interface RawTask {
  breezeway_id: number;
  name: string | null;
  ai_title: string | null;
  ai_description: string | null;
  description: string | null;
  property_name: string | null;
  status_code: string | null;
  priority: string | null;
  ai_guest_impact: boolean | null;
  ai_skill_category: string | null;
  scheduled_date: string | null;
  created_at: string | null;
  requested_by: string | null;
  report_url: string | null;
  // assignments come from join
  hasAssignment?: boolean;
}

type SortField = 'urgency' | 'priority' | 'property_name' | 'created_at' | 'days_old';
type SortDir = 'asc' | 'desc';

// ─── Constants ──────────────────────────────────────────────────────────────

const URGENCY_ORDER: Record<string, number> = {
  'guest-impacting': 0,
  urgent: 1,
  elevated: 2,
  routine: 3,
};

const PRIORITY_ORDER: Record<string, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
  '': 4,
};

const SKILL_CATEGORIES = [
  'all',
  'plumbing',
  'electrical',
  'hvac',
  'locks',
  'pest',
  'appliance',
  'general',
  'landscaping',
  'pool',
  'structural',
  'cleaning',
  'inspection',
];

// ─── Helpers ───────────────────────────────────────────────────────────────

function derivedUrgency(task: RawTask): string {
  if (task.ai_guest_impact) return 'guest-impacting';
  if (task.priority === 'urgent') return 'urgent';
  if (task.priority === 'high') return 'elevated';
  return 'routine';
}

function urgencyBadge(urgency: string) {
  switch (urgency) {
    case 'guest-impacting':
      return (
        <Badge variant="destructive" className="text-[9px] px-1.5 py-0 h-4 whitespace-nowrap">
          Guest Impact
        </Badge>
      );
    case 'urgent':
      return (
        <Badge variant="destructive" className="text-[9px] px-1.5 py-0 h-4">
          Urgent
        </Badge>
      );
    case 'elevated':
      return (
        <Badge className="text-[9px] px-1.5 py-0 h-4 bg-[hsl(var(--warning))] text-foreground border-0">
          Elevated
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4">
          Routine
        </Badge>
      );
  }
}

function priorityDot(priority: string | null) {
  const p = (priority ?? '').toLowerCase();
  const base = 'h-2.5 w-2.5 rounded-full shrink-0';
  if (p === 'urgent' || p === 'high') return <span className={`${base} bg-destructive`} title={p} />;
  if (p === 'normal' || p === 'medium') return <span className={`${base} bg-[hsl(var(--warning))]`} title={p} />;
  return <span className={`${base} bg-muted-foreground/40`} title={p || 'low'} />;
}

function daysAgo(isoStr: string | null): number {
  if (!isoStr) return 0;
  return differenceInDays(new Date(), parseISO(isoStr));
}

function taskUrl(task: RawTask): string | null {
  if (task.report_url) return task.report_url;
  return `https://app.breezeway.io/tasks/${task.breezeway_id}`;
}

// ─── Sort Header ─────────────────────────────────────────────────────────────

function SortHeader({
  field,
  label,
  sortField,
  sortDir,
  onSort,
  className = '',
}: {
  field: SortField;
  label: string;
  sortField: SortField;
  sortDir: SortDir;
  onSort: (f: SortField) => void;
  className?: string;
}) {
  const active = sortField === field;
  return (
    <TableHead
      className={`text-xs cursor-pointer select-none hover:text-foreground transition-colors ${className}`}
      onClick={() => onSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active ? (
          sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
        ) : (
          <ChevronsUpDown className="h-3 w-3 opacity-40" />
        )}
      </span>
    </TableHead>
  );
}

// ─── Task Table ──────────────────────────────────────────────────────────────

function TaskTable({ tasks, onOpenTask }: { tasks: RawTask[]; onOpenTask: (id: number) => void }) {
  const [sortField, setSortField] = useState<SortField>('urgency');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const handleSort = (f: SortField) => {
    if (f === sortField) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(f); setSortDir('asc'); }
  };

  const sorted = useMemo(() => {
    return [...tasks].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'urgency': {
          const au = URGENCY_ORDER[derivedUrgency(a)] ?? 9;
          const bu = URGENCY_ORDER[derivedUrgency(b)] ?? 9;
          cmp = au - bu;
          if (cmp === 0) cmp = (a.created_at ?? '') < (b.created_at ?? '') ? -1 : 1;
          break;
        }
        case 'priority': {
          const ap = PRIORITY_ORDER[(a.priority ?? '').toLowerCase()] ?? 9;
          const bp = PRIORITY_ORDER[(b.priority ?? '').toLowerCase()] ?? 9;
          cmp = ap - bp;
          break;
        }
        case 'property_name':
          cmp = (a.property_name ?? '').localeCompare(b.property_name ?? '');
          break;
        case 'created_at':
          cmp = (a.created_at ?? '') < (b.created_at ?? '') ? -1 : 1;
          break;
        case 'days_old':
          cmp = daysAgo(b.created_at) - daysAgo(a.created_at);
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [tasks, sortField, sortDir]);

  if (sorted.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-muted-foreground">
        🎉 No tasks in this category right now
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <SortHeader field="priority" label="Pri" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="w-10" />
            <SortHeader field="urgency" label="Urgency" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
            <SortHeader field="property_name" label="Property" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
            <TableHead className="text-xs">Task</TableHead>
            <TableHead className="text-xs hidden lg:table-cell">Category</TableHead>
            <SortHeader field="created_at" label="Created" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="hidden md:table-cell" />
            <SortHeader field="days_old" label="Age" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="hidden sm:table-cell" />
            <TableHead className="text-xs hidden xl:table-cell">Requested By</TableHead>
            <TableHead className="text-xs hidden xl:table-cell">Description</TableHead>
            <TableHead className="text-xs w-8"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map(task => {
            const urgency = derivedUrgency(task);
            const age = daysAgo(task.created_at);
            const descPreview = (task.ai_description || task.description || '').slice(0, 100);
            const url = taskUrl(task);

            return (
              <TableRow
                key={task.breezeway_id}
                className={`cursor-pointer hover:bg-accent/50 transition-colors ${urgency === 'guest-impacting' || urgency === 'urgent' ? 'bg-destructive/5' : ''}`}
                onClick={() => onOpenTask(task.breezeway_id)}
              >
                {/* Priority dot */}
                <TableCell className="py-2.5">
                  <div className="flex justify-center">{priorityDot(task.priority)}</div>
                </TableCell>

                {/* Urgency badge */}
                <TableCell className="py-2.5">{urgencyBadge(urgency)}</TableCell>

                {/* Property */}
                <TableCell className="py-2.5 font-medium text-xs max-w-[140px] truncate">
                  {task.property_name || '—'}
                </TableCell>

                {/* Task title */}
                <TableCell className="py-2.5 text-xs max-w-[180px]">
                  <span className="font-semibold text-foreground line-clamp-2">
                    {task.ai_title || task.name || 'Untitled'}
                  </span>
                </TableCell>

                {/* Category */}
                <TableCell className="py-2.5 hidden lg:table-cell">
                  {task.ai_skill_category ? (
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 capitalize">
                      {task.ai_skill_category}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </TableCell>

                {/* Created */}
                <TableCell className="py-2.5 text-xs text-muted-foreground hidden md:table-cell whitespace-nowrap">
                  {task.created_at ? format(parseISO(task.created_at), 'MMM d') : '—'}
                </TableCell>

                {/* Age */}
                <TableCell className="py-2.5 hidden sm:table-cell">
                  <span className={`text-xs font-semibold ${age >= 7 ? 'text-destructive' : age >= 3 ? 'text-[hsl(var(--warning))]' : 'text-muted-foreground'}`}>
                    {age === 0 ? 'Today' : `${age}d`}
                  </span>
                </TableCell>

                {/* Requested by */}
                <TableCell className="py-2.5 text-xs text-muted-foreground hidden xl:table-cell max-w-[120px] truncate">
                  {task.requested_by || '—'}
                </TableCell>

                {/* Description */}
                <TableCell className="py-2.5 hidden xl:table-cell max-w-[200px]">
                  <span className="text-[11px] text-muted-foreground line-clamp-2">{descPreview || '—'}</span>
                </TableCell>

                {/* Link */}
                <TableCell className="py-2.5">
                  {url && (
                    <a href={url} target="_blank" rel="noopener noreferrer"
                      className="text-primary hover:text-primary/80 transition-colors"
                      title="Open in Breezeway">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────

export default function SchedulingQueue() {
  const [skillFilter, setSkillFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [propertySearch, setPropertySearch] = useState('');

  // ── Data fetch ──────────────────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ['scheduling-queue'],
    queryFn: async () => {
      const todayStr = format(new Date(), 'yyyy-MM-dd');

      // Fetch active maintenance tasks
      const { data: tasks, error } = await supabase
        .from('breezeway_tasks')
        .select(`
          breezeway_id, name, ai_title, ai_description, description,
          property_name, status_code, priority, ai_guest_impact,
          ai_skill_category, scheduled_date, created_at, requested_by, report_url
        `)
        .eq('department', 'maintenance')
        .in('status_code', ['created', 'in_progress'])
        .order('created_at', { ascending: true })
        .limit(2000);

      if (error) throw error;
      if (!tasks || tasks.length === 0) return { tasks: [], assignedIds: new Set<number>() };

      // Fetch assignment presence
      const taskIds = tasks.map(t => t.breezeway_id);
      const chunkSize = 500;
      const allAssigned: number[] = [];
      for (let i = 0; i < taskIds.length; i += chunkSize) {
        const { data: asgn } = await supabase
          .from('breezeway_task_assignments')
          .select('task_id')
          .in('task_id', taskIds.slice(i, i + chunkSize));
        asgn?.forEach(a => { if (a.task_id != null) allAssigned.push(a.task_id); });
      }
      const assignedIds = new Set<number>(allAssigned);

      return { tasks: tasks as RawTask[], assignedIds, todayStr };
    },
    refetchInterval: 5 * 60 * 1000,
  });

  // ── Filter helpers ───────────────────────────────────────────────────────
  const applyFilters = (tasks: RawTask[]) =>
    tasks.filter(t => {
      if (skillFilter !== 'all' && t.ai_skill_category?.toLowerCase() !== skillFilter) return false;
      if (priorityFilter !== 'all' && (t.priority ?? '').toLowerCase() !== priorityFilter) return false;
      if (propertySearch) {
        const q = propertySearch.toLowerCase();
        if (!(t.property_name ?? '').toLowerCase().includes(q)) return false;
      }
      return true;
    });

  // ── Tab datasets ─────────────────────────────────────────────────────────
  const { unassigned, needsScheduling, pastDue, summaryCards } = useMemo(() => {
    if (!data) return { unassigned: [], needsScheduling: [], pastDue: [], summaryCards: null };
    const { tasks, assignedIds } = data;
    const todayStr = format(new Date(), 'yyyy-MM-dd');

    const unassigned = tasks.filter(t => !assignedIds.has(t.breezeway_id));
    const needsScheduling = tasks.filter(t => t.status_code === 'created' && !t.scheduled_date);
    const pastDue = tasks.filter(t => t.scheduled_date && t.scheduled_date < todayStr);

    // Summary cards
    const guestImpacting = unassigned.filter(t => t.ai_guest_impact).length;
    const avgDays = unassigned.length > 0
      ? Math.round(unassigned.reduce((s, t) => s + daysAgo(t.created_at), 0) / unassigned.length)
      : 0;
    const oldest = unassigned.reduce((max, t) => {
      const d = daysAgo(t.created_at);
      return d > max ? d : max;
    }, 0);

    return {
      unassigned,
      needsScheduling,
      pastDue,
      summaryCards: { total: unassigned.length, avgDays, guestImpacting, oldest },
    };
  }, [data]);

  const filteredUnassigned = useMemo(() => applyFilters(unassigned), [unassigned, skillFilter, priorityFilter, propertySearch]);
  const filteredNeedsScheduling = useMemo(() => applyFilters(needsScheduling), [needsScheduling, skillFilter, priorityFilter, propertySearch]);
  const filteredPastDue = useMemo(() => applyFilters(pastDue), [pastDue, skillFilter, priorityFilter, propertySearch]);

  const [openTaskId, setOpenTaskId] = useState<number | null>(null);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div>
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Scheduling Queue</h2>
        <p className="text-sm text-muted-foreground">Dispatch worklist — tasks needing assignment or scheduling</p>
      </div>

      {/* SUMMARY CARDS */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass-card p-4 animate-pulse h-20">
              <div className="h-3 bg-muted rounded w-3/4 mb-2" />
              <div className="h-6 bg-muted rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Total Unassigned */}
          <div className="glass-card p-3 sm:p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent shrink-0">
              <UserX className="h-4 w-4 text-secondary" />
            </div>
            <div>
              <p className="text-xl font-bold text-foreground">{summaryCards?.total ?? 0}</p>
              <p className="text-[11px] text-muted-foreground font-medium">Unassigned</p>
            </div>
          </div>

          {/* Avg Days Unassigned */}
          <div className="glass-card p-3 sm:p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[hsl(var(--warning)/0.15)] shrink-0">
              <Clock className="h-4 w-4 text-[hsl(var(--warning))]" />
            </div>
            <div>
              <p className="text-xl font-bold text-foreground">{summaryCards?.avgDays ?? 0}d</p>
              <p className="text-[11px] text-muted-foreground font-medium">Avg Days Open</p>
            </div>
          </div>

          {/* Guest-Impacting Unassigned */}
          <div className={`glass-card p-3 sm:p-4 flex items-center gap-3 ${(summaryCards?.guestImpacting ?? 0) > 0 ? 'border-destructive/40 bg-destructive/5' : ''}`}>
            <div className={`p-2 rounded-lg shrink-0 ${(summaryCards?.guestImpacting ?? 0) > 0 ? 'bg-destructive' : 'bg-muted'}`}>
              <Flame className={`h-4 w-4 ${(summaryCards?.guestImpacting ?? 0) > 0 ? 'text-destructive-foreground' : 'text-muted-foreground'}`} />
            </div>
            <div>
              <p className={`text-xl font-bold ${(summaryCards?.guestImpacting ?? 0) > 0 ? 'text-destructive' : 'text-foreground'}`}>
                {summaryCards?.guestImpacting ?? 0}
              </p>
              <p className="text-[11px] text-muted-foreground font-medium">Guest-Impacting</p>
            </div>
          </div>

          {/* Oldest Unassigned */}
          <div className={`glass-card p-3 sm:p-4 flex items-center gap-3 ${(summaryCards?.oldest ?? 0) >= 7 ? 'border-destructive/30 bg-destructive/5' : ''}`}>
            <div className={`p-2 rounded-lg shrink-0 ${(summaryCards?.oldest ?? 0) >= 7 ? 'bg-destructive/15' : 'bg-muted'}`}>
              <AlertTriangle className={`h-4 w-4 ${(summaryCards?.oldest ?? 0) >= 7 ? 'text-destructive' : 'text-muted-foreground'}`} />
            </div>
            <div>
              <p className={`text-xl font-bold ${(summaryCards?.oldest ?? 0) >= 7 ? 'text-destructive' : 'text-foreground'}`}>
                {summaryCards?.oldest ?? 0}d
              </p>
              <p className="text-[11px] text-muted-foreground font-medium">Oldest Task</p>
            </div>
          </div>
        </div>
      )}

      {/* FILTERS */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Property search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search property…"
            className="pl-8 h-8 text-xs w-48"
            value={propertySearch}
            onChange={e => setPropertySearch(e.target.value)}
          />
        </div>

        {/* Skill category */}
        <Select value={skillFilter} onValueChange={setSkillFilter}>
          <SelectTrigger className="h-8 text-xs w-40">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent className="bg-card border border-border shadow-lg z-50">
            {SKILL_CATEGORIES.map(cat => (
              <SelectItem key={cat} value={cat} className="text-xs capitalize">
                {cat === 'all' ? 'All Categories' : cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Priority */}
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="h-8 text-xs w-36">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent className="bg-card border border-border shadow-lg z-50">
            <SelectItem value="all" className="text-xs">All Priorities</SelectItem>
            <SelectItem value="urgent" className="text-xs">Urgent</SelectItem>
            <SelectItem value="high" className="text-xs">High</SelectItem>
            <SelectItem value="normal" className="text-xs">Normal</SelectItem>
            <SelectItem value="low" className="text-xs">Low</SelectItem>
          </SelectContent>
        </Select>

        {(skillFilter !== 'all' || priorityFilter !== 'all' || propertySearch) && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-muted-foreground"
            onClick={() => { setSkillFilter('all'); setPriorityFilter('all'); setPropertySearch(''); }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {/* TABS */}
      <Tabs defaultValue="unassigned">
        <TabsList className="h-9">
          <TabsTrigger value="unassigned" className="text-xs gap-1.5">
            Unassigned
            <span className={`inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full text-[10px] font-bold ${filteredUnassigned.length > 0 ? 'bg-destructive text-destructive-foreground' : 'bg-muted text-muted-foreground'}`}>
              {filteredUnassigned.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="needs-scheduling" className="text-xs gap-1.5">
            Needs Scheduling
            <span className={`inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full text-[10px] font-bold ${filteredNeedsScheduling.length > 0 ? 'bg-[hsl(var(--warning))] text-foreground' : 'bg-muted text-muted-foreground'}`}>
              {filteredNeedsScheduling.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="past-due" className="text-xs gap-1.5">
            Past Due
            <span className={`inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full text-[10px] font-bold ${filteredPastDue.length > 0 ? 'bg-destructive text-destructive-foreground' : 'bg-muted text-muted-foreground'}`}>
              {filteredPastDue.length}
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="unassigned" className="mt-4">
          <div className="glass-card rounded-lg overflow-hidden">
            <div className="p-3 border-b border-border flex items-center gap-2">
              <UserX className="h-4 w-4 text-destructive" />
              <span className="text-sm font-semibold">Unassigned Maintenance Tasks</span>
              <span className="text-xs text-muted-foreground ml-1">— active tasks with no assigned technician</span>
            </div>
            {isLoading ? (
              <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
            ) : (
              <TaskTable tasks={filteredUnassigned} onOpenTask={setOpenTaskId} />
            )}
          </div>
        </TabsContent>

        <TabsContent value="needs-scheduling" className="mt-4">
          <div className="glass-card rounded-lg overflow-hidden">
            <div className="p-3 border-b border-border flex items-center gap-2">
              <CalendarX className="h-4 w-4 text-[hsl(var(--warning))]" />
              <span className="text-sm font-semibold">Tasks Without a Scheduled Date</span>
              <span className="text-xs text-muted-foreground ml-1">— created but no date set yet</span>
            </div>
            {isLoading ? (
              <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
            ) : (
              <TaskTable tasks={filteredNeedsScheduling} onOpenTask={setOpenTaskId} />
            )}
          </div>
        </TabsContent>

        <TabsContent value="past-due" className="mt-4">
          <div className="glass-card rounded-lg overflow-hidden">
            <div className="p-3 border-b border-border flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span className="text-sm font-semibold">Past Due Tasks</span>
              <span className="text-xs text-muted-foreground ml-1">— scheduled date passed, still open</span>
            </div>
            {isLoading ? (
              <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
            ) : (
              <TaskTable tasks={filteredPastDue} onOpenTask={setOpenTaskId} />
            )}
          </div>
        </TabsContent>
      </Tabs>

      <TaskDetailSheet taskId={openTaskId} onClose={() => setOpenTaskId(null)} />
    </div>
  );
}


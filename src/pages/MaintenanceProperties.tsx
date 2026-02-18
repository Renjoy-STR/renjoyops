import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { PropertyDetailSheet } from '@/components/properties/PropertyDetailSheet';
import { TaskDetailSheet } from '@/components/maintenance/TaskDetailSheet';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  AlertTriangle, Search, ChevronDown, ChevronRight,
  Copy, Ghost, ExternalLink,
  ChevronUp, ChevronsUpDown, X, Layers, ArrowUpDown,
} from 'lucide-react';
import {
  formatDistanceToNow, parseISO, isValid, format,
} from 'date-fns';

// ─── Types ───────────────────────────────────────────────────────────────────

interface PropertyOverview {
  property_name: string;
  home_id: number | null;
  open_tasks: number;
  in_progress_tasks: number;
  overdue_tasks: number;
  completed_30d: number;
  avg_completion_minutes: number | null;
  duplicate_tasks: number;
  ghost_tasks: number;
  health_signal: string | null;
  last_task_date: string | null;
  top_issue: string | null;
}

interface CleanupSummaryRpc {
  total_actionable: number;
  future_scheduled: number;
  true_duplicates: number;
  ghosts: number;
  overdue: number;
  overdue_7d: number;
  overdue_30d: number;
  overdue_90d: number;
  overdue_90d_plus: number;
  stale_no_schedule: number;
  unassigned: number;
  top_overdue_task: string | null;
  top_overdue_count: number | null;
}

interface CleanupTask {
  breezeway_id: number;
  home_id: number | null;
  task_name: string | null;
  property_name: string | null;
  status_name: string | null;
  status_stage: string | null;
  department: string | null;
  created_date: string | null;
  scheduled_date: string | null;
  assigned_to: string | null;
  age_days: number;
  days_overdue: number;
  cleanup_category: string;
  dupe_count: number;
  ghost_completed_date: string | null;
  template_id: number | null;
}

type SortKey = keyof PropertyOverview;
type SortDir = 'asc' | 'desc';
type FilterType = 'all' | 'duplicates' | 'ghosts' | 'overdue';
type TabType = 'properties' | 'cleanup';
type CleanupCategory = 'ghost' | 'duplicate' | 'overdue' | 'stale' | 'unassigned';
type QueueSortKey = 'days_overdue' | 'age_days' | 'property_name' | 'cleanup_category';
type DeptFilter = '' | 'maintenance' | 'housekeeping' | 'inspection';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtMinutes(mins: number | null): string {
  if (!mins) return '—';
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function fmtRelative(dateStr: string | null): string {
  if (!dateStr) return '—';
  try {
    const d = parseISO(dateStr);
    if (!isValid(d)) return '—';
    return formatDistanceToNow(d, { addSuffix: true });
  } catch {
    return '—';
  }
}

function fmtDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  try {
    const d = parseISO(dateStr);
    if (!isValid(d)) return '—';
    return format(d, 'MMM d, yyyy');
  } catch {
    return '—';
  }
}

function healthColor(signal: string | null): string {
  if (!signal) return 'hsl(var(--muted-foreground))';
  const s = signal.toLowerCase();
  if (s === 'good' || s === 'healthy') return 'hsl(142 71% 45%)';
  if (s === 'watch' || s === 'warning' || s === 'moderate') return 'hsl(45 93% 47%)';
  return 'hsl(var(--destructive))';
}

function openColor(n: number): string {
  if (n > 10) return 'hsl(var(--destructive))';
  if (n > 5) return 'hsl(30 96% 51%)';
  return 'inherit';
}

const CATEGORY_CONFIG: Record<CleanupCategory, {
  label: string;
  emoji: string;
  badgeClass: string;
  pillActive: string;
  pillInactive: string;
}> = {
  ghost:     { label: 'Ghosts',     emoji: '👻', badgeClass: 'bg-purple-100 text-purple-700 border-purple-200', pillActive: 'bg-purple-600 text-white border-transparent', pillInactive: 'border-purple-300 text-purple-700 bg-transparent' },
  duplicate: { label: 'Duplicates', emoji: '🟠', badgeClass: 'bg-orange-100 text-orange-700 border-orange-200', pillActive: 'bg-orange-500 text-white border-transparent', pillInactive: 'border-orange-300 text-orange-700 bg-transparent' },
  overdue:   { label: 'Overdue',    emoji: '🔴', badgeClass: 'bg-red-100 text-red-700 border-red-200',          pillActive: 'bg-red-600 text-white border-transparent',    pillInactive: 'border-red-300 text-red-700 bg-transparent' },
  stale:     { label: 'Stale',      emoji: '⚫', badgeClass: 'bg-muted text-muted-foreground border-border',    pillActive: 'bg-gray-600 text-white border-transparent',   pillInactive: 'border-gray-400 text-gray-700 bg-transparent' },
  unassigned:{ label: 'Unassigned', emoji: '🟡', badgeClass: 'bg-yellow-100 text-yellow-700 border-yellow-200', pillActive: 'bg-yellow-500 text-white border-transparent',  pillInactive: 'border-yellow-300 text-yellow-700 bg-transparent' },
};

function CategoryBadge({ cat }: { cat: string }) {
  const c = CATEGORY_CONFIG[cat as CleanupCategory];
  if (!c) return <Badge variant="outline" className="text-[10px] capitalize">{cat}</Badge>;
  return (
    <Badge className={`${c.badgeClass} text-[10px] px-1.5 gap-0.5 border`}>
      {c.emoji} {c.label}
    </Badge>
  );
}

function StatusBadge({ name }: { name: string | null }) {
  if (!name) return <span className="text-muted-foreground text-xs">—</span>;
  const n = name.toLowerCase();
  if (n.includes('progress')) return <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-[10px]">{name}</Badge>;
  return <Badge variant="secondary" className="text-[10px]">{name}</Badge>;
}

// ─── Cleanup Queue Section ────────────────────────────────────────────────────

function CleanupQueueSection({
  onOpenProperty,
  onOpenTask,
}: {
  onOpenProperty: (name: string) => void;
  onOpenTask: (id: number) => void;
}) {
  const [activeCategories, setActiveCategories] = useState<Set<CleanupCategory>>(new Set());
  const [dept, setDept] = useState<DeptFilter>('');
  const [propertySearch, setPropertySearch] = useState('');
  const [selectedProperty, setSelectedProperty] = useState<string>('');
  const [groupByProp, setGroupByProp] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [queueSort, setQueueSort] = useState<QueueSortKey>('days_overdue');
  const [queueSortDir, setQueueSortDir] = useState<SortDir>('desc');
  const [displayLimit, setDisplayLimit] = useState(50);

  // Summary query
  const { data: summary, isLoading: loadingSummary } = useQuery<CleanupSummaryRpc>({
    queryKey: ['cleanup-summary-v2'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_cleanup_summary' as any);
      if (error) throw error;
      return (Array.isArray(data) ? data[0] : data) as CleanupSummaryRpc;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Queue query
  const categoryParam = activeCategories.size === 1 ? [...activeCategories][0] : null;
  const { data: allTasks = [], isLoading: loadingQueue } = useQuery<CleanupTask[]>({
    queryKey: ['cleanup-queue', categoryParam, dept, selectedProperty],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_cleanup_queue' as any, {
        p_category: categoryParam ?? null,
        p_department: dept || null,
        p_property: selectedProperty || null,
        p_limit: 500,
      });
      if (error) throw error;
      return (data ?? []) as CleanupTask[];
    },
    staleTime: 3 * 60 * 1000,
  });

  // Client-side multi-category filter (when multiple are active)
  const filteredTasks = useMemo(() => {
    let tasks = allTasks;
    if (activeCategories.size > 1) {
      tasks = tasks.filter((t) => activeCategories.has(t.cleanup_category as CleanupCategory));
    }
    return tasks;
  }, [allTasks, activeCategories]);

  // Distinct properties for dropdown
  const distinctProperties = useMemo(() => {
    const s = new Set(allTasks.map((t) => t.property_name ?? '').filter(Boolean));
    return [...s].sort();
  }, [allTasks]);

  const filteredByPropSearch = useMemo(() => {
    if (!propertySearch.trim()) return distinctProperties;
    const q = propertySearch.toLowerCase();
    return distinctProperties.filter((p) => p.toLowerCase().includes(q));
  }, [distinctProperties, propertySearch]);

  // Sorting
  const sortedTasks = useMemo(() => {
    const tasks = [...filteredTasks];
    tasks.sort((a, b) => {
      let av: string | number = 0;
      let bv: string | number = 0;
      if (queueSort === 'days_overdue') { av = a.days_overdue; bv = b.days_overdue; }
      else if (queueSort === 'age_days') { av = a.age_days; bv = b.age_days; }
      else if (queueSort === 'property_name') { av = a.property_name ?? ''; bv = b.property_name ?? ''; }
      else if (queueSort === 'cleanup_category') { av = a.cleanup_category; bv = b.cleanup_category; }

      if (typeof av === 'string') {
        return queueSortDir === 'asc' ? av.localeCompare(bv as string) : (bv as string).localeCompare(av);
      }
      return queueSortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return tasks;
  }, [filteredTasks, queueSort, queueSortDir]);

  const displayedTasks = useMemo(() => sortedTasks.slice(0, displayLimit), [sortedTasks, displayLimit]);

  // Grouped view
  const groupedByProperty = useMemo(() => {
    const map = new Map<string, CleanupTask[]>();
    for (const t of sortedTasks) {
      const key = t.property_name ?? 'Unknown';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [sortedTasks]);

  const toggleCategory = useCallback((cat: CleanupCategory) => {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
    setDisplayLimit(50);
  }, []);

  function handleQueueSort(key: QueueSortKey) {
    if (queueSort === key) setQueueSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setQueueSort(key); setQueueSortDir('desc'); }
  }

  function QueueSortIcon({ col }: { col: QueueSortKey }) {
    if (queueSort !== col) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return queueSortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
  }

  return (
    <div className="space-y-5 mt-2">
      {/* ── Dashboard Banner ──────────────────────────────────────────────── */}
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-bold">Task Cleanup Queue</h2>
            {loadingSummary ? (
              <Skeleton className="h-4 w-64 mt-1" />
            ) : summary && (
              <p className="text-sm text-muted-foreground mt-0.5">
                <span className="font-semibold text-foreground">{summary.total_actionable?.toLocaleString()}</span> actionable tasks
                {' · '}
                <span className="text-muted-foreground">{summary.future_scheduled?.toLocaleString()} future scheduled</span>{' '}
                <span className="text-xs text-muted-foreground">(OK — recurring)</span>
              </p>
            )}
          </div>
        </div>

        {/* Category pills */}
        {loadingSummary ? (
          <div className="flex gap-2 flex-wrap">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-28 rounded-full" />)}
          </div>
        ) : summary && (
          <>
            <div className="flex gap-2 flex-wrap">
              {(Object.keys(CATEGORY_CONFIG) as CleanupCategory[]).map((cat) => {
                const cfg = CATEGORY_CONFIG[cat];
                const isActive = activeCategories.has(cat);
                const count =
                  cat === 'ghost' ? summary.ghosts :
                  cat === 'duplicate' ? summary.true_duplicates :
                  cat === 'overdue' ? summary.overdue :
                  cat === 'stale' ? summary.stale_no_schedule :
                  summary.unassigned;
                return (
                  <button
                    key={cat}
                    onClick={() => toggleCategory(cat)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold border transition-colors ${isActive ? cfg.pillActive : cfg.pillInactive}`}
                  >
                    {cfg.emoji} {count?.toLocaleString()} {cfg.label}
                  </button>
                );
              })}
            </div>

            {/* Overdue breakdown */}
            <p className="text-xs text-muted-foreground">
              Overdue breakdown:{' '}
              <span className="font-medium text-foreground">{summary.overdue_7d}</span> this week ·{' '}
              <span className="font-medium text-foreground">{summary.overdue_30d}</span> this month ·{' '}
              <span className="font-medium text-foreground">{summary.overdue_90d}</span> this quarter ·{' '}
              <span className="font-medium text-destructive">{summary.overdue_90d_plus}</span> over 90 days
            </p>
          </>
        )}
      </div>

      {/* ── Filter Bar ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Department */}
        <div className="flex items-center gap-1">
          {(['', 'maintenance', 'housekeeping', 'inspection'] as DeptFilter[]).map((d) => (
            <Button
              key={d}
              size="sm"
              variant={dept === d ? 'default' : 'outline'}
              className="h-7 px-2.5 text-xs capitalize"
              onClick={() => { setDept(d); setDisplayLimit(50); }}
            >
              {d === '' ? 'All Depts' : d}
            </Button>
          ))}
        </div>

        {/* Property search/select */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Filter by property…"
            value={propertySearch || selectedProperty}
            onChange={(e) => {
              setPropertySearch(e.target.value);
              if (!e.target.value) setSelectedProperty('');
            }}
            className="pl-7 h-7 text-xs w-48"
          />
          {(propertySearch || selectedProperty) && (
            <button
              className="absolute right-2 top-1.5 text-muted-foreground hover:text-foreground"
              onClick={() => { setPropertySearch(''); setSelectedProperty(''); }}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          {propertySearch && !selectedProperty && filteredByPropSearch.length > 0 && (
            <div className="absolute top-full mt-1 left-0 z-50 w-64 bg-popover border rounded-lg shadow-lg max-h-52 overflow-y-auto">
              {filteredByPropSearch.slice(0, 20).map((p) => (
                <button
                  key={p}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent transition-colors"
                  onClick={() => { setSelectedProperty(p); setPropertySearch(''); setDisplayLimit(50); }}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Group toggle */}
        <Button
          size="sm"
          variant={groupByProp ? 'default' : 'outline'}
          className="h-7 px-2.5 text-xs ml-auto"
          onClick={() => setGroupByProp((g) => !g)}
        >
          <Layers className="h-3.5 w-3.5 mr-1" />
          Group by Property
        </Button>

        {/* Result count */}
        {!loadingQueue && (
          <span className="text-xs text-muted-foreground">
            {sortedTasks.length.toLocaleString()} tasks
          </span>
        )}
      </div>

      {/* ── Table / Grouped view ──────────────────────────────────────────── */}
      {loadingQueue ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : sortedTasks.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center text-muted-foreground">
          <p className="text-lg font-semibold mb-1">No tasks found</p>
          <p className="text-sm">Try changing the filters above.</p>
        </div>
      ) : groupByProp ? (
        /* ── GROUPED VIEW ───────────────────────────────────────────────── */
        <div className="space-y-2">
          {groupedByProperty.map(([propName, tasks]) => {
            const homePropId = tasks[0]?.home_id;
            const isOpen = expandedGroups.has(propName);
            return (
              <Collapsible
                key={propName}
                open={isOpen}
                onOpenChange={(open) => {
                  setExpandedGroups((prev) => {
                    const next = new Set(prev);
                    if (open) next.add(propName); else next.delete(propName);
                    return next;
                  });
                }}
              >
                <CollapsibleTrigger className="w-full">
                  <div className="flex items-center gap-2 px-4 py-3 rounded-lg border bg-muted/40 hover:bg-muted/60 transition-colors text-left w-full">
                    {isOpen ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                    <span className="font-semibold text-sm flex-1">{propName}</span>
                    <div className="flex items-center gap-2 mr-2">
                      {/* Category breakdown */}
                      {(Object.keys(CATEGORY_CONFIG) as CleanupCategory[]).map((cat) => {
                        const n = tasks.filter((t) => t.cleanup_category === cat).length;
                        if (n === 0) return null;
                        const cfg = CATEGORY_CONFIG[cat];
                        return (
                          <span key={cat} className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${cfg.badgeClass}`}>
                            {cfg.emoji} {n}
                          </span>
                        );
                      })}
                    </div>
                    <Badge variant="secondary" className="text-[10px] shrink-0">
                      {tasks.length} issue{tasks.length !== 1 ? 's' : ''}
                    </Badge>
                    {homePropId && (
                      <a
                        href={`https://app.breezeway.io/property/${homePropId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-2 text-muted-foreground hover:text-primary"
                        onClick={(e) => e.stopPropagation()}
                        title="Open property in Breezeway"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="ml-4 mt-1 border-l-2 border-border pl-3 space-y-1">
                    {tasks.map((t) => (
                      <div
                        key={t.breezeway_id}
                        className="flex items-center gap-2 py-2 px-3 rounded-md hover:bg-accent/30 cursor-pointer transition-colors text-sm"
                        onClick={() => onOpenTask(t.breezeway_id)}
                      >
                        <CategoryBadge cat={t.cleanup_category} />
                        <span className="flex-1 truncate font-medium">
                          {t.task_name ?? 'Untitled'}
                          {t.cleanup_category === 'duplicate' && t.dupe_count > 1 && (
                            <span className="ml-1 text-xs text-orange-500">(×{t.dupe_count})</span>
                          )}
                        </span>
                        {t.days_overdue > 0 && (
                          <span className="text-xs text-destructive font-medium shrink-0">{t.days_overdue}d overdue</span>
                        )}
                        <span className="text-xs text-muted-foreground shrink-0">{t.age_days}d old</span>
                        <a
                          href={`https://app.breezeway.io/task/${t.breezeway_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-primary shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      ) : (
        /* ── FLAT TABLE VIEW ────────────────────────────────────────────── */
        <>
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead
                    className="cursor-pointer select-none text-xs whitespace-nowrap w-[110px]"
                    onClick={() => handleQueueSort('cleanup_category')}
                  >
                    <span className="flex items-center gap-1">Category <QueueSortIcon col="cleanup_category" /></span>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none text-xs whitespace-nowrap"
                    onClick={() => handleQueueSort('property_name')}
                  >
                    <span className="flex items-center gap-1">Property <QueueSortIcon col="property_name" /></span>
                  </TableHead>
                  <TableHead className="text-xs">Task Name</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs whitespace-nowrap">Scheduled</TableHead>
                  <TableHead
                    className="cursor-pointer select-none text-xs whitespace-nowrap"
                    onClick={() => handleQueueSort('days_overdue')}
                  >
                    <span className="flex items-center gap-1">Overdue <QueueSortIcon col="days_overdue" /></span>
                  </TableHead>
                  <TableHead className="text-xs">Assigned</TableHead>
                  <TableHead
                    className="cursor-pointer select-none text-xs whitespace-nowrap"
                    onClick={() => handleQueueSort('age_days')}
                  >
                    <span className="flex items-center gap-1">Age <QueueSortIcon col="age_days" /></span>
                  </TableHead>
                  <TableHead className="text-xs text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedTasks.map((t) => (
                  <TableRow
                    key={t.breezeway_id}
                    className="cursor-pointer hover:bg-accent/30 transition-colors"
                    onClick={() => onOpenTask(t.breezeway_id)}
                  >
                    <TableCell className="py-2">
                      <CategoryBadge cat={t.cleanup_category} />
                    </TableCell>
                    <TableCell className="py-2">
                      <button
                        className="text-sm font-medium text-left hover:text-primary hover:underline max-w-[180px] truncate block"
                        onClick={(e) => { e.stopPropagation(); onOpenProperty(t.property_name ?? ''); }}
                      >
                        {t.property_name ?? '—'}
                      </button>
                    </TableCell>
                    <TableCell className="py-2 max-w-[240px]">
                      <div>
                        <p className="text-sm font-medium truncate">
                          {t.task_name ?? 'Untitled'}
                          {t.cleanup_category === 'duplicate' && t.dupe_count > 1 && (
                            <span className="ml-1 text-xs text-orange-500">(×{t.dupe_count})</span>
                          )}
                        </p>
                        {t.cleanup_category === 'ghost' && t.ghost_completed_date && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            Completed version finished {fmtRelative(t.ghost_completed_date)}
                          </p>
                        )}
                        {t.cleanup_category === 'duplicate' && t.dupe_count > 1 && (
                          <p className="text-[10px] text-orange-500 mt-0.5">{t.dupe_count} copies of this task open</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-2">
                      <StatusBadge name={t.status_name} />
                    </TableCell>
                    <TableCell className="py-2 text-xs text-muted-foreground whitespace-nowrap">
                      {fmtDate(t.scheduled_date)}
                    </TableCell>
                    <TableCell className="py-2">
                      {t.days_overdue > 0 ? (
                        <span className="text-xs font-semibold text-destructive">{t.days_overdue}d overdue</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="py-2 text-xs">
                      {t.assigned_to ? (
                        <span className="text-muted-foreground">{t.assigned_to}</span>
                      ) : (
                        <span className="text-yellow-600 font-medium">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell className="py-2 text-xs text-muted-foreground whitespace-nowrap">
                      {t.age_days} days
                    </TableCell>
                    <TableCell className="py-2" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1.5 justify-end">
                        <a
                          href={`https://app.breezeway.io/task/${t.breezeway_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary border rounded px-1.5 py-0.5 whitespace-nowrap"
                        >
                          <ExternalLink className="h-3 w-3" /> Task
                        </a>
                        {t.home_id && (
                          <a
                            href={`https://app.breezeway.io/property/${t.home_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary border rounded px-1.5 py-0.5 whitespace-nowrap"
                          >
                            <ExternalLink className="h-3 w-3" /> Property
                          </a>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Load more */}
          {displayedTasks.length < sortedTasks.length && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <span className="text-xs text-muted-foreground">
                Showing {displayedTasks.length} of {sortedTasks.length}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDisplayLimit((l) => l + 50)}
                className="h-7 text-xs"
              >
                Load 50 More
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type GroupedRow =
  | { type: 'group'; key: string; label: string; items: PropertyOverview[]; expanded: boolean }
  | { type: 'property'; data: PropertyOverview };

export default function MaintenanceProperties() {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('open_tasks');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [filter, setFilter] = useState<FilterType>('all');
  const [grouped, setGrouped] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [selectedProperty, setSelectedProperty] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('properties');

  // ── Queries ─────────────────────────────────────────────────────────────────
  const { data: overview = [], isLoading: loadingOverview } = useQuery<PropertyOverview[]>({
    queryKey: ['property-overview'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_property_overview' as any);
      if (error) throw error;
      return (data ?? []) as PropertyOverview[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: cleanup } = useQuery<CleanupSummaryRpc>({
    queryKey: ['cleanup-summary-v2'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_cleanup_summary' as any);
      if (error) throw error;
      return (Array.isArray(data) ? data[0] : data) as CleanupSummaryRpc;
    },
    staleTime: 5 * 60 * 1000,
  });

  // ── Sort + Filter ────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let rows = [...overview];
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter((r) => r.property_name.toLowerCase().includes(q));
    }
    if (filter === 'duplicates') rows = rows.filter((r) => r.duplicate_tasks > 0);
    if (filter === 'ghosts') rows = rows.filter((r) => r.ghost_tasks > 0);
    if (filter === 'overdue') rows = rows.filter((r) => r.overdue_tasks > 5);
    rows.sort((a, b) => {
      const av = a[sortKey] ?? 0;
      const bv = b[sortKey] ?? 0;
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === 'asc' ? Number(av) - Number(bv) : Number(bv) - Number(av);
    });
    return rows;
  }, [overview, search, sortKey, sortDir, filter]);

  function getGroupKey(name: string): string {
    const words = name.trim().split(/\s+/);
    const first = words[0] ?? '';
    if (/^\d/.test(first)) return words.slice(0, 2).join(' ');
    if (['the', 'renjoy'].includes(first.toLowerCase())) return name;
    return first;
  }

  const groupedRows = useMemo<GroupedRow[]>(() => {
    if (!grouped) return filtered.map((p) => ({ type: 'property', data: p }));
    const groupMap = new Map<string, PropertyOverview[]>();
    for (const p of filtered) {
      const key = getGroupKey(p.property_name);
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key)!.push(p);
    }
    const rows: GroupedRow[] = [];
    for (const [key, items] of groupMap) {
      if (items.length === 1) {
        rows.push({ type: 'property', data: items[0] });
      } else {
        rows.push({ type: 'group', key, label: key, items, expanded: expandedGroups.has(key) });
        if (expandedGroups.has(key)) {
          items.forEach((p) => rows.push({ type: 'property', data: p }));
        }
      }
    }
    return rows;
  }, [filtered, grouped, expandedGroups]);

  function toggleGroup(key: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ChevronsUpDown className="h-3 w-3 opacity-40" />;
    return sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
  }

  function groupSum(items: PropertyOverview[], key: keyof PropertyOverview): number {
    return items.reduce((s, p) => s + (Number(p[key]) || 0), 0);
  }

  if (loadingOverview) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const totalCleanupIssues = (cleanup?.ghosts ?? 0) + (cleanup?.true_duplicates ?? 0) + (cleanup?.overdue ?? 0) + (cleanup?.stale_no_schedule ?? 0) + (cleanup?.unassigned ?? 0);

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-screen-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Property Health</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Maintenance task overview by property — identify problem areas and cleanup opportunities
        </p>
      </div>

      {/* ── Cleanup Banner ─────────────────────────────────────────────────── */}
      {cleanup && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 shrink-0 rounded-lg bg-orange-100 p-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-orange-900 text-sm">
                🧹{' '}
                <span className="font-bold text-base">{cleanup.total_actionable?.toLocaleString()}</span>
                {' '}actionable tasks —{' '}
                <span className="font-bold" style={{ color: 'hsl(270 60% 45%)' }}>
                  {cleanup.ghosts?.toLocaleString()} ghosts
                </span>
                {' · '}
                <span className="font-bold" style={{ color: 'hsl(30 96% 38%)' }}>
                  {cleanup.true_duplicates?.toLocaleString()} duplicates
                </span>
                {' · '}
                <span className="font-bold text-red-600">
                  {cleanup.overdue?.toLocaleString()} overdue
                </span>
                {' · '}
                <span className="font-bold" style={{ color: 'hsl(45 80% 38%)' }}>
                  {cleanup.unassigned?.toLocaleString()} unassigned
                </span>
              </p>
              {cleanup.top_overdue_task && (
                <p className="text-sm text-orange-700 mt-1">
                  Most overdue:{' '}
                  <span className="font-medium">{cleanup.top_overdue_task}</span>
                  {cleanup.top_overdue_count && (
                    <span className="ml-1 text-orange-500">({cleanup.top_overdue_count} instances)</span>
                  )}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Tab bar ────────────────────────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabType)}>
        <TabsList>
          <TabsTrigger value="properties">All Properties</TabsTrigger>
          <TabsTrigger value="cleanup" className="flex items-center gap-1.5">
            Cleanup Queue
            {totalCleanupIssues > 0 && (
              <Badge variant="default" className="text-[9px] px-1 py-0 h-3.5 ml-0.5">
                {totalCleanupIssues.toLocaleString()}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── All Properties Tab ─────────────────────────────────────────── */}
        <TabsContent value="properties" className="mt-4">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search property…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
              {search && (
                <button className="absolute right-2 top-2 text-muted-foreground hover:text-foreground" onClick={() => setSearch('')}>
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {([
              { key: 'all', label: 'All Properties' },
              { key: 'duplicates', label: 'Has Duplicates' },
              { key: 'ghosts', label: 'Has Ghosts' },
              { key: 'overdue', label: 'Overdue > 5' },
            ] as { key: FilterType; label: string }[]).map(({ key, label }) => (
              <Button key={key} size="sm" variant={filter === key ? 'default' : 'outline'} className="h-8 text-xs" onClick={() => setFilter(key)}>
                {label}
              </Button>
            ))}
            <Button size="sm" variant={grouped ? 'default' : 'outline'} className="h-8 text-xs ml-auto" onClick={() => setGrouped((g) => !g)}>
              Group by Property
            </Button>
          </div>

          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  {([
                    { key: 'property_name', label: 'Property' },
                    { key: 'open_tasks', label: 'Score' },
                    { key: 'open_tasks', label: 'Open' },
                    { key: 'in_progress_tasks', label: 'In Prog' },
                    { key: 'overdue_tasks', label: 'Overdue' },
                    { key: 'completed_30d', label: 'Done (30d)' },
                    { key: 'avg_completion_minutes', label: 'Avg Time' },
                    { key: 'duplicate_tasks', label: 'Dupes' },
                    { key: 'ghost_tasks', label: 'Ghosts' },
                    { key: 'duplicate_tasks', label: 'Cleanup' },
                    { key: 'health_signal', label: 'Health' },
                    { key: 'last_task_date', label: 'Last Activity' },
                  ] as { key: SortKey; label: string }[]).map(({ key, label }, i) => (
                    <TableHead key={`${key}-${i}`} className="cursor-pointer select-none whitespace-nowrap text-xs" onClick={() => handleSort(key)}>
                      <span className="flex items-center gap-1">
                        {label}
                        {label !== 'Score' && label !== 'Cleanup' && <SortIcon col={key} />}
                      </span>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingOverview ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 12 }).map((__, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : groupedRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center text-muted-foreground py-12">
                      No properties match your filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  groupedRows.map((row, idx) => {
                    if (row.type === 'group') {
                      const open = groupSum(row.items, 'open_tasks');
                      const overdue = groupSum(row.items, 'overdue_tasks');
                      const dupes = groupSum(row.items, 'duplicate_tasks');
                      const ghosts = groupSum(row.items, 'ghost_tasks');
                      const cleanupN = dupes + ghosts;
                      const score = Math.max(0, Math.min(100, 100 - (open * 2) - (overdue * 3) - (dupes * 1) - (ghosts * 1)));
                      const scoreColor = score >= 80 ? 'text-green-600' : score >= 50 ? 'text-yellow-600' : 'text-destructive';
                      return (
                        <TableRow key={`grp-${row.key}`} className="bg-muted/50 cursor-pointer hover:bg-muted/70 font-medium" onClick={() => toggleGroup(row.key)}>
                          <TableCell className="flex items-center gap-1.5 text-sm">
                            {row.expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                            <span className="font-semibold">{row.label}</span>
                            <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 ml-1">{row.items.length} listing{row.items.length !== 1 ? 's' : ''}</Badge>
                          </TableCell>
                          <TableCell><span className={`font-bold text-sm ${scoreColor}`}>{score}</span></TableCell>
                          <TableCell style={{ color: openColor(open), fontWeight: open > 5 ? 700 : undefined }}>{open}</TableCell>
                          <TableCell>{groupSum(row.items, 'in_progress_tasks')}</TableCell>
                          <TableCell className="text-destructive">{overdue || '—'}</TableCell>
                          <TableCell>{groupSum(row.items, 'completed_30d')}</TableCell>
                          <TableCell>—</TableCell>
                          <TableCell>{dupes > 0 && <Badge className="bg-orange-100 text-orange-700 border-orange-200 text-[10px] px-1">{dupes}</Badge>}</TableCell>
                          <TableCell>{ghosts > 0 && <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-[10px] px-1">{ghosts}</Badge>}</TableCell>
                          <TableCell>{cleanupN > 0 ? <span className={`font-semibold text-sm ${cleanupN > 5 ? 'text-destructive' : 'text-orange-500'}`}>{cleanupN}</span> : <span className="text-muted-foreground">—</span>}</TableCell>
                          <TableCell>—</TableCell>
                          <TableCell>—</TableCell>
                        </TableRow>
                      );
                    }

                    const p = row.data;
                    const isIndented = grouped && groupedRows.some((r, ri) => ri < idx && r.type === 'group' && r.expanded && r.items.includes(p));
                    const cleanupN = p.duplicate_tasks + p.ghost_tasks;
                    const score = Math.max(0, Math.min(100, 100 - (p.open_tasks * 2) - (p.overdue_tasks * 3) - (p.duplicate_tasks * 1) - (p.ghost_tasks * 1)));
                    const scoreColor = score >= 80 ? 'text-green-600' : score >= 50 ? 'text-yellow-600' : 'text-destructive';
                    const needsAttention = cleanupN > 5;

                    return (
                      <TableRow
                        key={p.property_name}
                        className="cursor-pointer hover:bg-accent/30 transition-colors"
                        style={needsAttention ? { borderLeft: '4px solid hsl(30 96% 51%)' } : { borderLeft: '4px solid transparent' }}
                        onClick={() => setSelectedProperty(p.property_name)}
                      >
                        <TableCell className="text-sm font-medium max-w-[200px]">
                          <span className={isIndented ? 'pl-5 block' : ''}>{p.property_name}</span>
                        </TableCell>
                        <TableCell><span className={`font-bold text-sm ${scoreColor}`}>{score}</span></TableCell>
                        <TableCell style={{ color: openColor(p.open_tasks), fontWeight: p.open_tasks > 5 ? 700 : undefined }}>{p.open_tasks}</TableCell>
                        <TableCell className="text-muted-foreground">{p.in_progress_tasks}</TableCell>
                        <TableCell>{p.overdue_tasks > 0 ? <span className="text-destructive font-semibold">{p.overdue_tasks}</span> : <span className="text-muted-foreground">0</span>}</TableCell>
                        <TableCell>{p.completed_30d}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{fmtMinutes(p.avg_completion_minutes)}</TableCell>
                        <TableCell>{p.duplicate_tasks > 0 ? <Badge className="bg-orange-100 text-orange-700 border-orange-200 text-[10px] px-1.5">{p.duplicate_tasks}</Badge> : <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell>{p.ghost_tasks > 0 ? <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-[10px] px-1.5">{p.ghost_tasks}</Badge> : <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell>{cleanupN > 0 ? <span className={`font-semibold text-sm ${cleanupN > 5 ? 'text-destructive' : 'text-orange-500'}`}>{cleanupN}</span> : <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1.5 text-xs" title={p.health_signal ?? ''}>
                            <span className="h-2 w-2 rounded-full shrink-0" style={{ background: healthColor(p.health_signal) }} />
                            <span className="capitalize text-muted-foreground">{p.health_signal ?? '?'}</span>
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{fmtRelative(p.last_task_date)}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {!loadingOverview && (
            <p className="text-xs text-muted-foreground mt-2">
              Showing {filtered.length} of {overview.length} properties
            </p>
          )}
        </TabsContent>

        {/* ── Cleanup Queue Tab ──────────────────────────────────────────── */}
        <TabsContent value="cleanup" className="mt-4">
          <CleanupQueueSection
            onOpenProperty={(name) => setSelectedProperty(name)}
            onOpenTask={(id) => setSelectedTaskId(id)}
          />
        </TabsContent>
      </Tabs>

      {/* Sheets */}
      <PropertyDetailSheet
        propertyName={selectedProperty}
        onClose={() => setSelectedProperty(null)}
      />
      <TaskDetailSheet
        taskId={selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
      />
    </div>
  );
}

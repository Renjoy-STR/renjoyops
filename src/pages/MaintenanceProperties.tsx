import { useState, useMemo } from 'react';
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
import {
  AlertTriangle, Search, ChevronDown, ChevronRight,
  Copy, Ghost, ExternalLink,
  ChevronUp, ChevronsUpDown, X,
} from 'lucide-react';
import {
  formatDistanceToNow, parseISO, isValid,
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

interface CleanupSummary {
  total_open: number;
  total_duplicates: number;
  total_ghosts: number;
  total_stale_90d: number;
  total_unassigned: number;
  top_duplicate_task: string | null;
  top_duplicate_count: number | null;
}

type SortKey = keyof PropertyOverview;
type SortDir = 'asc' | 'desc';
type FilterType = 'all' | 'duplicates' | 'ghosts' | 'overdue';
type TabType = 'properties' | 'cleanup';

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




// ─── Cleanup Queue Section ────────────────────────────────────────────────────

function CleanupQueueSection({ data, cleanup }: {
  data: PropertyOverview[];
  cleanup?: CleanupSummary;
}) {
  const duplicates = useMemo(
    () => data.filter((p) => p.duplicate_tasks > 0).sort((a, b) => b.duplicate_tasks - a.duplicate_tasks),
    [data],
  );
  const ghosts = useMemo(
    () => data.filter((p) => p.ghost_tasks > 0).sort((a, b) => b.ghost_tasks - a.ghost_tasks),
    [data],
  );

  const totalDupeProps = duplicates.length;
  const totalDupeTasks = duplicates.reduce((s, p) => s + p.duplicate_tasks, 0);
  const totalGhostTasks = ghosts.reduce((s, p) => s + p.ghost_tasks, 0);

  return (
    <div className="space-y-8 mt-4">
      {/* ── Duplicates ─────────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <Copy className="h-4 w-4 text-orange-500" />
            <span className="font-semibold text-sm">Duplicate Tasks</span>
            <Badge className="bg-orange-100 text-orange-700 border-orange-200 text-[10px]">
              {totalDupeTasks} tasks
            </Badge>
          </div>
        </div>
        {totalDupeProps > 0 && (
          <p className="text-xs text-muted-foreground mb-3 ml-6">
            {totalDupeTasks} duplicate tasks across {totalDupeProps} properties — keeping 1 per group would close{' '}
            <span className="font-semibold text-orange-600">{totalDupeTasks} tasks</span>
          </p>
        )}
        {duplicates.length === 0 ? (
          <p className="text-sm text-muted-foreground">No duplicates found.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Property</TableHead>
                <TableHead className="text-right">Duplicates</TableHead>
                <TableHead>Last Activity</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {duplicates.map((p) => (
                <TableRow key={`dup-${p.property_name}`}>
                  <TableCell className="font-medium text-sm">{p.property_name}</TableCell>
                  <TableCell className="text-right">
                    <Badge className="bg-orange-100 text-orange-700 border-orange-200">
                      {p.duplicate_tasks}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{fmtRelative(p.last_task_date)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center gap-1.5 justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 text-[10px] px-2 text-orange-600 border-orange-200 hover:bg-orange-50"
                        title="Keep newest, mark others for closure"
                      >
                        Keep Newest
                      </Button>
                      {p.home_id && (
                        <a
                          href={`https://app.breezeway.io/home/${p.home_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-primary"
                          title="Open property in Breezeway"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* ── Ghosts ─────────────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <Ghost className="h-4 w-4 text-purple-500" />
            <span className="font-semibold text-sm">Ghost Tasks</span>
            <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-[10px]">
              {totalGhostTasks} tasks
            </Badge>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mb-3 ml-6">
          {totalGhostTasks} ghost tasks — these have a completed version already and are safe to close
        </p>
        {ghosts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No ghost tasks found.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Property</TableHead>
                <TableHead className="text-right">Ghosts</TableHead>
                <TableHead>Last Activity</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ghosts.map((p) => (
                <TableRow key={`ghost-${p.property_name}`}>
                  <TableCell className="font-medium text-sm">{p.property_name}</TableCell>
                  <TableCell className="text-right">
                    <Badge className="bg-purple-100 text-purple-700 border-purple-200">
                      {p.ghost_tasks}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{fmtRelative(p.last_task_date)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center gap-1.5 justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 text-[10px] px-2 text-purple-600 border-purple-200 hover:bg-purple-50"
                        title="View the completed version that supersedes this"
                      >
                        View Completed
                      </Button>
                      {p.home_id && (
                        <a
                          href={`https://app.breezeway.io/home/${p.home_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-primary"
                          title="Open in Breezeway"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
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

  const { data: cleanup, isLoading: loadingCleanup } = useQuery<CleanupSummary>({
    queryKey: ['cleanup-summary'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_cleanup_summary' as any);
      if (error) throw error;
      // RPC may return array with 1 row
      return (Array.isArray(data) ? data[0] : data) as CleanupSummary;
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
      const an = Number(av);
      const bn = Number(bv);
      return sortDir === 'asc' ? an - bn : bn - an;
    });

    return rows;
  }, [overview, search, sortKey, sortDir, filter]);

  // ── Grouped rows ─────────────────────────────────────────────────────────────
  // Derive the grouping key from the property name:
  //   - Exclude single-word groups "The" and "Renjoy" (non-rentals)
  //   - If the first word starts with a digit (address-style), use first TWO words
  //   - Otherwise use the FIRST word only
  function getGroupKey(name: string): string {
    const words = name.trim().split(/\s+/);
    const first = words[0] ?? '';
    if (/^\d/.test(first)) return words.slice(0, 2).join(' ');
    if (['the', 'renjoy'].includes(first.toLowerCase())) return name; // no grouping
    return first;
  }

  const groupedRows = useMemo<GroupedRow[]>(() => {
    if (!grouped) {
      return filtered.map((p) => ({ type: 'property', data: p }));
    }
    const groupMap = new Map<string, PropertyOverview[]>();
    for (const p of filtered) {
      const key = getGroupKey(p.property_name);
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key)!.push(p);
    }
    const rows: GroupedRow[] = [];
    for (const [key, items] of groupMap) {
      // Only show group header if 2+ listings share the key
      if (items.length === 1) {
        rows.push({ type: 'property', data: items[0] });
      } else {
        rows.push({
          type: 'group',
          key,
          label: key,
          items,
          expanded: expandedGroups.has(key),
        });
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
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('desc'); }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ChevronsUpDown className="h-3 w-3 opacity-40" />;
    return sortDir === 'asc'
      ? <ChevronUp className="h-3 w-3" />
      : <ChevronDown className="h-3 w-3" />;
  }

  // ── Summary numbers for group rows ───────────────────────────────────────────
  function groupSum(items: PropertyOverview[], key: keyof PropertyOverview): number {
    return items.reduce((s, p) => s + (Number(p[key]) || 0), 0);
  }

  // ── Loading skeleton ──────────────────────────────────────────────────────────
  if (loadingOverview && loadingCleanup) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-screen-2xl">
      {/* Page title */}
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
                <span className="font-bold text-base">{cleanup.total_open?.toLocaleString()}</span>
                {' '}open tasks —{' '}
                <span className="font-bold" style={{ color: 'hsl(30 96% 38%)' }}>
                  {cleanup.total_duplicates?.toLocaleString()} duplicates
                </span>
                {' · '}
                <span className="font-bold" style={{ color: 'hsl(270 60% 45%)' }}>
                  {cleanup.total_ghosts?.toLocaleString()} ghosts
                </span>
                {' · '}
                <span className="font-bold text-red-600">
                  {cleanup.total_stale_90d?.toLocaleString()} stale (90+ days)
                </span>
                {' · '}
                <span className="font-bold" style={{ color: 'hsl(45 80% 38%)' }}>
                  {cleanup.total_unassigned?.toLocaleString()} unassigned
                </span>
              </p>
              {cleanup.top_duplicate_task && (
                <p className="text-sm text-orange-700 mt-1">
                  Worst offender:{' '}
                  <span className="font-medium">{cleanup.top_duplicate_task}</span>
                  {cleanup.top_duplicate_count && (
                    <span className="ml-1 text-orange-500">({cleanup.top_duplicate_count} copies)</span>
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
            {cleanup && (cleanup.total_duplicates + cleanup.total_ghosts) > 0 && (
              <Badge variant="default" className="text-[9px] px-1 py-0 h-3.5 ml-0.5">
                {cleanup.total_duplicates + cleanup.total_ghosts}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── All Properties Tab ─────────────────────────────────────────── */}
        <TabsContent value="properties" className="mt-4">
          {/* Controls */}
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
                <button
                  className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
                  onClick={() => setSearch('')}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Filter chips */}
            {(
              [
                { key: 'all', label: 'All Properties' },
                { key: 'duplicates', label: 'Has Duplicates' },
                { key: 'ghosts', label: 'Has Ghosts' },
                { key: 'overdue', label: 'Overdue > 5' },
              ] as { key: FilterType; label: string }[]
            ).map(({ key, label }) => (
              <Button
                key={key}
                size="sm"
                variant={filter === key ? 'default' : 'outline'}
                className="h-8 text-xs"
                onClick={() => setFilter(key)}
              >
                {label}
              </Button>
            ))}

            <Button
              size="sm"
              variant={grouped ? 'default' : 'outline'}
              className="h-8 text-xs ml-auto"
              onClick={() => setGrouped((g) => !g)}
            >
              Group by Property
            </Button>
          </div>

          {/* Table */}
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  {(
                    [
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
                    ] as { key: SortKey; label: string }[]
                  ).map(({ key, label }, i) => (
                    <TableHead
                      key={`${key}-${i}`}
                      className="cursor-pointer select-none whitespace-nowrap text-xs"
                      onClick={() => handleSort(key)}
                    >
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
                      const cleanup = dupes + ghosts;
                      const score = Math.max(0, Math.min(100,
                        100 - (open * 2) - (overdue * 3) - (dupes * 1) - (ghosts * 1)
                      ));
                      const scoreColor = score >= 80 ? 'text-green-600' : score >= 50 ? 'text-yellow-600' : 'text-destructive';
                      return (
                        <TableRow
                          key={`grp-${row.key}`}
                          className="bg-muted/50 cursor-pointer hover:bg-muted/70 font-medium"
                          onClick={() => toggleGroup(row.key)}
                        >
                          <TableCell className="flex items-center gap-1.5 text-sm">
                            {row.expanded
                              ? <ChevronDown className="h-3.5 w-3.5" />
                              : <ChevronRight className="h-3.5 w-3.5" />}
                            <span className="font-semibold">{row.label}</span>
                            <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 ml-1">
                              {row.items.length} listing{row.items.length !== 1 ? 's' : ''}
                            </Badge>
                          </TableCell>
                          <TableCell><span className={`font-bold text-sm ${scoreColor}`}>{score}</span></TableCell>
                          <TableCell style={{ color: openColor(open), fontWeight: open > 5 ? 700 : undefined }}>{open}</TableCell>
                          <TableCell>{groupSum(row.items, 'in_progress_tasks')}</TableCell>
                          <TableCell className="text-destructive">{overdue || '—'}</TableCell>
                          <TableCell>{groupSum(row.items, 'completed_30d')}</TableCell>
                          <TableCell>—</TableCell>
                          <TableCell>
                            {dupes > 0 && (
                              <Badge className="bg-orange-100 text-orange-700 border-orange-200 text-[10px] px-1">{dupes}</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {ghosts > 0 && (
                              <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-[10px] px-1">{ghosts}</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {cleanup > 0 ? (
                              <span className={`font-semibold text-sm ${cleanup > 5 ? 'text-destructive' : 'text-orange-500'}`}>
                                {cleanup}
                              </span>
                            ) : <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell>—</TableCell>
                          <TableCell>—</TableCell>
                        </TableRow>
                      );
                    }

                    const p = row.data;
                    const isIndented = grouped && groupedRows.some(
                      (r, ri) => ri < idx && r.type === 'group' && r.expanded && r.items.includes(p),
                    );
                    const cleanup = p.duplicate_tasks + p.ghost_tasks;
                    const score = Math.max(0, Math.min(100,
                      100 - (p.open_tasks * 2) - (p.overdue_tasks * 3) - (p.duplicate_tasks * 1) - (p.ghost_tasks * 1)
                    ));
                    const scoreColor = score >= 80 ? 'text-green-600' : score >= 50 ? 'text-yellow-600' : 'text-destructive';
                    const needsAttention = cleanup > 5;

                    return (
                      <TableRow
                        key={p.property_name}
                        className="cursor-pointer hover:bg-accent/30 transition-colors"
                        style={needsAttention ? { borderLeft: '4px solid hsl(30 96% 51%)' } : { borderLeft: '4px solid transparent' }}
                        onClick={() => setSelectedProperty(p.property_name)}
                      >
                        <TableCell className="text-sm font-medium max-w-[200px]">
                          <span className={isIndented ? 'pl-5 block' : ''}>
                            {p.property_name}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={`font-bold text-sm ${scoreColor}`}>{score}</span>
                        </TableCell>
                        <TableCell style={{ color: openColor(p.open_tasks), fontWeight: p.open_tasks > 5 ? 700 : undefined }}>
                          {p.open_tasks}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{p.in_progress_tasks}</TableCell>
                        <TableCell>
                          {p.overdue_tasks > 0
                            ? <span className="text-destructive font-semibold">{p.overdue_tasks}</span>
                            : <span className="text-muted-foreground">0</span>
                          }
                        </TableCell>
                        <TableCell>{p.completed_30d}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{fmtMinutes(p.avg_completion_minutes)}</TableCell>
                        <TableCell>
                          {p.duplicate_tasks > 0
                            ? <Badge className="bg-orange-100 text-orange-700 border-orange-200 text-[10px] px-1.5">{p.duplicate_tasks}</Badge>
                            : <span className="text-muted-foreground">—</span>
                          }
                        </TableCell>
                        <TableCell>
                          {p.ghost_tasks > 0
                            ? <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-[10px] px-1.5">{p.ghost_tasks}</Badge>
                            : <span className="text-muted-foreground">—</span>
                          }
                        </TableCell>
                        <TableCell>
                          {cleanup > 0 ? (
                            <span className={`font-semibold text-sm ${cleanup > 5 ? 'text-destructive' : 'text-orange-500'}`}>
                              {cleanup}
                            </span>
                          ) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>
                          <span
                            className="inline-flex items-center gap-1.5 text-xs"
                            title={p.health_signal ?? ''}
                          >
                            <span
                              className="h-2 w-2 rounded-full shrink-0"
                              style={{ background: healthColor(p.health_signal) }}
                            />
                            <span className="capitalize text-muted-foreground">
                              {p.health_signal ?? '?'}
                            </span>
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {fmtRelative(p.last_task_date)}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>


          {/* Count */}
          {!loadingOverview && (
            <p className="text-xs text-muted-foreground mt-2">
              Showing {filtered.length} of {overview.length} properties
            </p>
          )}
        </TabsContent>

        {/* ── Cleanup Queue Tab ──────────────────────────────────────────── */}
        <TabsContent value="cleanup" className="mt-4">
          <CleanupQueueSection data={overview} cleanup={cleanup} />
        </TabsContent>
      </Tabs>

      {/* Property detail sheet */}
      <PropertyDetailSheet
        propertyName={selectedProperty}
        onClose={() => setSelectedProperty(null)}
      />
    </div>
  );
}

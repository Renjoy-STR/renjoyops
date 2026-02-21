import { useState, useMemo } from 'react';
import { useDateRange } from '@/contexts/DateRangeContext';
import {
  useMaintenanceCounts, useMaintenanceTasksSample, useTopMaintenanceIssues,
  useStaleTasks, useCostTrend, useCostsByCategory, useAssignmentLoad,
  useKanbanTasks, useRecurringTasks, useCostSummary,
} from '@/hooks/supabase';
import { TableSkeleton } from '@/components/dashboard/LoadingSkeleton';
import { KPICard } from '@/components/dashboard/KPICard';
import { ExportCSVButton } from '@/components/dashboard/ExportCSVButton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { FilterBar } from '@/components/dashboard/FilterBar';
import { Tooltip as UITooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Wrench, Clock, DollarSign, AlertTriangle, Kanban, TableIcon, Users, CalendarDays, Info } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend, LineChart, Line, LabelList } from 'recharts';
import { format, parseISO, differenceInDays } from 'date-fns';

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'destructive',
  high: 'default',
  normal: 'secondary',
  low: 'outline',
};

const tooltipStyle = {
  backgroundColor: 'hsl(0, 0%, 100%)',
  border: '1px solid hsl(0, 0%, 90%)',
  borderRadius: '8px',
  fontSize: 12,
};

type ViewMode = 'table' | 'kanban' | 'assignments' | 'recurring';
type SortKey = 'days' | 'priority' | 'property' | 'task' | 'cost' | 'assignees';
type SortDir = 'asc' | 'desc';

const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

const KANBAN_COLUMNS = [
  { id: 'created', label: 'New', codes: ['created', 'drafted'] },
  { id: 'in_progress', label: 'In Progress', codes: ['in_progress'] },
  { id: 'waiting', label: 'Waiting', codes: ['closed'] },
  { id: 'finished', label: 'Done', codes: ['finished'] },
];

export default function MaintenanceTracker() {
  const [filter, setFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [deptFilter, setDeptFilter] = useState('all');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [agingFilter, setAgingFilter] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('days');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const { formatForQuery } = useDateRange();
  const { from, to } = formatForQuery();

  // --- Data Hooks ---
  const { data: maintenanceCounts } = useMaintenanceCounts(from, to);
  const { data: maintenanceTasks } = useMaintenanceTasksSample(from, to);
  const { data: topIssues, isLoading: l1 } = useTopMaintenanceIssues();
  const { data: staleTasks, isLoading: l2 } = useStaleTasks();
  const { data: costTrend } = useCostTrend(from, to);
  const { data: costsByCategory } = useCostsByCategory(from, to);
  const { data: assignmentLoad } = useAssignmentLoad();
  const { data: kanbanTasks } = useKanbanTasks(from, to, viewMode === 'kanban');
  const { data: recurringTasks } = useRecurringTasks(viewMode === 'recurring');
  const { data: costs } = useCostSummary(from, to);

  const totalLabor = costs?.filter(c => c.cost_type_code === 'labor').reduce((s, c) => s + (c.cost || 0), 0) ?? 0;
  const totalMaterial = costs?.filter(c => c.cost_type_code === 'material').reduce((s, c) => s + (c.cost || 0), 0) ?? 0;
  const costPie = [{ name: 'Labor', value: Math.round(totalLabor) }, { name: 'Material', value: Math.round(totalMaterial) }];

  const resolvedTasks = maintenanceTasks?.filter(t => t.created_at && t.finished_at) ?? [];
  const avgResolution = resolvedTasks.length > 0
    ? Math.round(resolvedTasks.reduce((s, t) => s + differenceInDays(parseISO(t.finished_at!), parseISO(t.created_at)), 0) / resolvedTasks.length)
    : 0;

  const agingBuckets = useMemo(() => {
    const buckets = [
      { id: '0-7', label: '0-7d', min: 0, max: 7, count: 0, color: 'bg-chart-4' },
      { id: '8-30', label: '8-30d', min: 8, max: 30, count: 0, color: 'bg-warning' },
      { id: '31-90', label: '31-90d', min: 31, max: 90, count: 0, color: 'bg-primary' },
      { id: '90+', label: '90d+', min: 91, max: 99999, count: 0, color: 'bg-destructive' },
    ];
    staleTasks?.forEach(t => {
      const days = t.days_overdue ?? t.days_since_created ?? 0;
      const bucket = buckets.find(b => days >= b.min && days <= b.max);
      if (bucket) bucket.count++;
    });
    return buckets;
  }, [staleTasks]);

  const totalStale = agingBuckets.reduce((s, b) => s + b.count, 0);
  const unnamedCount = staleTasks?.filter(t => !t.task_name || t.task_name.trim() === '').length ?? 0;

  const filteredStale = useMemo(() => {
    let result = staleTasks?.filter(t => {
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
      if (deptFilter !== 'all' && t.department !== deptFilter) return false;
      if (agingFilter) {
        const bucket = agingBuckets.find(b => b.id === agingFilter);
        if (bucket) {
          const days = t.days_overdue ?? t.days_since_created ?? 0;
          if (days < bucket.min || days > bucket.max) return false;
        }
      }
      const q = filter.toLowerCase();
      return !q || t.property_name?.toLowerCase().includes(q) || t.task_name?.toLowerCase().includes(q) || t.assignees?.toLowerCase().includes(q);
    }) ?? [];

    result.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'days': cmp = (a.days_overdue ?? 0) - (b.days_overdue ?? 0); break;
        case 'priority': cmp = (PRIORITY_ORDER[a.priority ?? ''] ?? 9) - (PRIORITY_ORDER[b.priority ?? ''] ?? 9); break;
        case 'property': cmp = (a.property_name ?? '').localeCompare(b.property_name ?? ''); break;
        case 'task': cmp = (a.task_name ?? '').localeCompare(b.task_name ?? ''); break;
        case 'assignees': cmp = (a.assignees ?? '').localeCompare(b.assignees ?? ''); break;
        default: cmp = 0;
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });

    return result;
  }, [staleTasks, priorityFilter, deptFilter, filter, agingFilter, agingBuckets, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const sortIcon = (key: SortKey) => sortKey === key ? (sortDir === 'desc' ? ' ↓' : ' ↑') : '';

  const totalMaintenance = maintenanceCounts?.total ?? 0;
  const finishedMaintenance = maintenanceCounts?.finished ?? 0;

  const issueChartData = topIssues?.slice(0, 10).map(i => ({
    name: (i as any).task_type?.slice(0, 30) ?? 'Unknown',
    count: (i as any).occurrences ?? 0,
  })).reverse() ?? [];

  const exportData = filteredStale.map(t => ({
    Property: t.property_name,
    Task: t.task_name || 'Unnamed',
    Priority: t.priority,
    Status: t.status_code,
    'Days Overdue': t.days_overdue ?? t.days_since_created ?? 0,
    Assignees: t.assignees,
  }));

  const sparseData = (costTrend?.slice(-3) ?? []).some(m => m.entries < 5);

  const recurringByMonth = useMemo(() => {
    if (!recurringTasks) return {};
    const grouped: Record<string, typeof recurringTasks> = {};
    recurringTasks.forEach(t => {
      const month = t.scheduled_date ? format(parseISO(t.scheduled_date), 'MMMM yyyy') : 'Unscheduled';
      if (!grouped[month]) grouped[month] = [];
      grouped[month].push(t);
    });
    return grouped;
  }, [recurringTasks]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Maintenance Tracker</h2>
          <p className="text-sm text-muted-foreground">Triage, aging analysis, cost tracking & team load</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportCSVButton data={exportData} filename="stale-tasks" label="Export" />
          <div className="flex rounded-md border border-border overflow-hidden">
            {([
              { mode: 'table' as ViewMode, icon: TableIcon, label: 'Table' },
              { mode: 'kanban' as ViewMode, icon: Kanban, label: 'Kanban' },
              { mode: 'assignments' as ViewMode, icon: Users, label: 'Load' },
              { mode: 'recurring' as ViewMode, icon: CalendarDays, label: 'Schedule' },
            ]).map(v => (
              <button
                key={v.mode}
                onClick={() => setViewMode(v.mode)}
                className={`px-2 py-1.5 text-xs flex items-center gap-1 transition-colors ${viewMode === v.mode ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted'}`}
              >
                <v.icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{v.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {unnamedCount > 0 && (
        <div className="glass-card p-3 border-l-4 border-l-warning flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
          <span className="text-xs"><strong>{unnamedCount} tasks</strong> are missing names/descriptions — these need data cleanup in Breezeway.</span>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <KPICard title="Maintenance Tasks" value={totalMaintenance.toLocaleString()} icon={Wrench} />
        <KPICard title="Resolved" value={finishedMaintenance.toLocaleString()} icon={Wrench} subtitle={`${totalMaintenance > 0 ? Math.round((finishedMaintenance / totalMaintenance) * 100) : 0}% rate`} />
        <KPICard title="Avg Resolution" value={`${avgResolution}d`} icon={Clock} />
        <KPICard title="Total Spend" value={`$${Math.round(totalLabor + totalMaterial).toLocaleString()}`} icon={DollarSign} />
      </div>

      <div className="glass-card rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Aging Buckets ({totalStale} overdue)</h3>
          {agingFilter && (
            <button onClick={() => setAgingFilter(null)} className="text-xs text-primary hover:underline">Clear filter</button>
          )}
        </div>
        <div className="flex gap-2 mb-3">
          {agingBuckets.map(b => (
            <button key={b.id} onClick={() => setAgingFilter(agingFilter === b.id ? null : b.id)}
              className={`flex-1 rounded-lg p-3 text-center transition-all border-2 ${agingFilter === b.id ? 'border-primary ring-1 ring-primary/30' : 'border-transparent'}`}>
              <p className="text-2xl font-bold">{b.count}</p>
              <p className="text-[10px] text-muted-foreground">{b.label}</p>
            </button>
          ))}
        </div>
        <div className="flex h-3 rounded-full overflow-hidden bg-muted">
          {agingBuckets.map(b => (
            <div key={b.id} className={`${b.color} transition-all`} style={{ width: totalStale > 0 ? `${(b.count / totalStale) * 100}%` : '0%' }} />
          ))}
        </div>
        <div className="flex justify-between mt-1">
          {agingBuckets.map(b => (<span key={b.id} className="text-[9px] text-muted-foreground">{b.label}</span>))}
        </div>
      </div>

      {viewMode === 'table' && (
        <>
          <div className="grid lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 glass-card rounded-lg p-5">
              <h3 className="text-sm font-semibold mb-4">Most Common Issues</h3>
              {l1 ? <div className="h-64" /> : (
                <ResponsiveContainer width="100%" height={Math.max(300, issueChartData.length * 32)}>
                  <BarChart data={issueChartData} layout="vertical" margin={{ left: 10, right: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(0, 0%, 90%)" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(240, 4%, 40%)' }} />
                    <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 9, fill: 'hsl(240, 4%, 40%)' }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="count" fill="hsl(5, 87%, 55%)" radius={[0, 4, 4, 0]} name="Occurrences" barSize={20}>
                      <LabelList dataKey="count" position="right" fontSize={10} fill="hsl(240, 4%, 40%)" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="glass-card rounded-lg p-5">
              <h3 className="text-sm font-semibold mb-4">Cost Breakdown</h3>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={costPie} cx="50%" cy="50%" innerRadius={50} outerRadius={75} dataKey="value" paddingAngle={3}>
                    <Cell fill="hsl(5, 87%, 55%)" />
                    <Cell fill="hsl(210, 60%, 55%)" />
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `$${v.toLocaleString()}`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                <p>Labor: ${Math.round(totalLabor).toLocaleString()}</p>
                <p>Material: ${Math.round(totalMaterial).toLocaleString()}</p>
                <p className="font-medium text-foreground">Total: ${Math.round(totalLabor + totalMaterial).toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <div className="glass-card rounded-lg p-5">
              <h3 className="text-sm font-semibold mb-3">Cost by Category</h3>
              {costsByCategory?.byCategory && costsByCategory.byCategory.length > 0 ? (
                <div className="space-y-2">
                  {costsByCategory.byCategory.map((c, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="truncate flex-1 mr-2">{c.category}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <Progress value={(c.cost / (costsByCategory.byCategory[0]?.cost || 1)) * 100} className="w-20 h-1.5" />
                        <span className="font-mono w-16 text-right">${c.cost.toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p className="text-xs text-muted-foreground">No cost data</p>}
            </div>
            <div className="glass-card rounded-lg p-5">
              <h3 className="text-sm font-semibold mb-3">Top Properties by Cost</h3>
              {costsByCategory?.byProperty && costsByCategory.byProperty.length > 0 ? (
                <div className="space-y-2">
                  {costsByCategory.byProperty.map((p, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="truncate flex-1 mr-2">{p.name}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <Progress value={(p.cost / (costsByCategory.byProperty[0]?.cost || 1)) * 100} className="w-20 h-1.5" />
                        <span className="font-mono w-16 text-right">${p.cost.toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p className="text-xs text-muted-foreground">No cost data</p>}
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <div className="glass-card rounded-lg p-5">
              <h3 className="text-sm font-semibold mb-4">Monthly Maintenance Spend</h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={costTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(0, 0%, 90%)" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'hsl(240, 4%, 40%)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(240, 4%, 40%)' }} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `$${v.toLocaleString()}`} />
                  <Line type="monotone" dataKey="cost" stroke="hsl(5, 87%, 55%)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
              {sparseData && (
                <p className="text-[10px] text-warning mt-2 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Limited cost data for recent months
                </p>
              )}
            </div>
            <div className="glass-card rounded-lg p-5">
              <h3 className="text-sm font-semibold mb-4">Stale Task Aging</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={agingBuckets}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(0, 0%, 90%)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(240, 4%, 40%)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(240, 4%, 40%)' }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="count" fill="hsl(210, 60%, 55%)" radius={[4, 4, 0, 0]} name="Tasks">
                    <LabelList dataKey="count" position="top" fontSize={10} fill="hsl(240, 4%, 40%)" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass-card rounded-lg p-5">
            <div className="flex flex-col gap-3 mb-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <h3 className="text-sm font-semibold">
                  Overdue Tasks ({filteredStale.length})
                  {agingFilter && <Badge variant="outline" className="ml-2 text-[9px]">Filtered: {agingFilter}</Badge>}
                </h3>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Filter tasks..." value={filter} onChange={(e) => setFilter(e.target.value)} className="pl-9 h-8 text-sm" />
                </div>
              </div>
              <div className="flex flex-wrap gap-4">
                <FilterBar label="Priority" options={['all', 'urgent', 'high', 'normal', 'low']} value={priorityFilter} onChange={setPriorityFilter} />
                <FilterBar label="Dept" options={['all', 'housekeeping', 'maintenance', 'inspection']} value={deptFilter} onChange={setDeptFilter} />
              </div>
            </div>
            {l2 ? <TableSkeleton /> : (
              <div className="overflow-auto max-h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs cursor-pointer select-none" onClick={() => handleSort('property')}>Property{sortIcon('property')}</TableHead>
                      <TableHead className="text-xs cursor-pointer select-none" onClick={() => handleSort('task')}>Task{sortIcon('task')}</TableHead>
                      <TableHead className="text-xs cursor-pointer select-none" onClick={() => handleSort('priority')}>Priority{sortIcon('priority')}</TableHead>
                      <TableHead className="text-xs hidden sm:table-cell">Status</TableHead>
                      <TableHead className="text-xs text-right cursor-pointer select-none" onClick={() => handleSort('days')}>Days Overdue{sortIcon('days')}</TableHead>
                      <TableHead className="text-xs hidden sm:table-cell cursor-pointer select-none" onClick={() => handleSort('assignees')}>Assignees{sortIcon('assignees')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStale.slice(0, 50).map((t) => (
                      <TableRow key={t.breezeway_id}>
                        <TableCell className="text-sm max-w-[150px] truncate">{t.property_name}</TableCell>
                        <TableCell className="text-sm max-w-[150px] truncate">
                          {t.task_name || (
                            <span className="text-warning flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" /> Missing name
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={PRIORITY_COLORS[t.priority ?? ''] as any ?? 'secondary'} className="text-[10px]">{t.priority}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground hidden sm:table-cell">{t.status_code}</TableCell>
                        <TableCell className={`text-right font-mono text-sm ${(t.days_overdue ?? 0) > 30 ? 'text-destructive' : ''}`}>
                          {t.days_overdue ?? t.days_since_created ?? '—'}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate hidden sm:table-cell">{t.assignees || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </>
      )}

      {viewMode === 'kanban' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {KANBAN_COLUMNS.map(col => {
            const colTasks = kanbanTasks?.filter(t => col.codes.includes(t.status_code ?? '')) ?? [];
            return (
              <div key={col.id} className="glass-card rounded-lg p-3">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-semibold">{col.label}</h4>
                  <Badge variant="outline" className="text-[9px]">{colTasks.length}</Badge>
                </div>
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {colTasks.slice(0, 30).map(t => (
                    <div key={t.breezeway_id} className="bg-muted/50 rounded-md p-2.5 border border-border/50 hover:border-primary/30 transition-colors">
                      <p className="text-xs font-medium truncate">{t.name || 'Unnamed'}</p>
                      <p className="text-[10px] text-muted-foreground truncate mt-0.5">{t.property_name}</p>
                      <div className="flex items-center justify-between mt-1.5">
                        <Badge variant={PRIORITY_COLORS[t.priority ?? ''] as any ?? 'secondary'} className="text-[8px]">{t.priority}</Badge>
                        {t.total_cost && <span className="text-[10px] font-mono">${Number(t.total_cost).toFixed(0)}</span>}
                      </div>
                    </div>
                  ))}
                  {colTasks.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No tasks</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {viewMode === 'assignments' && (
        <div className="glass-card rounded-lg p-5">
          <h3 className="text-sm font-semibold mb-4">Technician Assignment Load (Open Maintenance Tasks)</h3>
          {assignmentLoad && assignmentLoad.length > 0 ? (
            <div className="space-y-3">
              {assignmentLoad.map((a, i) => {
                const maxLoad = assignmentLoad[0]?.open_tasks || 1;
                const pct = (a.open_tasks / maxLoad) * 100;
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-sm font-medium w-40 truncate">{a.name}</span>
                    <div className="flex-1">
                      <Progress value={pct} className={`h-5 ${pct > 80 ? '[&>div]:bg-destructive' : pct > 50 ? '[&>div]:bg-warning' : '[&>div]:bg-chart-4'}`} />
                    </div>
                    <span className="font-mono text-sm font-bold w-12 text-right">{a.open_tasks}</span>
                    {a.open_tasks > 100 && (
                      <UITooltip>
                        <TooltipTrigger><AlertTriangle className="h-4 w-4 text-destructive" /></TooltipTrigger>
                        <TooltipContent>Overloaded — consider redistributing</TooltipContent>
                      </UITooltip>
                    )}
                  </div>
                );
              })}
            </div>
          ) : <p className="text-xs text-muted-foreground">No assignment data</p>}
        </div>
      )}

      {viewMode === 'recurring' && (
        <div className="glass-card rounded-lg p-5">
          <h3 className="text-sm font-semibold mb-4">Recurring / Preventive Maintenance Schedule</h3>
          {Object.keys(recurringByMonth).length > 0 ? (
            <div className="space-y-6">
              {Object.entries(recurringByMonth).map(([month, tasks]) => (
                <div key={month}>
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">{month}</h4>
                  <div className="space-y-1">
                    {tasks.map((t, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded bg-muted/30 text-xs">
                        <div className="flex items-center gap-2 flex-1 truncate">
                          <Badge variant="outline" className="text-[8px] shrink-0">{t.tag_list?.slice(0, 15)}</Badge>
                          <span className="truncate">{t.name}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-muted-foreground">{t.property_name?.slice(0, 20)}</span>
                          <Badge variant={t.status_code === 'finished' ? 'secondary' : 'default'} className="text-[8px]">{t.status_code}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="text-xs text-muted-foreground">No recurring maintenance tasks found</p>}
        </div>
      )}
    </div>
  );
}

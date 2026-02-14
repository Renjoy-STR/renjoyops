import { useState, useMemo, Fragment } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useDateRange } from '@/contexts/DateRangeContext';
import { useTimeeroSchema, useTimeeroData } from '@/hooks/useTimeeroSchema';
import { normalizeName, matchNames } from '@/lib/nameMatch';
import { KPICard } from '@/components/dashboard/KPICard';
import { ExportCSVButton } from '@/components/dashboard/ExportCSVButton';
import { EmptyState } from '@/components/dashboard/EmptyState';
import { CardSkeleton, TableSkeleton } from '@/components/dashboard/LoadingSkeleton';
import { FilterBar } from '@/components/dashboard/FilterBar';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, LineChart, Line, Legend, ReferenceLine, ZAxis, Cell,
} from 'recharts';
import { Gauge, Clock, DollarSign, TrendingUp, TrendingDown, Search, ChevronDown, ChevronRight, AlertTriangle, ArrowUpDown } from 'lucide-react';
import { format, parseISO, startOfWeek, startOfMonth, getDay, getHours } from 'date-fns';
import { Link } from 'react-router-dom';

// ─── Types ──────────────────────────────────────────────────────────
interface PersonAccountability {
  name: string;
  department: string;
  clockedHours: number;
  taskHours: number;
  unaccountedHours: number;
  unaccountedCost: number;
  productivityRatio: number;
  dailyBreakdown: DailyEntry[];
}

interface DailyEntry {
  date: string;
  clockedHours: number;
  taskHours: number;
  tasksCompleted: number;
  unaccounted: number;
  ratio: number;
  flagged: boolean;
}

interface TimesheetException {
  type: 'long_day' | 'low_hours_tasks' | 'no_tasks' | 'large_gap';
  name: string;
  date: string;
  detail: string;
  severity: 'warning' | 'error';
}

type SortKey = 'name' | 'department' | 'clockedHours' | 'taskHours' | 'unaccountedHours' | 'unaccountedCost' | 'productivityRatio';
type ViewMode = 'daily' | 'weekly' | 'monthly';

// ─── Constants ──────────────────────────────────────────────────────
const tooltipStyle = {
  backgroundColor: 'hsl(var(--background))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
  fontSize: 12,
};

const DEPT_COLORS: Record<string, string> = {
  housekeeping: 'hsl(var(--primary))',
  maintenance: 'hsl(210, 60%, 55%)',
  inspection: 'hsl(160, 60%, 50%)',
};

const COST_PER_HOUR = 18;

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ─── Component ──────────────────────────────────────────────────────
export default function TimeAccountability() {
  const { formatForQuery } = useDateRange();
  const { from, to } = formatForQuery();
  const { data: schema, isLoading: schemaLoading } = useTimeeroSchema();
  const { data: timeeroRaw } = useTimeeroData(from, to, schema);

  const [deptFilter, setDeptFilter] = useState('all');
  const [personSearch, setPersonSearch] = useState('');
  const [minHours, setMinHours] = useState(0);
  const [expandedPerson, setExpandedPerson] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('unaccountedHours');
  const [sortAsc, setSortAsc] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('daily');

  // ─── Breezeway data ───────────────────────────────────────────────
  const { data: breezeData, isLoading: breezeLoading } = useQuery({
    queryKey: ['accountability-breezeway', from, to],
    queryFn: async () => {
      const { data: tasks } = await supabase
        .from('breezeway_tasks')
        .select('breezeway_id, department, status_code, total_time_minutes, finished_at, started_at')
        .eq('status_code', 'finished')
        .not('total_time_minutes', 'is', null)
        .gte('finished_at', from)
        .lte('finished_at', to);
      if (!tasks?.length) return { tasks: [], assignments: [] };

      const taskIds = tasks.map(t => t.breezeway_id);
      let allAssignments: { task_id: string; assignee_name: string }[] = [];
      for (let i = 0; i < taskIds.length; i += 500) {
        const { data: a } = await supabase
          .from('breezeway_task_assignments')
          .select('task_id, assignee_name')
          .in('task_id', taskIds.slice(i, i + 500));
        if (a) allAssignments = allAssignments.concat(a);
      }
      return { tasks, assignments: allAssignments };
    },
  });

  // ─── Core accountability computation ──────────────────────────────
  const { accountabilityData, exceptions, heatmapData } = useMemo(() => {
    const empty = { accountabilityData: [] as PersonAccountability[], exceptions: [] as TimesheetException[], heatmapData: [] as { day: number; hour: number; count: number }[] };
    if (!timeeroRaw?.length || !breezeData?.tasks.length || !schema) return empty;

    // Timeero per-person per-day
    const timeeroByPersonDay: Record<string, Record<string, number>> = {};
    const timeeroNames = new Set<string>();
    const timeeroPersonDept: Record<string, string> = {};

    // Heatmap: clock-in patterns by day-of-week × hour
    const heatMap: Record<string, number> = {};

    for (const entry of timeeroRaw) {
      const eName = entry.employee_name;
      if (!eName) continue;
      timeeroNames.add(eName);

      const hours = entry.duration_hours;
      const clockIn = entry.clock_in_time;
      const dateKey = clockIn ? String(clockIn).slice(0, 10) : '';
      if (!dateKey) continue;

      if (!timeeroByPersonDay[eName]) timeeroByPersonDay[eName] = {};
      timeeroByPersonDay[eName][dateKey] = (timeeroByPersonDay[eName][dateKey] || 0) + hours;

      // Heatmap data
      try {
        const d = parseISO(clockIn);
        const dayOfWeek = getDay(d);
        const hourOfDay = getHours(d);
        const key = `${dayOfWeek}-${hourOfDay}`;
        heatMap[key] = (heatMap[key] || 0) + 1;
      } catch {}
    }

    const heatmapData = Object.entries(heatMap).map(([key, count]) => {
      const [day, hour] = key.split('-').map(Number);
      return { day, hour, count };
    });

    // Name matching
    const breezeNames = [...new Set(breezeData.assignments.map(a => a.assignee_name).filter(Boolean))];
    const nameMap = matchNames(breezeNames, [...timeeroNames]);

    // Breezeway per-person per-day
    const taskMap = new Map(breezeData.tasks.map(t => [t.breezeway_id, t]));
    const breezeByPersonDay: Record<string, Record<string, { hours: number; count: number; firstStart: string | null }>> = {};
    const breezePersonDept: Record<string, string> = {};

    for (const a of breezeData.assignments) {
      if (!a.assignee_name) continue;
      const task = taskMap.get(a.task_id);
      if (!task) continue;
      const dateKey = task.finished_at?.slice(0, 10);
      if (!dateKey) continue;
      if (!breezeByPersonDay[a.assignee_name]) breezeByPersonDay[a.assignee_name] = {};
      if (!breezeByPersonDay[a.assignee_name][dateKey]) breezeByPersonDay[a.assignee_name][dateKey] = { hours: 0, count: 0, firstStart: null };
      breezeByPersonDay[a.assignee_name][dateKey].hours += (task.total_time_minutes || 0) / 60;
      breezeByPersonDay[a.assignee_name][dateKey].count++;
      if (task.department) breezePersonDept[a.assignee_name] = task.department;
    }

    // Merge and compute exceptions
    const allExceptions: TimesheetException[] = [];
    const results: PersonAccountability[] = [];

    for (const [breezeName, timeeroName] of nameMap) {
      const timeero = timeeroByPersonDay[timeeroName] ?? {};
      const breeze = breezeByPersonDay[breezeName] ?? {};
      const allDates = new Set([...Object.keys(timeero), ...Object.keys(breeze)]);
      let totalClocked = 0, totalTasked = 0;
      const daily: DailyEntry[] = [];

      for (const date of allDates) {
        const clocked = timeero[date] || 0;
        const taskH = breeze[date]?.hours || 0;
        const taskCount = breeze[date]?.count || 0;
        const unaccounted = Math.max(0, clocked - taskH);
        const ratio = clocked > 0 ? Math.round((taskH / clocked) * 100) : taskH > 0 ? 100 : 0;
        totalClocked += clocked;
        totalTasked += taskH;
        daily.push({
          date,
          clockedHours: Math.round(clocked * 10) / 10,
          taskHours: Math.round(taskH * 10) / 10,
          tasksCompleted: taskCount,
          unaccounted: Math.round(unaccounted * 10) / 10,
          ratio,
          flagged: clocked >= 8 && taskH < 2,
        });

        // Exception: >10 hours in a day
        if (clocked > 10) {
          allExceptions.push({ type: 'long_day', name: breezeName, date, detail: `${Math.round(clocked * 10) / 10}h clocked`, severity: 'error' });
        }
        // Exception: <2h clocked but tasks completed
        if (clocked > 0 && clocked < 2 && taskCount > 0) {
          allExceptions.push({ type: 'low_hours_tasks', name: breezeName, date, detail: `${clocked}h clocked, ${taskCount} tasks done`, severity: 'warning' });
        }
        // Exception: clocked in but no tasks
        if (clocked > 2 && taskCount === 0) {
          allExceptions.push({ type: 'no_tasks', name: breezeName, date, detail: `${Math.round(clocked * 10) / 10}h clocked, 0 tasks`, severity: 'warning' });
        }
      }

      daily.sort((a, b) => b.date.localeCompare(a.date));
      const dept = timeeroPersonDept[timeeroName] || breezePersonDept[breezeName] || 'unknown';
      const unaccH = Math.round(Math.max(0, totalClocked - totalTasked) * 10) / 10;
      results.push({
        name: breezeName,
        department: dept,
        clockedHours: Math.round(totalClocked * 10) / 10,
        taskHours: Math.round(totalTasked * 10) / 10,
        unaccountedHours: unaccH,
        unaccountedCost: Math.round(unaccH * COST_PER_HOUR),
        productivityRatio: totalClocked > 0 ? Math.round((totalTasked / totalClocked) * 100) : 0,
        dailyBreakdown: daily,
      });
    }

    // People with only Breezeway data
    for (const bn of breezeNames) {
      if (nameMap.has(bn)) continue;
      const breeze = breezeByPersonDay[bn];
      if (!breeze) continue;
      let totalTasked = 0;
      const daily: DailyEntry[] = [];
      for (const [date, v] of Object.entries(breeze)) {
        totalTasked += v.hours;
        daily.push({ date, clockedHours: 0, taskHours: Math.round(v.hours * 10) / 10, tasksCompleted: v.count, unaccounted: 0, ratio: 100, flagged: false });
      }
      daily.sort((a, b) => b.date.localeCompare(a.date));
      results.push({
        name: bn,
        department: breezePersonDept[bn] || 'unknown',
        clockedHours: 0,
        taskHours: Math.round(totalTasked * 10) / 10,
        unaccountedHours: 0,
        unaccountedCost: 0,
        productivityRatio: 0,
        dailyBreakdown: daily,
      });
    }

    return {
      accountabilityData: results.sort((a, b) => b.unaccountedHours - a.unaccountedHours),
      exceptions: allExceptions.sort((a, b) => (a.severity === 'error' ? -1 : 1) - (b.severity === 'error' ? -1 : 1)),
      heatmapData,
    };
  }, [timeeroRaw, breezeData, schema]);

  // ─── Filtered + sorted data ───────────────────────────────────────
  const filtered = useMemo(() => {
    let data = accountabilityData.filter(p => {
      if (deptFilter !== 'all' && p.department !== deptFilter) return false;
      if (personSearch && !p.name.toLowerCase().includes(personSearch.toLowerCase())) return false;
      if (p.clockedHours < minHours) return false;
      return true;
    });
    data.sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (typeof aVal === 'string' && typeof bVal === 'string') return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      return sortAsc ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
    return data;
  }, [accountabilityData, deptFilter, personSearch, minHours, sortKey, sortAsc]);

  // ─── KPIs ─────────────────────────────────────────────────────────
  const withClocked = filtered.filter(p => p.clockedHours > 0);
  const avgRatio = withClocked.length > 0 ? Math.round(withClocked.reduce((s, p) => s + p.productivityRatio, 0) / withClocked.length) : 0;
  const totalUnaccounted = Math.round(filtered.reduce((s, p) => s + p.unaccountedHours, 0));
  const withBothData = withClocked.filter(p => p.taskHours > 0 && p.clockedHours > 0);
  const mostProductive = [...withBothData].filter(p => p.productivityRatio <= 100).sort((a, b) => b.productivityRatio - a.productivityRatio)[0];
  const leastProductive = [...withBothData].filter(p => p.clockedHours >= 20).sort((a, b) => a.productivityRatio - b.productivityRatio)[0];
  const dataMismatches = withClocked.filter(p => p.productivityRatio > 100);
  const ghostCost = Math.round(totalUnaccounted * COST_PER_HOUR);

  // ─── Scatter data (respects dept filter) ──────────────────────────
  const scatterData = withClocked.map(p => {
    const days = p.dailyBreakdown.filter(d => d.clockedHours > 0).length || 1;
    return {
      name: p.name,
      department: p.department,
      avgClocked: Math.round((p.clockedHours / days) * 10) / 10,
      avgTasked: Math.round((p.taskHours / days) * 10) / 10,
      fill: DEPT_COLORS[p.department] || 'hsl(var(--muted-foreground))',
    };
  });

  // ─── Department comparison (respects dept filter) ─────────────────
  const deptComparison = useMemo(() => {
    const byDept: Record<string, { clocked: number; tasked: number; count: number }> = {};
    for (const p of withClocked) {
      if (!byDept[p.department]) byDept[p.department] = { clocked: 0, tasked: 0, count: 0 };
      byDept[p.department].clocked += p.clockedHours;
      byDept[p.department].tasked += p.taskHours;
      byDept[p.department].count++;
    }
    return Object.entries(byDept).map(([dept, v]) => ({
      name: dept,
      'Clocked Hours': Math.round(v.clocked),
      'Task Hours': Math.round(v.tasked),
    }));
  }, [withClocked]);

  // ─── Trend data (weekly or monthly) ───────────────────────────────
  const trendData = useMemo(() => {
    if (!withClocked.length) return [];
    const allDaily = withClocked.flatMap(p => p.dailyBreakdown.filter(d => d.clockedHours > 0));
    const byPeriod: Record<string, { clocked: number; tasked: number }> = {};
    for (const d of allDaily) {
      const key = viewMode === 'monthly'
        ? format(parseISO(d.date), 'yyyy-MM')
        : format(startOfWeek(parseISO(d.date)), 'yyyy-MM-dd');
      if (!byPeriod[key]) byPeriod[key] = { clocked: 0, tasked: 0 };
      byPeriod[key].clocked += d.clockedHours;
      byPeriod[key].tasked += d.taskHours;
    }
    return Object.entries(byPeriod).sort().map(([period, v]) => ({
      period: viewMode === 'monthly' ? period : period.slice(5),
      ratio: v.clocked > 0 ? Math.round((v.tasked / v.clocked) * 100) : 0,
      clocked: Math.round(v.clocked),
      tasked: Math.round(v.tasked),
    }));
  }, [withClocked, viewMode]);

  // ─── Filtered exceptions (respects dept filter) ───────────────────
  const filteredExceptions = useMemo(() => {
    if (deptFilter === 'all') return exceptions.slice(0, 15);
    const deptPeople = new Set(accountabilityData.filter(p => p.department === deptFilter).map(p => p.name));
    return exceptions.filter(e => deptPeople.has(e.name)).slice(0, 15);
  }, [exceptions, deptFilter, accountabilityData]);

  const isLoading = schemaLoading || breezeLoading;
  const noTimeero = !schemaLoading && !schema;
  const departments = [...new Set(accountabilityData.map(p => p.department))];

  const exportData = filtered.map(p => ({
    Name: p.name,
    Department: p.department,
    'Clocked Hours': p.clockedHours,
    'Task Hours': p.taskHours,
    'Unaccounted Hours': p.unaccountedHours,
    'Est. Cost ($)': p.unaccountedCost,
    'Productivity %': p.productivityRatio,
  }));

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  }

  function SortHeader({ label, col, className = '' }: { label: string; col: SortKey; className?: string }) {
    return (
      <TableHead className={`text-xs cursor-pointer select-none hover:text-primary transition-colors ${className}`} onClick={() => handleSort(col)}>
        <span className="inline-flex items-center gap-1">
          {label}
          {sortKey === col && <ArrowUpDown className="h-3 w-3" />}
        </span>
      </TableHead>
    );
  }

  // ─── Heatmap rendering ────────────────────────────────────────────
  const maxHeat = Math.max(1, ...heatmapData.map(h => h.count));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-primary tracking-tight">Time Accountability</h2>
          <p className="text-sm text-muted-foreground">Cross-reference Breezeway tasks with Timeero clock data</p>
        </div>
        <ExportCSVButton data={exportData} filename="time-accountability" />
      </div>

      {noTimeero && (
        <div className="rounded-lg border border-warning/40 bg-warning/10 p-4">
          <p className="text-sm font-medium">Timeero data not found</p>
          <p className="text-xs text-muted-foreground mt-1">
            No Timeero table was detected. Showing Breezeway task data only.
          </p>
        </div>
      )}

      {/* ── Timesheet Exceptions Alert ───────────────────────────────── */}
      {!isLoading && filteredExceptions.length > 0 && (
        <div className="bg-card rounded-lg border border-destructive/20 p-4 shadow-sm">
          <h3 className="text-sm font-bold text-destructive flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4" /> Timesheet Exceptions ({filteredExceptions.length})
          </h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[200px] overflow-auto">
            {filteredExceptions.map((e, i) => (
              <div key={i} className={`flex items-start gap-2 p-2 rounded-md text-xs ${e.severity === 'error' ? 'bg-destructive/5 border border-destructive/20' : 'bg-warning/5 border border-warning/20'}`}>
                <Badge variant={e.severity === 'error' ? 'destructive' : 'outline'} className="text-[9px] shrink-0 mt-0.5">
                  {e.type === 'long_day' ? '>10h Day' : e.type === 'low_hours_tasks' ? '<2h + Tasks' : e.type === 'no_tasks' ? 'No Tasks' : 'Gap'}
                </Badge>
                <div>
                  <span className="font-medium">{e.name}</span>
                  <span className="text-muted-foreground ml-1">({e.date})</span>
                  <p className="text-muted-foreground">{e.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Data Quality */}
      {!isLoading && accountabilityData.length > 0 && (
        <div className="rounded-lg border border-border/50 bg-muted/30 p-3 flex items-center gap-3 text-xs">
          <Badge variant="outline" className="text-[10px]">Data Quality</Badge>
          <span className="text-muted-foreground">
            {withBothData.length} of {accountabilityData.length} people matched between Breezeway &amp; Timeero.
            {dataMismatches.length > 0 && (
              <span className="text-warning ml-1">{dataMismatches.length} with &gt;100% ratio.</span>
            )}
          </span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => <CardSkeleton key={i} />)
        ) : (
          <>
            <KPICard title="Avg Productivity" value={`${avgRatio}%`} icon={Gauge} accent />
            <KPICard title="Unaccounted Hours" value={totalUnaccounted.toLocaleString()} icon={Clock} accent={totalUnaccounted > 100} />
            <KPICard title="Most Productive" value={mostProductive?.name?.split(' ')[0] ?? '—'} subtitle={mostProductive ? `${mostProductive.productivityRatio}%` : ''} icon={TrendingUp} />
            <KPICard title="Least Productive" value={leastProductive?.name?.split(' ')[0] ?? '—'} subtitle={leastProductive ? `${leastProductive.productivityRatio}%` : ''} icon={TrendingDown} />
            <KPICard title="Ghost Cost Est." value={`$${ghostCost.toLocaleString()}`} subtitle={`@$${COST_PER_HOUR}/hr`} icon={DollarSign} accent={ghostCost > 5000} />
          </>
        )}
      </div>

      {/* Filters + View Toggle */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center flex-wrap">
        <FilterBar label="Department" options={['all', ...departments]} value={deptFilter} onChange={setDeptFilter} />
        <div className="relative w-full sm:w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search person..." value={personSearch} onChange={(e) => setPersonSearch(e.target.value)} className="pl-9 h-8 text-sm" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Min hours:</span>
          <Slider value={[minHours]} onValueChange={(v) => setMinHours(v[0])} max={100} step={5} className="w-24" />
          <span className="text-xs font-mono">{minHours}h</span>
        </div>
        <div className="flex items-center gap-1 ml-auto">
          {(['daily', 'weekly', 'monthly'] as ViewMode[]).map(mode => (
            <button key={mode} onClick={() => setViewMode(mode)}
              className={`px-3 py-1 text-xs rounded-md transition-colors capitalize ${viewMode === mode ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Charts Row */}
      {withClocked.length > 0 && (
        <div className="grid lg:grid-cols-2 gap-4">
          {/* Scatter Plot with Quadrant Labels */}
          <div className="bg-card rounded-lg p-5 border border-border shadow-sm">
            <h3 className="text-sm font-bold text-secondary mb-1">Productivity Scatter (Avg Daily Hours)</h3>
            <p className="text-[10px] text-muted-foreground mb-3">Diagonal = 100% productivity. Hover dots for names.</p>
            <ResponsiveContainer width="100%" height={280}>
              <ScatterChart margin={{ bottom: 20, left: 10, top: 20, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="avgClocked" name="Avg Daily Clocked" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  label={{ value: 'Avg Daily Clocked Hours', position: 'bottom', fontSize: 10, fill: 'hsl(var(--muted-foreground))', offset: 0 }} />
                <YAxis dataKey="avgTasked" name="Avg Daily Task" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  label={{ value: 'Avg Daily Task Hours', angle: -90, position: 'insideLeft', fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <ZAxis dataKey="name" name="Person" range={[60, 200]} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ strokeDasharray: '3 3' }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div style={tooltipStyle} className="p-2">
                        <p className="font-bold text-sm">{d.name}</p>
                        <p className="text-xs">Clocked: {d.avgClocked}h/day</p>
                        <p className="text-xs">Tasks: {d.avgTasked}h/day</p>
                        <p className="text-xs capitalize">{d.department}</p>
                      </div>
                    );
                  }} />
                <ReferenceLine segment={[{ x: 0, y: 0 }, { x: 12, y: 12 }]} stroke="hsl(var(--chart-3))" strokeDasharray="5 5" strokeOpacity={0.5} ifOverflow="extendDomain" />
                {/* Quadrant labels */}
                <text x="15%" y="12%" textAnchor="middle" fontSize={9} fill="hsl(var(--chart-3))">High Efficiency</text>
                <text x="85%" y="12%" textAnchor="middle" fontSize={9} fill="hsl(var(--primary))">Overloaded</text>
                <text x="15%" y="95%" textAnchor="middle" fontSize={9} fill="hsl(var(--muted-foreground))">Underutilized</text>
                <text x="85%" y="95%" textAnchor="middle" fontSize={9} fill="hsl(var(--destructive))">Needs Review</text>
                {Object.entries(DEPT_COLORS).map(([dept, color]) => (
                  <Scatter key={dept} data={scatterData.filter(s => s.department === dept)} fill={color} name={dept} />
                ))}
                <Scatter data={scatterData.filter(s => !DEPT_COLORS[s.department])} fill="hsl(var(--muted-foreground))" name="other" />
                <Legend />
              </ScatterChart>
            </ResponsiveContainer>
          </div>

          {/* Department Comparison */}
          <div className="bg-card rounded-lg p-5 border border-border shadow-sm">
            <h3 className="text-sm font-bold text-secondary mb-4">Department: Clocked vs Task Hours</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={deptComparison}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
                <Bar dataKey="Clocked Hours" fill="hsl(210, 60%, 55%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Task Hours" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Daily Patterns Heatmap + Trend */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Heatmap */}
        {heatmapData.length > 0 && (
          <div className="bg-card rounded-lg p-5 border border-border shadow-sm">
            <h3 className="text-sm font-bold text-secondary mb-1">Daily Patterns — Clock-in Heatmap</h3>
            <p className="text-[10px] text-muted-foreground mb-3">Darker = more clock-ins at that day/hour</p>
            <div className="overflow-auto">
              <div className="grid gap-px" style={{ gridTemplateColumns: `60px repeat(14, 1fr)` }}>
                {/* Hour headers */}
                <div />
                {Array.from({ length: 14 }, (_, i) => i + 5).map(h => (
                  <div key={h} className="text-[9px] text-center text-muted-foreground font-mono">{h > 12 ? `${h - 12}p` : `${h}a`}</div>
                ))}
                {/* Day rows */}
                {[1, 2, 3, 4, 5, 6, 0].map(day => (
                  <Fragment key={day}>
                    <div className="text-[10px] text-muted-foreground font-medium flex items-center">{DAY_LABELS[day]}</div>
                    {Array.from({ length: 14 }, (_, i) => i + 5).map(hour => {
                      const cell = heatmapData.find(h => h.day === day && h.hour === hour);
                      const intensity = cell ? Math.min(1, cell.count / maxHeat) : 0;
                      return (
                        <div key={hour} className="aspect-square rounded-sm flex items-center justify-center text-[8px]" title={`${DAY_LABELS[day]} ${hour}:00 — ${cell?.count || 0} clock-ins`}
                          style={{ backgroundColor: intensity > 0 ? `hsl(var(--primary) / ${0.1 + intensity * 0.7})` : 'hsl(var(--muted) / 0.3)' }}>
                          {cell && cell.count > 2 ? cell.count : ''}
                        </div>
                      );
                    })}
                  </Fragment>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Trend */}
        {trendData.length > 1 && (
          <div className="bg-card rounded-lg p-5 border border-border shadow-sm">
            <h3 className="text-sm font-bold text-secondary mb-4">
              {viewMode === 'monthly' ? 'Monthly' : 'Weekly'} Productivity Trend (%)
            </h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="period" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} domain={[0, 100]} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number, name: string) => name === 'ratio' ? `${v}%` : `${v}h`} />
                <ReferenceLine y={85} stroke="hsl(var(--chart-3))" strokeDasharray="3 3" label={{ value: '85%', fontSize: 9, fill: 'hsl(var(--chart-3))' }} />
                <Line type="monotone" dataKey="ratio" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 2, fill: 'hsl(var(--primary))' }} name="Productivity %" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ── Unaccounted Time Report (sortable table) ─────────────────── */}
      <div className="bg-card rounded-lg p-5 border border-border shadow-sm">
        <h3 className="text-sm font-bold text-secondary mb-4">Unaccounted Time Report ({filtered.length} people)</h3>
        {isLoading ? (
          <TableSkeleton />
        ) : filtered.length === 0 ? (
          <EmptyState title="No matching data" description="Adjust filters or ensure Timeero data is available." />
        ) : (
          <div className="overflow-auto max-h-[600px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs w-8"></TableHead>
                  <SortHeader label="Name" col="name" />
                  <SortHeader label="Dept" col="department" className="hidden sm:table-cell" />
                  <SortHeader label="Clocked" col="clockedHours" className="text-right" />
                  <SortHeader label="Tasked" col="taskHours" className="text-right" />
                  <SortHeader label="Unaccounted" col="unaccountedHours" className="text-right hidden sm:table-cell" />
                  <SortHeader label="Est. Cost" col="unaccountedCost" className="text-right hidden md:table-cell" />
                  <SortHeader label="Productivity" col="productivityRatio" className="text-right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p, i) => (
                  <Fragment key={p.name}>
                    <TableRow
                      className={`cursor-pointer hover:bg-muted/50 ${i % 2 === 1 ? 'bg-muted/30' : ''}`}
                      onClick={() => setExpandedPerson(expandedPerson === p.name ? null : p.name)}
                    >
                      <TableCell className="w-8">
                        {expandedPerson === p.name ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      </TableCell>
                      <TableCell className="font-medium text-sm">
                        <Link to={`/person/${encodeURIComponent(p.name)}`} className="hover:text-primary transition-colors" onClick={(e) => e.stopPropagation()}>
                          {p.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-xs capitalize hidden sm:table-cell">{p.department}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{p.clockedHours}h</TableCell>
                      <TableCell className="text-right font-mono text-sm">{p.taskHours}h</TableCell>
                      <TableCell className={`text-right font-mono text-sm hidden sm:table-cell ${p.unaccountedHours > 20 ? 'text-destructive' : ''}`}>
                        {p.unaccountedHours}h
                      </TableCell>
                      <TableCell className={`text-right font-mono text-sm hidden md:table-cell ${p.unaccountedCost > 500 ? 'text-destructive font-bold' : ''}`}>
                        ${p.unaccountedCost.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className={`text-[10px] font-mono ${p.productivityRatio >= 85 ? 'border-green-500/50 text-green-600' : p.productivityRatio >= 60 ? 'border-warning/50 text-warning' : 'border-destructive/50 text-destructive'}`}>
                          {p.productivityRatio}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                    {expandedPerson === p.name && p.dailyBreakdown.length > 0 && (
                      <TableRow key={`${p.name}-detail`}>
                        <TableCell colSpan={8} className="p-0">
                          <div className="bg-muted/30 p-3 mx-4 mb-2 rounded-md">
                            <p className="text-xs font-semibold mb-2">Daily Breakdown</p>
                            <div className="overflow-auto max-h-[200px]">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="text-[10px]">Date</TableHead>
                                    <TableHead className="text-[10px] text-right">Clocked</TableHead>
                                    <TableHead className="text-[10px] text-right hidden sm:table-cell">Tasks</TableHead>
                                    <TableHead className="text-[10px] text-right">Task Hrs</TableHead>
                                    <TableHead className="text-[10px] text-right hidden sm:table-cell">Unaccounted</TableHead>
                                    <TableHead className="text-[10px] text-right hidden sm:table-cell">Cost</TableHead>
                                    <TableHead className="text-[10px] text-right">Ratio</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {p.dailyBreakdown.slice(0, 30).map((d) => (
                                    <TableRow key={d.date} className={d.flagged ? 'bg-destructive/10' : ''}>
                                      <TableCell className="text-[11px] font-mono">{d.date}</TableCell>
                                      <TableCell className="text-right text-[11px] font-mono">{d.clockedHours}h</TableCell>
                                      <TableCell className="text-right text-[11px] font-mono hidden sm:table-cell">{d.tasksCompleted}</TableCell>
                                      <TableCell className="text-right text-[11px] font-mono">{d.taskHours}h</TableCell>
                                      <TableCell className="text-right text-[11px] font-mono hidden sm:table-cell">{d.unaccounted}h</TableCell>
                                      <TableCell className="text-right text-[11px] font-mono hidden sm:table-cell">${Math.round(d.unaccounted * COST_PER_HOUR)}</TableCell>
                                      <TableCell className={`text-right text-[11px] font-mono ${d.ratio < 60 ? 'text-destructive' : ''}`}>{d.ratio}%</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}

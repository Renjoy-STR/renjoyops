import { useState, useMemo } from 'react';
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
  BarChart, Bar, LineChart, Line, Legend, ReferenceLine, ZAxis,
} from 'recharts';
import { Gauge, Clock, DollarSign, TrendingUp, TrendingDown, Search, ChevronDown, ChevronRight } from 'lucide-react';
import { format, parseISO, startOfWeek } from 'date-fns';
import { Link } from 'react-router-dom';

interface PersonAccountability {
  name: string;
  department: string;
  clockedHours: number;
  taskHours: number;
  unaccountedHours: number;
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

const tooltipStyle = {
  backgroundColor: 'hsl(222, 25%, 11%)',
  border: '1px solid hsl(220, 15%, 18%)',
  borderRadius: '8px',
  fontSize: 12,
};

const DEPT_COLORS: Record<string, string> = {
  housekeeping: 'hsl(15, 90%, 58%)',
  maintenance: 'hsl(210, 60%, 55%)',
  inspection: 'hsl(160, 60%, 50%)',
};

export default function TimeAccountability() {
  const { formatForQuery } = useDateRange();
  const { from, to } = formatForQuery();
  const { data: schema, isLoading: schemaLoading } = useTimeeroSchema();
  const { data: timeeroRaw } = useTimeeroData(from, to, schema);

  const [deptFilter, setDeptFilter] = useState('all');
  const [personSearch, setPersonSearch] = useState('');
  const [minHours, setMinHours] = useState(0);
  const [expandedPerson, setExpandedPerson] = useState<string | null>(null);
  const [costPerHour, setCostPerHour] = useState(18);

  // Breezeway tasks with assignments in period
  const { data: breezeData, isLoading: breezeLoading } = useQuery({
    queryKey: ['accountability-breezeway', from, to],
    queryFn: async () => {
      const { data: tasks } = await supabase
        .from('breezeway_tasks')
        .select('breezeway_id, department, status_code, total_time_minutes, finished_at')
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

  // Compute accountability data
  const accountabilityData = useMemo(() => {
    if (!timeeroRaw?.length || !breezeData?.tasks.length || !schema) return [];

    // Build Timeero per-person per-day using typed TimeeroEntry
    const timeeroByPersonDay: Record<string, Record<string, number>> = {};
    const timeeroNames = new Set<string>();
    const timeeroPersonDept: Record<string, string> = {};

    for (const entry of timeeroRaw) {
      const eName = entry.employee_name;
      if (!eName) continue;
      timeeroNames.add(eName);

      const hours = entry.duration_hours;
      const dateKey = entry.clock_in_time ? String(entry.clock_in_time).slice(0, 10) : '';
      if (!dateKey) continue;

      if (!timeeroByPersonDay[eName]) timeeroByPersonDay[eName] = {};
      timeeroByPersonDay[eName][dateKey] = (timeeroByPersonDay[eName][dateKey] || 0) + hours;
    }

    // Match names
    const breezeNames = [...new Set(breezeData.assignments.map(a => a.assignee_name).filter(Boolean))];
    const nameMap = matchNames(breezeNames, [...timeeroNames]);

    // Build Breezeway per-person per-day
    const taskMap = new Map(breezeData.tasks.map(t => [t.breezeway_id, t]));
    const breezeByPersonDay: Record<string, Record<string, { hours: number; count: number }>> = {};
    const breezePersonDept: Record<string, string> = {};

    for (const a of breezeData.assignments) {
      if (!a.assignee_name) continue;
      const task = taskMap.get(a.task_id);
      if (!task) continue;
      const dateKey = task.finished_at?.slice(0, 10);
      if (!dateKey) continue;
      if (!breezeByPersonDay[a.assignee_name]) breezeByPersonDay[a.assignee_name] = {};
      if (!breezeByPersonDay[a.assignee_name][dateKey]) breezeByPersonDay[a.assignee_name][dateKey] = { hours: 0, count: 0 };
      breezeByPersonDay[a.assignee_name][dateKey].hours += (task.total_time_minutes || 0) / 60;
      breezeByPersonDay[a.assignee_name][dateKey].count++;
      if (task.department) breezePersonDept[a.assignee_name] = task.department;
    }

    // Merge
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
      }

      daily.sort((a, b) => b.date.localeCompare(a.date));
      const dept = timeeroPersonDept[timeeroName] || breezePersonDept[breezeName] || 'unknown';
      results.push({
        name: breezeName,
        department: dept,
        clockedHours: Math.round(totalClocked * 10) / 10,
        taskHours: Math.round(totalTasked * 10) / 10,
        unaccountedHours: Math.round(Math.max(0, totalClocked - totalTasked) * 10) / 10,
        productivityRatio: totalClocked > 0 ? Math.round((totalTasked / totalClocked) * 100) : 0,
        dailyBreakdown: daily,
      });
    }

    // Also add people with only Breezeway data (no Timeero match)
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
        productivityRatio: 0,
        dailyBreakdown: daily,
      });
    }

    return results.sort((a, b) => b.unaccountedHours - a.unaccountedHours);
  }, [timeeroRaw, breezeData, schema]);

  // Filtered data
  const filtered = useMemo(() => {
    return accountabilityData.filter(p => {
      if (deptFilter !== 'all' && p.department !== deptFilter) return false;
      if (personSearch && !p.name.toLowerCase().includes(personSearch.toLowerCase())) return false;
      if (p.clockedHours < minHours) return false;
      return true;
    });
  }, [accountabilityData, deptFilter, personSearch, minHours]);

  // KPIs
  const withClocked = filtered.filter(p => p.clockedHours > 0);
  const avgRatio = withClocked.length > 0 ? Math.round(withClocked.reduce((s, p) => s + p.productivityRatio, 0) / withClocked.length) : 0;
  const totalUnaccounted = Math.round(filtered.reduce((s, p) => s + p.unaccountedHours, 0));
  const mostProductive = [...withClocked].sort((a, b) => b.productivityRatio - a.productivityRatio)[0];
  const leastProductive = [...withClocked].filter(p => p.clockedHours >= 20).sort((a, b) => a.productivityRatio - b.productivityRatio)[0];
  const ghostCost = Math.round(totalUnaccounted * costPerHour);

  // Scatter data
  const scatterData = withClocked.map(p => {
    const days = p.dailyBreakdown.filter(d => d.clockedHours > 0).length || 1;
    return {
      name: p.name,
      department: p.department,
      avgClocked: Math.round((p.clockedHours / days) * 10) / 10,
      avgTasked: Math.round((p.taskHours / days) * 10) / 10,
      fill: DEPT_COLORS[p.department] || 'hsl(215, 15%, 55%)',
    };
  });

  // Department comparison
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

  // Weekly trend
  const weeklyTrend = useMemo(() => {
    if (!withClocked.length) return [];
    const allDaily = withClocked.flatMap(p => p.dailyBreakdown.filter(d => d.clockedHours > 0));
    const byWeek: Record<string, { clocked: number; tasked: number }> = {};
    for (const d of allDaily) {
      const wk = format(startOfWeek(parseISO(d.date)), 'yyyy-MM-dd');
      if (!byWeek[wk]) byWeek[wk] = { clocked: 0, tasked: 0 };
      byWeek[wk].clocked += d.clockedHours;
      byWeek[wk].tasked += d.taskHours;
    }
    return Object.entries(byWeek).sort().map(([week, v]) => ({
      week: week.slice(5),
      ratio: v.clocked > 0 ? Math.round((v.tasked / v.clocked) * 100) : 0,
    }));
  }, [withClocked]);

  const isLoading = schemaLoading || breezeLoading;
  const noTimeero = !schemaLoading && !schema;

  const departments = [...new Set(accountabilityData.map(p => p.department))];

  const exportData = filtered.map(p => ({
    Name: p.name,
    Department: p.department,
    'Clocked Hours': p.clockedHours,
    'Task Hours': p.taskHours,
    'Unaccounted Hours': p.unaccountedHours,
    'Productivity %': p.productivityRatio,
  }));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight">Time Accountability</h2>
            <Badge variant="default" className="text-[10px] bg-accent text-accent-foreground">NEW</Badge>
          </div>
          <p className="text-sm text-muted-foreground">Cross-reference Breezeway tasks with Timeero clock data</p>
        </div>
        <ExportCSVButton data={exportData} filename="time-accountability" />
      </div>

      {noTimeero && (
        <div className="rounded-lg border border-chart-4/40 bg-chart-4/10 p-4">
          <p className="text-sm font-medium">Timeero data not found</p>
          <p className="text-xs text-muted-foreground mt-1">
            No Timeero table was detected in your database. Showing Breezeway task data only. 
            To enable full accountability analysis, import your Timeero time entries.
          </p>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => <CardSkeleton key={i} />)
        ) : (
          <>
            <KPICard title="Avg Productivity" value={`${avgRatio}%`} icon={Gauge} accent />
            <KPICard title="Unaccounted Hours" value={totalUnaccounted} icon={Clock} accent={totalUnaccounted > 100} />
            <KPICard title="Most Productive" value={mostProductive?.name?.split(' ')[0] ?? '—'} subtitle={mostProductive ? `${mostProductive.productivityRatio}%` : ''} icon={TrendingUp} />
            <KPICard title="Least Productive" value={leastProductive?.name?.split(' ')[0] ?? '—'} subtitle={leastProductive ? `${leastProductive.productivityRatio}%` : ''} icon={TrendingDown} />
            <KPICard title="Ghost Cost Est." value={`$${ghostCost.toLocaleString()}`} subtitle={`@$${costPerHour}/hr`} icon={DollarSign} accent={ghostCost > 5000} />
          </>
        )}
      </div>

      {/* Filters */}
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
      </div>

      {/* Charts Row */}
      {withClocked.length > 0 && (
        <div className="grid lg:grid-cols-2 gap-4">
          {/* Scatter Plot */}
          <div className="glass-card rounded-lg p-5">
            <h3 className="text-sm font-semibold mb-4">Productivity Scatter (Avg Daily Hours)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 18%)" />
                <XAxis dataKey="avgClocked" name="Clocked" tick={{ fontSize: 11, fill: 'hsl(215,15%,55%)' }} label={{ value: 'Clocked Hrs/Day', position: 'bottom', fontSize: 10, fill: 'hsl(215,15%,55%)' }} />
                <YAxis dataKey="avgTasked" name="Tasked" tick={{ fontSize: 11, fill: 'hsl(215,15%,55%)' }} label={{ value: 'Task Hrs/Day', angle: -90, position: 'insideLeft', fontSize: 10, fill: 'hsl(215,15%,55%)' }} />
                <ZAxis dataKey="name" name="Person" />
                <Tooltip contentStyle={tooltipStyle} cursor={{ strokeDasharray: '3 3' }} formatter={(value: number, name: string) => [`${value}h`, name]} />
                <ReferenceLine segment={[{ x: 0, y: 0 }, { x: 12, y: 12 }]} stroke="hsl(160, 60%, 50%)" strokeDasharray="5 5" strokeOpacity={0.5} />
                {Object.entries(DEPT_COLORS).map(([dept, color]) => (
                  <Scatter key={dept} data={scatterData.filter(s => s.department === dept)} fill={color} name={dept} />
                ))}
                <Scatter data={scatterData.filter(s => !DEPT_COLORS[s.department])} fill="hsl(215, 15%, 55%)" name="other" />
                <Legend />
              </ScatterChart>
            </ResponsiveContainer>
          </div>

          {/* Department Comparison */}
          <div className="glass-card rounded-lg p-5">
            <h3 className="text-sm font-semibold mb-4">Department: Clocked vs Task Hours</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={deptComparison}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 18%)" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(215,15%,55%)' }} />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(215,15%,55%)' }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
                <Bar dataKey="Clocked Hours" fill="hsl(210, 60%, 55%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Task Hours" fill="hsl(160, 60%, 50%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Weekly Trend */}
      {weeklyTrend.length > 1 && (
        <div className="glass-card rounded-lg p-5">
          <h3 className="text-sm font-semibold mb-4">Weekly Productivity Trend (%)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={weeklyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 18%)" />
              <XAxis dataKey="week" tick={{ fontSize: 10, fill: 'hsl(215,15%,55%)' }} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(215,15%,55%)' }} domain={[0, 100]} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v}%`} />
              <ReferenceLine y={85} stroke="hsl(160, 60%, 50%)" strokeDasharray="3 3" label={{ value: '85%', fontSize: 9, fill: 'hsl(160, 60%, 50%)' }} />
              <Line type="monotone" dataKey="ratio" stroke="hsl(15, 90%, 58%)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Ghost Hours Table */}
      <div className="glass-card rounded-lg p-5">
        <h3 className="text-sm font-semibold mb-4">Ghost Hours Table ({filtered.length} people)</h3>
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
                  <TableHead className="text-xs">Name</TableHead>
                  <TableHead className="text-xs">Dept</TableHead>
                  <TableHead className="text-xs text-right">Clocked</TableHead>
                  <TableHead className="text-xs text-right">Tasked</TableHead>
                  <TableHead className="text-xs text-right">Unaccounted</TableHead>
                  <TableHead className="text-xs text-right">Productivity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => (
                  <>
                    <TableRow
                      key={p.name}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setExpandedPerson(expandedPerson === p.name ? null : p.name)}
                    >
                      <TableCell className="w-8">
                        {expandedPerson === p.name ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      </TableCell>
                      <TableCell className="font-medium text-sm">
                        <Link to={`/person/${encodeURIComponent(p.name)}`} className="hover:text-accent transition-colors" onClick={(e) => e.stopPropagation()}>
                          {p.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-xs capitalize">{p.department}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{p.clockedHours}h</TableCell>
                      <TableCell className="text-right font-mono text-sm">{p.taskHours}h</TableCell>
                      <TableCell className={`text-right font-mono text-sm ${p.unaccountedHours > 20 ? 'text-destructive' : ''}`}>
                        {p.unaccountedHours}h
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className={`text-[10px] font-mono ${p.productivityRatio >= 85 ? 'border-chart-3/50 text-chart-3' : p.productivityRatio >= 60 ? 'border-chart-4/50 text-chart-4' : 'border-destructive/50 text-destructive'}`}>
                          {p.productivityRatio}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                    {expandedPerson === p.name && p.dailyBreakdown.length > 0 && (
                      <TableRow key={`${p.name}-detail`}>
                        <TableCell colSpan={7} className="p-0">
                          <div className="bg-muted/30 p-3 mx-4 mb-2 rounded-md">
                            <p className="text-xs font-semibold mb-2">Daily Breakdown</p>
                            <div className="overflow-auto max-h-[200px]">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="text-[10px]">Date</TableHead>
                                    <TableHead className="text-[10px] text-right">Clocked</TableHead>
                                    <TableHead className="text-[10px] text-right">Tasks</TableHead>
                                    <TableHead className="text-[10px] text-right">Task Hrs</TableHead>
                                    <TableHead className="text-[10px] text-right">Unaccounted</TableHead>
                                    <TableHead className="text-[10px] text-right">Ratio</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {p.dailyBreakdown.slice(0, 30).map((d) => (
                                    <TableRow key={d.date} className={d.flagged ? 'bg-destructive/10' : ''}>
                                      <TableCell className="text-[11px] font-mono">{d.date}</TableCell>
                                      <TableCell className="text-right text-[11px] font-mono">{d.clockedHours}h</TableCell>
                                      <TableCell className="text-right text-[11px] font-mono">{d.tasksCompleted}</TableCell>
                                      <TableCell className="text-right text-[11px] font-mono">{d.taskHours}h</TableCell>
                                      <TableCell className="text-right text-[11px] font-mono">{d.unaccounted}h</TableCell>
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
                  </>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}

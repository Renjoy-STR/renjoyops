import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useDateRange } from '@/contexts/DateRangeContext';
import { TableSkeleton } from '@/components/dashboard/LoadingSkeleton';
import { KPICard } from '@/components/dashboard/KPICard';
import { ExportCSVButton } from '@/components/dashboard/ExportCSVButton';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { FilterBar } from '@/components/dashboard/FilterBar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Wrench, Clock, DollarSign, AlertTriangle } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend, LineChart, Line, LabelList } from 'recharts';
import type { StaleTask } from '@/types/database';
import { format, parseISO, differenceInDays } from 'date-fns';

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'destructive',
  high: 'default',
  normal: 'secondary',
  low: 'outline',
};

const tooltipStyle = {
  backgroundColor: 'hsl(222, 25%, 11%)',
  border: '1px solid hsl(220, 15%, 18%)',
  borderRadius: '8px',
  fontSize: 12,
};

export default function MaintenanceTracker() {
  const [filter, setFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [deptFilter, setDeptFilter] = useState('all');
  const { formatForQuery } = useDateRange();
  const { from, to } = formatForQuery();

  // BUG 3 FIX: Server-side count for accurate KPI
  const { data: maintenanceCounts } = useQuery({
    queryKey: ['maintenance-counts', from, to],
    queryFn: async () => {
      const [totalRes, finishedRes] = await Promise.all([
        supabase.from('breezeway_tasks').select('*', { count: 'exact', head: true }).eq('department', 'maintenance').gte('created_at', from).lte('created_at', to),
        supabase.from('breezeway_tasks').select('*', { count: 'exact', head: true }).eq('department', 'maintenance').eq('status_code', 'finished').gte('created_at', from).lte('created_at', to),
      ]);
      return { total: totalRes.count ?? 0, finished: finishedRes.count ?? 0 };
    },
  });

  // Sample of tasks for resolution time calculation
  const { data: maintenanceTasks } = useQuery({
    queryKey: ['maintenance-tasks-sample', from, to],
    queryFn: async () => {
      const { data } = await supabase
        .from('breezeway_tasks')
        .select('name, department, priority, status_code, total_cost, total_time_minutes, created_at, finished_at')
        .eq('department', 'maintenance')
        .eq('status_code', 'finished')
        .not('finished_at', 'is', null)
        .gte('created_at', from)
        .lte('created_at', to)
        .limit(500);
      return data ?? [];
    },
  });

  // Top issues
  const { data: topIssues, isLoading: l1 } = useQuery({
    queryKey: ['top-maintenance-issues'],
    queryFn: async () => {
      const { data } = await supabase.from('v_top_maintenance_issues').select('*').order('occurrences', { ascending: false }).limit(20);
      return data ?? [];
    },
  });

  const { data: staleTasks, isLoading: l2 } = useQuery({
    queryKey: ['stale-tasks'],
    queryFn: async () => {
      const { data } = await supabase.from('v_stale_tasks').select('*').order('days_overdue', { ascending: false });
      return (data as StaleTask[]) ?? [];
    },
  });

  // Cost trend
  const { data: costTrend } = useQuery({
    queryKey: ['cost-trend', from, to],
    queryFn: async () => {
      const { data } = await supabase
        .from('breezeway_task_costs')
        .select('cost, created_at')
        .gte('created_at', from)
        .lte('created_at', to);
      if (!data) return [];
      const byMonth: Record<string, { cost: number; count: number }> = {};
      data.forEach(c => {
        const month = c.created_at?.slice(0, 7) ?? 'unknown';
        if (!byMonth[month]) byMonth[month] = { cost: 0, count: 0 };
        byMonth[month].cost += (c.cost || 0);
        byMonth[month].count++;
      });
      return Object.entries(byMonth).sort().map(([month, v]) => ({
        month,
        cost: Math.round(v.cost),
        entries: v.count,
      }));
    },
  });

  // Costs in period
  const { data: costs } = useQuery({
    queryKey: ['cost-summary-period', from, to],
    queryFn: async () => {
      const { data } = await supabase
        .from('breezeway_task_costs')
        .select('cost, cost_type_code')
        .gte('created_at', from)
        .lte('created_at', to);
      return data ?? [];
    },
  });

  const totalLabor = costs?.filter(c => c.cost_type_code === 'labor').reduce((s, c) => s + (c.cost || 0), 0) ?? 0;
  const totalMaterial = costs?.filter(c => c.cost_type_code === 'material').reduce((s, c) => s + (c.cost || 0), 0) ?? 0;
  const costPie = [{ name: 'Labor', value: Math.round(totalLabor) }, { name: 'Material', value: Math.round(totalMaterial) }];

  // Resolution time
  const resolvedTasks = maintenanceTasks?.filter(t => t.created_at && t.finished_at) ?? [];
  const avgResolution = resolvedTasks.length > 0
    ? Math.round(resolvedTasks.reduce((s, t) => s + differenceInDays(parseISO(t.finished_at!), parseISO(t.created_at)), 0) / resolvedTasks.length)
    : 0;

  // Aging buckets
  const agingBuckets = [
    { label: '1-7d', min: 1, max: 7, count: 0 },
    { label: '8-30d', min: 8, max: 30, count: 0 },
    { label: '31-90d', min: 31, max: 90, count: 0 },
    { label: '90d+', min: 91, max: 99999, count: 0 },
  ];
  staleTasks?.forEach(t => {
    const days = t.days_overdue ?? t.days_since_created ?? 0;
    const bucket = agingBuckets.find(b => days >= b.min && days <= b.max);
    if (bucket) bucket.count++;
  });

  // Filters
  const filteredStale = staleTasks?.filter(t => {
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
    if (deptFilter !== 'all' && t.department !== deptFilter) return false;
    const q = filter.toLowerCase();
    return !q || t.property_name?.toLowerCase().includes(q) || t.name?.toLowerCase().includes(q) || t.assignees?.toLowerCase().includes(q);
  }) ?? [];

  const totalMaintenance = maintenanceCounts?.total ?? 0;
  const finishedMaintenance = maintenanceCounts?.finished ?? 0;

  // Most common issues - horizontal bar chart
  const issueChartData = topIssues?.slice(0, 10).map(i => ({
    name: (i as any).task_type?.slice(0, 30) ?? 'Unknown',
    count: (i as any).occurrences ?? 0,
  })).reverse() ?? [];

  // Export data
  const exportData = filteredStale.map(t => ({
    Property: t.property_name,
    Task: t.name || 'Unnamed',
    Priority: t.priority,
    Status: t.status_code,
    'Days Overdue': t.days_overdue ?? t.days_since_created ?? 0,
    Assignees: t.assignees,
  }));

  // Check for sparse recent cost data
  const recentMonths = costTrend?.slice(-3) ?? [];
  const sparseData = recentMonths.some(m => m.entries < 5);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Maintenance Tracker</h2>
          <p className="text-sm text-muted-foreground">Top issues, overdue tasks & cost breakdown</p>
        </div>
        <ExportCSVButton data={exportData} filename="stale-tasks" label="Export Stale Tasks" />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <KPICard title="Maintenance Tasks" value={totalMaintenance.toLocaleString()} icon={Wrench} />
        <KPICard title="Resolved" value={finishedMaintenance.toLocaleString()} icon={Wrench} subtitle={`${totalMaintenance > 0 ? Math.round((finishedMaintenance / totalMaintenance) * 100) : 0}% rate`} />
        <KPICard title="Avg Resolution" value={`${avgResolution}d`} icon={Clock} />
        <KPICard title="Total Spend" value={`$${Math.round(totalLabor + totalMaterial).toLocaleString()}`} icon={DollarSign} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Most Common Issues - Horizontal bar */}
        <div className="lg:col-span-2 glass-card rounded-lg p-5">
          <h3 className="text-sm font-semibold mb-4">Most Common Issues</h3>
          {l1 ? <div className="h-64" /> : (
            <ResponsiveContainer width="100%" height={Math.max(300, issueChartData.length * 32)}>
              <BarChart data={issueChartData} layout="vertical" margin={{ left: 10, right: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 18%)" />
                <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(215,15%,55%)' }} />
                <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 9, fill: 'hsl(215,15%,55%)' }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" fill="hsl(15, 90%, 58%)" radius={[0, 4, 4, 0]} name="Occurrences" barSize={20}>
                  <LabelList dataKey="count" position="right" fontSize={10} fill="hsl(215,15%,55%)" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Cost Breakdown */}
        <div className="glass-card rounded-lg p-5">
          <h3 className="text-sm font-semibold mb-4">Cost Breakdown (Period)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={costPie} cx="50%" cy="50%" innerRadius={50} outerRadius={75} dataKey="value" paddingAngle={3}>
                <Cell fill="hsl(15, 90%, 58%)" />
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

      {/* Cost Trend + Aging Buckets */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="glass-card rounded-lg p-5">
          <h3 className="text-sm font-semibold mb-4">Monthly Maintenance Spend</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={costTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 18%)" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'hsl(215,15%,55%)' }} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(215,15%,55%)' }} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `$${v.toLocaleString()}`} />
              <Line type="monotone" dataKey="cost" stroke="hsl(15, 90%, 58%)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
          {sparseData && (
            <p className="text-[10px] text-chart-4 mt-2 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> Limited cost data for recent months
            </p>
          )}
        </div>

        <div className="glass-card rounded-lg p-5">
          <h3 className="text-sm font-semibold mb-4">Stale Task Aging</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={agingBuckets}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 18%)" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(215,15%,55%)' }} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(215,15%,55%)' }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" fill="hsl(210, 60%, 55%)" radius={[4, 4, 0, 0]} name="Tasks">
                <LabelList dataKey="count" position="top" fontSize={10} fill="hsl(215,15%,55%)" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Stale Tasks */}
      <div className="glass-card rounded-lg p-5">
        <div className="flex flex-col gap-3 mb-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <h3 className="text-sm font-semibold">Overdue / Stale Tasks ({staleTasks?.length ?? 0})</h3>
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
        {l2 ? (
          <TableSkeleton />
        ) : (
          <div className="overflow-auto max-h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Property</TableHead>
                  <TableHead className="text-xs">Task</TableHead>
                  <TableHead className="text-xs">Priority</TableHead>
                  <TableHead className="text-xs hidden sm:table-cell">Status</TableHead>
                  <TableHead className="text-xs text-right">Days Overdue</TableHead>
                  <TableHead className="text-xs hidden sm:table-cell">Assignees</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStale.slice(0, 50).map((t) => (
                  <TableRow key={t.breezeway_id}>
                    <TableCell className="text-sm max-w-[150px] truncate">{t.property_name}</TableCell>
                    {/* BUG 5 FIX: Show task name with fallback */}
                    <TableCell className="text-sm max-w-[150px] truncate">{t.name || 'Unnamed task'}</TableCell>
                    <TableCell>
                      <Badge variant={PRIORITY_COLORS[t.priority] as any ?? 'secondary'} className="text-[10px]">{t.priority}</Badge>
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
    </div>
  );
}

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useDateRange } from '@/contexts/DateRangeContext';
import { KPICard } from '@/components/dashboard/KPICard';
import { CardSkeleton } from '@/components/dashboard/LoadingSkeleton';
import { CheckCircle2, Clock, AlertTriangle, DollarSign, ListTodo, Percent, Building2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip,
  PieChart, Pie, Cell, CartesianGrid, Legend, BarChart, Bar,
} from 'recharts';
import { format, parse } from 'date-fns';

const DEPT_COLORS = ['hsl(15, 90%, 58%)', 'hsl(210, 60%, 55%)', 'hsl(160, 60%, 50%)'];
const STATUS_COLORS: Record<string, string> = {
  finished: 'hsl(160, 60%, 50%)',
  in_progress: 'hsl(210, 60%, 55%)',
  assigned: 'hsl(45, 90%, 55%)',
  open: 'hsl(15, 90%, 58%)',
};

const tooltipStyle = {
  backgroundColor: 'hsl(222, 25%, 11%)',
  border: '1px solid hsl(220, 15%, 18%)',
  borderRadius: '8px',
  fontSize: 12,
};

function formatMonth(m: string) {
  try {
    const d = parse(m, 'yyyy-MM', new Date());
    return format(d, 'MMM yy');
  } catch {
    return m;
  }
}

export default function Overview() {
  const { formatForQuery } = useDateRange();
  const { from, to } = formatForQuery();
  const navigate = useNavigate();

  // BUG 3 FIX: Server-side counts (avoids 1000 row limit)
  const { data: taskCounts, isLoading: l1 } = useQuery({
    queryKey: ['period-task-counts', from, to],
    queryFn: async () => {
      const [totalRes, finishedRes] = await Promise.all([
        supabase.from('breezeway_tasks').select('*', { count: 'exact', head: true }).gte('created_at', from).lte('created_at', to),
        supabase.from('breezeway_tasks').select('*', { count: 'exact', head: true }).eq('status_code', 'finished').gte('created_at', from).lte('created_at', to),
      ]);
      return { total: totalRes.count ?? 0, finished: finishedRes.count ?? 0 };
    },
  });

  const { data: priorCounts } = useQuery({
    queryKey: ['prior-task-counts', from, to],
    queryFn: async () => {
      const fromDate = new Date(from);
      const toDate = new Date(to);
      const diff = toDate.getTime() - fromDate.getTime();
      const priorFrom = new Date(fromDate.getTime() - diff).toISOString().split('T')[0];
      const priorTo = new Date(fromDate.getTime() - 1).toISOString().split('T')[0];
      const [totalRes, finishedRes] = await Promise.all([
        supabase.from('breezeway_tasks').select('*', { count: 'exact', head: true }).gte('created_at', priorFrom).lte('created_at', priorTo),
        supabase.from('breezeway_tasks').select('*', { count: 'exact', head: true }).eq('status_code', 'finished').gte('created_at', priorFrom).lte('created_at', priorTo),
      ]);
      return { total: totalRes.count ?? 0, finished: finishedRes.count ?? 0 };
    },
  });

  // Sample tasks for dept/status breakdowns (1000 row limit OK for breakdowns)
  const { data: periodTasks } = useQuery({
    queryKey: ['period-tasks-sample', from, to],
    queryFn: async () => {
      const { data } = await supabase
        .from('breezeway_tasks')
        .select('status_code, department, total_time_minutes, finished_at, created_at, home_id, property_name')
        .gte('created_at', from)
        .lte('created_at', to)
        .limit(2000);
      return data ?? [];
    },
  });

  const { data: staleTasks, isLoading: l4 } = useQuery({
    queryKey: ['stale-count'],
    queryFn: async () => {
      const { count } = await supabase.from('v_stale_tasks').select('*', { count: 'exact', head: true });
      return count ?? 0;
    },
  });

  const { data: costData, isLoading: l5 } = useQuery({
    queryKey: ['maintenance-costs-period', from, to],
    queryFn: async () => {
      const { data } = await supabase
        .from('breezeway_task_costs')
        .select('cost, cost_type_code, created_at')
        .gte('created_at', from)
        .lte('created_at', to);
      return data ?? [];
    },
  });

  // BUG 2 FIX: Monthly volume from view, no restrictive date filter
  const { data: monthlyData, isLoading: l7 } = useQuery({
    queryKey: ['monthly-volume-all'],
    queryFn: async () => {
      const { data } = await supabase
        .from('v_monthly_volume')
        .select('*')
        .order('month', { ascending: true });
      return data ?? [];
    },
  });

  const { data: urgentStale } = useQuery({
    queryKey: ['urgent-stale'],
    queryFn: async () => {
      const { data } = await supabase.from('v_stale_tasks').select('*').eq('priority', 'urgent').limit(3);
      return data ?? [];
    },
  });

  // Computed KPIs using server-side counts
  const totalTasks = taskCounts?.total ?? 0;
  const finishedTasks = taskCounts?.finished ?? 0;
  const completionRate = totalTasks > 0 ? Math.round((finishedTasks / totalTasks) * 100) : 0;

  const hkTasks = periodTasks?.filter(t => t.department === 'housekeeping' && t.status_code === 'finished' && t.total_time_minutes) ?? [];
  const avgClean = hkTasks.length > 0 ? Math.round(hkTasks.reduce((s, t) => s + (t.total_time_minutes || 0), 0) / hkTasks.length) : 0;

  const totalSpend = costData?.reduce((s, c) => s + (c.cost || 0), 0) ?? 0;

  // Prior period comparison using server-side counts
  const priorTotal = priorCounts?.total ?? 0;
  const priorFinished = priorCounts?.finished ?? 0;
  const priorCompletionRate = priorTotal > 0 ? Math.round((priorFinished / priorTotal) * 100) : 0;

  const calcTrend = (current: number, prior: number) => {
    if (prior === 0) return undefined;
    const pct = Math.round(((current - prior) / prior) * 100);
    return { value: pct, label: 'vs prior period' };
  };

  // Status breakdown (from sample)
  const statusCounts = periodTasks?.reduce<Record<string, number>>((acc, t) => {
    acc[t.status_code] = (acc[t.status_code] || 0) + 1;
    return acc;
  }, {}) ?? {};
  const statusData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));

  // Department breakdown
  const deptCounts = periodTasks?.reduce<Record<string, number>>((acc, t) => {
    if (t.department) acc[t.department] = (acc[t.department] || 0) + 1;
    return acc;
  }, {}) ?? {};
  const deptData = Object.entries(deptCounts).map(([name, value]) => ({ name, value }));

  // Department efficiency
  const deptEfficiency = periodTasks
    ?.filter(t => t.status_code === 'finished' && t.total_time_minutes && t.department)
    .reduce<Record<string, { total: number; count: number }>>((acc, t) => {
      if (!acc[t.department]) acc[t.department] = { total: 0, count: 0 };
      acc[t.department].total += t.total_time_minutes || 0;
      acc[t.department].count++;
      return acc;
    }, {}) ?? {};
  const deptEffData = Object.entries(deptEfficiency).map(([dept, v]) => ({
    name: dept,
    avg_minutes: Math.round(v.total / v.count),
    tasks: v.count,
  }));

  // Busiest properties
  const propCounts = periodTasks?.reduce<Record<string, { name: string; count: number }>>((acc, t) => {
    if (t.property_name) {
      if (!acc[t.property_name]) acc[t.property_name] = { name: t.property_name, count: 0 };
      acc[t.property_name].count++;
    }
    return acc;
  }, {}) ?? {};
  const busiestProps = Object.values(propCounts).sort((a, b) => b.count - a.count).slice(0, 5);

  // Monthly aggregation from view
  const monthlyAgg = monthlyData
    ? Object.values(
        monthlyData.reduce<Record<string, { month: string; total: number; finished: number }>>((acc, r: any) => {
          if (!acc[r.month]) acc[r.month] = { month: r.month, total: 0, finished: 0 };
          acc[r.month].total += r.total_tasks ?? 0;
          acc[r.month].finished += r.finished ?? 0;
          return acc;
        }, {})
      ).sort((a, b) => a.month.localeCompare(b.month))
    : [];

  const isLoading = l1 || l4 || l5;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Overview</h2>
        <p className="text-sm text-muted-foreground">Renjoy property operations at a glance</p>
      </div>

      {urgentStale && urgentStale.length > 0 && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 flex items-center gap-3 cursor-pointer hover:bg-destructive/15 transition-colors" onClick={() => navigate('/maintenance')}>
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
          <div>
            <p className="text-sm font-medium">
              {urgentStale.length} urgent task{urgentStale.length > 1 ? 's' : ''} overdue
            </p>
            <p className="text-xs text-muted-foreground">
              {urgentStale.map((t: any) => t.property_name).join(', ')}
            </p>
          </div>
        </div>
      )}

      {/* BUG 1 FIX: KPI Cards - 2 rows of 3 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)
        ) : (
          <>
            <KPICard title="Total Tasks" value={totalTasks.toLocaleString()} icon={ListTodo} trend={calcTrend(totalTasks, priorTotal)} accent />
            <KPICard title="Completed" value={finishedTasks.toLocaleString()} icon={CheckCircle2} trend={calcTrend(finishedTasks, priorFinished)} />
            <KPICard title="Completion Rate" value={`${completionRate}%`} icon={Percent} trend={calcTrend(completionRate, priorCompletionRate)} />
            <KPICard title="Avg Clean Time" value={`${avgClean} min`} subtitle="Housekeeping" icon={Clock} />
            <KPICard title="Overdue Tasks" value={(staleTasks ?? 0).toLocaleString()} icon={AlertTriangle} accent={!!staleTasks && staleTasks > 0} />
            <KPICard title="Maint. Spend" value={`$${(totalSpend / 1000).toFixed(1)}k`} icon={DollarSign} />
          </>
        )}
      </div>

      {/* Charts Row 1 */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 glass-card rounded-lg p-5">
          <h3 className="text-sm font-semibold mb-4">Monthly Task Volume</h3>
          {l7 ? (
            <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">Loading...</div>
          ) : monthlyAgg.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">No monthly data available</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={monthlyAgg}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 18%)" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'hsl(215,15%,55%)' }} tickFormatter={formatMonth} />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(215,15%,55%)' }} />
                <Tooltip contentStyle={tooltipStyle} labelFormatter={formatMonth} />
                <Legend />
                <Line type="monotone" dataKey="total" stroke="hsl(15, 90%, 58%)" strokeWidth={2} name="Total" dot={false} />
                <Line type="monotone" dataKey="finished" stroke="hsl(160, 60%, 50%)" strokeWidth={2} name="Finished" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="glass-card rounded-lg p-5">
          <h3 className="text-sm font-semibold mb-4">By Department</h3>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={deptData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" nameKey="name" paddingAngle={3}>
                {deptData.map((_, i) => <Cell key={i} fill={DEPT_COLORS[i % DEPT_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Status Breakdown */}
        <div className="glass-card rounded-lg p-5">
          <h3 className="text-sm font-semibold mb-4">Tasks by Status</h3>
          <div className="space-y-3">
            {statusData.map((s) => (
              <div key={s.name} className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[s.name] || 'hsl(215,15%,55%)' }} />
                <span className="text-xs capitalize flex-1">{s.name.replace('_', ' ')}</span>
                <span className="text-sm font-mono font-medium">{s.value}</span>
                <span className="text-xs text-muted-foreground">{totalTasks > 0 ? Math.round((s.value / totalTasks) * 100) : 0}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Department Efficiency */}
        <div className="glass-card rounded-lg p-5">
          <h3 className="text-sm font-semibold mb-4">Dept Avg Completion Time</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={deptEffData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 18%)" />
              <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(215,15%,55%)' }} />
              <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10, fill: 'hsl(215,15%,55%)' }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="avg_minutes" fill="hsl(210, 60%, 55%)" radius={[0, 4, 4, 0]} name="Avg Min" label={{ position: 'right', fontSize: 10, fill: 'hsl(215,15%,55%)' }} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Busiest Properties */}
        <div className="glass-card rounded-lg p-5">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-accent" /> Busiest Properties
          </h3>
          <div className="space-y-3">
            {busiestProps.map((p, i) => (
              <div key={p.name} className="flex items-center gap-3">
                <span className="text-xs font-bold text-accent w-4">{i + 1}</span>
                <span className="text-sm flex-1 truncate">{p.name}</span>
                <span className="text-sm font-mono">{p.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

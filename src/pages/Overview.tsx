import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useDateRange } from '@/contexts/DateRangeContext';
import { KPICard } from '@/components/dashboard/KPICard';
import { CardSkeleton } from '@/components/dashboard/LoadingSkeleton';
import {
  CheckCircle2, Clock, AlertTriangle, DollarSign, ListTodo, Percent,
  Building2, TrendingUp, TrendingDown, Minus, Activity, ShieldAlert,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip,
  PieChart, Pie, Cell, CartesianGrid, Legend, BarChart, Bar,
} from 'recharts';
import { format, parse, subWeeks, startOfWeek, endOfWeek, formatDistanceToNow } from 'date-fns';

const DEPT_COLORS = ['hsl(5, 87%, 55%)', 'hsl(5, 61%, 28%)', 'hsl(38, 92%, 50%)'];
const STATUS_COLORS: Record<string, string> = {
  finished: 'hsl(142, 71%, 45%)',
  in_progress: 'hsl(5, 61%, 28%)',
  assigned: 'hsl(38, 92%, 50%)',
  open: 'hsl(5, 87%, 55%)',
};

const tooltipStyle = {
  backgroundColor: 'hsl(0, 0%, 100%)',
  border: '1px solid hsl(0, 0%, 90%)',
  borderRadius: '8px',
  fontSize: 12,
  color: 'hsl(240, 4%, 15%)',
};

function formatMonth(m: string) {
  try {
    const d = parse(m, 'yyyy-MM', new Date());
    return format(d, 'MMM yy');
  } catch {
    return m;
  }
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function Overview() {
  const { formatForQuery } = useDateRange();
  const { from, to } = formatForQuery();
  const navigate = useNavigate();

  // Server-side counts
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

  // Sample tasks for breakdowns
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

  // Recent activity feed
  const { data: recentActivity } = useQuery({
    queryKey: ['recent-activity'],
    queryFn: async () => {
      const { data } = await supabase
        .from('breezeway_tasks')
        .select('breezeway_id, name, property_name, department, status_code, finished_at, finished_by_name, updated_at')
        .not('finished_at', 'is', null)
        .order('finished_at', { ascending: false })
        .limit(12);
      return data ?? [];
    },
  });

  // This week vs last week
  const { data: weekComparison } = useQuery({
    queryKey: ['week-comparison'],
    queryFn: async () => {
      const now = new Date();
      const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 });
      const lastWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
      const lastWeekEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });

      const tw = thisWeekStart.toISOString();
      const lwStart = lastWeekStart.toISOString();
      const lwEnd = lastWeekEnd.toISOString();

      const [thisWeekTasks, lastWeekTasks, thisWeekCosts, lastWeekCosts] = await Promise.all([
        supabase.from('breezeway_tasks')
          .select('status_code, department, total_time_minutes, finished_at')
          .gte('created_at', tw),
        supabase.from('breezeway_tasks')
          .select('status_code, department, total_time_minutes, finished_at')
          .gte('created_at', lwStart).lte('created_at', lwEnd),
        supabase.from('breezeway_task_costs')
          .select('cost').gte('created_at', tw),
        supabase.from('breezeway_task_costs')
          .select('cost').gte('created_at', lwStart).lte('created_at', lwEnd),
      ]);

      const twData = thisWeekTasks.data ?? [];
      const lwData = lastWeekTasks.data ?? [];

      const twFinished = twData.filter(t => t.status_code === 'finished').length;
      const lwFinished = lwData.filter(t => t.status_code === 'finished').length;

      const twHK = twData.filter(t => t.department === 'housekeeping' && t.status_code === 'finished' && t.total_time_minutes);
      const lwHK = lwData.filter(t => t.department === 'housekeeping' && t.status_code === 'finished' && t.total_time_minutes);
      const twAvgClean = twHK.length > 0 ? Math.round(twHK.reduce((s, t) => s + (t.total_time_minutes || 0), 0) / twHK.length) : 0;
      const lwAvgClean = lwHK.length > 0 ? Math.round(lwHK.reduce((s, t) => s + (t.total_time_minutes || 0), 0) / lwHK.length) : 0;

      const twSpend = (thisWeekCosts.data ?? []).reduce((s, c) => s + (c.cost || 0), 0);
      const lwSpend = (lastWeekCosts.data ?? []).reduce((s, c) => s + (c.cost || 0), 0);

      const twRate = twData.length > 0 ? Math.round((twFinished / twData.length) * 100) : 0;
      const lwRate = lwData.length > 0 ? Math.round((lwFinished / lwData.length) * 100) : 0;

      return { twFinished, lwFinished, twAvgClean, lwAvgClean, twSpend, lwSpend, twRate, lwRate };
    },
  });

  // Properties needing attention
  const { data: problemProperties } = useQuery({
    queryKey: ['problem-properties'],
    queryFn: async () => {
      const [hotspots, difficulty] = await Promise.all([
        supabase.from('v_maintenance_hotspots').select('*').order('total_maint_tasks', { ascending: false }).limit(20),
        supabase.from('v_property_difficulty').select('*').order('avg_clean_minutes', { ascending: false }).limit(20),
      ]);

      const hotMap = new Map<string, any>();
      (hotspots.data ?? []).forEach((h: any) => {
        hotMap.set(h.property_name, h);
      });

      const diffMap = new Map<string, any>();
      (difficulty.data ?? []).forEach((d: any) => {
        diffMap.set(d.property_name, d);
      });

      const allProps = new Set([...hotMap.keys(), ...diffMap.keys()]);
      const scored: any[] = [];

      allProps.forEach(name => {
        const h = hotMap.get(name);
        const d = diffMap.get(name);
        let score = 0;
        const issues: string[] = [];

        if (h) {
          if (h.currently_open > 2) { score += 30; issues.push(`${h.currently_open} open tasks`); }
          if (h.urgent_count > 5) { score += 25; issues.push(`${h.urgent_count} urgent`); }
          if (h.total_cost > 2000) { score += 15; issues.push(`$${(h.total_cost / 1000).toFixed(1)}k spent`); }
        }
        if (d) {
          if (d.avg_clean_minutes > 200) { score += 20; issues.push(`${d.avg_clean_minutes}min avg clean`); }
          if (d.cleans_over_4hrs > 10) { score += 10; issues.push(`${d.cleans_over_4hrs} cleans >4h`); }
        }

        // Health score (inverse of problem score, 0-100)
        const healthScore = Math.max(0, 100 - score);

        if (score > 0) {
          scored.push({ name, score, healthScore, issues, data: { h, d } });
        }
      });

      return scored.sort((a, b) => b.score - a.score).slice(0, 5);
    },
  });

  // Computed KPIs
  const totalTasks = taskCounts?.total ?? 0;
  const finishedTasks = taskCounts?.finished ?? 0;
  const completionRate = totalTasks > 0 ? Math.round((finishedTasks / totalTasks) * 100) : 0;

  const hkTasks = periodTasks?.filter(t => t.department === 'housekeeping' && t.status_code === 'finished' && t.total_time_minutes) ?? [];
  const avgClean = hkTasks.length > 0 ? Math.round(hkTasks.reduce((s, t) => s + (t.total_time_minutes || 0), 0) / hkTasks.length) : 0;

  const totalSpend = costData?.reduce((s, c) => s + (c.cost || 0), 0) ?? 0;

  const priorTotal = priorCounts?.total ?? 0;
  const priorFinished = priorCounts?.finished ?? 0;
  const priorCompletionRate = priorTotal > 0 ? Math.round((priorFinished / priorTotal) * 100) : 0;

  const calcTrend = (current: number, prior: number) => {
    if (prior === 0) return undefined;
    const pct = Math.round(((current - prior) / prior) * 100);
    return { value: pct, label: 'vs prior period' };
  };

  // Status breakdown
  const statusCounts = periodTasks?.reduce<Record<string, number>>((acc, t) => {
    acc[t.status_code] = (acc[t.status_code] || 0) + 1;
    return acc;
  }, {}) ?? {};
  const statusData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));
  const statusTotal = statusData.reduce((s, d) => s + d.value, 0);

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
      if (!acc[t.department!]) acc[t.department!] = { total: 0, count: 0 };
      acc[t.department!].total += t.total_time_minutes || 0;
      acc[t.department!].count++;
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
          acc[r.month].total += r.task_count ?? 0;
          acc[r.month].finished += r.finished ?? 0;
          return acc;
        }, {})
      ).sort((a, b) => a.month.localeCompare(b.month))
    : [];

  // AI summary generation
  const generateSummary = () => {
    const parts: string[] = [];
    const urgentCount = urgentStale?.length ?? 0;
    if (urgentCount > 0) parts.push(`${urgentCount} urgent task${urgentCount > 1 ? 's' : ''} need attention`);
    if (priorCompletionRate > 0 && completionRate < priorCompletionRate) {
      parts.push(`completion rate trending down ${priorCompletionRate - completionRate}%`);
    } else if (priorCompletionRate > 0 && completionRate > priorCompletionRate) {
      parts.push(`completion rate up ${completionRate - priorCompletionRate}%`);
    }
    if (staleTasks && staleTasks > 300) parts.push(`${staleTasks} overdue tasks — review Maintenance Tracker`);
    if (parts.length === 0) parts.push('All systems running smoothly');
    return parts.join(', ') + '.';
  };

  const isLoading = l1 || l4 || l5;

  function DeltaIndicator({ current, prior, unit = '', invert = false }: { current: number; prior: number; unit?: string; invert?: boolean }) {
    if (prior === 0) return <span className="text-xs text-muted-foreground">—</span>;
    const delta = current - prior;
    const pct = Math.round((delta / prior) * 100);
    const isPositive = invert ? delta < 0 : delta > 0;
    const isNeutral = Math.abs(pct) < 3;

    return (
      <div className="flex items-center gap-1">
        {isNeutral ? (
          <Minus className="h-3 w-3 text-muted-foreground" />
        ) : isPositive ? (
          <TrendingUp className="h-3 w-3 text-[hsl(142,71%,45%)]" />
        ) : (
          <TrendingDown className="h-3 w-3 text-destructive" />
        )}
        <span className={`text-xs font-medium ${isNeutral ? 'text-muted-foreground' : isPositive ? 'text-[hsl(142,71%,45%)]' : 'text-destructive'}`}>
          {pct > 0 ? '+' : ''}{pct}%
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Greeting Header */}
      <div>
        <h2 className="text-page-title">{getGreeting()}</h2>
        <p className="text-sm text-muted-foreground mt-1">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
        {!isLoading && (
          <p className="text-sm text-foreground/70 mt-2 flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            {generateSummary()}
          </p>
        )}
      </div>

      {urgentStale && urgentStale.length > 0 && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 flex items-center gap-3 cursor-pointer hover:bg-destructive/10 transition-colors" onClick={() => navigate('/maintenance')}>
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
          <div>
            <p className="text-sm font-medium text-foreground">
              {urgentStale.length} urgent task{urgentStale.length > 1 ? 's' : ''} overdue
            </p>
            <p className="text-xs text-muted-foreground">
              {urgentStale.map((t: any) => t.property_name).join(', ')}
            </p>
          </div>
        </div>
      )}

      {/* Clickable KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)
        ) : (
          <>
            <div className="cursor-pointer" onClick={() => navigate('/people/team')}>
              <KPICard title="Total Tasks" value={totalTasks.toLocaleString()} icon={ListTodo} trend={calcTrend(totalTasks, priorTotal)} accent />
            </div>
            <div className="cursor-pointer" onClick={() => navigate('/people/team')}>
              <KPICard title="Completed" value={finishedTasks.toLocaleString()} icon={CheckCircle2} trend={calcTrend(finishedTasks, priorFinished)} />
            </div>
            <div className="cursor-pointer" onClick={() => navigate('/people/team')}>
              <KPICard title="Completion Rate" value={`${completionRate}%`} icon={Percent} trend={calcTrend(completionRate, priorCompletionRate)} />
            </div>
            <div className="cursor-pointer" onClick={() => navigate('/housekeeping/performance')}>
              <KPICard title="Avg Clean Time" value={`${avgClean} min`} subtitle="Housekeeping" icon={Clock} />
            </div>
            <div className="cursor-pointer" onClick={() => navigate('/maintenance')}>
              <KPICard title="Overdue Tasks" value={(staleTasks ?? 0).toLocaleString()} icon={AlertTriangle} accent={!!staleTasks && staleTasks > 0} />
            </div>
            <div className="cursor-pointer" onClick={() => navigate('/maintenance')}>
              <KPICard title="Maint. Spend" value={`$${(totalSpend / 1000).toFixed(1)}k`} icon={DollarSign} />
            </div>
          </>
        )}
      </div>

      {/* This Week vs Last Week */}
      {weekComparison && (
        <div className="glass-card rounded-lg p-4">
          <h3 className="text-section-header text-sm mb-3">This Week vs Last Week</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Tasks Completed</p>
              <p className="text-lg font-bold">{weekComparison.twFinished}</p>
              <DeltaIndicator current={weekComparison.twFinished} prior={weekComparison.lwFinished} />
            </div>
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Avg Clean Time</p>
              <p className="text-lg font-bold">{weekComparison.twAvgClean} min</p>
              <DeltaIndicator current={weekComparison.twAvgClean} prior={weekComparison.lwAvgClean} invert />
            </div>
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Maint. Spend</p>
              <p className="text-lg font-bold">${weekComparison.twSpend.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
              <DeltaIndicator current={weekComparison.twSpend} prior={weekComparison.lwSpend} invert />
            </div>
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Completion Rate</p>
              <p className="text-lg font-bold">{weekComparison.twRate}%</p>
              <DeltaIndicator current={weekComparison.twRate} prior={weekComparison.lwRate} />
            </div>
          </div>
        </div>
      )}

      {/* Charts Row 1 */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 glass-card rounded-lg p-5">
          <h3 className="text-section-header text-sm mb-4">Monthly Task Volume</h3>
          {l7 ? (
            <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">Loading...</div>
          ) : monthlyAgg.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">No monthly data available</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={monthlyAgg}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0, 0%, 90%)" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'hsl(240, 4%, 40%)' }} tickFormatter={formatMonth} />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(240, 4%, 40%)' }} />
                <Tooltip contentStyle={tooltipStyle} labelFormatter={formatMonth} />
                <Legend />
                <Line type="monotone" dataKey="total" stroke="hsl(5, 87%, 55%)" strokeWidth={2} name="Total" dot={false} />
                <Line type="monotone" dataKey="finished" stroke="hsl(142, 71%, 45%)" strokeWidth={2} name="Finished" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="glass-card rounded-lg p-5">
          <h3 className="text-section-header text-sm mb-4">By Department</h3>
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
        {/* Status Breakdown - Stacked Progress Bar */}
        <div className="glass-card rounded-lg p-5">
          <h3 className="text-section-header text-sm mb-4">Tasks by Status</h3>
          {statusTotal > 0 && (
            <div className="space-y-4">
              {/* Stacked bar */}
              <div className="flex rounded-full overflow-hidden h-4">
                {statusData.map((s) => (
                  <div
                    key={s.name}
                    className="h-full transition-all"
                    style={{
                      width: `${(s.value / statusTotal) * 100}%`,
                      backgroundColor: STATUS_COLORS[s.name] || 'hsl(240, 4%, 40%)',
                    }}
                    title={`${s.name}: ${s.value}`}
                  />
                ))}
              </div>
              {/* Legend */}
              <div className="space-y-2">
                {statusData.map((s) => (
                  <div key={s.name} className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: STATUS_COLORS[s.name] || 'hsl(240,4%,40%)' }} />
                    <span className="text-xs capitalize flex-1 text-foreground/80">{s.name.replace('_', ' ')}</span>
                    <span className="text-sm font-mono font-semibold">{s.value.toLocaleString()}</span>
                    <span className="text-xs text-muted-foreground w-8 text-right">{Math.round((s.value / statusTotal) * 100)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Department Efficiency */}
        <div className="glass-card rounded-lg p-5">
          <h3 className="text-section-header text-sm mb-4">Dept Avg Completion Time</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={deptEffData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(0, 0%, 90%)" />
              <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(240, 4%, 40%)' }} />
              <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10, fill: 'hsl(240, 4%, 40%)' }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="avg_minutes" fill="hsl(5, 61%, 28%)" radius={[0, 4, 4, 0]} name="Avg Min" label={{ position: 'right', fontSize: 10, fill: 'hsl(240, 4%, 40%)' }} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Busiest Properties */}
        <div className="glass-card rounded-lg p-5">
          <h3 className="text-section-header text-sm mb-4 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" /> Busiest Properties
          </h3>
          <div className="space-y-3">
            {busiestProps.map((p, i) => (
              <div key={p.name} className="flex items-center gap-3 cursor-pointer hover:bg-accent/50 rounded px-1 -mx-1 py-0.5 transition-colors" onClick={() => navigate('/analytics/properties')}>
                <span className="text-xs font-bold text-primary w-4">{i + 1}</span>
                <span className="text-sm flex-1 truncate">{p.name}</span>
                <span className="text-sm font-mono font-semibold">{p.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Properties Needing Attention + Recent Activity */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Properties Needing Attention */}
        <div className="glass-card rounded-lg p-5">
          <h3 className="text-section-header text-sm mb-4 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-destructive" /> Properties Needing Attention
          </h3>
          <div className="space-y-3">
            {problemProperties?.map((p, i) => (
              <div
                key={p.name}
                className="flex items-start gap-3 p-2 rounded-lg hover:bg-accent/50 cursor-pointer transition-colors"
                onClick={() => navigate('/analytics/properties')}
              >
                <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-primary-foreground ${
                  p.healthScore < 40 ? 'bg-destructive' : p.healthScore < 70 ? 'bg-[hsl(38,92%,50%)]' : 'bg-[hsl(142,71%,45%)]'
                }`}>
                  {p.healthScore}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.issues.join(' · ')}</p>
                </div>
              </div>
            ))}
            {(!problemProperties || problemProperties.length === 0) && (
              <p className="text-sm text-muted-foreground">All properties looking healthy</p>
            )}
          </div>
        </div>

        {/* Recent Activity Feed */}
        <div className="glass-card rounded-lg p-5">
          <h3 className="text-section-header text-sm mb-4 flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" /> Recent Activity
          </h3>
          <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
            {recentActivity?.map((task: any) => (
              <div key={task.breezeway_id} className="flex items-start gap-3 border-l-2 border-primary/20 pl-3 py-1">
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <span className="font-semibold">{task.finished_by_name || 'Unknown'}</span>
                    <span className="text-muted-foreground"> completed </span>
                    <span className="font-medium">{task.name || 'task'}</span>
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-2">
                    <span>{task.property_name}</span>
                    <span>·</span>
                    <span className="capitalize">{task.department}</span>
                    <span>·</span>
                    <span>{task.finished_at ? formatDistanceToNow(new Date(task.finished_at), { addSuffix: true }) : ''}</span>
                  </p>
                </div>
              </div>
            ))}
            {(!recentActivity || recentActivity.length === 0) && (
              <p className="text-sm text-muted-foreground">No recent activity</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

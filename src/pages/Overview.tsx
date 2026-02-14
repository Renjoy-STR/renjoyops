import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { KPICard } from '@/components/dashboard/KPICard';
import { CardSkeleton, ChartSkeleton } from '@/components/dashboard/LoadingSkeleton';
import { CheckCircle2, Clock, AlertTriangle, DollarSign, ListTodo } from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  Legend,
} from 'recharts';

const DEPT_COLORS = ['hsl(15, 90%, 58%)', 'hsl(210, 60%, 55%)', 'hsl(160, 60%, 50%)'];

export default function Overview() {
  const { data: activeTasks, isLoading: l1 } = useQuery({
    queryKey: ['active-tasks-count'],
    queryFn: async () => {
      const { count } = await supabase
        .from('breezeway_tasks')
        .select('*', { count: 'exact', head: true })
        .in('status_code', ['open', 'in_progress', 'assigned']);
      return count ?? 0;
    },
  });

  const { data: completedMonth, isLoading: l2 } = useQuery({
    queryKey: ['completed-month'],
    queryFn: async () => {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      const { count } = await supabase
        .from('breezeway_tasks')
        .select('*', { count: 'exact', head: true })
        .eq('status_code', 'finished')
        .gte('finished_at', startOfMonth.toISOString());
      return count ?? 0;
    },
  });

  const { data: avgClean, isLoading: l3 } = useQuery({
    queryKey: ['avg-clean-time'],
    queryFn: async () => {
      const { data } = await supabase
        .from('breezeway_tasks')
        .select('total_time_minutes')
        .eq('department', 'housekeeping')
        .eq('status_code', 'finished')
        .not('total_time_minutes', 'is', null)
        .limit(1000);
      if (!data?.length) return 0;
      const avg = data.reduce((s, r) => s + (r.total_time_minutes || 0), 0) / data.length;
      return Math.round(avg);
    },
  });

  const { data: staleTasks, isLoading: l4 } = useQuery({
    queryKey: ['stale-count'],
    queryFn: async () => {
      const { data } = await supabase.from('v_stale_tasks').select('breezeway_id');
      return data?.length ?? 0;
    },
  });

  const { data: totalSpend, isLoading: l5 } = useQuery({
    queryKey: ['total-spend'],
    queryFn: async () => {
      const { data } = await supabase.from('v_cost_summary').select('total_cost');
      return data?.reduce((s, r) => s + (r.total_cost || 0), 0) ?? 0;
    },
  });

  const { data: deptBreakdown, isLoading: l6 } = useQuery({
    queryKey: ['dept-breakdown'],
    queryFn: async () => {
      const { data } = await supabase
        .from('breezeway_tasks')
        .select('department')
        .not('department', 'is', null);
      if (!data) return [];
      const counts: Record<string, number> = {};
      data.forEach((r) => {
        counts[r.department] = (counts[r.department] || 0) + 1;
      });
      return Object.entries(counts).map(([name, value]) => ({ name, value }));
    },
  });

  const { data: monthlyData, isLoading: l7 } = useQuery({
    queryKey: ['monthly-volume'],
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
      const { data } = await supabase
        .from('v_stale_tasks')
        .select('*')
        .eq('priority', 'urgent')
        .limit(3);
      return data ?? [];
    },
  });

  // Aggregate monthly data for line chart
  const monthlyAgg = monthlyData
    ? Object.values(
        monthlyData.reduce<Record<string, { month: string; total: number; finished: number }>>((acc, r) => {
          if (!acc[r.month]) acc[r.month] = { month: r.month, total: 0, finished: 0 };
          acc[r.month].total += r.total_tasks ?? 0;
          acc[r.month].finished += r.finished ?? 0;
          return acc;
        }, {})
      ).slice(-12)
    : [];

  const isLoading = l1 || l2 || l3 || l4 || l5;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Overview</h2>
        <p className="text-sm text-muted-foreground">Renjoy property operations at a glance</p>
      </div>

      {urgentStale && urgentStale.length > 0 && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
          <div>
            <p className="text-sm font-medium">
              {urgentStale.length} urgent task{urgentStale.length > 1 ? 's' : ''} overdue
            </p>
            <p className="text-xs text-muted-foreground">
              {urgentStale.map((t) => t.property_name).join(', ')}
            </p>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => <CardSkeleton key={i} />)
        ) : (
          <>
            <KPICard title="Active Tasks" value={activeTasks ?? 0} icon={ListTodo} accent />
            <KPICard title="Completed This Month" value={completedMonth ?? 0} icon={CheckCircle2} />
            <KPICard title="Avg Clean Time" value={`${avgClean}m`} subtitle="Housekeeping" icon={Clock} />
            <KPICard title="Overdue Tasks" value={staleTasks ?? 0} icon={AlertTriangle} accent={!!staleTasks && staleTasks > 0} />
            <KPICard
              title="Maintenance Spend"
              value={`$${((totalSpend ?? 0) / 1000).toFixed(1)}k`}
              icon={DollarSign}
            />
          </>
        )}
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Monthly Trend */}
        <div className="lg:col-span-2 glass-card rounded-lg p-5">
          <h3 className="text-sm font-semibold mb-4">Monthly Task Volume</h3>
          {l7 ? (
            <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">Loading...</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={monthlyAgg}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 18%)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(215,15%,55%)' }} />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(215,15%,55%)' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(222, 25%, 11%)',
                    border: '1px solid hsl(220, 15%, 18%)',
                    borderRadius: '8px',
                    fontSize: 12,
                  }}
                />
                <Legend />
                <Line type="monotone" dataKey="total" stroke="hsl(15, 90%, 58%)" strokeWidth={2} name="Total" dot={false} />
                <Line type="monotone" dataKey="finished" stroke="hsl(160, 60%, 50%)" strokeWidth={2} name="Finished" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Department Breakdown */}
        <div className="glass-card rounded-lg p-5">
          <h3 className="text-sm font-semibold mb-4">By Department</h3>
          {l6 ? (
            <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">Loading...</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={deptBreakdown}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  dataKey="value"
                  nameKey="name"
                  paddingAngle={3}
                >
                  {deptBreakdown?.map((_, i) => (
                    <Cell key={i} fill={DEPT_COLORS[i % DEPT_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(222, 25%, 11%)',
                    border: '1px solid hsl(220, 15%, 18%)',
                    borderRadius: '8px',
                    fontSize: 12,
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}

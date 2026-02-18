import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  TrendingUp, TrendingDown, Minus, AlertTriangle, ChevronUp, ChevronDown,
  ChevronsUpDown, BarChart2, Activity, Clock, Wrench, Users,
} from 'lucide-react';
import {
  format, subDays, subWeeks, startOfWeek, parseISO, startOfYear,
  differenceInWeeks, addWeeks, isWithinInterval, startOfDay,
} from 'date-fns';

// ─── Types ──────────────────────────────────────────────────────────────────

type TimeFilter = '7d' | '30d' | '90d' | 'ytd';

interface WeekBucket {
  weekLabel: string;
  weekStart: string;
  created: number;
  completed: number;
  netOpen: number;
  avgResponseTime: number | null;
}

interface RecurringIssue {
  property_name: string;
  ai_skill_category: string;
  count: number;
  first_seen: string;
  last_seen: string;
  latest_status: string | null;
}

interface PropertyHealth {
  property_id: string;
  property_name: string;
  health_signal: string | null;
  maintenance_count: number;
  recurring_issues: number | null;
  total_costs: number;
  week_start: string;
}

interface WorkerPerf {
  worker_name: string;
  worker_id: number;
  tasks_completed: number;
  avg_response_time_minutes: number | null;
  avg_work_duration_minutes: number | null;
  callback_rate: number | null;
  completeness_score: number | null;
}

type SortField = keyof WorkerPerf;
type SortDir = 'asc' | 'desc';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDateRange(filter: TimeFilter): { from: Date; to: Date } {
  const to = new Date();
  switch (filter) {
    case '7d':  return { from: subDays(to, 7), to };
    case '30d': return { from: subDays(to, 30), to };
    case '90d': return { from: subDays(to, 90), to };
    case 'ytd': return { from: startOfYear(to), to };
  }
}

function fmt(mins: number | null): string {
  if (mins == null) return '—';
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

const HEALTH_BADGE: Record<string, string> = {
  good:      'bg-[hsl(var(--success)/0.15)] text-[hsl(var(--success))] border-[hsl(var(--success)/0.3)]',
  watch:     'bg-[hsl(var(--warning)/0.15)] text-[hsl(var(--warning))] border-[hsl(var(--warning)/0.3)]',
  declining: 'bg-destructive/10 text-destructive border-destructive/30',
};

const CHART_COLORS = {
  primary:   'hsl(var(--primary))',
  success:   'hsl(var(--success))',
  warning:   'hsl(var(--warning))',
  muted:     'hsl(var(--muted-foreground))',
  destructive: 'hsl(var(--destructive))',
};

const CATEGORY_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--success))',
  'hsl(var(--warning))',
  'hsl(var(--destructive))',
  '#8b5cf6', '#06b6d4', '#f59e0b', '#10b981', '#ef4444', '#6366f1',
];

// ─── Custom Tooltip ──────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card p-2.5 text-xs shadow-lg border border-border">
      <p className="font-semibold mb-1 text-foreground">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }} className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.color }} />
          {p.name}: <span className="font-semibold">{p.value ?? '—'}</span>
        </p>
      ))}
    </div>
  );
}

// ─── Section Header ──────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="p-2 rounded-lg gradient-accent shrink-0">
        <Icon className="h-4 w-4 text-primary-foreground" />
      </div>
      <div>
        <h3 className="text-base font-bold text-foreground">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}

// ─── Sort Icon ────────────────────────────────────────────────────────────────

function SortIcon({ field, sort }: { field: string; sort: { field: SortField; dir: SortDir } }) {
  if (sort.field !== field) return <ChevronsUpDown className="h-3 w-3 text-muted-foreground/50" />;
  return sort.dir === 'asc'
    ? <ChevronUp className="h-3 w-3 text-primary" />
    : <ChevronDown className="h-3 w-3 text-primary" />;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MaintenanceInsights() {
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('30d');
  const [sort, setSort] = useState<{ field: SortField; dir: SortDir }>({ field: 'tasks_completed', dir: 'desc' });

  const { from, to } = getDateRange(timeFilter);
  const fromISO = from.toISOString();
  const toISO   = to.toISOString();
  const fromDate = format(from, 'yyyy-MM-dd');
  const toDate   = format(to,   'yyyy-MM-dd');

  // ── Task volume + response time data ────────────────────────────────────────
  const { data: taskData, isLoading: taskLoading } = useQuery({
    queryKey: ['maintenance-insights-tasks', timeFilter],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('breezeway_tasks')
        .select('breezeway_id, created_at, finished_at, status_code, response_time_minutes, ai_skill_category, ai_guest_impact, priority')
        .eq('department', 'maintenance')
        .gte('created_at', fromISO)
        .order('created_at', { ascending: true })
        .limit(5000);
      if (error) throw error;
      return data ?? [];
    },
  });

  // ── Recurring risk tasks ────────────────────────────────────────────────────
  const { data: recurringData } = useQuery({
    queryKey: ['maintenance-recurring', timeFilter],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('breezeway_tasks')
        .select('breezeway_id, property_name, ai_skill_category, created_at, finished_at, status_code')
        .eq('department', 'maintenance')
        .eq('ai_recurring_risk', true)
        .gte('created_at', fromISO)
        .order('created_at', { ascending: true })
        .limit(1000);
      if (error) throw error;
      return data ?? [];
    },
  });

  // ── Property health (latest week per property) ──────────────────────────────
  const { data: healthData } = useQuery({
    queryKey: ['maintenance-health'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('property_health_weekly')
        .select('property_id, property_name, health_signal, maintenance_count, recurring_issues, total_costs, week_start')
        .in('health_signal', ['declining', 'watch'])
        .order('week_start', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  // ── Worker performance ──────────────────────────────────────────────────────
  const { data: workerData } = useQuery({
    queryKey: ['maintenance-workers', timeFilter],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('worker_performance_weekly')
        .select('worker_name, worker_id, tasks_completed, avg_response_time_minutes, avg_work_duration_minutes, callback_rate, completeness_score, week_start')
        .gte('week_start', fromDate)
        .lte('week_start', toDate)
        .limit(1000);
      if (error) throw error;
      return data ?? [];
    },
  });

  // ── Compute weekly buckets ───────────────────────────────────────────────────
  const weeklyBuckets = useMemo<WeekBucket[]>(() => {
    if (!taskData) return [];

    const numWeeks = Math.max(Math.ceil(differenceInWeeks(to, from)), 1);
    const capWeeks = Math.min(numWeeks, 13);
    const weekStarts: Date[] = [];
    for (let i = capWeeks - 1; i >= 0; i--) {
      weekStarts.push(startOfWeek(subWeeks(to, i), { weekStartsOn: 1 }));
    }

    return weekStarts.map((ws) => {
      const we = addWeeks(ws, 1);
      const created   = taskData.filter(t => t.created_at  && parseISO(t.created_at)  >= ws && parseISO(t.created_at)  < we).length;
      const completed = taskData.filter(t => t.finished_at && parseISO(t.finished_at) >= ws && parseISO(t.finished_at) < we).length;
      const responseItems = taskData.filter(t => t.finished_at && t.response_time_minutes != null && parseISO(t.finished_at) >= ws && parseISO(t.finished_at) < we);
      const avgResponse = responseItems.length > 0
        ? Math.round(responseItems.reduce((s, t) => s + (t.response_time_minutes ?? 0), 0) / responseItems.length)
        : null;

      return {
        weekLabel: format(ws, 'MMM d'),
        weekStart: ws.toISOString(),
        created,
        completed,
        netOpen: created - completed,
        avgResponseTime: avgResponse,
      };
    });
  }, [taskData, from, to]);

  // ── Category distribution ────────────────────────────────────────────────────
  const categoryData = useMemo(() => {
    if (!taskData) return [];
    const map = new Map<string, number>();
    taskData.forEach(t => {
      const cat = t.ai_skill_category || 'General';
      map.set(cat, (map.get(cat) ?? 0) + 1);
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));
  }, [taskData]);

  // ── Urgency distribution ─────────────────────────────────────────────────────
  const urgencyData = useMemo(() => {
    if (!taskData) return [];
    const buckets = { 'Guest Impact': 0, 'Urgent': 0, 'High': 0, 'Normal': 0, 'Low': 0 };
    taskData.forEach(t => {
      if (t.ai_guest_impact) buckets['Guest Impact']++;
      else if (t.priority === 'urgent') buckets['Urgent']++;
      else if (t.priority === 'high') buckets['High']++;
      else if (t.priority === 'normal') buckets['Normal']++;
      else buckets['Low']++;
    });
    return Object.entries(buckets).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }));
  }, [taskData]);

  const URGENCY_COLORS: Record<string, string> = {
    'Guest Impact': 'hsl(var(--destructive))',
    'Urgent':       'hsl(var(--warning))',
    'High':         'hsl(var(--primary))',
    'Normal':       'hsl(var(--success))',
    'Low':          'hsl(var(--muted-foreground))',
  };

  // ── Recurring issues grouped ─────────────────────────────────────────────────
  const recurringGrouped = useMemo<RecurringIssue[]>(() => {
    if (!recurringData) return [];
    const map = new Map<string, RecurringIssue>();
    recurringData.forEach(t => {
      const key = `${t.property_name ?? ''}|${t.ai_skill_category ?? 'general'}`;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          property_name: t.property_name ?? '—',
          ai_skill_category: t.ai_skill_category ?? 'General',
          count: 1,
          first_seen: t.created_at ?? '',
          last_seen: t.created_at ?? '',
          latest_status: t.status_code,
        });
      } else {
        existing.count++;
        if (t.created_at && t.created_at > existing.last_seen) {
          existing.last_seen = t.created_at;
          existing.latest_status = t.status_code;
        }
        if (t.created_at && t.created_at < existing.first_seen) {
          existing.first_seen = t.created_at;
        }
      }
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [recurringData]);

  // ── Latest health per property ────────────────────────────────────────────────
  const latestHealth = useMemo<PropertyHealth[]>(() => {
    if (!healthData) return [];
    const map = new Map<string, PropertyHealth>();
    (healthData as PropertyHealth[]).forEach(row => {
      const existing = map.get(row.property_id);
      if (!existing || row.week_start > existing.week_start) {
        map.set(row.property_id, row);
      }
    });
    return Array.from(map.values()).sort((a, b) => {
      const order = { declining: 0, watch: 1, good: 2 };
      return (order[a.health_signal as keyof typeof order] ?? 3) - (order[b.health_signal as keyof typeof order] ?? 3);
    });
  }, [healthData]);

  // ── Aggregate worker performance ──────────────────────────────────────────────
  const workerAgg = useMemo<WorkerPerf[]>(() => {
    if (!workerData) return [];
    const map = new Map<number, { name: string; tasks: number; responseSum: number; responseCt: number; durationSum: number; durationCt: number; callbackSum: number; callbackCt: number; completenessSum: number; completenessCt: number }>();
    (workerData as any[]).forEach(r => {
      const id = r.worker_id;
      if (!map.has(id)) map.set(id, { name: r.worker_name, tasks: 0, responseSum: 0, responseCt: 0, durationSum: 0, durationCt: 0, callbackSum: 0, callbackCt: 0, completenessSum: 0, completenessCt: 0 });
      const w = map.get(id)!;
      w.tasks += r.tasks_completed ?? 0;
      if (r.avg_response_time_minutes != null) { w.responseSum += r.avg_response_time_minutes; w.responseCt++; }
      if (r.avg_work_duration_minutes != null) { w.durationSum += r.avg_work_duration_minutes; w.durationCt++; }
      if (r.callback_rate != null) { w.callbackSum += parseFloat(r.callback_rate); w.callbackCt++; }
      if (r.completeness_score != null) { w.completenessSum += r.completeness_score; w.completenessCt++; }
    });
    return Array.from(map.entries()).map(([id, w]) => ({
      worker_name: w.name,
      worker_id: id,
      tasks_completed: w.tasks,
      avg_response_time_minutes: w.responseCt > 0 ? Math.round(w.responseSum / w.responseCt) : null,
      avg_work_duration_minutes: w.durationCt > 0 ? Math.round(w.durationSum / w.durationCt) : null,
      callback_rate: w.callbackCt > 0 ? parseFloat((w.callbackSum / w.callbackCt).toFixed(1)) : null,
      completeness_score: w.completenessCt > 0 ? parseFloat((w.completenessSum / w.completenessCt).toFixed(1)) : null,
    })).filter(w => w.tasks_completed > 0);
  }, [workerData]);

  const sortedWorkers = useMemo(() => {
    return [...workerAgg].sort((a, b) => {
      const av = a[sort.field] ?? (sort.dir === 'asc' ? Infinity : -Infinity);
      const bv = b[sort.field] ?? (sort.dir === 'asc' ? Infinity : -Infinity);
      return sort.dir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
  }, [workerAgg, sort]);

  const topWorker = sortedWorkers[0]?.worker_id;

  function toggleSort(field: SortField) {
    setSort(prev => prev.field === field
      ? { field, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { field, dir: 'desc' });
  }

  const TIME_FILTERS: { key: TimeFilter; label: string }[] = [
    { key: '7d',  label: 'Last 7 Days' },
    { key: '30d', label: 'Last 30 Days' },
    { key: '90d', label: 'Last 90 Days' },
    { key: 'ytd', label: 'Year to Date' },
  ];

  // ── KPI summary cards ─────────────────────────────────────────────────────────
  const totalCreated   = taskData?.length ?? 0;
  const totalCompleted = taskData?.filter(t => t.finished_at).length ?? 0;
  const avgResponse    = taskData
    ? (() => {
        const items = taskData.filter(t => t.response_time_minutes != null);
        return items.length > 0
          ? Math.round(items.reduce((s, t) => s + (t.response_time_minutes ?? 0), 0) / items.length)
          : null;
      })()
    : null;
  const guestImpact = taskData?.filter(t => t.ai_guest_impact && !t.finished_at).length ?? 0;

  return (
    <div className="space-y-8">
      {/* PAGE HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Maintenance Insights</h2>
          <p className="text-sm text-muted-foreground">Trend analysis, recurring issues, and team performance</p>
        </div>
        <div className="flex flex-wrap gap-1">
          {TIME_FILTERS.map(f => (
            <Button
              key={f.key}
              variant={timeFilter === f.key ? 'default' : 'ghost'}
              size="sm"
              className="h-7 px-2.5 text-xs"
              onClick={() => setTimeFilter(f.key)}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      {/* KPI STRIP */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Tasks Created', value: totalCreated, icon: Wrench, color: 'gradient-accent', textColor: 'text-primary-foreground' },
          { label: 'Completed', value: totalCompleted, icon: Activity, color: 'bg-[hsl(var(--success)/0.15)]', textColor: 'text-[hsl(var(--success))]' },
          { label: 'Avg Response', value: fmt(avgResponse), icon: Clock, color: 'bg-[hsl(var(--warning)/0.15)]', textColor: 'text-[hsl(var(--warning))]' },
          { label: 'Guest Impact Open', value: guestImpact, icon: AlertTriangle, color: guestImpact > 0 ? 'bg-destructive' : 'bg-muted', textColor: guestImpact > 0 ? 'text-destructive-foreground' : 'text-muted-foreground' },
        ].map(({ label, value, icon: Icon, color, textColor }) => (
          <div key={label} className="glass-card p-3 sm:p-4 flex items-center gap-3">
            <div className={`p-2 rounded-lg shrink-0 ${color}`}>
              <Icon className={`h-4 w-4 ${textColor}`} />
            </div>
            <div>
              <p className="text-xl font-bold text-foreground">{value}</p>
              <p className="text-[11px] text-muted-foreground font-medium">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── SECTION 1: TREND CHARTS ─────────────────────────────────────────── */}
      <div>
        <SectionHeader icon={TrendingUp} title="Trend Charts" subtitle={`${format(from, 'MMM d')} – ${format(to, 'MMM d, yyyy')}`} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Chart 1: Task Volume */}
          <div className="glass-card p-4">
            <h4 className="text-sm font-semibold mb-1">Task Volume Over Time</h4>
            <p className="text-[11px] text-muted-foreground mb-4">Created vs completed per week</p>
            {taskLoading ? (
              <div className="h-48 bg-muted/30 rounded animate-pulse" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={weeklyBuckets} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="netOpenGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.warning} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={CHART_COLORS.warning} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="weekLabel" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="netOpen" name="Net Open" fill="url(#netOpenGrad)" stroke={CHART_COLORS.warning} strokeWidth={1.5} dot={false} />
                  <Line type="monotone" dataKey="created" name="Created" stroke={CHART_COLORS.primary} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="completed" name="Completed" stroke={CHART_COLORS.success} strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Chart 2: Response Time Trend */}
          <div className="glass-card p-4">
            <h4 className="text-sm font-semibold mb-1">Response Time Trend</h4>
            <p className="text-[11px] text-muted-foreground mb-4">Avg minutes from creation to start · Goal: 4 hours (240 min)</p>
            {taskLoading ? (
              <div className="h-48 bg-muted/30 rounded animate-pulse" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={weeklyBuckets} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="weekLabel" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip content={<ChartTooltip />} formatter={(v: any) => [`${v} min`, 'Avg Response']} />
                  <ReferenceLine y={240} stroke={CHART_COLORS.success} strokeDasharray="4 4" label={{ value: '4h goal', position: 'right', fontSize: 10, fill: 'hsl(var(--success))' }} />
                  <Line type="monotone" dataKey="avgResponseTime" name="Avg Response (min)" stroke={CHART_COLORS.primary} strokeWidth={2} dot={{ r: 3, fill: CHART_COLORS.primary }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Chart 3: Tasks by Category */}
          <div className="glass-card p-4">
            <h4 className="text-sm font-semibold mb-1">Tasks by Category</h4>
            <p className="text-[11px] text-muted-foreground mb-4">Top 10 skill categories for selected period</p>
            {taskLoading ? (
              <div className="h-48 bg-muted/30 rounded animate-pulse" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={categoryData} layout="vertical" margin={{ top: 4, right: 24, left: 60, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} width={58} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="count" name="Tasks" radius={[0, 3, 3, 0]}>
                    {categoryData.map((_, i) => (
                      <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Chart 4: Tasks by Urgency (Donut) */}
          <div className="glass-card p-4">
            <h4 className="text-sm font-semibold mb-1">Tasks by Urgency</h4>
            <p className="text-[11px] text-muted-foreground mb-4">Distribution across priority levels</p>
            {taskLoading ? (
              <div className="h-48 bg-muted/30 rounded animate-pulse" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={urgencyData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {urgencyData.map((entry) => (
                      <Cell key={entry.name} fill={URGENCY_COLORS[entry.name] ?? CHART_COLORS.muted} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any, name: string) => [v, name]} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

        </div>
      </div>

      {/* ── SECTION 2: RECURRING ISSUES ────────────────────────────────────── */}
      <div>
        <SectionHeader
          icon={AlertTriangle}
          title="Recurring Issues"
          subtitle={`Tasks flagged as ai_recurring_risk in the selected period — ${recurringGrouped.length} property/category combos`}
        />
        <div className="glass-card overflow-hidden">
          {recurringGrouped.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">No recurring issues flagged in this period</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Property</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Count</TableHead>
                  <TableHead>First Reported</TableHead>
                  <TableHead>Most Recent</TableHead>
                  <TableHead>Latest Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recurringGrouped.map((row, i) => (
                  <TableRow key={i} className={row.count >= 3 ? 'bg-destructive/5' : undefined}>
                    <TableCell className="font-medium text-sm">{row.property_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] capitalize">{row.ai_skill_category}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={`font-bold text-sm ${row.count >= 3 ? 'text-destructive' : 'text-foreground'}`}>{row.count}</span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {row.first_seen ? format(parseISO(row.first_seen), 'MMM d, yyyy') : '—'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {row.last_seen ? format(parseISO(row.last_seen), 'MMM d, yyyy') : '—'}
                    </TableCell>
                    <TableCell>
                      <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                        row.latest_status === 'in_progress' ? 'bg-[hsl(var(--success)/0.15)] text-[hsl(var(--success))]' :
                        row.latest_status === 'created'     ? 'bg-[hsl(var(--warning)/0.15)] text-[hsl(var(--warning))]' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {row.latest_status === 'in_progress' ? 'In Progress' : row.latest_status === 'created' ? 'Open' : row.latest_status ?? '—'}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* ── SECTION 3: PROPERTIES NEEDING ATTENTION ─────────────────────────── */}
      <div>
        <SectionHeader
          icon={BarChart2}
          title="Properties Needing Attention"
          subtitle={`${latestHealth.length} properties with declining or watch health signal`}
        />
        <div className="glass-card overflow-hidden">
          {latestHealth.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">No at-risk properties found</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Property</TableHead>
                  <TableHead>Health Signal</TableHead>
                  <TableHead className="text-right">Open Tasks</TableHead>
                  <TableHead className="text-right">Recurring</TableHead>
                  <TableHead className="text-right">Total Cost</TableHead>
                  <TableHead>Week</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {latestHealth.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium text-sm">{row.property_name}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${HEALTH_BADGE[row.health_signal ?? ''] ?? 'bg-muted text-muted-foreground border-border'}`}>
                        {row.health_signal === 'declining' ? '↓' : '~'} {row.health_signal ?? '—'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-semibold">{row.maintenance_count}</TableCell>
                    <TableCell className="text-right">
                      {row.recurring_issues != null && row.recurring_issues > 0 ? (
                        <span className="text-destructive font-semibold">{row.recurring_issues}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {row.total_costs > 0 ? `$${row.total_costs.toLocaleString()}` : '—'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {row.week_start ? format(parseISO(row.week_start), 'MMM d') : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* ── SECTION 4: TECH PERFORMANCE LEADERBOARD ─────────────────────────── */}
      <div>
        <SectionHeader
          icon={Users}
          title="Tech Performance Leaderboard"
          subtitle="Aggregated from worker_performance_weekly · click headers to sort"
        />
        <div className="glass-card overflow-hidden">
          {sortedWorkers.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">No worker data for this period</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tech</TableHead>
                  {(
                    [
                      ['tasks_completed',         'Tasks Done'],
                      ['avg_response_time_minutes','Avg Response'],
                      ['avg_work_duration_minutes','Avg Duration'],
                      ['callback_rate',            'Callback Rate'],
                      ['completeness_score',       'Completeness'],
                    ] as [SortField, string][]
                  ).map(([field, label]) => (
                    <TableHead
                      key={field}
                      className="text-right cursor-pointer select-none hover:text-foreground transition-colors"
                      onClick={() => toggleSort(field)}
                    >
                      <span className="inline-flex items-center gap-1 justify-end">
                        {label} <SortIcon field={field} sort={sort} />
                      </span>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedWorkers.map((w, i) => {
                  const isTop = w.worker_id === topWorker && sort.field === 'tasks_completed';
                  const highCallback = (w.callback_rate ?? 0) > 15;
                  return (
                    <TableRow
                      key={w.worker_id}
                      className={isTop ? 'bg-[hsl(var(--success)/0.08)]' : highCallback ? 'bg-[hsl(var(--warning)/0.06)]' : undefined}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className={`h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0
                            ${isTop ? 'gradient-accent text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                            {i + 1}
                          </div>
                          <span className="font-medium text-sm">{w.worker_name}</span>
                          {isTop && <Badge variant="outline" className="text-[9px] h-3.5 px-1 text-[hsl(var(--success))] border-[hsl(var(--success)/0.4)]">Top</Badge>}
                          {highCallback && <Badge variant="outline" className="text-[9px] h-3.5 px-1 text-[hsl(var(--warning))] border-[hsl(var(--warning)/0.4)]">⚠</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-bold">{w.tasks_completed}</TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">{fmt(w.avg_response_time_minutes)}</TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">{fmt(w.avg_work_duration_minutes)}</TableCell>
                      <TableCell className="text-right">
                        <span className={`text-sm font-semibold ${highCallback ? 'text-[hsl(var(--warning))]' : 'text-foreground'}`}>
                          {w.callback_rate != null ? `${w.callback_rate}%` : '—'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {w.completeness_score != null ? (
                          <span className={w.completeness_score >= 80 ? 'text-[hsl(var(--success))] font-semibold' : 'text-muted-foreground'}>
                            {w.completeness_score.toFixed(0)}
                          </span>
                        ) : '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </div>
  );
}

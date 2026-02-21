import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { KPICard } from '@/components/dashboard/KPICard';
import { CardSkeleton } from '@/components/dashboard/LoadingSkeleton';

import { ExportCSVButton } from '@/components/dashboard/ExportCSVButton';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  AreaChart, Area, Legend,
} from 'recharts';
import { TrendingUp, AlertTriangle, Calendar, DollarSign, Wrench, UserX, Building2, Clock } from 'lucide-react';
import { format, parse, subMonths } from 'date-fns';
import { Link } from 'react-router-dom';

const tooltipStyle = {
  backgroundColor: 'hsl(222, 25%, 11%)',
  border: '1px solid hsl(220, 15%, 18%)',
  borderRadius: '8px',
  fontSize: 12,
};

function formatMonth(m: string) {
  try {
    if (m.startsWith('+')) return m;
    const full = m.length === 5 ? '20' + m : m;
    const d = parse(full, 'yyyy-MM', new Date());
    return format(d, 'MMM yy');
  } catch {
    return m;
  }
}

export default function TrendsInsights() {
  // BUG 3 FIX: Server-side counts for accurate KPIs
  const { data: taskCount12m, isLoading: countLoading } = useQuery({
    queryKey: ['trends-task-count'],
    queryFn: async () => {
      const twelveMonthsAgo = subMonths(new Date(), 12).toISOString().split('T')[0];
      const [totalRes, maintRes] = await Promise.all([
        supabase.from('breezeway_tasks').select('*', { count: 'exact', head: true }).gte('created_at', twelveMonthsAgo),
        supabase.from('breezeway_tasks').select('*', { count: 'exact', head: true }).eq('department', 'maintenance').gte('created_at', twelveMonthsAgo),
      ]);
      return { total: totalRes.count ?? 0, maintenance: maintRes.count ?? 0 };
    },
  });

  // BUG 6 FIX: Use v_monthly_volume view for pulse chart (server-side aggregation, no row limit)
  const { data: monthlyVolume, isLoading: pulseLoading } = useQuery({
    queryKey: ['trends-monthly-volume'],
    queryFn: async () => {
      const { data } = await supabase
        .from('v_monthly_volume')
        .select('*')
        .order('month', { ascending: true });
      return data ?? [];
    },
  });

  const { data: costs } = useQuery({
    queryKey: ['trends-costs'],
    queryFn: async () => {
      const twelveMonthsAgo = subMonths(new Date(), 12).toISOString().split('T')[0];
      const { data } = await supabase
        .from('breezeway_task_costs')
        .select('cost, created_at')
        .gte('created_at', twelveMonthsAgo);
      return data ?? [];
    },
  });

  // Stale tasks for anomaly detection
  const { data: staleTasks } = useQuery({
    queryKey: ['trends-stale-tasks'],
    queryFn: async () => {
      const { data } = await supabase.from('v_stale_tasks').select('property_name, priority, days_overdue, days_since_created, department');
      return data ?? [];
    },
  });

  // Monthly pulse from view (aggregated by month across departments)
  const monthlyPulse = useMemo(() => {
    if (!monthlyVolume?.length) return [];
    const byMonth: Record<string, { total: number; finished: number; maintenance: number }> = {};
    for (const r of monthlyVolume as any[]) {
      if (!r.month) continue;
      if (!byMonth[r.month]) byMonth[r.month] = { total: 0, finished: 0, maintenance: 0 };
      byMonth[r.month].total += r.task_count ?? 0;
      byMonth[r.month].finished += r.finished ?? 0;
      if (r.department === 'maintenance') byMonth[r.month].maintenance += r.task_count ?? 0;
    }
    return Object.entries(byMonth).sort().map(([month, v]) => ({
      month,
      tasks: v.total,
      finished: v.finished,
      maintenance: v.maintenance,
    }));
  }, [monthlyVolume]);

  // Monthly spend
  const monthlySpend = useMemo(() => {
    if (!costs) return [];
    const byMonth: Record<string, number> = {};
    for (const c of costs) {
      const month = (c.created_at || '').slice(0, 7);
      if (!month) continue;
      byMonth[month] = (byMonth[month] || 0) + (c.cost || 0);
    }
    return Object.entries(byMonth).sort().map(([month, spend]) => ({
      month,
      spend: Math.round(spend),
    }));
  }, [costs]);

  // BUG 7 FIX: Real anomaly detection with multiple signals
  const anomalies = useMemo(() => {
    const alerts: { title: string; description: string; severity: 'high' | 'medium' | 'low'; link?: string; icon: any }[] = [];

    // 1. Stale tasks with urgent/high priority overdue >90 days
    if (staleTasks?.length) {
      const urgentStale = staleTasks.filter((t: any) => 
        (t.priority === 'urgent' || t.priority === 'high') && 
        (t.days_overdue ?? t.days_since_created ?? 0) > 90
      );
      if (urgentStale.length > 0) {
        alerts.push({
          title: `${urgentStale.length} urgent/high tasks overdue >90 days`,
          description: `Critical tasks left unresolved. Properties: ${urgentStale.slice(0, 3).map((t: any) => t.property_name).join(', ')}${urgentStale.length > 3 ? '...' : ''}`,
          severity: 'high',
          link: '/maintenance',
          icon: AlertTriangle,
        });
      }

      // Total stale count
      if (staleTasks.length > 50) {
        alerts.push({
          title: `${staleTasks.length} total overdue tasks`,
          description: `Task backlog is growing. Consider a batch cleanup or reassignment.`,
          severity: 'medium',
          link: '/maintenance',
          icon: Wrench,
        });
      }
    }

    // 2. Property maintenance spikes (from monthly volume)
    if (monthlyPulse.length >= 3) {
      const recent = monthlyPulse[monthlyPulse.length - 1];
      const prior = monthlyPulse.slice(-4, -1);
      const avgTasks = prior.reduce((s, m) => s + m.tasks, 0) / prior.length;
      
      if (avgTasks > 0 && recent.tasks > avgTasks * 1.5) {
        alerts.push({
          title: 'Task volume spike this month',
          description: `${recent.tasks} tasks vs ${Math.round(avgTasks)} avg. ${Math.round((recent.tasks / avgTasks) * 100 - 100)}% increase.`,
          severity: 'medium',
          icon: TrendingUp,
        });
      }

      // Completion rate drop
      if (prior.length > 0) {
        const recentRate = recent.tasks > 0 ? recent.finished / recent.tasks : 0;
        const priorRate = prior.reduce((s, m) => s + (m.tasks > 0 ? m.finished / m.tasks : 0), 0) / prior.length;
        if (priorRate > 0.5 && recentRate < priorRate * 0.85) {
          alerts.push({
            title: 'Completion rate dropped',
            description: `${Math.round(recentRate * 100)}% this month vs ${Math.round(priorRate * 100)}% prior avg. Investigate bottlenecks.`,
            severity: 'high',
            icon: TrendingUp,
          });
        }
      }
    }

    // 3. Cost spike
    if (monthlySpend.length >= 3) {
      const recentSpend = monthlySpend[monthlySpend.length - 1];
      const priorSpend = monthlySpend.slice(-4, -1);
      const avgSpend = priorSpend.reduce((s, m) => s + m.spend, 0) / priorSpend.length;
      if (avgSpend > 100 && recentSpend.spend > avgSpend * 2) {
        alerts.push({
          title: `Cost spike: $${recentSpend.spend.toLocaleString()}`,
          description: `${Math.round((recentSpend.spend / avgSpend) * 100 - 100)}% over the 3-month average of $${Math.round(avgSpend).toLocaleString()}.`,
          severity: 'high',
          icon: DollarSign,
        });
      }
    }

    return alerts.slice(0, 8);
  }, [staleTasks, monthlyPulse, monthlySpend]);

  // Seasonal heatmap - use v_monthly_volume per property (if available) or skip
  // For now, derive from pulse data
  const seasonalData = useMemo((): { topProps: { name: string; total: number; months: Record<string, number> }[]; allMonths: string[] } | null => {
    if (!monthlyVolume?.length) return null;
    // If the view has property-level data, use it. Otherwise build from what we have.
    // The view is per-department per-month, not per-property. So we need the base table for property heatmap.
    // For now, we'll skip the base table query and just show the monthly data we have.
    return null;
  }, [monthlyVolume]);

  // We'll fetch property-level seasonal data separately
  const { data: propSeasonalRaw } = useQuery({
    queryKey: ['trends-property-seasonal'],
    queryFn: async () => {
      // Get property counts by month for top 15 busiest properties
      const { data } = await supabase
        .from('breezeway_tasks')
        .select('property_name, created_at')
        .not('property_name', 'is', null)
        .order('created_at', { ascending: true })
        .limit(5000);
      return data ?? [];
    },
  });

  const propSeasonal = useMemo(() => {
    if (!propSeasonalRaw?.length) return null;
    const propCounts: Record<string, Record<string, number>> = {};
    for (const t of propSeasonalRaw) {
      if (!t.property_name) continue;
      const month = (t.created_at || '').slice(0, 7);
      if (!month) continue;
      if (!propCounts[t.property_name]) propCounts[t.property_name] = {};
      propCounts[t.property_name][month] = (propCounts[t.property_name][month] || 0) + 1;
    }
    const topProps = Object.entries(propCounts)
      .map(([name, months]) => ({ name, total: Object.values(months).reduce((s, v) => s + v, 0), months }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 15);
    const allMonths = [...new Set(propSeasonalRaw.map(t => (t.created_at || '').slice(0, 7)).filter(Boolean))].sort();
    return { topProps, allMonths };
  }, [propSeasonalRaw]);

  // Cost forecast
  const forecast = useMemo(() => {
    if (monthlySpend.length < 3) return [];
    const recent = monthlySpend.slice(-6);
    const n = recent.length;
    const xMean = (n - 1) / 2;
    const yMean = recent.reduce((s, d) => s + d.spend, 0) / n;
    let num = 0, den = 0;
    recent.forEach((d, i) => {
      num += (i - xMean) * (d.spend - yMean);
      den += (i - xMean) ** 2;
    });
    const slope = den !== 0 ? num / den : 0;
    const intercept = yMean - slope * xMean;

    const forecastData = [...recent.map((d, i) => ({
      ...d,
      forecast: Math.round(intercept + slope * i),
      upper: Math.round((intercept + slope * i) * 1.2),
      lower: Math.max(0, Math.round((intercept + slope * i) * 0.8)),
    }))];
    for (let i = 1; i <= 3; i++) {
      const idx = n + i - 1;
      const val = Math.max(0, Math.round(intercept + slope * idx));
      forecastData.push({
        month: `+${i}mo`,
        spend: 0,
        forecast: val,
        upper: Math.round(val * 1.2),
        lower: Math.max(0, Math.round(val * 0.8)),
      });
    }
    return forecastData;
  }, [monthlySpend]);

  const totalTasks12m = taskCount12m?.total ?? 0;
  const maintenanceTasks12m = taskCount12m?.maintenance ?? 0;
  const totalSpend12m = costs?.reduce((s, c) => s + (c.cost || 0), 0) ?? 0;
  const isLoading = countLoading || pulseLoading;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Trends & Insights</h2>
          <p className="text-sm text-muted-foreground">12-month patterns, anomaly detection & forecasting</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)
        ) : (
          <>
            <KPICard title="Tasks (12mo)" value={totalTasks12m.toLocaleString()} icon={TrendingUp} />
            <KPICard title="Maintenance (12mo)" value={maintenanceTasks12m.toLocaleString()} icon={AlertTriangle} />
            <KPICard title="Total Spend (12mo)" value={`$${Math.round(totalSpend12m).toLocaleString()}`} icon={DollarSign} />
            <KPICard title="Anomalies" value={anomalies.length} icon={AlertTriangle} accent={anomalies.length > 0} />
          </>
        )}
      </div>

      {/* Operations Pulse - BUG 6 FIX */}
      <div className="glass-card rounded-lg p-5">
        <h3 className="text-sm font-semibold mb-4">Operations Pulse (All Months)</h3>
        {pulseLoading ? (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">Loading...</div>
        ) : monthlyPulse.length === 0 ? (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">No monthly volume data available</div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlyPulse}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 18%)" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'hsl(215,15%,55%)' }} tickFormatter={formatMonth} />
              <YAxis yAxisId="left" tick={{ fontSize: 11, fill: 'hsl(215,15%,55%)' }} />
              <Tooltip contentStyle={tooltipStyle} labelFormatter={formatMonth} />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="tasks" stroke="hsl(15, 90%, 58%)" strokeWidth={2} dot={false} name="Total Tasks" />
              <Line yAxisId="left" type="monotone" dataKey="finished" stroke="hsl(160, 60%, 50%)" strokeWidth={2} dot={false} name="Finished" />
              <Line yAxisId="left" type="monotone" dataKey="maintenance" stroke="hsl(210, 60%, 55%)" strokeWidth={2} dot={false} name="Maintenance" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* BUG 7 FIX: Anomaly Alerts with real detection */}
        <div className="glass-card rounded-lg p-5">
          <h3 className="text-sm font-semibold mb-4">Anomaly Alerts</h3>
          {anomalies.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No anomalies detected — operations are running smoothly.</p>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {anomalies.map((a, i) => (
                <div key={i} className={`rounded-lg p-3 border ${
                  a.severity === 'high' ? 'border-destructive/30 bg-destructive/10' :
                  a.severity === 'medium' ? 'border-chart-4/30 bg-chart-4/10' :
                  'border-border bg-muted/30'
                }`}>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      <a.icon className={`h-3.5 w-3.5 shrink-0 ${a.severity === 'high' ? 'text-destructive' : 'text-chart-4'}`} />
                      <p className="text-xs font-semibold">{a.title}</p>
                    </div>
                    {a.link && (
                      <Link to={a.link} className="text-[10px] text-accent hover:underline shrink-0">View →</Link>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">{a.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cost Forecast with confidence bands */}
        <div className="glass-card rounded-lg p-5">
          <h3 className="text-sm font-semibold mb-4">Cost Forecast (3-Month Projection)</h3>
          {forecast.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={forecast}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 18%)" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'hsl(215,15%,55%)' }} tickFormatter={formatMonth} />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(215,15%,55%)' }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `$${v.toLocaleString()}`} />
                <Area type="monotone" dataKey="upper" stroke="none" fill="hsl(15, 90%, 58%)" fillOpacity={0.08} name="Upper Band" />
                <Area type="monotone" dataKey="lower" stroke="none" fill="hsl(15, 90%, 58%)" fillOpacity={0.08} name="Lower Band" />
                <Area type="monotone" dataKey="spend" stroke="hsl(210, 60%, 55%)" fill="hsl(210, 60%, 55%)" fillOpacity={0.3} name="Actual" />
                <Area type="monotone" dataKey="forecast" stroke="hsl(15, 90%, 58%)" fill="none" strokeDasharray="5 5" name="Forecast" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">Not enough cost data for forecasting.</p>
          )}
        </div>
      </div>

      {/* Seasonal Heatmap */}
      {propSeasonal && propSeasonal.allMonths.length > 0 && propSeasonal.topProps.length > 0 && (
        <div className="glass-card rounded-lg p-5">
          <h3 className="text-sm font-semibold mb-4">Seasonal Activity (Top 15 Properties)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="text-left py-1 px-2 font-medium text-muted-foreground sticky left-0 bg-card z-10">Property</th>
                  {propSeasonal.allMonths.map(m => (
                    <th key={m} className="text-center py-1 px-1 font-medium text-muted-foreground">{m.slice(5)}</th>
                  ))}
                  <th className="text-center py-1 px-2 font-medium text-muted-foreground">Total</th>
                </tr>
              </thead>
              <tbody>
                {propSeasonal.topProps.map((prop) => (
                  <tr key={prop.name}>
                    <td className="py-1 px-2 truncate max-w-[100px] sm:max-w-[150px] sticky left-0 bg-card z-10">{prop.name}</td>
                    {propSeasonal.allMonths.map(m => {
                      const count = prop.months[m] || 0;
                      const maxCount = Math.max(...Object.values(prop.months));
                      const intensity = maxCount > 0 ? count / maxCount : 0;
                      return (
                        <td key={m} className="py-1 px-1 text-center">
                          <div
                            className="w-6 h-6 rounded-sm mx-auto flex items-center justify-center text-[9px] font-mono"
                            style={{
                              backgroundColor: count > 0 ? `hsl(15, 90%, 58%, ${0.2 + intensity * 0.7})` : 'hsl(220, 15%, 18%, 0.3)',
                              color: intensity > 0.5 ? 'white' : 'hsl(215, 15%, 55%)',
                            }}
                          >
                            {count || ''}
                          </div>
                        </td>
                      );
                    })}
                    <td className="text-center py-1 px-2 font-mono font-medium">{prop.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Color legend */}
          <div className="flex items-center gap-3 mt-3 text-[10px] text-muted-foreground">
            <span>Activity:</span>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: 'hsl(220, 15%, 18%, 0.3)' }} />
              <span>None</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: 'hsl(15, 90%, 58%, 0.3)' }} />
              <span>Low</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: 'hsl(15, 90%, 58%, 0.6)' }} />
              <span>Medium</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: 'hsl(15, 90%, 58%, 0.9)' }} />
              <span>High</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

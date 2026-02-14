import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { KPICard } from '@/components/dashboard/KPICard';
import { CardSkeleton } from '@/components/dashboard/LoadingSkeleton';
import { Badge } from '@/components/ui/badge';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  AreaChart, Area, Legend,
} from 'recharts';
import { TrendingUp, AlertTriangle, Calendar, DollarSign } from 'lucide-react';
import { format, parseISO, subMonths } from 'date-fns';

const tooltipStyle = {
  backgroundColor: 'hsl(222, 25%, 11%)',
  border: '1px solid hsl(220, 15%, 18%)',
  borderRadius: '8px',
  fontSize: 12,
};

export default function TrendsInsights() {
  // 12 months of task data
  const { data: tasks, isLoading } = useQuery({
    queryKey: ['trends-all-tasks'],
    queryFn: async () => {
      const twelveMonthsAgo = subMonths(new Date(), 12).toISOString().split('T')[0];
      const { data } = await supabase
        .from('breezeway_tasks')
        .select('department, status_code, total_time_minutes, total_cost, finished_at, created_at, property_name, name, home_id')
        .gte('created_at', twelveMonthsAgo);
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

  // Monthly aggregation for operations pulse
  const monthlyPulse = useMemo(() => {
    if (!tasks) return [];
    const byMonth: Record<string, { total: number; finished: number; maintenance: number; hkTime: number; hkCount: number }> = {};
    for (const t of tasks) {
      const month = (t.created_at || t.finished_at || '').slice(0, 7);
      if (!month) continue;
      if (!byMonth[month]) byMonth[month] = { total: 0, finished: 0, maintenance: 0, hkTime: 0, hkCount: 0 };
      byMonth[month].total++;
      if (t.status_code === 'finished') byMonth[month].finished++;
      if (t.department === 'maintenance') byMonth[month].maintenance++;
      if (t.department === 'housekeeping' && t.status_code === 'finished' && t.total_time_minutes) {
        byMonth[month].hkTime += t.total_time_minutes;
        byMonth[month].hkCount++;
      }
    }
    return Object.entries(byMonth).sort().map(([month, v]) => ({
      month: month.slice(2),
      tasks: v.total,
      maintenance: v.maintenance,
      avg_clean: v.hkCount > 0 ? Math.round(v.hkTime / v.hkCount) : 0,
    }));
  }, [tasks]);

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
      month: month.slice(2),
      spend: Math.round(spend),
    }));
  }, [costs]);

  // Anomaly detection
  const anomalies = useMemo(() => {
    if (!tasks) return [];
    const alerts: { title: string; description: string; severity: 'high' | 'medium' | 'low' }[] = [];

    // Property maintenance spikes
    const byPropMonth: Record<string, Record<string, number>> = {};
    for (const t of tasks) {
      if (t.department !== 'maintenance' || !t.property_name) continue;
      const month = (t.created_at || '').slice(0, 7);
      if (!month) continue;
      if (!byPropMonth[t.property_name]) byPropMonth[t.property_name] = {};
      byPropMonth[t.property_name][month] = (byPropMonth[t.property_name][month] || 0) + 1;
    }

    for (const [prop, months] of Object.entries(byPropMonth)) {
      const values = Object.values(months);
      if (values.length < 3) continue;
      const avg = values.slice(0, -1).reduce((s, v) => s + v, 0) / (values.length - 1);
      const latest = values[values.length - 1];
      if (avg > 0 && latest > avg * 2) {
        alerts.push({
          title: `Maintenance spike: ${prop}`,
          description: `${latest} issues last month vs ${Math.round(avg)} avg. ${Math.round((latest / avg) * 100)}% increase.`,
          severity: 'high',
        });
      }
    }

    // Department completion drops
    const recentMonth = monthlyPulse[monthlyPulse.length - 1];
    const priorMonth = monthlyPulse[monthlyPulse.length - 2];
    if (recentMonth && priorMonth && priorMonth.tasks > 0) {
      const recentFinishRate = tasks.filter(t => t.created_at?.startsWith(recentMonth.month) && t.status_code === 'finished').length / recentMonth.tasks;
      const priorFinishRate = tasks.filter(t => t.created_at?.startsWith(priorMonth.month) && t.status_code === 'finished').length / priorMonth.tasks;
      if (priorFinishRate > 0 && recentFinishRate < priorFinishRate * 0.8) {
        alerts.push({
          title: 'Completion rate dropped',
          description: `${Math.round(recentFinishRate * 100)}% this month vs ${Math.round(priorFinishRate * 100)}% last month.`,
          severity: 'medium',
        });
      }
    }

    return alerts.slice(0, 8);
  }, [tasks, monthlyPulse]);

  // Seasonal heatmap
  const seasonalData = useMemo((): { topProps: { name: string; total: number; months: Record<string, number> }[]; allMonths: string[] } | null => {
    if (!tasks) return null;
    const propCounts: Record<string, Record<string, number>> = {};
    for (const t of tasks) {
      if (!t.property_name) continue;
      const month = (t.created_at || '').slice(0, 7);
      if (!month) continue;
      if (!propCounts[t.property_name]) propCounts[t.property_name] = {};
      propCounts[t.property_name][month] = (propCounts[t.property_name][month] || 0) + 1;
    }
    // Top 15 busiest properties
    const topProps = Object.entries(propCounts)
      .map(([name, months]) => ({ name, total: Object.values(months).reduce((s, v) => s + v, 0), months }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 15);

    const allMonths = [...new Set(tasks.map(t => (t.created_at || '').slice(0, 7)).filter(Boolean))].sort();
    return { topProps, allMonths };
  }, [tasks]);

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

    const forecastData = [...recent.map((d, i) => ({ ...d, forecast: Math.round(intercept + slope * i) }))];
    for (let i = 1; i <= 3; i++) {
      const idx = n + i - 1;
      forecastData.push({
        month: `+${i}mo`,
        spend: 0,
        forecast: Math.max(0, Math.round(intercept + slope * idx)),
      });
    }
    return forecastData;
  }, [monthlySpend]);

  // KPIs
  const totalTasks12m = tasks?.length ?? 0;
  const maintenanceTasks12m = tasks?.filter(t => t.department === 'maintenance').length ?? 0;
  const totalSpend12m = costs?.reduce((s, c) => s + (c.cost || 0), 0) ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-bold tracking-tight">Trends & Insights</h2>
          <Badge variant="default" className="text-[10px] bg-accent text-accent-foreground">NEW</Badge>
        </div>
        <p className="text-sm text-muted-foreground">12-month patterns, anomaly detection & forecasting</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)
        ) : (
          <>
            <KPICard title="Tasks (12mo)" value={totalTasks12m.toLocaleString()} icon={TrendingUp} />
            <KPICard title="Maintenance (12mo)" value={maintenanceTasks12m} icon={AlertTriangle} />
            <KPICard title="Total Spend (12mo)" value={`$${Math.round(totalSpend12m).toLocaleString()}`} icon={DollarSign} />
            <KPICard title="Anomalies" value={anomalies.length} icon={AlertTriangle} accent={anomalies.length > 0} />
          </>
        )}
      </div>

      {/* Operations Pulse */}
      <div className="glass-card rounded-lg p-5">
        <h3 className="text-sm font-semibold mb-4">Operations Pulse (12 Months)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={monthlyPulse}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 18%)" />
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'hsl(215,15%,55%)' }} />
            <YAxis yAxisId="left" tick={{ fontSize: 11, fill: 'hsl(215,15%,55%)' }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: 'hsl(215,15%,55%)' }} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend />
            <Line yAxisId="left" type="monotone" dataKey="tasks" stroke="hsl(15, 90%, 58%)" strokeWidth={2} dot={false} name="Total Tasks" />
            <Line yAxisId="left" type="monotone" dataKey="maintenance" stroke="hsl(210, 60%, 55%)" strokeWidth={2} dot={false} name="Maintenance" />
            <Line yAxisId="right" type="monotone" dataKey="avg_clean" stroke="hsl(160, 60%, 50%)" strokeWidth={2} dot={false} name="Avg Clean (min)" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Anomaly Alerts */}
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
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className={`h-3.5 w-3.5 ${a.severity === 'high' ? 'text-destructive' : 'text-chart-4'}`} />
                    <p className="text-xs font-semibold">{a.title}</p>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{a.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cost Forecast */}
        <div className="glass-card rounded-lg p-5">
          <h3 className="text-sm font-semibold mb-4">Cost Forecast (3-Month Projection)</h3>
          {forecast.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={forecast}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 18%)" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'hsl(215,15%,55%)' }} />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(215,15%,55%)' }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `$${v.toLocaleString()}`} />
                <Area type="monotone" dataKey="spend" stroke="hsl(210, 60%, 55%)" fill="hsl(210, 60%, 55%)" fillOpacity={0.3} name="Actual" />
                <Area type="monotone" dataKey="forecast" stroke="hsl(15, 90%, 58%)" fill="hsl(15, 90%, 58%)" fillOpacity={0.15} strokeDasharray="5 5" name="Forecast" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">Not enough cost data for forecasting.</p>
          )}
        </div>
      </div>

      {/* Seasonal Heatmap */}
      {seasonalData && seasonalData.allMonths && seasonalData.topProps && (
        <div className="glass-card rounded-lg p-5">
          <h3 className="text-sm font-semibold mb-4">Seasonal Activity (Top 15 Properties)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="text-left py-1 px-2 font-medium text-muted-foreground">Property</th>
                  {seasonalData.allMonths.map(m => (
                    <th key={m} className="text-center py-1 px-1 font-medium text-muted-foreground">{m.slice(5)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {seasonalData.topProps.map((prop) => (
                  <tr key={prop.name}>
                    <td className="py-1 px-2 truncate max-w-[100px] sm:max-w-[150px]">{prop.name}</td>
                    {seasonalData.allMonths.map(m => {
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

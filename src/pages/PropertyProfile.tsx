import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useDateRange } from '@/contexts/DateRangeContext';
import { TableSkeleton } from '@/components/dashboard/LoadingSkeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Users, DollarSign, Clock, Wrench } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend, BarChart, Bar } from 'recharts';
import { SeasonalChart } from '@/components/properties/SeasonalChart';
import { format, parseISO } from 'date-fns';

const tooltipStyle = {
  backgroundColor: 'hsl(0, 0%, 100%)',
  border: '1px solid hsl(0, 0%, 90%)',
  borderRadius: '8px',
  fontSize: 12,
};

export default function PropertyProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { formatForQuery } = useDateRange();
  const { from, to } = formatForQuery();

  // All tasks for this property
  const { data: tasks, isLoading } = useQuery({
    queryKey: ['property-profile-tasks', id, from, to],
    queryFn: async () => {
      const { data } = await supabase
        .from('breezeway_tasks')
        .select('breezeway_id, name, department, status_code, total_time_minutes, total_cost, priority, finished_at, created_at, property_name, started_at, scheduled_date')
        .eq('home_id', Number(id))
        .gte('created_at', from)
        .lte('created_at', to)
        .order('created_at', { ascending: false })
        .limit(1000);
      return data ?? [];
    },
  });

  // Assignments for cleaners at this property
  const { data: assignments } = useQuery({
    queryKey: ['property-profile-assignments', id, from, to],
    queryFn: async () => {
      const taskIds = tasks?.map(t => t.breezeway_id) ?? [];
      if (taskIds.length === 0) return [];
      const { data } = await supabase
        .from('breezeway_task_assignments')
        .select('assignee_name, assignee_id, task_id')
        .in('task_id', taskIds);
      return data ?? [];
    },
    enabled: !!tasks && tasks.length > 0,
  });

  // Costs breakdown
  const { data: costs } = useQuery({
    queryKey: ['property-profile-costs', id, from, to],
    queryFn: async () => {
      const taskIds = tasks?.map(t => t.breezeway_id) ?? [];
      if (taskIds.length === 0) return [];
      const { data } = await supabase
        .from('breezeway_task_costs')
        .select('cost, cost_type_name, cost_type_code, created_at, task_id')
        .in('task_id', taskIds);
      return data ?? [];
    },
    enabled: !!tasks && tasks.length > 0,
  });

  // Reservations for this property (match via breezeway properties -> guesty)
  const { data: propInfo } = useQuery({
    queryKey: ['property-profile-info', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('breezeway_properties')
        .select('name, address, latitude, longitude')
        .eq('breezeway_id', Number(id))
        .single();
      return data;
    },
  });

  const propertyName = tasks?.[0]?.property_name || propInfo?.name || `Property ${id}`;

  // Cleaner performance at this property
  const cleanerStats = (() => {
    if (!tasks || !assignments) return [];
    const taskMap = new Map(tasks.map(t => [t.breezeway_id, t]));
    const byClnr: Record<string, { name: string; times: number[]; count: number }> = {};
    for (const a of assignments) {
      if (!a.assignee_name) continue;
      if (!byClnr[a.assignee_name]) byClnr[a.assignee_name] = { name: a.assignee_name, times: [], count: 0 };
      const task = taskMap.get(a.task_id!);
      if (task?.department === 'housekeeping' && task?.status_code === 'finished') {
        byClnr[a.assignee_name].count++;
        if (task.total_time_minutes) byClnr[a.assignee_name].times.push(Number(task.total_time_minutes));
      }
    }
    return Object.values(byClnr)
      .map(c => ({
        name: c.name,
        cleans: c.count,
        avg: c.times.length > 0 ? Math.round(c.times.reduce((s, t) => s + t, 0) / c.times.length) : 0,
        best: c.times.length > 0 ? Math.round(Math.min(...c.times)) : 0,
        worst: c.times.length > 0 ? Math.round(Math.max(...c.times)) : 0,
      }))
      .sort((a, b) => b.cleans - a.cleans);
  })();

  // Clean time trend (weekly)
  const cleanTrend = (() => {
    if (!tasks) return [];
    const hkFinished = tasks.filter(t => t.department === 'housekeeping' && t.status_code === 'finished' && t.finished_at && t.total_time_minutes);
    const byWeek: Record<string, number[]> = {};
    for (const t of hkFinished) {
      const d = parseISO(t.finished_at!);
      const weekKey = format(d, 'MM/dd');
      if (!byWeek[weekKey]) byWeek[weekKey] = [];
      byWeek[weekKey].push(Number(t.total_time_minutes));
    }
    return Object.entries(byWeek)
      .map(([week, times]) => ({ week, avg: Math.round(times.reduce((s, t) => s + t, 0) / times.length) }))
      .slice(-12);
  })();

  // Cost breakdown (labor vs material)
  const laborCost = costs?.filter(c => c.cost_type_code === 'labor').reduce((s, c) => s + (Number(c.cost) || 0), 0) ?? 0;
  const materialCost = costs?.filter(c => c.cost_type_code !== 'labor').reduce((s, c) => s + (Number(c.cost) || 0), 0) ?? 0;
  const costPieData = [
    { name: 'Labor', value: laborCost },
    { name: 'Materials', value: materialCost },
  ].filter(d => d.value > 0);

  // Seasonal patterns
  const seasonalData = (() => {
    if (!tasks) return [];
    const byMonth: Record<string, { housekeeping: number; maintenance: number }> = {};
    for (const t of tasks) {
      if (!t.created_at) continue;
      const m = format(parseISO(t.created_at), 'MMM yyyy');
      if (!byMonth[m]) byMonth[m] = { housekeeping: 0, maintenance: 0 };
      if (t.department === 'housekeeping') byMonth[m].housekeeping++;
      else if (t.department === 'maintenance') byMonth[m].maintenance++;
    }
    return Object.entries(byMonth).map(([month, v]) => ({ month, ...v }));
  })();

  // Maintenance timeline
  const maintTasks = tasks?.filter(t => t.department === 'maintenance').slice(0, 20) ?? [];

  // Upcoming scheduled
  const upcoming = tasks?.filter(t => t.scheduled_date && t.status_code !== 'finished' && new Date(t.scheduled_date) >= new Date()).slice(0, 10) ?? [];

  // Anomalies
  const anomalies: string[] = [];
  const hkTimes = tasks?.filter(t => t.department === 'housekeeping' && t.total_time_minutes).map(t => Number(t.total_time_minutes)) ?? [];
  if (hkTimes.length > 0) {
    const mean = hkTimes.reduce((s, t) => s + t, 0) / hkTimes.length;
    const std = Math.sqrt(hkTimes.reduce((s, t) => s + (t - mean) ** 2, 0) / hkTimes.length);
    const outliers = hkTimes.filter(t => Math.abs(t - mean) > 2 * std).length;
    if (outliers > 0) anomalies.push(`${outliers} clean times are 2+ standard deviations from mean (${Math.round(mean)}±${Math.round(std)}min)`);
  }
  const urgentCount = tasks?.filter(t => t.priority === 'urgent').length ?? 0;
  if (urgentCount > 3) anomalies.push(`${urgentCount} urgent priority tasks in this period`);

  if (isLoading) return <TableSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/properties')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{propertyName}</h2>
          <p className="text-sm text-muted-foreground">{propInfo?.address || 'Property profile & analytics'}</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="glass-card p-4 text-center">
          <Clock className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
          <p className="text-xs text-muted-foreground">Avg Clean</p>
          <p className="text-xl font-bold">{hkTimes.length > 0 ? Math.round(hkTimes.reduce((s, t) => s + t, 0) / hkTimes.length) : '—'}m</p>
        </div>
        <div className="glass-card p-4 text-center">
          <Wrench className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
          <p className="text-xs text-muted-foreground">Maintenance</p>
          <p className="text-xl font-bold">{maintTasks.length}</p>
        </div>
        <div className="glass-card p-4 text-center">
          <DollarSign className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
          <p className="text-xs text-muted-foreground">Total Cost</p>
          <p className="text-xl font-bold">${(laborCost + materialCost).toLocaleString()}</p>
        </div>
        <div className="glass-card p-4 text-center">
          <Users className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
          <p className="text-xs text-muted-foreground">Cleaners</p>
          <p className="text-xl font-bold">{cleanerStats.length}</p>
        </div>
      </div>

      {/* Anomalies */}
      {anomalies.length > 0 && (
        <div className="glass-card p-4 border-l-4 border-l-destructive">
          <h3 className="text-sm font-semibold mb-2">⚠️ Anomalies Detected</h3>
          <ul className="space-y-1">
            {anomalies.map((a, i) => <li key={i} className="text-xs text-muted-foreground">• {a}</li>)}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Clean Time Trend */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold mb-3">Clean Time Trend</h3>
          {cleanTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={cleanTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0, 0%, 90%)" />
                <XAxis dataKey="week" tick={{ fontSize: 10, fill: 'hsl(240, 4%, 40%)' }} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(240, 4%, 40%)' }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="avg" stroke="hsl(5, 87%, 55%)" strokeWidth={2} dot={{ r: 3 }} name="Avg min" />
              </LineChart>
            </ResponsiveContainer>
          ) : <p className="text-xs text-muted-foreground">No clean data available</p>}
        </div>

        {/* Cost Breakdown */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold mb-3">Cost Breakdown</h3>
          {costPieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={costPieData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" paddingAngle={3}>
                  <Cell fill="hsl(5, 87%, 55%)" />
                  <Cell fill="hsl(210, 60%, 55%)" />
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `$${v.toLocaleString()}`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-xs text-muted-foreground">No cost data</p>}
        </div>
      </div>

      {/* Seasonal Patterns */}
      {seasonalData.length > 0 && (
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold mb-3">Seasonal Task Volume</h3>
          <SeasonalChart data={seasonalData} />
        </div>
      )}

      {/* Assigned Cleaners Performance */}
      {cleanerStats.length > 0 && (
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold mb-3">Cleaner Performance at This Property</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Cleaner</TableHead>
                <TableHead className="text-xs text-right">Cleans</TableHead>
                <TableHead className="text-xs text-right">Avg Time</TableHead>
                <TableHead className="text-xs text-right">Best</TableHead>
                <TableHead className="text-xs text-right">Worst</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cleanerStats.map(c => (
                <TableRow key={c.name}>
                  <TableCell className="text-sm font-medium">{c.name}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{c.cleans}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{c.avg}m</TableCell>
                  <TableCell className="text-right font-mono text-sm text-chart-4">{c.best}m</TableCell>
                  <TableCell className="text-right font-mono text-sm text-destructive">{c.worst}m</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Maintenance History */}
      {maintTasks.length > 0 && (
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold mb-3">Maintenance History</h3>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {maintTasks.map((t, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded bg-muted/30 text-xs">
                <div className="flex-1 truncate">{t.name}</div>
                <div className="flex items-center gap-2 shrink-0">
                  {t.priority === 'urgent' && <Badge variant="destructive" className="text-[9px]">urgent</Badge>}
                  <Badge variant="outline" className="text-[9px]">{t.status_code}</Badge>
                  {t.total_cost && <span className="font-mono">${Number(t.total_cost).toFixed(0)}</span>}
                  {t.finished_at && <span className="text-muted-foreground">{format(parseISO(t.finished_at), 'MMM d')}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming Scheduled */}
      {upcoming.length > 0 && (
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold mb-3">Upcoming Scheduled Tasks</h3>
          <div className="space-y-1">
            {upcoming.map((t, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded bg-muted/30 text-xs">
                <span className="truncate flex-1">{t.name}</span>
                <span className="text-muted-foreground shrink-0">{t.scheduled_date}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

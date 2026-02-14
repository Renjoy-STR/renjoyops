import { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Breadcrumbs } from '@/components/dashboard/Breadcrumbs';
import { KPICard } from '@/components/dashboard/KPICard';
import { ExportCSVButton } from '@/components/dashboard/ExportCSVButton';
import { CardSkeleton, TableSkeleton } from '@/components/dashboard/LoadingSkeleton';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend, BarChart, Bar,
} from 'recharts';
import { User, CheckCircle2, Clock, TrendingUp, Calendar } from 'lucide-react';
import { format, parseISO, subDays } from 'date-fns';

const tooltipStyle = {
  backgroundColor: 'hsl(222, 25%, 11%)',
  border: '1px solid hsl(220, 15%, 18%)',
  borderRadius: '8px',
  fontSize: 12,
};

const PIE_COLORS = ['hsl(15, 90%, 58%)', 'hsl(210, 60%, 55%)', 'hsl(160, 60%, 50%)', 'hsl(45, 90%, 55%)', 'hsl(280, 55%, 60%)'];

export default function PersonProfile() {
  const { name } = useParams<{ name: string }>();
  const decodedName = decodeURIComponent(name || '');

  // Fetch all tasks for this person
  const { data, isLoading } = useQuery({
    queryKey: ['person-profile', decodedName],
    enabled: !!decodedName,
    queryFn: async () => {
      // Get all assignment task_ids for this person
      const { data: assignments } = await supabase
        .from('breezeway_task_assignments')
        .select('task_id')
        .ilike('assignee_name', decodedName);
      if (!assignments?.length) return null;

      const taskIds = assignments.map(a => a.task_id);
      let allTasks: any[] = [];
      for (let i = 0; i < taskIds.length; i += 500) {
        const { data: tasks } = await supabase
          .from('breezeway_tasks')
          .select('breezeway_id, property_name, home_id, name, department, status_code, total_time_minutes, finished_at, created_at, total_cost')
          .in('breezeway_id', taskIds.slice(i, i + 500));
        if (tasks) allTasks = allTasks.concat(tasks);
      }
      return allTasks;
    },
  });

  const profile = useMemo(() => {
    if (!data) return null;

    const departments = [...new Set(data.map(t => t.department).filter(Boolean))];
    const finished = data.filter(t => t.status_code === 'finished');
    const earliest = data.reduce((min, t) => {
      const d = t.created_at || t.finished_at;
      return d && (!min || d < min) ? d : min;
    }, '');
    const completionRate = data.length > 0 ? Math.round((finished.length / data.length) * 100) : 0;

    // Monthly performance
    const byMonth: Record<string, { total: number; count: number; tasks: number }> = {};
    for (const t of finished) {
      if (!t.finished_at) continue;
      const month = t.finished_at.slice(0, 7);
      if (!byMonth[month]) byMonth[month] = { total: 0, count: 0, tasks: 0 };
      byMonth[month].tasks++;
      if (t.total_time_minutes) {
        byMonth[month].total += t.total_time_minutes;
        byMonth[month].count++;
      }
    }
    const monthlyPerf = Object.entries(byMonth).sort().map(([month, v]) => ({
      month: month.slice(2), // YY-MM
      avg_minutes: v.count > 0 ? Math.round(v.total / v.count) : 0,
      task_count: v.tasks,
    }));

    // Property affinity
    const byProp: Record<string, { name: string; count: number; total: number; timeCount: number }> = {};
    for (const t of finished) {
      if (!t.property_name) continue;
      if (!byProp[t.property_name]) byProp[t.property_name] = { name: t.property_name, count: 0, total: 0, timeCount: 0 };
      byProp[t.property_name].count++;
      if (t.total_time_minutes) {
        byProp[t.property_name].total += t.total_time_minutes;
        byProp[t.property_name].timeCount++;
      }
    }
    const propertyAffinity = Object.values(byProp)
      .map(p => ({ ...p, avg_minutes: p.timeCount > 0 ? Math.round(p.total / p.timeCount) : 0 }))
      .sort((a, b) => b.count - a.count);

    // Task type breakdown
    const byType: Record<string, number> = {};
    for (const t of data) {
      const type = t.name || 'Unknown';
      byType[type] = (byType[type] || 0) + 1;
    }
    const taskBreakdown = Object.entries(byType)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, value]) => ({ name: name.slice(0, 25), value }));

    // 90-day avg
    const ninetyDaysAgo = subDays(new Date(), 90).toISOString();
    const recent = finished.filter(t => t.finished_at && t.finished_at >= ninetyDaysAgo);
    const recentWithTime = recent.filter(t => t.total_time_minutes);
    const recentAvg = recentWithTime.length > 0
      ? Math.round(recentWithTime.reduce((s, t) => s + t.total_time_minutes, 0) / recentWithTime.length)
      : 0;

    // Overall avg
    const allWithTime = finished.filter(t => t.total_time_minutes);
    const overallAvg = allWithTime.length > 0
      ? Math.round(allWithTime.reduce((s, t) => s + t.total_time_minutes, 0) / allWithTime.length)
      : 0;
    const trend = overallAvg > 0 ? Math.round(((recentAvg - overallAvg) / overallAvg) * 100) : 0;

    return {
      departments,
      totalTasks: data.length,
      completedTasks: finished.length,
      completionRate,
      memberSince: earliest ? format(parseISO(earliest), 'MMM yyyy') : 'Unknown',
      recentAvg,
      overallAvg,
      trend,
      monthlyPerf,
      propertyAffinity,
      taskBreakdown,
    };
  }, [data]);

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[
        { label: 'Overview', href: '/' },
        { label: 'Team', href: '/team' },
        { label: decodedName },
      ]} />

      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <User className="h-6 w-6 text-accent" />
            {decodedName}
          </h2>
          <div className="flex items-center gap-2 mt-1">
            {profile?.departments.map(d => (
              <Badge key={d} variant="outline" className="text-[10px] capitalize">{d}</Badge>
            ))}
            {profile && <span className="text-xs text-muted-foreground">• Member since {profile.memberSince}</span>}
          </div>
        </div>
        {profile?.propertyAffinity && (
          <ExportCSVButton
            data={profile.propertyAffinity.map(p => ({ Property: p.name, Tasks: p.count, 'Avg Minutes': p.avg_minutes }))}
            filename={`${decodedName}-profile`}
          />
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)
        ) : profile ? (
          <>
            <KPICard title="Total Tasks" value={profile.totalTasks} icon={CheckCircle2} />
            <KPICard title="Completion Rate" value={`${profile.completionRate}%`} icon={TrendingUp} />
            <KPICard title="90-Day Avg" value={`${profile.recentAvg}m`} icon={Clock}
              trend={profile.trend !== 0 ? { value: -profile.trend, label: 'vs overall (lower=better)' } : undefined}
            />
            <KPICard title="Overall Avg" value={`${profile.overallAvg}m`} icon={Calendar} />
          </>
        ) : null}
      </div>

      {profile && (
        <>
          {/* Performance Over Time */}
          <div className="glass-card rounded-lg p-5">
            <h3 className="text-sm font-semibold mb-4">Performance Over Time</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={profile.monthlyPerf}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 18%)" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'hsl(215,15%,55%)' }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11, fill: 'hsl(215,15%,55%)' }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: 'hsl(215,15%,55%)' }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="avg_minutes" stroke="hsl(15, 90%, 58%)" strokeWidth={2} dot={false} name="Avg Minutes" />
                <Line yAxisId="right" type="monotone" dataKey="task_count" stroke="hsl(210, 60%, 55%)" strokeWidth={2} dot={false} name="Tasks" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            {/* Task Breakdown */}
            <div className="glass-card rounded-lg p-5">
              <h3 className="text-sm font-semibold mb-4">Task Type Breakdown</h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={profile.taskBreakdown} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" nameKey="name" paddingAngle={2}>
                    {profile.taskBreakdown.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Property Affinity */}
            <div className="glass-card rounded-lg p-5">
              <h3 className="text-sm font-semibold mb-4">Top Properties</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={profile.propertyAffinity.slice(0, 10).map(p => ({ name: p.name.slice(0, 18), tasks: p.count, avg: p.avg_minutes }))} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 18%)" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(215,15%,55%)' }} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 9, fill: 'hsl(215,15%,55%)' }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="tasks" fill="hsl(15, 90%, 58%)" radius={[0, 4, 4, 0]} name="Tasks" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Full Property Table */}
          <div className="glass-card rounded-lg p-5">
            <h3 className="text-sm font-semibold mb-4">Property Affinity ({profile.propertyAffinity.length} properties)</h3>
            <div className="overflow-auto max-h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Property</TableHead>
                    <TableHead className="text-xs text-right">Tasks</TableHead>
                    <TableHead className="text-xs text-right">Avg Time (min)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profile.propertyAffinity.map((p) => (
                    <TableRow key={p.name}>
                      <TableCell className="text-sm">{p.name}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{p.count}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{p.avg_minutes || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </>
      )}

      {!isLoading && !profile && (
        <div className="text-center py-16">
          <p className="text-sm text-muted-foreground">No data found for "{decodedName}"</p>
          <Link to="/team" className="text-xs text-accent hover:underline mt-2 inline-block">← Back to Team</Link>
        </div>
      )}
    </div>
  );
}

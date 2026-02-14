import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useDateRange } from '@/contexts/DateRangeContext';
import { TableSkeleton } from '@/components/dashboard/LoadingSkeleton';
import { KPICard } from '@/components/dashboard/KPICard';
import { ExportCSVButton } from '@/components/dashboard/ExportCSVButton';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { Users, UserCheck, UserX, Clock } from 'lucide-react';
import { differenceInDays, parseISO, subDays, format } from 'date-fns';
import { Link } from 'react-router-dom';

const tooltipStyle = {
  backgroundColor: 'hsl(222, 25%, 11%)',
  border: '1px solid hsl(220, 15%, 18%)',
  borderRadius: '8px',
  fontSize: 12,
};

interface PersonData {
  name: string;
  assigned: number;
  completed: number;
  completion_rate: number;
  avg_minutes: number;
  departments: string[];
  active_7d: number;
  zero_activity: boolean;
}

export default function TeamWorkloadPage() {
  const { formatForQuery } = useDateRange();
  const { from, to } = formatForQuery();

  const { data: people, isLoading } = useQuery({
    queryKey: ['team-workload-enhanced', from, to],
    queryFn: async () => {
      // Get all tasks in period with assignments
      const { data: tasks } = await supabase
        .from('breezeway_tasks')
        .select('breezeway_id, department, status_code, total_time_minutes, finished_at, created_at')
        .gte('created_at', from)
        .lte('created_at', to);

      if (!tasks?.length) return [];

      const taskIds = tasks.map(t => t.breezeway_id);
      const batchSize = 500;
      let allAssignments: { task_id: string; assignee_name: string }[] = [];
      for (let i = 0; i < taskIds.length; i += batchSize) {
        const batch = taskIds.slice(i, i + batchSize);
        const { data: assignments } = await supabase
          .from('breezeway_task_assignments')
          .select('task_id, assignee_name')
          .in('task_id', batch);
        if (assignments) allAssignments = allAssignments.concat(assignments);
      }

      const taskMap = new Map(tasks.map(t => [t.breezeway_id, t]));
      const sevenDaysAgo = subDays(new Date(), 7).toISOString();

      const byPerson: Record<string, {
        assigned: number; completed: number; times: number[];
        departments: Set<string>; recent_7d: number;
      }> = {};

      for (const a of allAssignments) {
        if (!a.assignee_name) continue;
        const task = taskMap.get(a.task_id);
        if (!task) continue;
        if (!byPerson[a.assignee_name]) {
          byPerson[a.assignee_name] = { assigned: 0, completed: 0, times: [], departments: new Set(), recent_7d: 0 };
        }
        const p = byPerson[a.assignee_name];
        p.assigned++;
        if (task.status_code === 'finished') {
          p.completed++;
          if (task.total_time_minutes) p.times.push(task.total_time_minutes);
        }
        if (task.department) p.departments.add(task.department);
        if (task.finished_at && task.finished_at >= sevenDaysAgo) p.recent_7d++;
      }

      return Object.entries(byPerson)
        .map(([name, v]) => ({
          name,
          assigned: v.assigned,
          completed: v.completed,
          completion_rate: v.assigned > 0 ? Math.round((v.completed / v.assigned) * 100) : 0,
          avg_minutes: v.times.length > 0 ? Math.round(v.times.reduce((s, t) => s + t, 0) / v.times.length) : 0,
          departments: Array.from(v.departments),
          active_7d: v.recent_7d,
          zero_activity: v.recent_7d === 0,
        } as PersonData))
        .sort((a, b) => b.assigned - a.assigned);
    },
  });

  const totalPeople = people?.length ?? 0;
  const avgCompletionRate = people?.length ? Math.round(people.reduce((s, p) => s + p.completion_rate, 0) / people.length) : 0;
  const zeroActivity = people?.filter(p => p.zero_activity).length ?? 0;

  // Department efficiency
  const deptEff = people?.reduce<Record<string, { total: number; count: number; completed: number }>>((acc, p) => {
    for (const dept of p.departments) {
      if (!acc[dept]) acc[dept] = { total: 0, count: 0, completed: 0 };
      acc[dept].total += p.avg_minutes;
      acc[dept].count++;
      acc[dept].completed += p.completed;
    }
    return acc;
  }, {}) ?? {};

  const deptEffData = Object.entries(deptEff).map(([dept, v]) => ({
    name: dept,
    avg_minutes: Math.round(v.total / v.count),
    volume: v.completed,
  }));

  const chartData = people?.slice(0, 20).map(p => ({
    name: p.name?.split(' ')[0] ?? 'Unknown',
    assigned: p.assigned,
    completed: p.completed,
  })) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Team Workload</h2>
        <p className="text-sm text-muted-foreground">Assignment distribution and activity tracking (filtered by date range)</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Team Members" value={totalPeople} icon={Users} />
        <KPICard title="Avg Completion Rate" value={`${avgCompletionRate}%`} icon={UserCheck} />
        <KPICard title="Zero Activity (7d)" value={zeroActivity} icon={UserX} accent={zeroActivity > 0} />
        <KPICard title="Total Assigned" value={people?.reduce((s, p) => s + p.assigned, 0) ?? 0} icon={Clock} />
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 glass-card rounded-lg p-5">
          <h3 className="text-sm font-semibold mb-4">Assigned vs Completed (Top 20)</h3>
          {isLoading ? <div className="h-64" /> : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 18%)" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(215,15%,55%)' }} angle={-45} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(215,15%,55%)' }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
                <Bar dataKey="assigned" fill="hsl(15, 90%, 58%)" radius={[4, 4, 0, 0]} name="Assigned" />
                <Bar dataKey="completed" fill="hsl(160, 60%, 50%)" radius={[4, 4, 0, 0]} name="Completed" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="glass-card rounded-lg p-5">
          <h3 className="text-sm font-semibold mb-4">Department Efficiency</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={deptEffData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 18%)" />
              <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(215,15%,55%)' }} />
              <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10, fill: 'hsl(215,15%,55%)' }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="volume" fill="hsl(210, 60%, 55%)" radius={[0, 4, 4, 0]} name="Completed Tasks" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card rounded-lg p-5">
        <h3 className="text-sm font-semibold mb-4">Team Members ({totalPeople})</h3>
        {isLoading ? (
          <TableSkeleton />
        ) : (
          <div className="overflow-auto max-h-[600px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Name</TableHead>
                  <TableHead className="text-xs text-right">Assigned</TableHead>
                  <TableHead className="text-xs text-right">Completed</TableHead>
                  <TableHead className="text-xs text-right">Rate</TableHead>
                  <TableHead className="text-xs text-right">Avg Time (m)</TableHead>
                  <TableHead className="text-xs text-right">7-Day</TableHead>
                  <TableHead className="text-xs">Departments</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {people?.map((p) => (
                  <TableRow key={p.name} className={p.zero_activity ? 'bg-destructive/5' : ''}>
                    <TableCell className="font-medium text-sm">
                      <Link to={`/person/${encodeURIComponent(p.name)}`} className="hover:text-accent transition-colors">
                        {p.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">{p.assigned}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{p.completed}</TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      <span className={p.completion_rate < 50 ? 'text-destructive' : p.completion_rate > 80 ? 'text-chart-3' : ''}>
                        {p.completion_rate}%
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">{p.avg_minutes || '—'}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{p.active_7d}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.departments.join(', ')}</TableCell>
                    <TableCell>
                      {p.zero_activity ? (
                        <Badge variant="destructive" className="text-[10px]">Inactive</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">Active</Badge>
                      )}
                    </TableCell>
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

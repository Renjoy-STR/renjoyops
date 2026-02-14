import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useDateRange } from '@/contexts/DateRangeContext';
import { TableSkeleton } from '@/components/dashboard/LoadingSkeleton';
import { KPICard } from '@/components/dashboard/KPICard';
import { ExportCSVButton } from '@/components/dashboard/ExportCSVButton';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, LabelList } from 'recharts';
import { Users, UserCheck, UserX, Clock } from 'lucide-react';
import { subDays } from 'date-fns';
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
  active_90d: boolean;
}

export default function TeamWorkloadPage() {
  const { formatForQuery } = useDateRange();
  const { from, to } = formatForQuery();
  const [showAll, setShowAll] = useState(false);

  const { data: people, isLoading } = useQuery({
    queryKey: ['team-workload-enhanced', from, to],
    queryFn: async () => {
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
      const ninetyDaysAgo = subDays(new Date(), 90).toISOString();

      const byPerson: Record<string, {
        assigned: number; completed: number; times: number[];
        departments: Set<string>; recent_7d: number; recent_90d: number;
      }> = {};

      for (const a of allAssignments) {
        if (!a.assignee_name) continue;
        const task = taskMap.get(a.task_id);
        if (!task) continue;
        if (!byPerson[a.assignee_name]) {
          byPerson[a.assignee_name] = { assigned: 0, completed: 0, times: [], departments: new Set(), recent_7d: 0, recent_90d: 0 };
        }
        const p = byPerson[a.assignee_name];
        p.assigned++;
        if (task.status_code === 'finished') {
          p.completed++;
          if (task.total_time_minutes) p.times.push(task.total_time_minutes);
        }
        if (task.department) p.departments.add(task.department);
        if (task.finished_at && task.finished_at >= sevenDaysAgo) p.recent_7d++;
        if (task.finished_at && task.finished_at >= ninetyDaysAgo) p.recent_90d++;
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
          active_90d: v.recent_90d > 0,
        } as PersonData))
        .sort((a, b) => b.assigned - a.assigned);
    },
  });

  // Active-only filter
  const displayPeople = showAll ? people : people?.filter(p => p.active_90d);
  const activePeople = people?.filter(p => p.active_90d) ?? [];

  const totalPeople = displayPeople?.length ?? 0;
  const avgCompletionRate = displayPeople?.length ? Math.round(displayPeople.reduce((s, p) => s + p.completion_rate, 0) / displayPeople.length) : 0;
  const zeroActivity7d = activePeople.filter(p => p.zero_activity).length;

  // Department efficiency with labels
  const deptEff = displayPeople?.reduce<Record<string, { total: number; count: number; completed: number; assigned: number }>>((acc, p) => {
    for (const dept of p.departments) {
      if (!acc[dept]) acc[dept] = { total: 0, count: 0, completed: 0, assigned: 0 };
      acc[dept].total += p.avg_minutes;
      acc[dept].count++;
      acc[dept].completed += p.completed;
      acc[dept].assigned += p.assigned;
    }
    return acc;
  }, {}) ?? {};

  const deptEffData = Object.entries(deptEff).map(([dept, v]) => ({
    name: dept,
    completed: v.completed,
    assigned: v.assigned,
    rate: v.assigned > 0 ? Math.round((v.completed / v.assigned) * 100) : 0,
  }));

  const chartData = displayPeople?.slice(0, 20).map(p => ({
    name: p.name?.split(' ')[0] ?? 'Unknown',
    assigned: p.assigned,
    completed: p.completed,
  })) ?? [];

  const exportData = (displayPeople ?? []).map(p => ({
    Name: p.name,
    Assigned: p.assigned,
    Completed: p.completed,
    'Completion Rate': `${p.completion_rate}%`,
    'Avg Time (min)': p.avg_minutes,
    '7-Day Activity': p.active_7d,
    Departments: p.departments.join(', '),
    Status: p.zero_activity ? 'Inactive' : 'Active',
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Team Workload</h2>
          <p className="text-sm text-muted-foreground">Assignment distribution and activity tracking</p>
        </div>
        <ExportCSVButton data={exportData} filename="team-workload" />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <KPICard title="Active Members" value={activePeople.length} icon={Users} subtitle={`${people?.length ?? 0} total`} />
        <KPICard title="Avg Completion Rate" value={`${avgCompletionRate}%`} icon={UserCheck} />
        <KPICard title="Zero Activity (7d)" value={`${zeroActivity7d} of ${activePeople.length}`} icon={UserX} accent={zeroActivity7d > activePeople.length * 0.5} />
        <KPICard title="Total Assigned" value={(displayPeople?.reduce((s, p) => s + p.assigned, 0) ?? 0).toLocaleString()} icon={Clock} />
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 glass-card rounded-lg p-5">
          <h3 className="text-sm font-semibold mb-4">Assigned vs Completed (Top 20)</h3>
          {isLoading ? <div className="h-64" /> : (
            <ResponsiveContainer width="100%" height={260}>
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
              <Legend />
              <Bar dataKey="completed" fill="hsl(160, 60%, 50%)" radius={[0, 4, 4, 0]} name="Completed" stackId="a">
                <LabelList dataKey="completed" position="right" fontSize={10} fill="hsl(215,15%,55%)" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card rounded-lg p-5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
          <h3 className="text-sm font-semibold">Team Members ({totalPeople})</h3>
          <button
            onClick={() => setShowAll(!showAll)}
            className="text-xs px-3 py-1.5 rounded-md font-medium bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
          >
            {showAll ? 'Show active only' : `Show all (${people?.length ?? 0} including inactive)`}
          </button>
        </div>
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
                  <TableHead className="text-xs text-right hidden sm:table-cell">Avg Time (m)</TableHead>
                  <TableHead className="text-xs text-right hidden sm:table-cell">7-Day</TableHead>
                  <TableHead className="text-xs hidden md:table-cell">Departments</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayPeople?.map((p) => (
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
                    <TableCell className="text-right font-mono text-sm hidden sm:table-cell">{p.avg_minutes || '—'}</TableCell>
                    <TableCell className="text-right font-mono text-sm hidden sm:table-cell">{p.active_7d}</TableCell>
                    <TableCell className="text-xs text-muted-foreground hidden md:table-cell">{p.departments.join(', ')}</TableCell>
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

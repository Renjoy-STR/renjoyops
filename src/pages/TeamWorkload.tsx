import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { TableSkeleton } from '@/components/dashboard/LoadingSkeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import type { TeamWorkload } from '@/types/database';

export default function TeamWorkloadPage() {
  const { data: team, isLoading } = useQuery({
    queryKey: ['team-workload'],
    queryFn: async () => {
      const { data } = await supabase.from('v_team_workload').select('*').order('active_tasks', { ascending: false });
      return (data as TeamWorkload[]) ?? [];
    },
  });

  // Aggregate by person
  const byPerson = team?.reduce<Record<string, { name: string; active: number; completed: number; activity_7d: number; activity_30d: number; departments: string[] }>>((acc, t) => {
    if (!acc[t.assignee_name]) {
      acc[t.assignee_name] = { name: t.assignee_name, active: 0, completed: 0, activity_7d: 0, activity_30d: 0, departments: [] };
    }
    acc[t.assignee_name].active += t.active_tasks ?? 0;
    acc[t.assignee_name].completed += t.completed_tasks ?? 0;
    acc[t.assignee_name].activity_7d += t.activity_7d ?? 0;
    acc[t.assignee_name].activity_30d += t.activity_30d ?? 0;
    if (t.department && !acc[t.assignee_name].departments.includes(t.department)) {
      acc[t.assignee_name].departments.push(t.department);
    }
    return acc;
  }, {}) ?? {};

  const people = Object.values(byPerson).sort((a, b) => b.active - a.active);

  const avgActive = people.length ? people.reduce((s, p) => s + p.active, 0) / people.length : 0;

  const chartData = people.slice(0, 20).map((p) => ({
    name: p.name?.split(' ')[0] ?? 'Unknown',
    active: p.active,
    completed: p.completed,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Team Workload</h2>
        <p className="text-sm text-muted-foreground">Assignment distribution and activity tracking</p>
      </div>

      {/* Workload Chart */}
      <div className="glass-card rounded-lg p-5">
        <h3 className="text-sm font-semibold mb-4">Active vs Completed (Top 20)</h3>
        {isLoading ? (
          <div className="h-64" />
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 18%)" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(215,15%,55%)' }} angle={-45} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(215,15%,55%)' }} />
              <Tooltip contentStyle={{ backgroundColor: 'hsl(222, 25%, 11%)', border: '1px solid hsl(220, 15%, 18%)', borderRadius: '8px', fontSize: 12 }} />
              <Legend />
              <Bar dataKey="active" fill="hsl(15, 90%, 58%)" radius={[4, 4, 0, 0]} name="Active" />
              <Bar dataKey="completed" fill="hsl(160, 60%, 50%)" radius={[4, 4, 0, 0]} name="Completed" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Table */}
      <div className="glass-card rounded-lg p-5">
        <h3 className="text-sm font-semibold mb-4">Team Members ({people.length})</h3>
        {isLoading ? (
          <TableSkeleton />
        ) : (
          <div className="overflow-auto max-h-[600px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Name</TableHead>
                  <TableHead className="text-xs text-right">Active</TableHead>
                  <TableHead className="text-xs text-right">Completed</TableHead>
                  <TableHead className="text-xs text-right">7-Day Activity</TableHead>
                  <TableHead className="text-xs text-right">30-Day Activity</TableHead>
                  <TableHead className="text-xs">Departments</TableHead>
                  <TableHead className="text-xs">Workload</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {people.map((p) => {
                  const isOverloaded = p.active > avgActive * 1.5;
                  const isUnder = p.active < avgActive * 0.5 && p.active > 0;
                  return (
                    <TableRow key={p.name}>
                      <TableCell className="font-medium text-sm">{p.name}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{p.active}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{p.completed}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{p.activity_7d}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{p.activity_30d}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{p.departments.join(', ')}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-2 rounded-full bg-muted w-20 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${isOverloaded ? 'bg-destructive' : isUnder ? 'bg-chart-4' : 'bg-accent'}`}
                              style={{ width: `${Math.min(100, (p.active / (avgActive * 2)) * 100)}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-muted-foreground">
                            {isOverloaded ? 'High' : isUnder ? 'Low' : 'Normal'}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}

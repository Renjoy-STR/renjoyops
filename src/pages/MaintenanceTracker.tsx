import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { TableSkeleton } from '@/components/dashboard/LoadingSkeleton';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';
import type { TopMaintenanceIssue, StaleTask, CostSummary } from '@/types/database';

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'destructive',
  high: 'default',
  normal: 'secondary',
  low: 'outline',
};

export default function MaintenanceTracker() {
  const [filter, setFilter] = useState('');

  const { data: topIssues, isLoading: l1 } = useQuery({
    queryKey: ['top-maintenance-issues'],
    queryFn: async () => {
      const { data } = await supabase.from('v_top_maintenance_issues').select('*').order('occurrences', { ascending: false }).limit(20);
      return (data as TopMaintenanceIssue[]) ?? [];
    },
  });

  const { data: staleTasks, isLoading: l2 } = useQuery({
    queryKey: ['stale-tasks'],
    queryFn: async () => {
      const { data } = await supabase.from('v_stale_tasks').select('*').order('days_overdue', { ascending: false });
      return (data as StaleTask[]) ?? [];
    },
  });

  const { data: costs, isLoading: l3 } = useQuery({
    queryKey: ['cost-summary-all'],
    queryFn: async () => {
      const { data } = await supabase.from('v_cost_summary').select('*');
      return (data as CostSummary[]) ?? [];
    },
  });

  const totalLabor = costs?.reduce((s, c) => s + (c.labor_cost || 0), 0) ?? 0;
  const totalMaterial = costs?.reduce((s, c) => s + (c.material_cost || 0), 0) ?? 0;

  const costPie = [
    { name: 'Labor', value: totalLabor },
    { name: 'Material', value: totalMaterial },
  ];

  const filteredStale = staleTasks?.filter(
    (t) =>
      t.property_name?.toLowerCase().includes(filter.toLowerCase()) ||
      t.name?.toLowerCase().includes(filter.toLowerCase()) ||
      t.assignees?.toLowerCase().includes(filter.toLowerCase())
  ) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Maintenance Tracker</h2>
        <p className="text-sm text-muted-foreground">Top issues, overdue tasks & cost breakdown</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Top Issues */}
        <div className="lg:col-span-2 glass-card rounded-lg p-5">
          <h3 className="text-sm font-semibold mb-4">Most Common Issues</h3>
          {l1 ? (
            <div className="h-64" />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topIssues?.slice(0, 10).map((i) => ({ name: i.task_name?.slice(0, 25), count: i.occurrences, cost: Math.round(i.total_cost || 0) }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 18%)" />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'hsl(215,15%,55%)' }} angle={-45} textAnchor="end" height={80} />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(215,15%,55%)' }} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(222, 25%, 11%)', border: '1px solid hsl(220, 15%, 18%)', borderRadius: '8px', fontSize: 12 }} />
                <Bar dataKey="count" fill="hsl(15, 90%, 58%)" radius={[4, 4, 0, 0]} name="Occurrences" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Cost Breakdown */}
        <div className="glass-card rounded-lg p-5">
          <h3 className="text-sm font-semibold mb-4">Cost Breakdown</h3>
          {l3 ? (
            <div className="h-64" />
          ) : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={costPie} cx="50%" cy="50%" innerRadius={50} outerRadius={75} dataKey="value" paddingAngle={3}>
                    <Cell fill="hsl(15, 90%, 58%)" />
                    <Cell fill="hsl(210, 60%, 55%)" />
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(222, 25%, 11%)', border: '1px solid hsl(220, 15%, 18%)', borderRadius: '8px', fontSize: 12 }} formatter={(v: number) => `$${v.toLocaleString()}`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                <p>Labor: ${totalLabor.toLocaleString()}</p>
                <p>Material: ${totalMaterial.toLocaleString()}</p>
                <p className="font-medium text-foreground">Total: ${(totalLabor + totalMaterial).toLocaleString()}</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Stale Tasks */}
      <div className="glass-card rounded-lg p-5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
          <h3 className="text-sm font-semibold">Overdue / Stale Tasks ({staleTasks?.length ?? 0})</h3>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Filter tasks..." value={filter} onChange={(e) => setFilter(e.target.value)} className="pl-9 h-8 text-sm" />
          </div>
        </div>
        {l2 ? (
          <TableSkeleton />
        ) : (
          <div className="overflow-auto max-h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Property</TableHead>
                  <TableHead className="text-xs">Task</TableHead>
                  <TableHead className="text-xs">Priority</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs text-right">Days Overdue</TableHead>
                  <TableHead className="text-xs">Assignees</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStale.slice(0, 50).map((t) => (
                  <TableRow key={t.breezeway_id}>
                    <TableCell className="text-sm max-w-[150px] truncate">{t.property_name}</TableCell>
                    <TableCell className="text-sm max-w-[150px] truncate">{t.name}</TableCell>
                    <TableCell>
                      <Badge variant={PRIORITY_COLORS[t.priority] as any ?? 'secondary'} className="text-[10px]">
                        {t.priority}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{t.status_code}</TableCell>
                    <TableCell className={`text-right font-mono text-sm ${t.days_overdue > 30 ? 'text-destructive' : ''}`}>
                      {t.days_overdue}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">{t.assignees}</TableCell>
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

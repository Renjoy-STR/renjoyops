import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useDateRange } from '@/contexts/DateRangeContext';
import { TableSkeleton } from '@/components/dashboard/LoadingSkeleton';
import { Badge } from '@/components/ui/badge';
import { KPICard } from '@/components/dashboard/KPICard';
import { ExportCSVButton } from '@/components/dashboard/ExportCSVButton';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell, LabelList,
} from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trophy, AlertTriangle, Users, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';

interface CleanerData {
  assignee_name: string;
  avg_minutes: number;
  median_minutes: number;
  fastest_minutes: number;
  slowest_minutes: number;
  total_cleans: number;
  std_dev: number;
  properties_cleaned: number;
}

const tooltipStyle = {
  backgroundColor: 'hsl(222, 25%, 11%)',
  border: '1px solid hsl(220, 15%, 18%)',
  borderRadius: '8px',
  fontSize: 12,
};

function barColor(avg: number) {
  if (avg < 90) return 'hsl(160, 60%, 50%)';
  if (avg <= 150) return 'hsl(45, 90%, 55%)';
  return 'hsl(15, 90%, 58%)';
}

export default function CleanerPerformance() {
  const { formatForQuery } = useDateRange();
  const { from, to } = formatForQuery();

  const { data: cleaners, isLoading } = useQuery({
    queryKey: ['cleaner-performance', from, to],
    queryFn: async () => {
      const { data: tasks } = await supabase
        .from('breezeway_tasks')
        .select('total_time_minutes, home_id, breezeway_id')
        .eq('department', 'housekeeping')
        .eq('status_code', 'finished')
        .not('total_time_minutes', 'is', null)
        .gte('finished_at', from)
        .lte('finished_at', to);

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
      const byAssignee: Record<string, { times: number[]; properties: Set<string> }> = {};
      for (const a of allAssignments) {
        const task = taskMap.get(a.task_id);
        if (!task || !a.assignee_name) continue;
        if (!byAssignee[a.assignee_name]) byAssignee[a.assignee_name] = { times: [], properties: new Set() };
        byAssignee[a.assignee_name].times.push(task.total_time_minutes);
        byAssignee[a.assignee_name].properties.add(task.home_id);
      }

      return Object.entries(byAssignee)
        .filter(([_, v]) => v.times.length >= 3)
        .map(([name, v]) => {
          const sorted = [...v.times].sort((a, b) => a - b);
          const avg = sorted.reduce((s, t) => s + t, 0) / sorted.length;
          const median = sorted[Math.floor(sorted.length / 2)];
          const variance = sorted.reduce((s, t) => s + Math.pow(t - avg, 2), 0) / sorted.length;
          return {
            assignee_name: name,
            avg_minutes: Math.round(avg),
            median_minutes: Math.round(median),
            fastest_minutes: sorted[0],
            slowest_minutes: sorted[sorted.length - 1],
            total_cleans: sorted.length,
            std_dev: Math.round(Math.sqrt(variance)),
            properties_cleaned: v.properties.size,
          } as CleanerData;
        })
        // BUG 4 FIX: Filter out invalid data (avg < 5 min is clearly erroneous)
        .filter(c => c.avg_minutes >= 5)
        .sort((a, b) => a.avg_minutes - b.avg_minutes);
    },
  });

  const top3 = cleaners?.slice(0, 3) ?? [];
  const flagged = cleaners?.filter((c) => c.median_minutes > 180) ?? [];
  const totalCleaners = cleaners?.length ?? 0;
  const overallAvg = cleaners?.length ? Math.round(cleaners.reduce((s, c) => s + c.avg_minutes, 0) / cleaners.length) : 0;

  // Horizontal bar chart data (top 20)
  const chartData = cleaners?.slice(0, 20).map((c) => ({
    name: c.assignee_name,
    avg: c.avg_minutes,
    median: c.median_minutes,
  })).reverse() ?? []; // reverse for horizontal chart (bottom to top)

  const exportData = cleaners?.map(c => ({
    Cleaner: c.assignee_name,
    'Avg Minutes': c.avg_minutes,
    'Median Minutes': c.median_minutes,
    'Fastest': c.fastest_minutes,
    'Slowest': c.slowest_minutes,
    'Total Cleans': c.total_cleans,
    'Consistency (σ)': c.std_dev,
    'Properties': c.properties_cleaned,
  })) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Cleaner Performance</h2>
          <p className="text-sm text-muted-foreground">Departure clean speed rankings (filtered by date range)</p>
        </div>
        <ExportCSVButton data={exportData} filename="cleaner-performance" />
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <KPICard title="Total Cleaners" value={totalCleaners} icon={Users} />
        <KPICard title="Overall Avg" value={`${overallAvg} min`} icon={TrendingUp} />
        <KPICard title="Flagged (>180m)" value={flagged.length} icon={AlertTriangle} accent={flagged.length > 0} />
        <KPICard title="Top Performer" value={top3[0]?.assignee_name?.split(' ')[0] ?? '—'} subtitle={top3[0] ? `${top3[0].avg_minutes} min avg` : ''} icon={Trophy} />
      </div>

      {/* Horizontal Bar Chart */}
      <div className="glass-card rounded-lg p-5">
        <h3 className="text-sm font-semibold mb-4">Average Clean Time (Top 20)</h3>
        {isLoading ? (
          <div className="h-[500px]" />
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(400, chartData.length * 28)}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 18%)" />
              <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(215,15%,55%)' }} />
              <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 10, fill: 'hsl(215,15%,55%)' }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="avg" radius={[0, 4, 4, 0]} name="Avg Minutes" barSize={20}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={barColor(entry.avg)} />
                ))}
                <LabelList dataKey="avg" position="right" fontSize={10} fill="hsl(215,15%,55%)" formatter={(v: number) => `${v} min`} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="glass-card rounded-lg p-5">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Trophy className="h-4 w-4 text-accent" /> Fastest Cleaners
          </h3>
          <div className="space-y-3">
            {top3.map((c, i) => (
              <div key={c.assignee_name} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-accent">{i + 1}</span>
                  <div>
                    <Link to={`/person/${encodeURIComponent(c.assignee_name)}`} className="text-sm font-medium hover:text-accent transition-colors">
                      {c.assignee_name}
                    </Link>
                    <p className="text-[10px] text-muted-foreground">{c.properties_cleaned} properties</p>
                  </div>
                </div>
                <span className="text-sm font-mono">{c.avg_minutes} min avg</span>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 glass-card rounded-lg p-5">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" /> Flagged (Median &gt; 180 min)
          </h3>
          {flagged.length === 0 ? (
            <p className="text-sm text-muted-foreground">No cleaners flagged in this period</p>
          ) : (
            <div className="space-y-2">
              {flagged.slice(0, 5).map((c) => (
                <div key={c.assignee_name} className="flex items-center justify-between p-2 rounded-md bg-destructive/10 border border-destructive/20">
                  <Link to={`/person/${encodeURIComponent(c.assignee_name)}`} className="text-sm hover:text-accent transition-colors">
                    {c.assignee_name}
                  </Link>
                  <div className="flex items-center gap-3 text-xs">
                    <span>Median: {c.median_minutes} min</span>
                    <span>{c.total_cleans} cleans</span>
                    <span>σ {c.std_dev}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Full table */}
      <div className="glass-card rounded-lg p-5">
        <h3 className="text-sm font-semibold mb-4">Full Leaderboard</h3>
        {isLoading ? (
          <TableSkeleton />
        ) : (
          <div className="overflow-auto max-h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Rank</TableHead>
                  <TableHead className="text-xs">Cleaner</TableHead>
                  <TableHead className="text-xs text-right">Avg (min)</TableHead>
                  <TableHead className="text-xs text-right hidden sm:table-cell">Median</TableHead>
                  <TableHead className="text-xs text-right hidden md:table-cell">Fastest</TableHead>
                  <TableHead className="text-xs text-right hidden md:table-cell">Slowest</TableHead>
                  <TableHead className="text-xs text-right hidden lg:table-cell">Consistency (σ)</TableHead>
                  <TableHead className="text-xs text-right hidden lg:table-cell">Properties</TableHead>
                  <TableHead className="text-xs text-right">Total Cleans</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cleaners?.map((c, i) => (
                  <TableRow key={c.assignee_name} className={c.median_minutes > 180 ? 'bg-destructive/5' : ''}>
                    <TableCell className="font-mono text-xs">{i + 1}</TableCell>
                    <TableCell className="font-medium text-sm">
                      <Link to={`/person/${encodeURIComponent(c.assignee_name)}`} className="hover:text-accent transition-colors">
                        {c.assignee_name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">{c.avg_minutes}</TableCell>
                    <TableCell className="text-right font-mono text-sm hidden sm:table-cell">{c.median_minutes}</TableCell>
                    <TableCell className="text-right font-mono text-sm hidden md:table-cell">{c.fastest_minutes}</TableCell>
                    <TableCell className="text-right font-mono text-sm hidden md:table-cell">{c.slowest_minutes}</TableCell>
                    <TableCell className="text-right font-mono text-sm hidden lg:table-cell">
                      <span className={c.std_dev > 80 ? 'text-destructive' : c.std_dev < 30 ? 'text-chart-3' : ''}>
                        {c.std_dev}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm hidden lg:table-cell">{c.properties_cleaned}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{c.total_cleans}</TableCell>
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

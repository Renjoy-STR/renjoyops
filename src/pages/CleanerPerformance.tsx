import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { TableSkeleton, ChartSkeleton } from '@/components/dashboard/LoadingSkeleton';
import { Badge } from '@/components/ui/badge';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trophy, AlertTriangle } from 'lucide-react';
import type { CleanerLeaderboard } from '@/types/database';

export default function CleanerPerformance() {
  const { data: cleaners, isLoading } = useQuery({
    queryKey: ['cleaner-leaderboard'],
    queryFn: async () => {
      const { data } = await supabase
        .from('v_cleaner_leaderboard')
        .select('*')
        .order('avg_minutes', { ascending: true });
      return (data as CleanerLeaderboard[]) ?? [];
    },
  });

  const top3 = cleaners?.slice(0, 3) ?? [];
  const flagged = cleaners?.filter((c) => c.median_minutes > 180) ?? [];

  const chartData = cleaners?.slice(0, 20).map((c) => ({
    name: c.assignee_name?.split(' ')[0] ?? 'Unknown',
    avg: Math.round(c.avg_minutes),
    median: Math.round(c.median_minutes),
  })) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Cleaner Performance</h2>
        <p className="text-sm text-muted-foreground">Departure clean speed rankings</p>
      </div>

      {/* Bar Chart */}
      <div className="glass-card rounded-lg p-5">
        <h3 className="text-sm font-semibold mb-4">Average Clean Time (Top 20)</h3>
        {isLoading ? (
          <div className="h-64" />
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 18%)" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(215,15%,55%)' }} angle={-45} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(215,15%,55%)' }} label={{ value: 'Minutes', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: 'hsl(215,15%,55%)' } }} />
              <Tooltip contentStyle={{ backgroundColor: 'hsl(222, 25%, 11%)', border: '1px solid hsl(220, 15%, 18%)', borderRadius: '8px', fontSize: 12 }} />
              <Bar dataKey="avg" fill="hsl(15, 90%, 58%)" radius={[4, 4, 0, 0]} name="Avg Minutes" />
              <Bar dataKey="median" fill="hsl(210, 60%, 55%)" radius={[4, 4, 0, 0]} name="Median Minutes" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Top 3 */}
        <div className="glass-card rounded-lg p-5">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Trophy className="h-4 w-4 text-accent" /> Fastest Cleaners
          </h3>
          <div className="space-y-3">
            {top3.map((c, i) => (
              <div key={c.assignee_name} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-accent">{i + 1}</span>
                  <span className="text-sm font-medium">{c.assignee_name}</span>
                </div>
                <span className="text-sm font-mono">{Math.round(c.avg_minutes)}m avg</span>
              </div>
            ))}
          </div>
        </div>

        {/* Flagged */}
        <div className="lg:col-span-2 glass-card rounded-lg p-5">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" /> Flagged (Median &gt; 180 min)
          </h3>
          {flagged.length === 0 ? (
            <p className="text-sm text-muted-foreground">No cleaners flagged</p>
          ) : (
            <div className="space-y-2">
              {flagged.slice(0, 5).map((c) => (
                <div key={c.assignee_name} className="flex items-center justify-between p-2 rounded-md bg-destructive/10 border border-destructive/20">
                  <span className="text-sm">{c.assignee_name}</span>
                  <div className="flex items-center gap-3 text-xs">
                    <span>Median: {Math.round(c.median_minutes)}m</span>
                    <span>{c.total_cleans} cleans</span>
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
                  <TableHead className="text-xs text-right">Median</TableHead>
                  <TableHead className="text-xs text-right">Fastest</TableHead>
                  <TableHead className="text-xs text-right">Slowest</TableHead>
                  <TableHead className="text-xs text-right">Total Cleans</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cleaners?.map((c, i) => (
                  <TableRow key={c.assignee_name} className={c.median_minutes > 180 ? 'bg-destructive/5' : ''}>
                    <TableCell className="font-mono text-xs">{i + 1}</TableCell>
                    <TableCell className="font-medium text-sm">{c.assignee_name}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{Math.round(c.avg_minutes)}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{Math.round(c.median_minutes)}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{Math.round(c.fastest_minutes)}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{Math.round(c.slowest_minutes)}</TableCell>
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

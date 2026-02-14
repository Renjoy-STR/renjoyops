import { useState } from 'react';
import { TableSkeleton } from '@/components/dashboard/LoadingSkeleton';
import { KPICard } from '@/components/dashboard/KPICard';
import { ExportCSVButton } from '@/components/dashboard/ExportCSVButton';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell, LabelList,
} from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Trophy, AlertTriangle, Users, TrendingUp, Zap, HelpCircle } from 'lucide-react';
import { useCleanerData, CleanerData } from '@/hooks/useCleanerData';
import { CleanerSparkline } from '@/components/cleaners/CleanerSparkline';
import { TrendIndicator } from '@/components/cleaners/TrendIndicator';
import { CleanerDetailSheet } from '@/components/cleaners/CleanerDetailSheet';

const tooltipStyle = {
  backgroundColor: 'hsl(var(--background))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
  fontSize: 12,
};

function barColor(avg: number) {
  if (avg < 90) return 'hsl(var(--chart-3))';
  if (avg <= 150) return 'hsl(var(--chart-4))';
  return 'hsl(var(--primary))';
}

export default function CleanerPerformance() {
  const { data: cleaners, isLoading } = useCleanerData();
  const [selectedCleaner, setSelectedCleaner] = useState<CleanerData | null>(null);

  const top3 = cleaners?.slice(0, 3) ?? [];
  const flagged = cleaners?.filter((c) => c.median_minutes > 180) ?? [];
  const totalCleaners = cleaners?.length ?? 0;
  const overallAvg = cleaners?.length ? Math.round(cleaners.reduce((s, c) => s + c.avg_minutes, 0) / cleaners.length) : 0;
  const avgEfficiency = cleaners?.length ? Math.round(cleaners.reduce((s, c) => s + c.schedule_efficiency, 0) / cleaners.length) : 0;

  const chartData = cleaners?.slice(0, 20).map((c) => ({
    name: c.assignee_name,
    avg: c.avg_minutes,
    adjusted: c.adjusted_avg,
  })).reverse() ?? [];

  const exportData = cleaners?.map(c => ({
    Cleaner: c.assignee_name,
    'Avg Minutes': c.avg_minutes,
    'Adjusted Avg': c.adjusted_avg,
    'Median Minutes': c.median_minutes,
    'Fastest': c.fastest_minutes,
    'Slowest': c.slowest_minutes,
    'Total Cleans': c.total_cleans,
    'Consistency (σ)': c.std_dev,
    'Properties': c.properties_cleaned,
    'Schedule Efficiency %': c.schedule_efficiency,
    'Trend': c.trend_direction,
  })) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-primary tracking-tight">Cleaner Performance</h2>
          <p className="text-sm text-muted-foreground">Departure clean speed rankings with property-adjusted metrics</p>
        </div>
        <ExportCSVButton data={exportData} filename="cleaner-performance" />
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <KPICard title="Total Cleaners" value={totalCleaners} icon={Users} />
        <KPICard title="Overall Avg" value={`${overallAvg} min`} icon={TrendingUp} />
        <KPICard title="Flagged (>180m)" value={flagged.length} icon={AlertTriangle} accent={flagged.length > 0} />
        <KPICard title="Avg Schedule Eff." value={`${avgEfficiency}%`} subtitle="Back-to-back clean days" icon={Zap} />
      </div>

      {/* Horizontal Bar Chart */}
      <div className="bg-card rounded-lg p-5 border border-border shadow-sm">
        <h3 className="text-sm font-bold text-secondary mb-4">Average Clean Time — Top 20</h3>
        {isLoading ? (
          <div className="h-[500px]" />
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(400, chartData.length * 28)}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 50 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="avg" radius={[0, 4, 4, 0]} name="Avg Minutes" barSize={20}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={barColor(entry.avg)} />
                ))}
                <LabelList dataKey="avg" position="right" fontSize={10} fill="hsl(var(--muted-foreground))" formatter={(v: number) => `${v}m`} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Top 3 */}
        <div className="bg-card rounded-lg p-5 border border-border shadow-sm">
          <h3 className="text-sm font-bold text-secondary mb-3 flex items-center gap-2">
            <Trophy className="h-4 w-4 text-primary" /> Fastest Cleaners
          </h3>
          <div className="space-y-3">
            {top3.map((c, i) => (
              <div key={c.assignee_name} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-primary">{i + 1}</span>
                  <div>
                    <button onClick={() => setSelectedCleaner(c)} className="text-sm font-medium hover:text-primary transition-colors text-left">
                      {c.assignee_name}
                    </button>
                    <p className="text-[10px] text-muted-foreground">{c.properties_cleaned} properties · eff {c.schedule_efficiency}%</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-mono">{c.avg_minutes}m</span>
                  <p className="text-[10px] text-muted-foreground">adj {c.adjusted_avg}m</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Flagged section */}
        <div className="lg:col-span-2 bg-card rounded-lg p-5 border border-border shadow-sm">
          <h3 className="text-sm font-bold text-secondary mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" /> Flagged (Median &gt; 180 min)
          </h3>
          {flagged.length === 0 ? (
            <p className="text-sm text-muted-foreground">No cleaners flagged in this period 🎉</p>
          ) : (
            <div className="space-y-2">
              {flagged.slice(0, 5).map((c) => (
                <div key={c.assignee_name} className="flex items-center justify-between p-2 rounded-md bg-destructive/5 border border-destructive/20">
                  <div className="flex items-center gap-2">
                    <TrendIndicator direction={c.trend_direction} showLabel />
                    <button onClick={() => setSelectedCleaner(c)} className="text-sm hover:text-primary transition-colors">
                      {c.assignee_name}
                    </button>
                  </div>
                  <div className="flex items-center gap-3 text-xs font-mono">
                    <span>Med: {c.median_minutes}m</span>
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
      <div className="bg-card rounded-lg p-5 border border-border shadow-sm">
        <h3 className="text-sm font-bold text-secondary mb-4">Full Leaderboard</h3>
        {isLoading ? (
          <TableSkeleton />
        ) : (
          <div className="overflow-auto max-h-[500px]">
            <TooltipProvider>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Rank</TableHead>
                    <TableHead className="text-xs">Cleaner</TableHead>
                    <TableHead className="text-xs text-right">Avg (min)</TableHead>
                    <TableHead className="text-xs text-right hidden sm:table-cell">Adj. Avg</TableHead>
                    <TableHead className="text-xs text-right hidden sm:table-cell">Median</TableHead>
                    <TableHead className="text-xs text-right hidden md:table-cell">Fastest</TableHead>
                    <TableHead className="text-xs text-right hidden md:table-cell">Slowest</TableHead>
                    <TableHead className="text-xs text-right hidden lg:table-cell">
                      <span className="inline-flex items-center gap-1">
                        Consistency
                        <UITooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-[200px]">
                            <p className="text-xs">Standard deviation (σ) in minutes. Lower = more consistent. Under 30 is excellent, over 80 is highly variable.</p>
                          </TooltipContent>
                        </UITooltip>
                      </span>
                    </TableHead>
                    <TableHead className="text-xs text-right hidden lg:table-cell">Sched. Eff.</TableHead>
                    <TableHead className="text-xs text-center hidden xl:table-cell">Trend</TableHead>
                    <TableHead className="text-xs text-right">Cleans</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cleaners?.map((c, i) => (
                    <TableRow key={c.assignee_name} className={`${c.median_minutes > 180 ? 'bg-destructive/5' : i % 2 === 1 ? 'bg-muted/30' : ''}`}>
                      <TableCell className="font-mono text-xs">{i + 1}</TableCell>
                      <TableCell className="font-medium text-sm">
                        <button onClick={() => setSelectedCleaner(c)} className="hover:text-primary transition-colors text-left">
                          {c.assignee_name}
                        </button>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">{c.avg_minutes}</TableCell>
                      <TableCell className="text-right font-mono text-sm hidden sm:table-cell">
                        <span className={c.adjusted_avg < c.avg_minutes - 5 ? 'text-green-600' : c.adjusted_avg > c.avg_minutes + 5 ? 'text-destructive' : ''}>
                          {c.adjusted_avg}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm hidden sm:table-cell">{c.median_minutes}</TableCell>
                      <TableCell className="text-right font-mono text-sm hidden md:table-cell">{c.fastest_minutes}</TableCell>
                      <TableCell className="text-right font-mono text-sm hidden md:table-cell">{c.slowest_minutes}</TableCell>
                      <TableCell className="text-right font-mono text-sm hidden lg:table-cell">
                        <span className={c.std_dev > 80 ? 'text-destructive' : c.std_dev < 30 ? 'text-green-600' : ''}>
                          {c.std_dev}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm hidden lg:table-cell">{c.schedule_efficiency}%</TableCell>
                      <TableCell className="text-center hidden xl:table-cell">
                        <CleanerSparkline data={c.weekly_trend} />
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">{c.total_cleans}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TooltipProvider>
          </div>
        )}
      </div>

      <CleanerDetailSheet
        cleaner={selectedCleaner}
        open={!!selectedCleaner}
        onOpenChange={(open) => { if (!open) setSelectedCleaner(null); }}
      />
    </div>
  );
}

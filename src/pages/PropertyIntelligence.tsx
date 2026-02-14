import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useDateRange } from '@/contexts/DateRangeContext';
import { TableSkeleton } from '@/components/dashboard/LoadingSkeleton';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Search, Building2 } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line, PieChart, Pie, Cell, Legend, LabelList } from 'recharts';

const tooltipStyle = {
  backgroundColor: 'hsl(222, 25%, 11%)',
  border: '1px solid hsl(220, 15%, 18%)',
  borderRadius: '8px',
  fontSize: 12,
};

export default function PropertyIntelligence() {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'clean' | 'maintenance' | 'cost'>('clean');
  const [selectedProperty, setSelectedProperty] = useState<string | null>(null);
  const { formatForQuery } = useDateRange();
  const { from, to } = formatForQuery();

  // Fetch tasks in date range grouped by property
  const { data: propertyData, isLoading } = useQuery({
    queryKey: ['property-intelligence', from, to],
    queryFn: async () => {
      const { data: tasks } = await supabase
        .from('breezeway_tasks')
        .select('home_id, property_name, department, status_code, total_time_minutes, total_cost, priority, finished_at')
        .gte('created_at', from)
        .lte('created_at', to);

      if (!tasks) return [];

      const byProp: Record<string, {
        home_id: string; property_name: string;
        clean_times: number[]; maintenance_count: number; urgent_count: number;
        total_cost: number; total_tasks: number;
      }> = {};

      for (const t of tasks) {
        if (!t.home_id) continue;
        if (!byProp[t.home_id]) {
          byProp[t.home_id] = {
            home_id: t.home_id, property_name: t.property_name || 'Unknown',
            clean_times: [], maintenance_count: 0, urgent_count: 0,
            total_cost: 0, total_tasks: 0,
          };
        }
        const p = byProp[t.home_id];
        p.total_tasks++;
        if (t.department === 'housekeeping' && t.status_code === 'finished' && t.total_time_minutes) {
          p.clean_times.push(t.total_time_minutes);
        }
        if (t.department === 'maintenance') {
          p.maintenance_count++;
          if (t.priority === 'urgent') p.urgent_count++;
        }
        p.total_cost += t.total_cost || 0;
      }

      return Object.values(byProp).map(p => {
        const avg = p.clean_times.length > 0 ? Math.round(p.clean_times.reduce((s, t) => s + t, 0) / p.clean_times.length) : 0;
        const over4hr = p.clean_times.filter(t => t > 240).length;
        // Health score: 0-100 (higher=better)
        const cleanScore = avg > 0 ? Math.max(0, 100 - ((avg - 120) / 2)) : 50;
        const maintScore = Math.max(0, 100 - p.maintenance_count * 5);
        const costScore = Math.max(0, 100 - (p.total_cost / 50));
        const healthScore = Math.round((cleanScore + maintScore + costScore) / 3);
        return {
          ...p,
          avg_clean_minutes: avg,
          total_cleans: p.clean_times.length,
          cleans_over_4hrs: over4hr,
          health_score: Math.max(0, Math.min(100, healthScore)),
        };
      });
    },
  });

  // Detail data for selected property
  const { data: detailTasks } = useQuery({
    queryKey: ['property-detail', selectedProperty, from, to],
    enabled: !!selectedProperty,
    queryFn: async () => {
      const { data } = await supabase
        .from('breezeway_tasks')
        .select('name, department, status_code, total_time_minutes, total_cost, finished_at, priority')
        .eq('home_id', selectedProperty!)
        .gte('created_at', from)
        .lte('created_at', to)
        .order('created_at', { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  const filtered = propertyData?.filter(p =>
    p.property_name?.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'clean') return b.avg_clean_minutes - a.avg_clean_minutes;
    if (sortBy === 'maintenance') return b.maintenance_count - a.maintenance_count;
    return b.total_cost - a.total_cost;
  });

  const topProblem = sorted.slice(0, 10);

  const selectedProp = propertyData?.find(p => p.home_id === selectedProperty);
  const detailCostLabor = detailTasks?.filter(t => t.department === 'maintenance').reduce((s, t) => s + (t.total_cost || 0), 0) ?? 0;
  const detailCostHk = detailTasks?.filter(t => t.department === 'housekeeping').reduce((s, t) => s + (t.total_cost || 0), 0) ?? 0;

  const healthColor = (score: number) => {
    if (score >= 70) return 'bg-chart-3/20 text-chart-3 border-chart-3/30';
    if (score >= 40) return 'bg-chart-4/20 text-chart-4 border-chart-4/30';
    return 'bg-destructive/20 text-destructive border-destructive/30';
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Property Intelligence</h2>
        <p className="text-sm text-muted-foreground">Clean difficulty, maintenance hotspots & costs (filtered by date range)</p>
      </div>

      {/* Top Problem Properties Chart */}
      <div className="glass-card rounded-lg p-5">
        <h3 className="text-sm font-semibold mb-4">Top 10 Problem Properties (Avg Clean Time)</h3>
        {isLoading ? (
          <div className="h-64" />
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topProblem.map(p => ({ name: p.property_name?.slice(0, 20), clean: p.avg_clean_minutes, maintenance: p.maintenance_count }))} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 18%)" />
              <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(215,15%,55%)' }} />
              <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 9, fill: 'hsl(215,15%,55%)' }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="clean" fill="hsl(15, 90%, 58%)" radius={[0, 4, 4, 0]} name="Avg Clean (min)" barSize={24}>
                <LabelList dataKey="clean" position="right" fontSize={10} fill="hsl(215,15%,55%)" formatter={(v: number) => `${v} min`} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Search + Sort */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search properties..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-2">
          {(['clean', 'maintenance', 'cost'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={`px-2 py-1 text-[10px] sm:px-3 sm:py-1.5 sm:text-xs rounded-md font-medium transition-colors ${sortBy === s ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
            >
              {s === 'clean' ? 'Clean Time' : s === 'maintenance' ? 'Maintenance' : 'Cost'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="glass-card rounded-lg p-5">
        {isLoading ? (
          <TableSkeleton />
        ) : (
          <div className="overflow-auto max-h-[600px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Property</TableHead>
                   <TableHead className="text-xs text-center hidden sm:table-cell">Health</TableHead>
                   <TableHead className="text-xs text-right">Avg Clean</TableHead>
                   <TableHead className="text-xs text-right hidden md:table-cell">Total Cleans</TableHead>
                   <TableHead className="text-xs text-right hidden lg:table-cell">Cleans &gt;4hr</TableHead>
                   <TableHead className="text-xs text-right">Maintenance</TableHead>
                   <TableHead className="text-xs text-right hidden lg:table-cell">Urgent</TableHead>
                   <TableHead className="text-xs text-right">Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.slice(0, 50).map((p) => (
                  <TableRow
                    key={p.home_id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelectedProperty(p.home_id)}
                  >
                    <TableCell className="font-medium text-sm max-w-[200px] truncate">
                      {p.property_name}
                    </TableCell>
                     <TableCell className="text-center hidden sm:table-cell">
                       <Badge variant="outline" className={`text-[10px] ${healthColor(p.health_score)}`}>
                         {p.health_score}
                       </Badge>
                     </TableCell>
                     <TableCell className={`text-right font-mono text-sm ${p.avg_clean_minutes > 180 ? 'text-destructive' : ''}`}>
                       {p.avg_clean_minutes || '—'}
                     </TableCell>
                     <TableCell className="text-right font-mono text-sm hidden md:table-cell">{p.total_cleans}</TableCell>
                     <TableCell className="text-right font-mono text-sm hidden lg:table-cell">{p.cleans_over_4hrs}</TableCell>
                     <TableCell className="text-right font-mono text-sm">{p.maintenance_count}</TableCell>
                     <TableCell className="text-right font-mono text-sm hidden lg:table-cell">{p.urgent_count}</TableCell>
                    <TableCell className="text-right font-mono text-sm">${(p.total_cost || 0).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Property Detail Drawer */}
      <Sheet open={!!selectedProperty} onOpenChange={(open) => !open && setSelectedProperty(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-lg">{selectedProp?.property_name ?? 'Property Detail'}</SheetTitle>
          </SheetHeader>
          {selectedProp && (
            <div className="space-y-6 mt-4">
              {/* Summary */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground">Avg Clean</p>
                  <p className="text-xl font-bold">{selectedProp.avg_clean_minutes}m</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground">Health Score</p>
                  <p className="text-xl font-bold">{selectedProp.health_score}/100</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground">Total Tasks</p>
                  <p className="text-xl font-bold">{selectedProp.total_tasks}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground">Total Cost</p>
                  <p className="text-xl font-bold">${selectedProp.total_cost.toLocaleString()}</p>
                </div>
              </div>

              {/* Cost Breakdown */}
              <div>
                <h4 className="text-sm font-semibold mb-2">Cost by Department</h4>
                <ResponsiveContainer width="100%" height={150}>
                  <PieChart>
                    <Pie data={[{ name: 'Maintenance', value: detailCostLabor }, { name: 'Housekeeping', value: detailCostHk }]} cx="50%" cy="50%" innerRadius={35} outerRadius={55} dataKey="value" paddingAngle={3}>
                      <Cell fill="hsl(15, 90%, 58%)" />
                      <Cell fill="hsl(210, 60%, 55%)" />
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `$${v.toLocaleString()}`} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Recent Tasks */}
              <div>
                <h4 className="text-sm font-semibold mb-2">Recent Tasks</h4>
                <div className="space-y-1 max-h-[300px] overflow-y-auto">
                  {detailTasks?.map((t, i) => (
                    <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded bg-muted/30 text-xs">
                      <div className="flex-1 truncate">{t.name}</div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className="text-[9px]">{t.department}</Badge>
                        {t.total_time_minutes && <span className="font-mono">{t.total_time_minutes}m</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

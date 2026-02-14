import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { TableSkeleton } from '@/components/dashboard/LoadingSkeleton';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Building2, ArrowUpDown } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import type { PropertyDifficulty, MaintenanceHotspot, CostSummary } from '@/types/database';

export default function PropertyIntelligence() {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'clean' | 'maintenance' | 'cost'>('clean');

  const { data: difficulty, isLoading: l1 } = useQuery({
    queryKey: ['property-difficulty'],
    queryFn: async () => {
      const { data } = await supabase.from('v_property_difficulty').select('*').order('avg_clean_minutes', { ascending: false });
      return (data as PropertyDifficulty[]) ?? [];
    },
  });

  const { data: hotspots, isLoading: l2 } = useQuery({
    queryKey: ['maintenance-hotspots'],
    queryFn: async () => {
      const { data } = await supabase.from('v_maintenance_hotspots').select('*').order('total_maintenance', { ascending: false });
      return (data as MaintenanceHotspot[]) ?? [];
    },
  });

  const { data: costs, isLoading: l3 } = useQuery({
    queryKey: ['cost-summary'],
    queryFn: async () => {
      const { data } = await supabase.from('v_cost_summary').select('*').order('total_cost', { ascending: false });
      return (data as CostSummary[]) ?? [];
    },
  });

  // Merge data by property
  const merged = difficulty?.map((d) => {
    const h = hotspots?.find((x) => x.home_id === d.home_id);
    const c = costs?.find((x) => x.home_id === d.home_id);
    return {
      ...d,
      maintenance_count: h?.total_maintenance ?? 0,
      urgent_count: h?.urgent_count ?? 0,
      total_cost: c?.total_cost ?? 0,
      labor_cost: c?.labor_cost ?? 0,
      material_cost: c?.material_cost ?? 0,
      problem_score: (d.avg_clean_minutes > 180 ? 1 : 0) + (h?.total_maintenance ?? 0 > 10 ? 1 : 0),
    };
  }) ?? [];

  const filtered = merged.filter((p) =>
    p.property_name?.toLowerCase().includes(search.toLowerCase())
  );

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'clean') return b.avg_clean_minutes - a.avg_clean_minutes;
    if (sortBy === 'maintenance') return b.maintenance_count - a.maintenance_count;
    return b.total_cost - a.total_cost;
  });

  const topProblem = sorted.slice(0, 10);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Property Intelligence</h2>
        <p className="text-sm text-muted-foreground">Clean difficulty, maintenance hotspots & costs</p>
      </div>

      {/* Top Problem Properties Chart */}
      <div className="glass-card rounded-lg p-5">
        <h3 className="text-sm font-semibold mb-4">Top 10 Problem Properties (Avg Clean Time)</h3>
        {l1 ? (
          <div className="h-64" />
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topProblem.map((p) => ({ name: p.property_name?.slice(0, 20), clean: Math.round(p.avg_clean_minutes), maintenance: p.maintenance_count }))} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 18%)" />
              <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(215,15%,55%)' }} />
              <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 10, fill: 'hsl(215,15%,55%)' }} />
              <Tooltip contentStyle={{ backgroundColor: 'hsl(222, 25%, 11%)', border: '1px solid hsl(220, 15%, 18%)', borderRadius: '8px', fontSize: 12 }} />
              <Bar dataKey="clean" fill="hsl(15, 90%, 58%)" radius={[0, 4, 4, 0]} name="Avg Clean (min)" />
              <Bar dataKey="maintenance" fill="hsl(210, 60%, 55%)" radius={[0, 4, 4, 0]} name="Maintenance Tasks" />
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
              className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${sortBy === s ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
            >
              {s === 'clean' ? 'Clean Time' : s === 'maintenance' ? 'Maintenance' : 'Cost'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="glass-card rounded-lg p-5">
        {l1 || l2 || l3 ? (
          <TableSkeleton />
        ) : (
          <div className="overflow-auto max-h-[600px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Property</TableHead>
                  <TableHead className="text-xs text-right">Avg Clean (min)</TableHead>
                  <TableHead className="text-xs text-right">Total Cleans</TableHead>
                  <TableHead className="text-xs text-right">Cleans &gt;4hr</TableHead>
                  <TableHead className="text-xs text-right">Maintenance</TableHead>
                  <TableHead className="text-xs text-right">Urgent</TableHead>
                  <TableHead className="text-xs text-right">Total Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.slice(0, 50).map((p) => (
                  <TableRow key={p.home_id}>
                    <TableCell className="font-medium text-sm max-w-[200px] truncate">
                      {p.property_name}
                      {p.problem_score >= 2 && (
                        <Badge variant="destructive" className="ml-2 text-[10px]">Problem</Badge>
                      )}
                    </TableCell>
                    <TableCell className={`text-right font-mono text-sm ${p.avg_clean_minutes > 180 ? 'text-destructive' : ''}`}>
                      {Math.round(p.avg_clean_minutes)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">{p.total_cleans}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{p.cleans_over_4hrs}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{p.maintenance_count}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{p.urgent_count}</TableCell>
                    <TableCell className="text-right font-mono text-sm">${(p.total_cost || 0).toLocaleString()}</TableCell>
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

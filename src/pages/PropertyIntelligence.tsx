import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useDateRange } from '@/contexts/DateRangeContext';
import { TableSkeleton } from '@/components/dashboard/LoadingSkeleton';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Search, Building2, Map, TableIcon, GitCompareArrows } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LabelList } from 'recharts';
import { HealthScoreBreakdown } from '@/components/properties/HealthScoreBreakdown';
import { PropertyCompare } from '@/components/properties/PropertyCompare';
import { PropertyMap } from '@/components/properties/PropertyMap';
import { SeasonalChart } from '@/components/properties/SeasonalChart';
import { format, parseISO } from 'date-fns';

const tooltipStyle = {
  backgroundColor: 'hsl(0, 0%, 100%)',
  border: '1px solid hsl(0, 0%, 90%)',
  borderRadius: '8px',
  fontSize: 12,
};

interface PropertyRow {
  home_id: string;
  property_name: string;
  clean_times: number[];
  maintenance_count: number;
  urgent_count: number;
  total_cost: number;
  total_tasks: number;
  avg_clean_minutes: number;
  total_cleans: number;
  cleans_over_4hrs: number;
  health_score: number;
  cost_per_clean: number;
  cost_per_night: number | null;
  latitude: number | null;
  longitude: number | null;
}

export default function PropertyIntelligence() {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'clean' | 'maintenance' | 'cost' | 'health'>('health');
  const [viewMode, setViewMode] = useState<'table' | 'map'>('table');
  const [selectedProperty, setSelectedProperty] = useState<string | null>(null);
  const [healthBreakdownProp, setHealthBreakdownProp] = useState<PropertyRow | null>(null);
  const [compareIds, setCompareIds] = useState<Set<string>>(new Set());
  const [showCompare, setShowCompare] = useState(false);
  const navigate = useNavigate();
  const { formatForQuery } = useDateRange();
  const { from, to } = formatForQuery();

  // Fetch property coordinates
  const { data: propCoords } = useQuery({
    queryKey: ['property-coords'],
    queryFn: async () => {
      const { data } = await supabase
        .from('breezeway_properties')
        .select('breezeway_id, latitude, longitude')
        .not('latitude', 'is', null);
      const map: Record<string, { lat: number; lng: number }> = {};
      data?.forEach(p => { map[String(p.breezeway_id)] = { lat: p.latitude!, lng: p.longitude! }; });
      return map;
    },
  });

  // Fetch reservation nights per property for cost/night
  const { data: nightsMap } = useQuery({
    queryKey: ['property-nights', from, to],
    queryFn: async () => {
      const { data } = await supabase
        .from('guesty_reservations')
        .select('listing_id, nights_count')
        .gte('check_in', from)
        .lte('check_in', to);
      const map: Record<string, number> = {};
      data?.forEach(r => {
        if (r.listing_id && r.nights_count) {
          map[r.listing_id] = (map[r.listing_id] || 0) + r.nights_count;
        }
      });
      return map;
    },
  });

  // Fetch tasks grouped by property
  const { data: propertyData, isLoading } = useQuery({
    queryKey: ['property-intelligence', from, to, propCoords, nightsMap],
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
        const hid = String(t.home_id);
        if (!byProp[hid]) {
          byProp[hid] = {
            home_id: hid, property_name: t.property_name || 'Unknown',
            clean_times: [], maintenance_count: 0, urgent_count: 0,
            total_cost: 0, total_tasks: 0,
          };
        }
        const p = byProp[hid];
        p.total_tasks++;
        if (t.department === 'housekeeping' && t.status_code === 'finished' && t.total_time_minutes) {
          p.clean_times.push(Number(t.total_time_minutes));
        }
        if (t.department === 'maintenance') {
          p.maintenance_count++;
          if (t.priority === 'urgent') p.urgent_count++;
        }
        p.total_cost += Number(t.total_cost) || 0;
      }

      return Object.values(byProp).map(p => {
        const avg = p.clean_times.length > 0 ? Math.round(p.clean_times.reduce((s, t) => s + t, 0) / p.clean_times.length) : 0;
        const over4hr = p.clean_times.filter(t => t > 240).length;
        const cleanScore = avg > 0 ? Math.max(0, 100 - ((avg - 120) / 2)) : 50;
        const maintScore = Math.max(0, 100 - p.maintenance_count * 5);
        const costScore = Math.max(0, 100 - (p.total_cost / 50));
        const healthScore = Math.round((cleanScore + maintScore + costScore) / 3);
        const coords = propCoords?.[p.home_id];
        const costPerClean = p.clean_times.length > 0 ? Math.round(p.total_cost / p.clean_times.length) : 0;
        const nights = nightsMap?.[p.home_id] ?? null;
        const costPerNight = nights && nights > 0 ? Math.round(p.total_cost / nights) : null;

        return {
          ...p,
          avg_clean_minutes: avg,
          total_cleans: p.clean_times.length,
          cleans_over_4hrs: over4hr,
          health_score: Math.max(0, Math.min(100, healthScore)),
          cost_per_clean: costPerClean,
          cost_per_night: costPerNight,
          latitude: coords?.lat ?? null,
          longitude: coords?.lng ?? null,
        } as PropertyRow;
      });
    },
    enabled: propCoords !== undefined,
  });

  const filtered = propertyData?.filter(p =>
    p.property_name?.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'clean') return b.avg_clean_minutes - a.avg_clean_minutes;
    if (sortBy === 'maintenance') return b.maintenance_count - a.maintenance_count;
    if (sortBy === 'health') return a.health_score - b.health_score;
    return b.total_cost - a.total_cost;
  });

  const topProblem = sorted.slice(0, 10);
  const selectedProp = propertyData?.find(p => p.home_id === selectedProperty);

  // Detail data for selected property drawer
  const { data: detailTasks } = useQuery({
    queryKey: ['property-detail', selectedProperty, from, to],
    enabled: !!selectedProperty,
    queryFn: async () => {
      const { data } = await supabase
        .from('breezeway_tasks')
        .select('name, department, status_code, total_time_minutes, total_cost, finished_at, priority, created_at')
        .eq('home_id', Number(selectedProperty))
        .gte('created_at', from)
        .lte('created_at', to)
        .order('created_at', { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  // Seasonal data for detail
  const seasonalData = useMemo(() => {
    if (!detailTasks) return [];
    const byMonth: Record<string, { housekeeping: number; maintenance: number }> = {};
    for (const t of detailTasks) {
      if (!t.created_at) continue;
      const m = format(parseISO(t.created_at), 'MMM');
      if (!byMonth[m]) byMonth[m] = { housekeeping: 0, maintenance: 0 };
      if (t.department === 'housekeeping') byMonth[m].housekeeping++;
      else if (t.department === 'maintenance') byMonth[m].maintenance++;
    }
    return Object.entries(byMonth).map(([month, v]) => ({ month, ...v }));
  }, [detailTasks]);

  const healthColor = (score: number) => {
    if (score >= 70) return 'bg-chart-4/20 text-chart-4 border-chart-4/30';
    if (score >= 40) return 'bg-warning/20 text-warning border-warning/30';
    return 'bg-destructive/20 text-destructive border-destructive/30';
  };

  const toggleCompare = (id: string) => {
    setCompareIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 3) next.add(id);
      return next;
    });
  };

  const compareProperties = propertyData?.filter(p => compareIds.has(p.home_id)) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Property Intelligence</h2>
          <p className="text-sm text-muted-foreground">Health scores, unit economics & geographic view</p>
        </div>
        <div className="flex items-center gap-2">
          {compareIds.size >= 2 && (
            <Button variant="outline" size="sm" onClick={() => setShowCompare(true)}>
              <GitCompareArrows className="h-3.5 w-3.5 mr-1" />
              Compare ({compareIds.size})
            </Button>
          )}
          <Button
            variant={viewMode === 'table' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('table')}
          >
            <TableIcon className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant={viewMode === 'map' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('map')}
          >
            <Map className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Top Problem Properties Chart */}
      {viewMode === 'table' && (
        <div className="glass-card rounded-lg p-5">
          <h3 className="text-sm font-semibold mb-4">Top 10 Problem Properties (Avg Clean Time)</h3>
          {isLoading ? <div className="h-64" /> : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topProblem.map(p => ({ name: p.property_name?.slice(0, 20), clean: p.avg_clean_minutes }))} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0, 0%, 90%)" />
                <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(240, 4%, 40%)' }} />
                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 9, fill: 'hsl(240, 4%, 40%)' }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="clean" fill="hsl(5, 87%, 55%)" radius={[0, 4, 4, 0]} name="Avg Clean (min)" barSize={24}>
                  <LabelList dataKey="clean" position="right" fontSize={10} fill="hsl(240, 4%, 40%)" formatter={(v: number) => `${v} min`} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {/* Map View */}
      {viewMode === 'map' && (
        <div className="glass-card rounded-lg p-5">
          <h3 className="text-sm font-semibold mb-4">Property Health Map</h3>
          {isLoading ? <div className="h-[500px]" /> : (
            <PropertyMap
              properties={filtered}
              onPropertyClick={(id) => navigate(`/property/${id}`)}
            />
          )}
          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-chart-4 inline-block" /> ≥70 Healthy</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-warning inline-block" /> 40-69 Warning</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-destructive inline-block" /> &lt;40 Critical</span>
          </div>
        </div>
      )}

      {/* Search + Sort */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search properties..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-2">
          {(['health', 'clean', 'maintenance', 'cost'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={`px-2 py-1 text-[10px] sm:px-3 sm:py-1.5 sm:text-xs rounded-md font-medium transition-colors ${sortBy === s ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
            >
              {s === 'health' ? 'Health' : s === 'clean' ? 'Clean Time' : s === 'maintenance' ? 'Maintenance' : 'Cost'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="glass-card rounded-lg p-5">
        {isLoading ? <TableSkeleton /> : (
          <div className="overflow-auto max-h-[600px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs w-8">⬜</TableHead>
                  <TableHead className="text-xs">Property</TableHead>
                  <TableHead className="text-xs text-center hidden sm:table-cell">Health</TableHead>
                  <TableHead className="text-xs text-right">Avg Clean</TableHead>
                  <TableHead className="text-xs text-right hidden md:table-cell">$/Clean</TableHead>
                  <TableHead className="text-xs text-right hidden lg:table-cell">$/Night</TableHead>
                  <TableHead className="text-xs text-right">Maintenance</TableHead>
                  <TableHead className="text-xs text-right hidden lg:table-cell">Urgent</TableHead>
                  <TableHead className="text-xs text-right">Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.slice(0, 50).map((p) => (
                  <TableRow key={p.home_id} className="hover:bg-muted/50">
                    <TableCell className="w-8" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={compareIds.has(p.home_id)}
                        onCheckedChange={() => toggleCompare(p.home_id)}
                        disabled={!compareIds.has(p.home_id) && compareIds.size >= 3}
                      />
                    </TableCell>
                    <TableCell
                      className="font-medium text-sm max-w-[200px] truncate cursor-pointer text-primary hover:underline"
                      onClick={() => navigate(`/property/${p.home_id}`)}
                    >
                      {p.property_name}
                    </TableCell>
                    <TableCell className="text-center hidden sm:table-cell">
                      <Badge
                        variant="outline"
                        className={`text-[10px] cursor-pointer ${healthColor(p.health_score)}`}
                        onClick={(e) => { e.stopPropagation(); setHealthBreakdownProp(p); }}
                      >
                        {p.health_score}
                      </Badge>
                    </TableCell>
                    <TableCell className={`text-right font-mono text-sm ${p.avg_clean_minutes > 180 ? 'text-destructive' : ''}`}>
                      {p.avg_clean_minutes || '—'}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm hidden md:table-cell">
                      {p.cost_per_clean > 0 ? `$${p.cost_per_clean}` : '—'}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm hidden lg:table-cell">
                      {p.cost_per_night != null ? `$${p.cost_per_night}` : '—'}
                    </TableCell>
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

      {/* Health Score Breakdown Modal */}
      <HealthScoreBreakdown
        open={!!healthBreakdownProp}
        onOpenChange={(open) => !open && setHealthBreakdownProp(null)}
        property={healthBreakdownProp}
      />

      {/* Compare Modal */}
      <PropertyCompare
        open={showCompare}
        onOpenChange={setShowCompare}
        properties={compareProperties}
      />

      {/* Property Detail Drawer */}
      <Sheet open={!!selectedProperty} onOpenChange={(open) => !open && setSelectedProperty(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-lg">{selectedProp?.property_name ?? 'Property Detail'}</SheetTitle>
          </SheetHeader>
          {selectedProp && (
            <div className="space-y-6 mt-4">
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
                  <p className="text-xs text-muted-foreground">Cost / Clean</p>
                  <p className="text-xl font-bold">${selectedProp.cost_per_clean}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground">Total Cost</p>
                  <p className="text-xl font-bold">${selectedProp.total_cost.toLocaleString()}</p>
                </div>
              </div>

              {/* Seasonal */}
              {seasonalData.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">Seasonal Patterns</h4>
                  <SeasonalChart data={seasonalData} />
                </div>
              )}

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

              <Button variant="outline" className="w-full" onClick={() => { setSelectedProperty(null); navigate(`/property/${selectedProp.home_id}`); }}>
                View Full Property Profile →
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

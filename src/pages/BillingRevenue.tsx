import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useDateRange } from '@/contexts/DateRangeContext';
import { TableSkeleton } from '@/components/dashboard/LoadingSkeleton';
import { KPICard } from '@/components/dashboard/KPICard';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, DollarSign, TrendingUp, Percent, Building2, BarChart3 } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, ComposedChart, XAxis, YAxis, Tooltip, CartesianGrid, Legend, Line } from 'recharts';

const tooltipStyle = {
  backgroundColor: 'hsl(0, 0%, 100%)',
  border: '1px solid hsl(0, 0%, 90%)',
  borderRadius: '8px',
  fontSize: 12,
};

type SortKey = 'name' | 'revenue' | 'hk_cost' | 'maint_cost' | 'total_cost' | 'net' | 'margin' | 'occupancy' | 'revpar';
type SortDir = 'asc' | 'desc';

const MGMT_FEE_PCT = 0.20; // 20% management fee assumption

export default function BillingRevenue() {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('revenue');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const { formatForQuery } = useDateRange();
  const { from, to } = formatForQuery();

  // Revenue by listing (guesty_reservations)
  const { data: revenueData, isLoading: revLoading } = useQuery({
    queryKey: ['billing-revenue', from, to],
    queryFn: async () => {
      const { data } = await supabase
        .from('guesty_reservations')
        .select('listing_id, fare_accommodation, host_payout, nights_count, check_in')
        .gte('check_in', from)
        .lte('check_in', to)
        .gt('fare_accommodation', 0);
      return data ?? [];
    },
  });

  // Listing names
  const { data: listings } = useQuery({
    queryKey: ['guesty-listings-all'],
    queryFn: async () => {
      const { data } = await supabase
        .from('guesty_listings')
        .select('id, nickname, bedrooms, accommodates');
      const map: Record<string, { name: string; bedrooms: number }> = {};
      data?.forEach(l => { map[l.id] = { name: l.nickname || l.id, bedrooms: l.bedrooms || 1 }; });
      return map;
    },
  });

  // Map breezeway home_id -> guesty listing_id
  const { data: propMapping } = useQuery({
    queryKey: ['property-mapping'],
    queryFn: async () => {
      const { data } = await supabase
        .from('breezeway_properties')
        .select('breezeway_id, reference_external_property_id')
        .not('reference_external_property_id', 'is', null);
      // bz home_id -> guesty listing_id
      const bzToGuesty: Record<string, string> = {};
      // guesty listing_id -> bz home_id
      const guestyToBz: Record<string, string> = {};
      data?.forEach(p => {
        if (p.reference_external_property_id) {
          bzToGuesty[String(p.breezeway_id)] = p.reference_external_property_id;
          guestyToBz[p.reference_external_property_id] = String(p.breezeway_id);
        }
      });
      return { bzToGuesty, guestyToBz };
    },
  });

  // Operational costs from breezeway
  const { data: opCosts } = useQuery({
    queryKey: ['billing-opcosts', from, to],
    queryFn: async () => {
      const { data } = await supabase
        .from('breezeway_tasks')
        .select('home_id, department, total_cost')
        .gte('created_at', from)
        .lte('created_at', to)
        .not('total_cost', 'is', null)
        .limit(1000);
      return data ?? [];
    },
  });

  // Monthly revenue + costs for dual-axis chart
  const monthlyChart = useMemo(() => {
    if (!revenueData || !opCosts) return [];
    const months: Record<string, { revenue: number; hk: number; maint: number }> = {};

    revenueData.forEach(r => {
      if (!r.check_in) return;
      const m = r.check_in.slice(0, 7);
      if (!months[m]) months[m] = { revenue: 0, hk: 0, maint: 0 };
      months[m].revenue += Number(r.fare_accommodation) || 0;
    });

    opCosts.forEach(t => {
      // We need to map this to a month — use the date range period
      // Since we don't have per-task months easily, distribute evenly (approximation)
    });

    // Better: get costs by month from breezeway_tasks
    return Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({
        month,
        revenue: Math.round(v.revenue),
        costs: 0, // will be filled below
      }));
  }, [revenueData, opCosts]);

  // Monthly costs (separate query for chart accuracy)
  const { data: monthlyCosts } = useQuery({
    queryKey: ['billing-monthly-costs', from, to],
    queryFn: async () => {
      const { data } = await supabase
        .from('breezeway_tasks')
        .select('department, total_cost, created_at')
        .gte('created_at', from)
        .lte('created_at', to)
        .not('total_cost', 'is', null)
        .limit(1000);
      const months: Record<string, { hk: number; maint: number }> = {};
      data?.forEach(t => {
        const m = t.created_at?.slice(0, 7);
        if (!m) return;
        if (!months[m]) months[m] = { hk: 0, maint: 0 };
        const cost = Number(t.total_cost) || 0;
        if (t.department === 'housekeeping') months[m].hk += cost;
        else if (t.department === 'maintenance') months[m].maint += cost;
      });
      return months;
    },
  });

  // Merged monthly chart data
  const chartData = useMemo(() => {
    if (!revenueData) return [];
    const months: Record<string, { revenue: number; hk: number; maint: number }> = {};
    revenueData.forEach(r => {
      if (!r.check_in) return;
      const m = r.check_in.slice(0, 7);
      if (!months[m]) months[m] = { revenue: 0, hk: 0, maint: 0 };
      months[m].revenue += Number(r.fare_accommodation) || 0;
    });
    if (monthlyCosts) {
      Object.entries(monthlyCosts).forEach(([m, v]) => {
        if (!months[m]) months[m] = { revenue: 0, hk: 0, maint: 0 };
        months[m].hk = v.hk;
        months[m].maint = v.maint;
      });
    }
    return Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({
        month: month.slice(5), // MM format
        revenue: Math.round(v.revenue),
        hk_cost: Math.round(v.hk),
        maint_cost: Math.round(v.maint),
        total_cost: Math.round(v.hk + v.maint),
      }));
  }, [revenueData, monthlyCosts]);

  // Cost trend (stacked area)
  const costTrendData = useMemo(() => {
    if (!monthlyCosts) return [];
    return Object.entries(monthlyCosts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({
        month: month.slice(5),
        housekeeping: Math.round(v.hk),
        maintenance: Math.round(v.maint),
      }));
  }, [monthlyCosts]);

  // Occupancy by listing
  const { data: occupancyData } = useQuery({
    queryKey: ['occupancy-data', from, to],
    queryFn: async () => {
      const { data } = await supabase
        .from('guesty_calendar')
        .select('listing_id, available, status')
        .gte('date', from)
        .lte('date', to)
        .limit(1000);

      // Also get from the view for broader data
      const { data: viewData } = await supabase
        .from('v_occupancy_by_listing')
        .select('listing_id, occupancy_rate, booked_days, total_days');

      const map: Record<string, { booked: number; total: number; rate: number }> = {};
      viewData?.forEach(v => {
        if (v.listing_id) {
          map[v.listing_id] = {
            booked: Number(v.booked_days) || 0,
            total: Number(v.total_days) || 1,
            rate: Number(v.occupancy_rate) || 0,
          };
        }
      });
      return map;
    },
  });

  // Property P&L table
  const propertyPnL = useMemo(() => {
    if (!revenueData || !listings || !opCosts || !propMapping) return [];

    // Revenue by listing
    const revByListing: Record<string, { revenue: number; payout: number; nights: number }> = {};
    revenueData.forEach(r => {
      if (!r.listing_id) return;
      if (!revByListing[r.listing_id]) revByListing[r.listing_id] = { revenue: 0, payout: 0, nights: 0 };
      revByListing[r.listing_id].revenue += Number(r.fare_accommodation) || 0;
      revByListing[r.listing_id].payout += Number(r.host_payout) || 0;
      revByListing[r.listing_id].nights += Number(r.nights_count) || 0;
    });

    // Costs by home_id
    const costsByHome: Record<string, { hk: number; maint: number }> = {};
    opCosts.forEach(t => {
      if (!t.home_id) return;
      const hid = String(t.home_id);
      if (!costsByHome[hid]) costsByHome[hid] = { hk: 0, maint: 0 };
      const cost = Number(t.total_cost) || 0;
      if (t.department === 'housekeeping') costsByHome[hid].hk += cost;
      else costsByHome[hid].maint += cost;
    });

    // Merge: iterate listings with revenue
    const rows: Array<{
      listing_id: string; name: string;
      revenue: number; payout: number; hk_cost: number; maint_cost: number;
      total_cost: number; net: number; margin: number;
      nights: number; occupancy: number; revpar: number;
    }> = [];

    Object.entries(revByListing).forEach(([lid, rev]) => {
      const listing = listings[lid];
      const name = listing?.name || lid.slice(0, 12);
      const bzId = propMapping.guestyToBz[lid];
      const costs = bzId ? costsByHome[bzId] : undefined;
      const hk = costs?.hk ?? 0;
      const maint = costs?.maint ?? 0;
      const totalCost = hk + maint;
      const net = rev.revenue - totalCost;
      const margin = rev.revenue > 0 ? (net / rev.revenue) * 100 : 0;
      const occ = occupancyData?.[lid];
      const occRate = occ?.rate ?? 0;
      // Calculate days in period for RevPAR
      const fromDate = new Date(from);
      const toDate = new Date(to);
      const daysInPeriod = Math.max(1, Math.round((toDate.getTime() - fromDate.getTime()) / 86400000));
      const revpar = rev.revenue / daysInPeriod;

      rows.push({
        listing_id: lid, name,
        revenue: Math.round(rev.revenue), payout: Math.round(rev.payout),
        hk_cost: Math.round(hk), maint_cost: Math.round(maint),
        total_cost: Math.round(totalCost), net: Math.round(net),
        margin: Math.round(margin),
        nights: rev.nights, occupancy: Math.round(occRate),
        revpar: Math.round(revpar * 100) / 100,
      });
    });

    return rows;
  }, [revenueData, listings, opCosts, propMapping, occupancyData, from, to]);

  // KPI totals
  const totals = useMemo(() => {
    const totalRev = propertyPnL.reduce((s, p) => s + p.revenue, 0);
    const totalHK = propertyPnL.reduce((s, p) => s + p.hk_cost, 0);
    const totalMaint = propertyPnL.reduce((s, p) => s + p.maint_cost, 0);
    const totalCost = totalHK + totalMaint;
    const propCount = propertyPnL.length || 1;
    return {
      totalRev,
      avgRevPerProp: Math.round(totalRev / propCount),
      hkPct: totalRev > 0 ? ((totalHK / totalRev) * 100).toFixed(1) : '0',
      maintPct: totalRev > 0 ? ((totalMaint / totalRev) * 100).toFixed(1) : '0',
      grossMargin: totalRev > 0 ? (((totalRev - totalCost) / totalRev) * 100).toFixed(1) : '0',
      totalCost,
    };
  }, [propertyPnL]);

  // Filter + sort
  const filtered = propertyPnL.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    switch (sortKey) {
      case 'name': cmp = a.name.localeCompare(b.name); break;
      case 'revenue': cmp = a.revenue - b.revenue; break;
      case 'hk_cost': cmp = a.hk_cost - b.hk_cost; break;
      case 'maint_cost': cmp = a.maint_cost - b.maint_cost; break;
      case 'total_cost': cmp = a.total_cost - b.total_cost; break;
      case 'net': cmp = a.net - b.net; break;
      case 'margin': cmp = a.margin - b.margin; break;
      case 'occupancy': cmp = a.occupancy - b.occupancy; break;
      case 'revpar': cmp = a.revpar - b.revpar; break;
    }
    return sortDir === 'desc' ? -cmp : cmp;
  });

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };
  const si = (key: SortKey) => sortKey === key ? (sortDir === 'desc' ? ' ↓' : ' ↑') : '';

  // Owner statement data (top 10 by revenue)
  const ownerStatements = sorted.slice(0, 10).map(p => {
    const mgmtFee = Math.round(p.revenue * MGMT_FEE_PCT);
    const expenses = p.total_cost;
    const netToOwner = p.revenue - mgmtFee - expenses;
    return { ...p, mgmtFee, expenses, netToOwner };
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Billing & Revenue</h2>
        <p className="text-sm text-muted-foreground">Revenue analytics, P&L by property & owner statements</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <KPICard title="Total Revenue" value={`$${totals.totalRev.toLocaleString()}`} icon={DollarSign} />
        <KPICard title="Avg Rev / Property" value={`$${totals.avgRevPerProp.toLocaleString()}`} icon={Building2} />
        <KPICard title="HK Cost % Rev" value={`${totals.hkPct}%`} icon={Percent} subtitle="Housekeeping" />
        <KPICard title="Maint Cost % Rev" value={`${totals.maintPct}%`} icon={Percent} subtitle="Maintenance" />
        <KPICard title="Gross Margin" value={`${totals.grossMargin}%`} icon={TrendingUp} subtitle={`$${(totals.totalRev - totals.totalCost).toLocaleString()} net`} />
      </div>

      {/* Revenue vs Cost chart + Cost Trend */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="glass-card rounded-lg p-5">
          <h3 className="text-sm font-semibold mb-4">Revenue vs Operational Costs</h3>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0, 0%, 90%)" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'hsl(240, 4%, 40%)' }} />
                <YAxis yAxisId="left" tick={{ fontSize: 10, fill: 'hsl(240, 4%, 40%)' }} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: 'hsl(240, 4%, 40%)' }} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `$${v.toLocaleString()}`} />
                <Legend />
                <Bar yAxisId="left" dataKey="revenue" fill="hsl(142, 71%, 45%)" name="Revenue" radius={[4, 4, 0, 0]} opacity={0.8} />
                <Line yAxisId="right" type="monotone" dataKey="total_cost" stroke="hsl(5, 87%, 55%)" strokeWidth={2} name="Total Cost" dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          ) : <p className="text-xs text-muted-foreground">Loading chart data...</p>}
        </div>

        <div className="glass-card rounded-lg p-5">
          <h3 className="text-sm font-semibold mb-4">Cost Trend (Stacked)</h3>
          {costTrendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={costTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0, 0%, 90%)" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'hsl(240, 4%, 40%)' }} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(240, 4%, 40%)' }} tickFormatter={(v: number) => `$${v.toLocaleString()}`} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `$${v.toLocaleString()}`} />
                <Legend />
                <Area type="monotone" dataKey="housekeeping" stackId="1" fill="hsl(210, 60%, 55%)" stroke="hsl(210, 60%, 55%)" name="Housekeeping" fillOpacity={0.6} />
                <Area type="monotone" dataKey="maintenance" stackId="1" fill="hsl(5, 87%, 55%)" stroke="hsl(5, 87%, 55%)" name="Maintenance" fillOpacity={0.6} />
              </AreaChart>
            </ResponsiveContainer>
          ) : <p className="text-xs text-muted-foreground">Loading...</p>}
        </div>
      </div>

      {/* Property P&L Table */}
      <div className="glass-card rounded-lg p-5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
          <h3 className="text-sm font-semibold">Property P&L ({sorted.length} properties)</h3>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search properties..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-8 text-sm" />
          </div>
        </div>
        {revLoading ? <TableSkeleton /> : (
          <div className="overflow-auto max-h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs cursor-pointer select-none" onClick={() => handleSort('name')}>Property{si('name')}</TableHead>
                  <TableHead className="text-xs text-right cursor-pointer select-none" onClick={() => handleSort('revenue')}>Revenue{si('revenue')}</TableHead>
                  <TableHead className="text-xs text-right cursor-pointer select-none hidden md:table-cell" onClick={() => handleSort('hk_cost')}>HK Cost{si('hk_cost')}</TableHead>
                  <TableHead className="text-xs text-right cursor-pointer select-none hidden md:table-cell" onClick={() => handleSort('maint_cost')}>Maint Cost{si('maint_cost')}</TableHead>
                  <TableHead className="text-xs text-right cursor-pointer select-none" onClick={() => handleSort('total_cost')}>Total Cost{si('total_cost')}</TableHead>
                  <TableHead className="text-xs text-right cursor-pointer select-none" onClick={() => handleSort('net')}>Net{si('net')}</TableHead>
                  <TableHead className="text-xs text-right cursor-pointer select-none" onClick={() => handleSort('margin')}>Margin %{si('margin')}</TableHead>
                  <TableHead className="text-xs text-right cursor-pointer select-none hidden lg:table-cell" onClick={() => handleSort('occupancy')}>Occ %{si('occupancy')}</TableHead>
                  <TableHead className="text-xs text-right cursor-pointer select-none hidden lg:table-cell" onClick={() => handleSort('revpar')}>RevPAR{si('revpar')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map(p => (
                  <TableRow key={p.listing_id}>
                    <TableCell className="text-sm font-medium max-w-[180px] truncate">{p.name}</TableCell>
                    <TableCell className="text-right font-mono text-sm">${p.revenue.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-mono text-sm hidden md:table-cell">${p.hk_cost.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-mono text-sm hidden md:table-cell">${p.maint_cost.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-mono text-sm">${p.total_cost.toLocaleString()}</TableCell>
                    <TableCell className={`text-right font-mono text-sm font-bold ${p.net >= 0 ? 'text-chart-4' : 'text-destructive'}`}>
                      {p.net >= 0 ? '' : '-'}${Math.abs(p.net).toLocaleString()}
                    </TableCell>
                    <TableCell className={`text-right font-mono text-sm ${p.margin >= 0 ? 'text-chart-4' : 'text-destructive'}`}>
                      {p.margin}%
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm hidden lg:table-cell">
                      {p.occupancy > 0 ? `${p.occupancy}%` : '—'}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm hidden lg:table-cell">
                      {p.revpar > 0 ? `$${p.revpar.toFixed(0)}` : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Owner Statement Preview */}
      <div className="glass-card rounded-lg p-5">
        <h3 className="text-sm font-semibold mb-1">Owner Statement Preview</h3>
        <p className="text-[10px] text-muted-foreground mb-4">Top 10 properties — assumes {(MGMT_FEE_PCT * 100).toFixed(0)}% management fee</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ownerStatements.map(p => (
            <div key={p.listing_id} className="bg-muted/50 rounded-lg p-3 border border-border/50">
              <p className="text-xs font-semibold truncate mb-2">{p.name}</p>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Gross Revenue</span>
                  <span className="font-mono">${p.revenue.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-destructive/80">
                  <span>Management Fee ({(MGMT_FEE_PCT * 100).toFixed(0)}%)</span>
                  <span className="font-mono">-${p.mgmtFee.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-destructive/80">
                  <span>Expenses (HK + Maint)</span>
                  <span className="font-mono">-${p.expenses.toLocaleString()}</span>
                </div>
                <div className="border-t border-border pt-1 flex justify-between font-bold">
                  <span>Net to Owner</span>
                  <span className={`font-mono ${p.netToOwner >= 0 ? 'text-chart-4' : 'text-destructive'}`}>
                    ${p.netToOwner.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

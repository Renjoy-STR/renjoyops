import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useDateRange } from '@/contexts/DateRangeContext';
import { TableSkeleton } from '@/components/dashboard/LoadingSkeleton';
import { KPICard } from '@/components/dashboard/KPICard';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Star, MessageSquare, TrendingDown, AlertTriangle, Search, BarChart3 } from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, ScatterChart, Scatter,
  XAxis, YAxis, Tooltip, CartesianGrid, Cell, BarChart, Bar,
} from 'recharts';

const tooltipStyle = {
  backgroundColor: 'hsl(0, 0%, 100%)',
  border: '1px solid hsl(0, 0%, 90%)',
  borderRadius: '8px',
  fontSize: 12,
};

type SortKey = 'name' | 'avg_rating' | 'count' | 'latest';
type SortDir = 'asc' | 'desc';

// Keywords to extract from reviews
const KEYWORD_CATEGORIES: Record<string, string[]> = {
  'Cleanliness': ['clean', 'spotless', 'tidy', 'dirty', 'dust', 'stain', 'mess', 'sanitary', 'hygiene'],
  'Check-in': ['check-in', 'checkin', 'check in', 'key', 'lockbox', 'access', 'arrival', 'instructions'],
  'Amenities': ['amenities', 'kitchen', 'wifi', 'internet', 'pool', 'hot tub', 'washer', 'dryer', 'towel', 'linens', 'supplies'],
  'Location': ['location', 'neighborhood', 'area', 'convenient', 'close', 'nearby', 'quiet', 'noisy', 'view'],
  'Communication': ['communication', 'responsive', 'host', 'response', 'helpful', 'contact', 'message'],
  'Comfort': ['comfortable', 'cozy', 'spacious', 'bed', 'mattress', 'pillow', 'temperature', 'heating', 'cooling'],
  'Value': ['value', 'price', 'worth', 'expensive', 'affordable', 'deal', 'overpriced'],
  'Maintenance': ['broken', 'repair', 'fix', 'issue', 'problem', 'malfunction', 'leak', 'plumbing'],
};

export default function GuestSatisfaction() {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('avg_rating');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const { formatForQuery } = useDateRange();
  const { from, to } = formatForQuery();

  // Reviews in date range
  const { data: reviews, isLoading } = useQuery({
    queryKey: ['guest-reviews', from, to],
    queryFn: async () => {
      const { data } = await supabase
        .from('guesty_reviews')
        .select('id, listing_id, rating, cleanliness_rating, comment, reviewer_name, created_at, reservation_id')
        .gte('created_at', from)
        .lte('created_at', to)
        .not('rating', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1000);
      return data ?? [];
    },
  });

  // Listing names
  const { data: listings } = useQuery({
    queryKey: ['guesty-listings-all'],
    queryFn: async () => {
      const { data } = await supabase
        .from('guesty_listings')
        .select('id, nickname');
      const map: Record<string, string> = {};
      data?.forEach(l => { map[l.id] = l.nickname || l.id; });
      return map;
    },
  });

  // Breezeway property mapping
  const { data: propMapping } = useQuery({
    queryKey: ['property-mapping'],
    queryFn: async () => {
      const { data } = await supabase
        .from('breezeway_properties')
        .select('breezeway_id, reference_external_property_id')
        .not('reference_external_property_id', 'is', null);
      const guestyToBz: Record<string, number> = {};
      data?.forEach(p => {
        if (p.reference_external_property_id) {
          guestyToBz[p.reference_external_property_id] = p.breezeway_id;
        }
      });
      return guestyToBz;
    },
  });

  // Average clean time by property (for scatter plot)
  const { data: cleanTimes } = useQuery({
    queryKey: ['property-clean-times'],
    queryFn: async () => {
      const { data } = await supabase
        .from('v_property_difficulty')
        .select('home_id, property_name, avg_clean_minutes, total_cleans');
      return data ?? [];
    },
  });

  // Cleaner assignments for quality correlation
  const { data: cleanerAssignments } = useQuery({
    queryKey: ['cleaner-assignments-quality', from, to],
    queryFn: async () => {
      const { data } = await supabase
        .from('breezeway_task_assignments')
        .select('assignee_name, assignee_id, task_id')
        .not('assignee_name', 'is', null)
        .limit(1000);
      return data ?? [];
    },
  });

  // Breezeway tasks for linking cleaners to properties
  const { data: bzTasks } = useQuery({
    queryKey: ['bz-tasks-hk', from, to],
    queryFn: async () => {
      const { data } = await supabase
        .from('breezeway_tasks')
        .select('breezeway_id, home_id, department, finished_at')
        .eq('department', 'housekeeping')
        .gte('created_at', from)
        .lte('created_at', to)
        .limit(1000);
      return data ?? [];
    },
  });

  // KPIs
  const kpis = useMemo(() => {
    if (!reviews) return { avg: 0, total: 0, fiveStar: 0, below4: 0 };
    const total = reviews.length;
    const avg = total > 0 ? reviews.reduce((s, r) => s + (r.rating || 0), 0) / total : 0;
    const fiveStar = reviews.filter(r => r.rating === 5).length;
    const fiveStarPct = total > 0 ? ((fiveStar / total) * 100) : 0;

    // Properties below 4.0
    const byProp: Record<string, number[]> = {};
    reviews.forEach(r => {
      if (r.listing_id && r.rating) {
        if (!byProp[r.listing_id]) byProp[r.listing_id] = [];
        byProp[r.listing_id].push(r.rating);
      }
    });
    const below4 = Object.values(byProp).filter(ratings => {
      const propAvg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
      return propAvg < 4.0;
    }).length;

    return { avg: Math.round(avg * 100) / 100, total, fiveStarPct: Math.round(fiveStarPct), below4 };
  }, [reviews]);

  // Rating trend by month
  const ratingTrend = useMemo(() => {
    if (!reviews) return [];
    const months: Record<string, { sum: number; count: number }> = {};
    reviews.forEach(r => {
      if (!r.created_at || !r.rating) return;
      const m = r.created_at.slice(0, 7);
      if (!months[m]) months[m] = { sum: 0, count: 0 };
      months[m].sum += r.rating;
      months[m].count += 1;
    });
    return Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({
        month: month.slice(5),
        avg: Math.round((v.sum / v.count) * 100) / 100,
        count: v.count,
      }));
  }, [reviews]);

  // Property ratings table
  const propertyRatings = useMemo(() => {
    if (!reviews || !listings) return [];
    const byProp: Record<string, { ratings: number[]; latest: string; monthly: Record<string, number[]> }> = {};
    reviews.forEach(r => {
      if (!r.listing_id || !r.rating) return;
      if (!byProp[r.listing_id]) byProp[r.listing_id] = { ratings: [], latest: '', monthly: {} };
      byProp[r.listing_id].ratings.push(r.rating);
      if (!byProp[r.listing_id].latest || (r.created_at || '') > byProp[r.listing_id].latest) {
        byProp[r.listing_id].latest = r.created_at || '';
      }
      const m = (r.created_at || '').slice(0, 7);
      if (m) {
        if (!byProp[r.listing_id].monthly[m]) byProp[r.listing_id].monthly[m] = [];
        byProp[r.listing_id].monthly[m].push(r.rating);
      }
    });

    return Object.entries(byProp).map(([lid, data]) => {
      const avg = data.ratings.reduce((a, b) => a + b, 0) / data.ratings.length;
      // Trend: compare last 3 months avg to prior 3 months
      const sortedMonths = Object.keys(data.monthly).sort();
      const len = sortedMonths.length;
      let trending: 'up' | 'down' | 'stable' = 'stable';
      if (len >= 4) {
        const recentMonths = sortedMonths.slice(-2);
        const olderMonths = sortedMonths.slice(-4, -2);
        const recentAvg = recentMonths.flatMap(m => data.monthly[m]).reduce((a, b) => a + b, 0) /
          recentMonths.flatMap(m => data.monthly[m]).length;
        const olderAvg = olderMonths.flatMap(m => data.monthly[m]).reduce((a, b) => a + b, 0) /
          olderMonths.flatMap(m => data.monthly[m]).length;
        if (recentAvg < olderAvg - 0.2) trending = 'down';
        else if (recentAvg > olderAvg + 0.2) trending = 'up';
      }
      // Mini sparkline data
      const sparkline = sortedMonths.slice(-6).map(m => {
        const vals = data.monthly[m];
        return vals.reduce((a, b) => a + b, 0) / vals.length;
      });

      return {
        listing_id: lid,
        name: listings[lid] || lid.slice(0, 12),
        avg_rating: Math.round(avg * 100) / 100,
        count: data.ratings.length,
        latest: data.latest.slice(0, 10),
        trending,
        sparkline,
      };
    });
  }, [reviews, listings]);

  // Quality correlation: avg clean time vs avg rating per property
  const qualityCorrelation = useMemo(() => {
    if (!cleanTimes || !reviews || !propMapping || !listings) return [];
    // Avg rating by listing
    const ratingByListing: Record<string, { sum: number; count: number }> = {};
    reviews.forEach(r => {
      if (!r.listing_id || !r.rating) return;
      if (!ratingByListing[r.listing_id]) ratingByListing[r.listing_id] = { sum: 0, count: 0 };
      ratingByListing[r.listing_id].sum += r.rating;
      ratingByListing[r.listing_id].count += 1;
    });

    // Map home_id -> listing_id (reverse of propMapping which is guesty->bz)
    const bzToGuesty: Record<number, string> = {};
    Object.entries(propMapping).forEach(([guestyId, bzId]) => {
      bzToGuesty[bzId] = guestyId;
    });

    return cleanTimes
      .filter(ct => ct.home_id && ct.avg_clean_minutes && bzToGuesty[ct.home_id])
      .map(ct => {
        const guestyId = bzToGuesty[ct.home_id!];
        const rData = ratingByListing[guestyId];
        if (!rData || rData.count < 3) return null;
        return {
          name: ct.property_name || listings[guestyId] || 'Unknown',
          cleanMinutes: Math.round(Number(ct.avg_clean_minutes)),
          rating: Math.round((rData.sum / rData.count) * 100) / 100,
          reviews: rData.count,
        };
      })
      .filter(Boolean) as Array<{ name: string; cleanMinutes: number; rating: number; reviews: number }>;
  }, [cleanTimes, reviews, propMapping, listings]);

  // Cleaner quality scores
  const cleanerQuality = useMemo(() => {
    if (!bzTasks || !cleanerAssignments || !reviews || !propMapping) return [];
    // Build task_id -> home_id map from bzTasks
    const taskToHome: Record<number, number> = {};
    bzTasks.forEach(t => {
      if (t.breezeway_id && t.home_id) taskToHome[t.breezeway_id] = t.home_id;
    });

    // Build home_id -> listing_id
    const bzToGuesty: Record<number, string> = {};
    Object.entries(propMapping).forEach(([guestyId, bzId]) => {
      bzToGuesty[bzId] = guestyId;
    });

    // Build listing_id -> avg rating
    const ratingByListing: Record<string, number> = {};
    const countByListing: Record<string, number> = {};
    reviews.forEach(r => {
      if (!r.listing_id || !r.rating) return;
      ratingByListing[r.listing_id] = (ratingByListing[r.listing_id] || 0) + r.rating;
      countByListing[r.listing_id] = (countByListing[r.listing_id] || 0) + 1;
    });

    // Aggregate by cleaner
    const cleanerScores: Record<string, { totalRating: number; count: number; properties: Set<string> }> = {};
    cleanerAssignments.forEach(a => {
      if (!a.assignee_name || !a.task_id) return;
      const homeId = taskToHome[a.task_id];
      if (!homeId) return;
      const guestyId = bzToGuesty[homeId];
      if (!guestyId || !countByListing[guestyId]) return;
      const avgRating = ratingByListing[guestyId] / countByListing[guestyId];

      if (!cleanerScores[a.assignee_name]) {
        cleanerScores[a.assignee_name] = { totalRating: 0, count: 0, properties: new Set() };
      }
      cleanerScores[a.assignee_name].totalRating += avgRating;
      cleanerScores[a.assignee_name].count += 1;
      cleanerScores[a.assignee_name].properties.add(guestyId);
    });

    return Object.entries(cleanerScores)
      .filter(([, v]) => v.count >= 3)
      .map(([name, v]) => ({
        name,
        avgPropertyRating: Math.round((v.totalRating / v.count) * 100) / 100,
        propertiesServiced: v.properties.size,
        taskCount: v.count,
      }))
      .sort((a, b) => b.avgPropertyRating - a.avgPropertyRating);
  }, [bzTasks, cleanerAssignments, reviews, propMapping]);

  // Review keywords analysis
  const keywordAnalysis = useMemo(() => {
    if (!reviews) return [];
    const counts: Record<string, { positive: number; negative: number; total: number }> = {};
    Object.keys(KEYWORD_CATEGORIES).forEach(cat => {
      counts[cat] = { positive: 0, negative: 0, total: 0 };
    });

    const negativeWords = ['not', 'no', "didn't", "wasn't", "weren't", 'never', 'bad', 'poor', 'terrible', 'horrible', 'worst', 'dirty', 'broken'];

    reviews.forEach(r => {
      if (!r.comment) return;
      const comment = r.comment.toLowerCase();
      const isNegativeOverall = (r.rating || 5) <= 3;

      Object.entries(KEYWORD_CATEGORIES).forEach(([cat, keywords]) => {
        const found = keywords.some(kw => comment.includes(kw));
        if (found) {
          counts[cat].total += 1;
          // Simple sentiment: if review rating <= 3 or contains negative words near keyword
          const hasNeg = negativeWords.some(nw => comment.includes(nw));
          if (isNegativeOverall || hasNeg) counts[cat].negative += 1;
          else counts[cat].positive += 1;
        }
      });
    });

    return Object.entries(counts)
      .map(([category, data]) => ({ category, ...data }))
      .sort((a, b) => b.total - a.total);
  }, [reviews]);

  // Table sort/filter
  const filtered = propertyRatings.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );
  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    switch (sortKey) {
      case 'name': cmp = a.name.localeCompare(b.name); break;
      case 'avg_rating': cmp = a.avg_rating - b.avg_rating; break;
      case 'count': cmp = a.count - b.count; break;
      case 'latest': cmp = a.latest.localeCompare(b.latest); break;
    }
    return sortDir === 'desc' ? -cmp : cmp;
  });

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };
  const si = (key: SortKey) => sortKey === key ? (sortDir === 'desc' ? ' ↓' : ' ↑') : '';

  // Mini sparkline renderer
  const renderSparkline = (data: number[]) => {
    if (data.length < 2) return null;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const h = 20;
    const w = 60;
    const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(' ');
    const trending = data[data.length - 1] < data[0] - 0.2;
    return (
      <svg width={w} height={h} className="inline-block">
        <polyline fill="none" stroke={trending ? 'hsl(5, 87%, 55%)' : 'hsl(142, 71%, 45%)'} strokeWidth="1.5" points={points} />
      </svg>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Guest Satisfaction</h2>
        <p className="text-sm text-muted-foreground">Review analytics, quality correlations & cleaner quality scores</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPICard title="Average Rating" value={kpis.avg.toFixed(2)} icon={Star} subtitle="out of 5.0" accent />
        <KPICard title="Total Reviews" value={kpis.total.toLocaleString()} icon={MessageSquare} subtitle="in period" />
        <KPICard title="5-Star %" value={`${kpis.fiveStarPct}%`} icon={Star} subtitle="of all reviews" />
        <KPICard title="Properties < 4.0" value={kpis.below4} icon={AlertTriangle} subtitle="need attention" />
      </div>

      {/* Rating Trend + Review Keywords */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="glass-card rounded-lg p-5">
          <h3 className="text-sm font-semibold mb-4">Rating Trend</h3>
          {ratingTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={ratingTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis domain={[3.5, 5]} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => v.toFixed(2)} />
                <Line type="monotone" dataKey="avg" stroke="hsl(var(--primary))" strokeWidth={2} name="Avg Rating" dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : <p className="text-xs text-muted-foreground">Loading...</p>}
        </div>

        <div className="glass-card rounded-lg p-5">
          <h3 className="text-sm font-semibold mb-4">Review Themes ({reviews?.length || 0} reviews analyzed)</h3>
          {keywordAnalysis.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={keywordAnalysis} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis type="category" dataKey="category" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} width={100} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="positive" stackId="a" fill="hsl(142, 71%, 45%)" name="Positive" radius={[0, 0, 0, 0]} />
                <Bar dataKey="negative" stackId="a" fill="hsl(5, 87%, 55%)" name="Negative" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-xs text-muted-foreground">Loading...</p>}
        </div>
      </div>

      {/* Quality Correlation Scatter + Cleaner Quality */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="glass-card rounded-lg p-5">
          <h3 className="text-sm font-semibold mb-1">Quality Correlation</h3>
          <p className="text-xs text-muted-foreground mb-4">Avg clean time vs guest rating per property</p>
          {qualityCorrelation.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" dataKey="cleanMinutes" name="Avg Clean (min)" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} label={{ value: 'Clean Time (min)', position: 'insideBottom', offset: -5, fontSize: 10 }} />
                <YAxis type="number" dataKey="rating" name="Avg Rating" domain={[3, 5]} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} label={{ value: 'Rating', angle: -90, position: 'insideLeft', fontSize: 10 }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number, name: string) => [name === 'Avg Rating' ? v.toFixed(2) : `${v} min`, name]} labelFormatter={() => ''} />
                <Scatter data={qualityCorrelation} name="Properties">
                  {qualityCorrelation.map((entry, i) => (
                    <Cell key={i} fill={entry.rating >= 4.5 ? 'hsl(142, 71%, 45%)' : entry.rating >= 4.0 ? 'hsl(45, 93%, 47%)' : 'hsl(5, 87%, 55%)'} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          ) : <p className="text-xs text-muted-foreground">Loading correlation data...</p>}
        </div>

        <div className="glass-card rounded-lg p-5">
          <h3 className="text-sm font-semibold mb-1">Cleaner Quality Score</h3>
          <p className="text-xs text-muted-foreground mb-4">Avg guest rating of properties each cleaner services</p>
          <div className="overflow-auto max-h-[280px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Cleaner</TableHead>
                  <TableHead className="text-xs text-right">Avg Property Rating</TableHead>
                  <TableHead className="text-xs text-right hidden sm:table-cell">Properties</TableHead>
                  <TableHead className="text-xs text-right hidden sm:table-cell">Tasks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cleanerQuality.slice(0, 15).map(c => (
                  <TableRow key={c.name}>
                    <TableCell className="text-xs font-medium py-1.5">{c.name}</TableCell>
                    <TableCell className="text-xs text-right py-1.5">
                      <span className={c.avgPropertyRating >= 4.5 ? 'text-[hsl(142,71%,45%)]' : c.avgPropertyRating >= 4.0 ? 'text-[hsl(45,93%,47%)]' : 'text-destructive'}>
                        ★ {c.avgPropertyRating.toFixed(2)}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-right py-1.5 hidden sm:table-cell">{c.propertiesServiced}</TableCell>
                    <TableCell className="text-xs text-right py-1.5 hidden sm:table-cell">{c.taskCount}</TableCell>
                  </TableRow>
                ))}
                {cleanerQuality.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-xs text-muted-foreground text-center py-4">Loading cleaner data...</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* Property Ratings Table */}
      <div className="glass-card rounded-lg p-5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
          <h3 className="text-sm font-semibold">Property Ratings ({sorted.length} properties)</h3>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search properties..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-8 text-sm" />
          </div>
        </div>
        {isLoading ? <TableSkeleton /> : (
          <div className="overflow-auto max-h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs cursor-pointer select-none" onClick={() => handleSort('name')}>Property{si('name')}</TableHead>
                  <TableHead className="text-xs text-right cursor-pointer select-none" onClick={() => handleSort('avg_rating')}>Avg Rating{si('avg_rating')}</TableHead>
                  <TableHead className="text-xs text-right cursor-pointer select-none" onClick={() => handleSort('count')}>Reviews{si('count')}</TableHead>
                  <TableHead className="text-xs text-right cursor-pointer select-none hidden md:table-cell" onClick={() => handleSort('latest')}>Latest Review{si('latest')}</TableHead>
                  <TableHead className="text-xs text-center hidden md:table-cell">Trend</TableHead>
                  <TableHead className="text-xs text-center hidden md:table-cell">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map(p => (
                  <TableRow key={p.listing_id}>
                    <TableCell className="text-xs font-medium py-2 max-w-[180px] truncate">{p.name}</TableCell>
                    <TableCell className="text-xs text-right py-2">
                      <span className={p.avg_rating >= 4.5 ? 'text-[hsl(142,71%,45%)] font-semibold' : p.avg_rating >= 4.0 ? 'text-[hsl(45,93%,47%)]' : 'text-destructive font-semibold'}>
                        ★ {p.avg_rating.toFixed(2)}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-right py-2">{p.count}</TableCell>
                    <TableCell className="text-xs text-right py-2 hidden md:table-cell text-muted-foreground">{p.latest}</TableCell>
                    <TableCell className="text-xs text-center py-2 hidden md:table-cell">{renderSparkline(p.sparkline)}</TableCell>
                    <TableCell className="text-xs text-center py-2 hidden md:table-cell">
                      {p.trending === 'down' && <Badge variant="destructive" className="text-[8px] px-1.5 py-0">↓ Declining</Badge>}
                      {p.trending === 'up' && <Badge className="text-[8px] px-1.5 py-0 bg-[hsl(142,71%,45%)] text-white">↑ Improving</Badge>}
                      {p.trending === 'stable' && <Badge variant="secondary" className="text-[8px] px-1.5 py-0">— Stable</Badge>}
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

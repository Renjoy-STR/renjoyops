import { useState, useMemo } from 'react';
import { useDateRange } from '@/contexts/DateRangeContext';
import { useGuestyReviews, useGuestyListings, usePropertyRegistry, usePropertyDifficulty, useCleanerAssignments, useHousekeepingTasks } from '@/hooks/supabase';
import { TableSkeleton } from '@/components/dashboard/LoadingSkeleton';
import { KPICard } from '@/components/dashboard/KPICard';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Star, MessageSquare, TrendingDown, AlertTriangle, Search, Filter } from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line,
  XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar,
} from 'recharts';

const tooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
  fontSize: 12,
  color: 'hsl(var(--foreground))',
};

type SortKey = 'name' | 'avg_rating' | 'count' | 'latest';
type SortDir = 'asc' | 'desc';

type PlatformFilter = 'all' | 'airbnb2' | 'homeaway2' | 'bookingCom';

const PLATFORM_LABELS: Record<string, string> = {
  all: 'All Sources',
  airbnb2: 'Airbnb',
  homeaway2: 'VRBO / HomeAway',
  bookingCom: 'Booking.com',
};

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

function extractCommentText(raw: string | null | undefined): string {
  if (!raw) return '';
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null && 'value' in parsed) {
      return String(parsed.value);
    }
  } catch {
    // not JSON — use as-is
  }
  return raw;
}

export default function GuestSatisfaction() {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('avg_rating');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all');
  const { formatForQuery } = useDateRange();
  const { from, to } = formatForQuery();

  // --- Data Hooks ---
  const { data: rawReviews, isLoading } = useGuestyReviews(from, to);
  const { data: rawListings } = useGuestyListings();
  const { data: propRegistry } = usePropertyRegistry();
  const { data: cleanTimes } = usePropertyDifficulty();
  const { data: cleanerAssignments } = useCleanerAssignments();
  const { data: bzTasks } = useHousekeepingTasks(from, to);

  // Normalize reviews
  const allReviews = useMemo(() => {
    return (rawReviews ?? []).map(r => ({
      ...r,
      rating: r.rating ?? null,
      comment: extractCommentText(r.comment),
    }));
  }, [rawReviews]);

  // Build listing name map
  const listings = useMemo(() => {
    const map: Record<string, string> = {};
    rawListings?.forEach(l => { map[l.id] = l.nickname || l.title || l.id; });
    return map;
  }, [rawListings]);

  // Filter reviews by selected platform
  const reviews = useMemo(() => {
    if (platformFilter === 'all') return allReviews;
    return allReviews.filter(r => r.platform === platformFilter);
  }, [allReviews, platformFilter]);

  // Platform breakdown for badge counts
  const platformCounts = useMemo(() => {
    const counts = { airbnb2: 0, homeaway2: 0, bookingCom: 0, total: allReviews.length };
    allReviews.forEach(r => {
      if (r.platform === 'airbnb2') counts.airbnb2++;
      else if (r.platform === 'homeaway2') counts.homeaway2++;
      else if (r.platform === 'bookingCom') counts.bookingCom++;
    });
    return counts;
  }, [allReviews]);

  // KPIs
  const kpis = useMemo(() => {
    if (!reviews.length) return { avg: 0, total: 0, fiveStarPct: 0, below4: 0, withRating: 0 };
    const withRating = reviews.filter(r => r.rating !== null);
    const total = reviews.length;
    const withRatingCount = withRating.length;
    const avg = withRatingCount > 0 ? withRating.reduce((s, r) => s + (r.rating || 0), 0) / withRatingCount : 0;
    const fiveStar = withRating.filter(r => r.rating === 5).length;
    const fiveStarPct = withRatingCount > 0 ? ((fiveStar / withRatingCount) * 100) : 0;

    const byProp: Record<string, number[]> = {};
    withRating.forEach(r => {
      if (r.listing_id && r.rating) {
        if (!byProp[r.listing_id]) byProp[r.listing_id] = [];
        byProp[r.listing_id].push(r.rating);
      }
    });
    const below4 = Object.values(byProp).filter(ratings => {
      const propAvg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
      return propAvg < 4.0;
    }).length;

    return { avg: Math.round(avg * 100) / 100, total, withRating: withRatingCount, fiveStarPct: Math.round(fiveStarPct), below4 };
  }, [reviews]);

  // Rating trend by month
  const ratingTrend = useMemo(() => {
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
    if (!reviews.length || !Object.keys(listings).length) return [];
    const byProp: Record<string, { ratings: number[]; latest: string; monthly: Record<string, number[]> }> = {};
    reviews.forEach(r => {
      if (!r.listing_id) return;
      if (!byProp[r.listing_id]) byProp[r.listing_id] = { ratings: [], latest: '', monthly: {} };
      if (r.rating !== null) {
        byProp[r.listing_id].ratings.push(r.rating);
        const m = (r.created_at || '').slice(0, 7);
        if (m) {
          if (!byProp[r.listing_id].monthly[m]) byProp[r.listing_id].monthly[m] = [];
          byProp[r.listing_id].monthly[m].push(r.rating);
        }
      }
      if (!byProp[r.listing_id].latest || (r.created_at || '') > byProp[r.listing_id].latest) {
        byProp[r.listing_id].latest = r.created_at || '';
      }
    });

    return Object.entries(byProp)
      .filter(([, data]) => data.ratings.length > 0)
      .map(([lid, data]) => {
        const avg = data.ratings.reduce((a, b) => a + b, 0) / data.ratings.length;
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

  // Quality correlation
  const qualityCorrelation = useMemo(() => {
    if (!cleanTimes || !reviews.length || !propRegistry || !Object.keys(listings).length) return [];

    const ratingByBwId: Record<string, { sum: number; count: number; name: string }> = {};
    reviews.forEach(r => {
      if (!r.listing_id || !r.rating) return;
      const reg = propRegistry[r.listing_id];
      if (!reg || !reg.bwId) return;
      if (!ratingByBwId[reg.bwId]) ratingByBwId[reg.bwId] = { sum: 0, count: 0, name: reg.name || listings[r.listing_id] || '' };
      ratingByBwId[reg.bwId].sum += r.rating;
      ratingByBwId[reg.bwId].count += 1;
    });

    return cleanTimes
      .filter(ct => ct.property_id && ct.avg_clean_minutes && ratingByBwId[ct.property_id])
      .map(ct => {
        const rData = ratingByBwId[ct.property_id!];
        if (!rData || rData.count < 3) return null;
        return {
          name: ct.property_name || rData.name || 'Unknown',
          cleanMinutes: Math.round(Number(ct.avg_clean_minutes)),
          rating: Math.round((rData.sum / rData.count) * 100) / 100,
          reviews: rData.count,
        };
      })
      .filter(Boolean) as Array<{ name: string; cleanMinutes: number; rating: number; reviews: number }>;
  }, [cleanTimes, reviews, propRegistry, listings]);

  // Cleaner quality scores
  const cleanerQuality = useMemo(() => {
    if (!bzTasks || !cleanerAssignments || !reviews.length || !propRegistry) return [];
    const taskToPropId: Record<number, string> = {};
    bzTasks.forEach(t => {
      if (t.breezeway_id && t.reference_property_id) taskToPropId[t.breezeway_id] = t.reference_property_id;
    });

    const bwIdToGuestyId: Record<string, string> = {};
    Object.entries(propRegistry).forEach(([guestyId, reg]) => {
      if (reg.bwId) bwIdToGuestyId[reg.bwId] = guestyId;
    });

    const ratingByListing: Record<string, number> = {};
    const countByListing: Record<string, number> = {};
    reviews.forEach(r => {
      if (!r.listing_id || !r.rating) return;
      ratingByListing[r.listing_id] = (ratingByListing[r.listing_id] || 0) + r.rating;
      countByListing[r.listing_id] = (countByListing[r.listing_id] || 0) + 1;
    });

    const cleanerScores: Record<string, { totalRating: number; count: number; properties: Set<string> }> = {};
    cleanerAssignments.forEach(a => {
      if (!a.assignee_name || !a.task_id) return;
      const bwPropId = taskToPropId[a.task_id];
      if (!bwPropId) return;
      const guestyId = bwIdToGuestyId[bwPropId];
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
  }, [bzTasks, cleanerAssignments, reviews, propRegistry]);

  // Review keywords analysis
  const keywordAnalysis = useMemo(() => {
    if (!reviews.length) return [];
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
          const hasNeg = negativeWords.some(nw => comment.includes(nw));
          if (isNegativeOverall || hasNeg) counts[cat].negative += 1;
          else counts[cat].positive += 1;
        }
      });
    });

    return Object.entries(counts)
      .map(([category, data]) => ({ category, ...data }))
      .filter(d => d.total > 0)
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

  const renderSparkline = (data: number[]) => {
    if (data.length < 2) return null;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const h = 20;
    const w = 60;
    const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(' ');
    const declining = data[data.length - 1] < data[0] - 0.2;
    return (
      <svg width={w} height={h} className="inline-block">
        <polyline fill="none" stroke={declining ? 'hsl(var(--destructive))' : 'hsl(142, 71%, 45%)'} strokeWidth="1.5" points={points} />
      </svg>
    );
  };

  const ratingColor = (r: number) =>
    r >= 4.5 ? 'text-[hsl(142,71%,45%)] font-semibold' : r >= 4.0 ? 'text-[hsl(45,93%,47%)]' : 'text-destructive font-semibold';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Guest Satisfaction</h2>
          <p className="text-sm text-muted-foreground">Review analytics, quality correlations & cleaner quality scores</p>
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
          <Select value={platformFilter} onValueChange={v => setPlatformFilter(v as PlatformFilter)}>
            <SelectTrigger className="w-48 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources ({platformCounts.total})</SelectItem>
              <SelectItem value="airbnb2">Airbnb ({platformCounts.airbnb2})</SelectItem>
              <SelectItem value="homeaway2">VRBO / HomeAway ({platformCounts.homeaway2})</SelectItem>
              <SelectItem value="bookingCom">Booking.com ({platformCounts.bookingCom})</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {platformFilter === 'homeaway2' && (
        <div className="rounded-md border border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-xs text-yellow-700 dark:text-yellow-400">
          VRBO / HomeAway reviews do not include a numeric star rating — keyword & comment analysis is available, but rating-based metrics are unavailable for this source.
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPICard title="Average Rating" value={kpis.avg > 0 ? kpis.avg.toFixed(2) : '—'} icon={Star} subtitle="out of 5.0" accent />
        <KPICard title="Total Reviews" value={kpis.total.toLocaleString()} icon={MessageSquare} subtitle={`${kpis.withRating} with rating`} />
        <KPICard title="5-Star %" value={kpis.withRating > 0 ? `${kpis.fiveStarPct}%` : '—'} icon={Star} subtitle="of rated reviews" />
        <KPICard title="Properties < 4.0" value={kpis.below4} icon={AlertTriangle} subtitle="need attention" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="glass-card rounded-lg p-5">
          <h3 className="text-sm font-semibold mb-4">Rating Trend</h3>
          {isLoading ? (
            <div className="h-[280px] flex items-center justify-center text-xs text-muted-foreground">Loading...</div>
          ) : ratingTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={ratingTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis domain={[3.5, 5]} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => v.toFixed(2)} />
                <Line type="monotone" dataKey="avg" stroke="hsl(var(--primary))" strokeWidth={2} name="Avg Rating" dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs text-muted-foreground h-[280px] flex items-center justify-center">No rated reviews in this period / source</p>
          )}
        </div>

        <div className="glass-card rounded-lg p-5">
          <h3 className="text-sm font-semibold mb-4">Review Themes ({reviews.length} reviews analyzed)</h3>
          {keywordAnalysis.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={keywordAnalysis} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis type="category" dataKey="category" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} width={100} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="positive" stackId="a" fill="hsl(142, 71%, 45%)" name="Positive" />
                <Bar dataKey="negative" stackId="a" fill="hsl(var(--destructive))" name="Negative" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs text-muted-foreground">No comment data to analyze</p>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="glass-card rounded-lg p-5">
          <h3 className="text-sm font-semibold mb-1">Quality Correlation</h3>
          <p className="text-xs text-muted-foreground mb-4">Avg clean time vs guest rating per property (min 3 reviews)</p>
          {qualityCorrelation.length > 0 ? (
            <div className="overflow-auto max-h-[300px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Property</TableHead>
                    <TableHead className="text-xs text-right">Avg Clean</TableHead>
                    <TableHead className="text-xs text-right">Rating</TableHead>
                    <TableHead className="text-xs text-right">Reviews</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {qualityCorrelation
                    .sort((a, b) => b.rating - a.rating)
                    .map((entry, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs py-1.5 font-medium max-w-[160px] truncate">{entry.name}</TableCell>
                        <TableCell className="text-xs py-1.5 text-right text-muted-foreground">{entry.cleanMinutes}m</TableCell>
                        <TableCell className={`text-xs py-1.5 text-right ${ratingColor(entry.rating)}`}>{entry.rating.toFixed(2)}</TableCell>
                        <TableCell className="text-xs py-1.5 text-right text-muted-foreground">{entry.reviews}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground h-[200px] flex items-center justify-center">No correlation data available — requires property registry cross-reference</p>
          )}
        </div>

        <div className="glass-card rounded-lg p-5">
          <h3 className="text-sm font-semibold mb-1">Cleaner Quality Score</h3>
          <p className="text-xs text-muted-foreground mb-4">Avg guest rating of properties each cleaner services</p>
          <div className="overflow-auto max-h-[300px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Cleaner</TableHead>
                  <TableHead className="text-xs text-right">Avg Rating</TableHead>
                  <TableHead className="text-xs text-right hidden sm:table-cell">Properties</TableHead>
                  <TableHead className="text-xs text-right hidden sm:table-cell">Tasks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cleanerQuality.length > 0 ? (
                  cleanerQuality.slice(0, 20).map(c => (
                    <TableRow key={c.name}>
                      <TableCell className="text-xs font-medium py-1.5">{c.name}</TableCell>
                      <TableCell className={`text-xs text-right py-1.5 ${ratingColor(c.avgPropertyRating)}`}>
                        {c.avgPropertyRating.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-xs text-right py-1.5 hidden sm:table-cell">{c.propertiesServiced}</TableCell>
                      <TableCell className="text-xs text-right py-1.5 hidden sm:table-cell">{c.taskCount}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-xs text-muted-foreground text-center py-4">
                      No cleaner data linked — requires housekeeping tasks in date range
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      <div className="glass-card rounded-lg p-5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
          <h3 className="text-sm font-semibold">
            Property Ratings ({sorted.length} properties)
            {platformFilter !== 'all' && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">— {PLATFORM_LABELS[platformFilter]}</span>
            )}
          </h3>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search properties..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-8 text-sm" />
          </div>
        </div>
        {isLoading ? <TableSkeleton /> : sorted.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">No rated reviews found for this date range / source</p>
        ) : (
          <div className="overflow-auto max-h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs cursor-pointer select-none" onClick={() => handleSort('name')}>Property{si('name')}</TableHead>
                  <TableHead className="text-xs text-right cursor-pointer select-none" onClick={() => handleSort('avg_rating')}>Avg Rating{si('avg_rating')}</TableHead>
                  <TableHead className="text-xs text-right cursor-pointer select-none" onClick={() => handleSort('count')}>Reviews{si('count')}</TableHead>
                  <TableHead className="text-xs text-right cursor-pointer select-none hidden md:table-cell" onClick={() => handleSort('latest')}>Latest{si('latest')}</TableHead>
                  <TableHead className="text-xs text-center hidden md:table-cell">Trend</TableHead>
                  <TableHead className="text-xs text-center hidden md:table-cell">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map(p => (
                  <TableRow key={p.listing_id}>
                    <TableCell className="text-xs font-medium py-2 max-w-[180px] truncate">{p.name}</TableCell>
                    <TableCell className={`text-xs text-right py-2 ${ratingColor(p.avg_rating)}`}>
                      {p.avg_rating.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-xs text-right py-2">{p.count}</TableCell>
                    <TableCell className="text-xs text-right py-2 hidden md:table-cell text-muted-foreground">{p.latest}</TableCell>
                    <TableCell className="text-xs text-center py-2 hidden md:table-cell">{renderSparkline(p.sparkline)}</TableCell>
                    <TableCell className="text-xs text-center py-2 hidden md:table-cell">
                      {p.trending === 'down' && <Badge variant="destructive" className="text-[8px] px-1.5 py-0">Declining</Badge>}
                      {p.trending === 'up' && <Badge className="text-[8px] px-1.5 py-0 bg-primary text-primary-foreground">Improving</Badge>}
                      {p.trending === 'stable' && <Badge variant="secondary" className="text-[8px] px-1.5 py-0">Stable</Badge>}
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

import { useState, useMemo } from 'react';
import { format, formatDistanceToNow, subMonths, subYears } from 'date-fns';
import { useAllReviews, usePropertyRegistryMap, useLowReviews, useCleanerQuality, useQualityCorrelation } from '@/hooks/useGuestSatisfactionData';
import { CardSkeleton, TableSkeleton, ChartSkeleton } from '@/components/dashboard/LoadingSkeleton';
import { KPICard } from '@/components/dashboard/KPICard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Star, MessageSquare, AlertTriangle, Search, Filter, CheckCircle2, XCircle, ThumbsUp } from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, ComposedChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine,
  ScatterChart, Scatter, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';

const tooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
  fontSize: 12,
  color: 'hsl(var(--foreground))',
};

type PlatformFilter = 'all' | 'airbnb2' | 'homeaway2' | 'bookingCom';
type DatePreset = '1m' | '3m' | '6m' | '1y' | 'all';
type PropSortKey = 'name' | 'avg_rating' | 'count' | 'cleanliness' | 'below_4' | 'latest';
type PropSortDir = 'asc' | 'desc';

const PLATFORM_LABELS: Record<string, string> = {
  airbnb2: 'Airbnb',
  homeaway2: 'VRBO',
  bookingCom: 'Booking.com',
};

function platformDisplay(raw: string | null): string {
  if (!raw) return 'Unknown';
  return PLATFORM_LABELS[raw] || raw;
}

function platformColor(raw: string | null): string {
  if (raw === 'airbnb2') return 'bg-[hsl(356,100%,69%)] text-white';
  if (raw === 'homeaway2') return 'bg-[hsl(210,100%,45%)] text-white';
  if (raw === 'bookingCom') return 'bg-[hsl(220,60%,35%)] text-white';
  return 'bg-muted text-muted-foreground';
}

function extractComment(raw: string | null | undefined): string {
  if (!raw) return '';
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null && 'value' in parsed) return String(parsed.value);
  } catch { /* not JSON */ }
  return raw;
}

function ratingColor(r: number): string {
  if (r >= 4.8) return 'text-[hsl(var(--success))] font-semibold';
  if (r >= 4.5) return 'text-[hsl(var(--warning))]';
  if (r >= 4.0) return 'text-foreground';
  return 'text-destructive font-semibold';
}

function ratingBgColor(r: number): string {
  if (r < 4.0) return 'bg-destructive/10';
  return '';
}

function StarDisplay({ rating, max = 5 }: { rating: number; max?: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${i < Math.round(rating) ? 'fill-[hsl(var(--warning))] text-[hsl(var(--warning))]' : 'text-muted-foreground/30'}`}
        />
      ))}
    </span>
  );
}

function getDateRange(preset: DatePreset): { from: string; to: string } {
  const now = new Date();
  const to = format(now, 'yyyy-MM-dd');
  switch (preset) {
    case '1m': return { from: format(subMonths(now, 1), 'yyyy-MM-dd'), to };
    case '3m': return { from: format(subMonths(now, 3), 'yyyy-MM-dd'), to };
    case '6m': return { from: format(subMonths(now, 6), 'yyyy-MM-dd'), to };
    case '1y': return { from: format(subYears(now, 1), 'yyyy-MM-dd'), to };
    case 'all': return { from: '2018-01-01', to };
  }
}

export default function GuestSatisfaction() {
  const [search, setSearch] = useState('');
  const [datePreset, setDatePreset] = useState<DatePreset>('6m');
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all');
  const [propSortKey, setPropSortKey] = useState<PropSortKey>('avg_rating');
  const [propSortDir, setPropSortDir] = useState<PropSortDir>('asc');

  const { from, to } = getDateRange(datePreset);

  // Data hooks
  const { data: reviews, isLoading } = useAllReviews(from, to, platformFilter);
  const { data: propRegistry } = usePropertyRegistryMap();
  const { data: lowReviews, isLoading: lowLoading } = useLowReviews(from, to, platformFilter);
  const { data: cleanerData, isLoading: cleanerLoading } = useCleanerQuality(from, to);
  const { data: correlation, isLoading: correlationLoading } = useQualityCorrelation(from, to);

  // Platform counts (from unfiltered query for dropdown display)
  const { data: allReviewsForCounts } = useAllReviews(from, to);
  const platformCounts = useMemo(() => {
    const counts = { total: 0, airbnb2: 0, homeaway2: 0, bookingCom: 0 };
    allReviewsForCounts?.forEach(r => {
      counts.total++;
      if (r.platform === 'airbnb2') counts.airbnb2++;
      else if (r.platform === 'homeaway2') counts.homeaway2++;
      else if (r.platform === 'bookingCom') counts.bookingCom++;
    });
    return counts;
  }, [allReviewsForCounts]);

  // ── KPIs ──
  const kpis = useMemo(() => {
    if (!reviews?.length) return { avg: 0, total: 0, withRating: 0, fiveStarPct: 0, below4Props: 0 };
    const withRating = reviews.filter(r => r.rating != null);
    const avg = withRating.length > 0
      ? withRating.reduce((s, r) => s + (r.rating || 0), 0) / withRating.length : 0;
    const fiveStar = withRating.filter(r => r.rating === 5).length;
    const fiveStarPct = withRating.length > 0 ? (fiveStar / withRating.length) * 100 : 0;

    // Properties below 4.0
    const byProp: Record<string, number[]> = {};
    withRating.forEach(r => {
      if (r.listing_id && r.rating) {
        if (!byProp[r.listing_id]) byProp[r.listing_id] = [];
        byProp[r.listing_id].push(r.rating);
      }
    });
    const below4Props = Object.values(byProp).filter(ratings => {
      const propAvg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
      return propAvg < 4.0;
    }).length;

    return {
      avg: Math.round(avg * 100) / 100,
      total: reviews.length,
      withRating: withRating.length,
      fiveStarPct: Math.round(fiveStarPct * 10) / 10,
      below4Props,
    };
  }, [reviews]);

  // ── Rating Trend (monthly) ──
  const ratingTrend = useMemo(() => {
    if (!reviews?.length) return [];
    const months: Record<string, { sum: number; count: number }> = {};
    reviews.forEach(r => {
      if (!r.created_at || r.rating == null) return;
      const m = r.created_at.slice(0, 7);
      if (!months[m]) months[m] = { sum: 0, count: 0 };
      months[m].sum += r.rating;
      months[m].count += 1;
    });
    return Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({
        month,
        label: format(new Date(month + '-01'), 'MMM yy'),
        avg: Math.round((v.sum / v.count) * 100) / 100,
        count: v.count,
      }));
  }, [reviews]);

  // ── Sub-rating breakdown ──
  const subRatings = useMemo(() => {
    if (!reviews?.length) return null;
    const sums = { cleanliness: 0, accuracy: 0, communication: 0, location: 0, checkin: 0, value: 0 };
    const counts = { cleanliness: 0, accuracy: 0, communication: 0, location: 0, checkin: 0, value: 0 };
    reviews.forEach(r => {
      if (r.cleanliness_rating) { sums.cleanliness += r.cleanliness_rating; counts.cleanliness++; }
      if (r.accuracy_rating) { sums.accuracy += r.accuracy_rating; counts.accuracy++; }
      if (r.communication_rating) { sums.communication += r.communication_rating; counts.communication++; }
      if (r.location_rating) { sums.location += r.location_rating; counts.location++; }
      if (r.checkin_rating) { sums.checkin += r.checkin_rating; counts.checkin++; }
      if (r.value_rating) { sums.value += r.value_rating; counts.value++; }
    });
    const totalSubRated = Math.max(counts.cleanliness, counts.accuracy, counts.communication);
    if (totalSubRated === 0) return null;

    const data = [
      { subject: 'Cleanliness', value: counts.cleanliness > 0 ? Math.round((sums.cleanliness / counts.cleanliness) * 100) / 100 : 0, count: counts.cleanliness },
      { subject: 'Accuracy', value: counts.accuracy > 0 ? Math.round((sums.accuracy / counts.accuracy) * 100) / 100 : 0, count: counts.accuracy },
      { subject: 'Communication', value: counts.communication > 0 ? Math.round((sums.communication / counts.communication) * 100) / 100 : 0, count: counts.communication },
      { subject: 'Location', value: counts.location > 0 ? Math.round((sums.location / counts.location) * 100) / 100 : 0, count: counts.location },
      { subject: 'Check-in', value: counts.checkin > 0 ? Math.round((sums.checkin / counts.checkin) * 100) / 100 : 0, count: counts.checkin },
      { subject: 'Value', value: counts.value > 0 ? Math.round((sums.value / counts.value) * 100) / 100 : 0, count: counts.value },
    ];
    return { data, totalSubRated };
  }, [reviews]);

  // ── Property ratings table ──
  const propertyRatings = useMemo(() => {
    if (!reviews?.length) return [];
    const byProp: Record<string, { ratings: number[]; cleanliness: number[]; fiveStar: number; below4: number; latest: string }> = {};
    reviews.forEach(r => {
      if (!r.listing_id || r.rating == null) return;
      if (!byProp[r.listing_id]) byProp[r.listing_id] = { ratings: [], cleanliness: [], fiveStar: 0, below4: 0, latest: '' };
      byProp[r.listing_id].ratings.push(r.rating);
      if (r.cleanliness_rating) byProp[r.listing_id].cleanliness.push(r.cleanliness_rating);
      if (r.rating === 5) byProp[r.listing_id].fiveStar++;
      if (r.rating < 4) byProp[r.listing_id].below4++;
      if ((r.created_at || '') > byProp[r.listing_id].latest) byProp[r.listing_id].latest = r.created_at || '';
    });

    return Object.entries(byProp)
      .filter(([, d]) => d.ratings.length > 0)
      .map(([lid, d]) => {
        const avg = d.ratings.reduce((a, b) => a + b, 0) / d.ratings.length;
        const avgClean = d.cleanliness.length > 0 ? d.cleanliness.reduce((a, b) => a + b, 0) / d.cleanliness.length : null;
        return {
          listing_id: lid,
          name: propRegistry?.[lid]?.name || lid.slice(0, 12),
          avg_rating: Math.round(avg * 100) / 100,
          count: d.ratings.length,
          avg_cleanliness: avgClean ? Math.round(avgClean * 100) / 100 : null,
          five_star: d.fiveStar,
          below_4: d.below4,
          latest: d.latest.slice(0, 10),
        };
      });
  }, [reviews, propRegistry]);

  // Sort/filter property ratings
  const filteredProps = propertyRatings.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
  const sortedProps = [...filteredProps].sort((a, b) => {
    let cmp = 0;
    switch (propSortKey) {
      case 'name': cmp = a.name.localeCompare(b.name); break;
      case 'avg_rating': cmp = a.avg_rating - b.avg_rating; break;
      case 'count': cmp = a.count - b.count; break;
      case 'cleanliness': cmp = (a.avg_cleanliness ?? 0) - (b.avg_cleanliness ?? 0); break;
      case 'below_4': cmp = a.below_4 - b.below_4; break;
      case 'latest': cmp = a.latest.localeCompare(b.latest); break;
    }
    return propSortDir === 'desc' ? -cmp : cmp;
  });

  const handlePropSort = (key: PropSortKey) => {
    if (propSortKey === key) setPropSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setPropSortKey(key); setSortDir(key === 'avg_rating' ? 'asc' : 'desc'); }
  };
  function setSortDir(dir: PropSortDir) { setPropSortDir(dir); }
  const si = (key: PropSortKey) => propSortKey === key ? (propSortDir === 'desc' ? ' ↓' : ' ↑') : '';

  // ── Scatter plot data ──
  const scatterData = useMemo(() => {
    if (!correlation?.length) return [];
    return correlation.map(c => ({
      ...c,
      fill: c.avgRating < 4.0 ? 'hsl(var(--destructive))' : c.avgRating >= 4.8 ? 'hsl(var(--success))' : 'hsl(var(--primary))',
    }));
  }, [correlation]);

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Guest Satisfaction</h1>
          <p className="text-sm text-muted-foreground">Review analytics, quality correlations & cleaner attribution</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Date range presets */}
          <div className="flex items-center gap-1 bg-muted rounded-md p-0.5">
            {(['1m', '3m', '6m', '1y', 'all'] as DatePreset[]).map(p => (
              <Button
                key={p}
                variant={datePreset === p ? 'default' : 'ghost'}
                size="sm"
                className="h-6 px-2 text-[10px] uppercase"
                onClick={() => setDatePreset(p)}
              >
                {p === 'all' ? 'All' : p}
              </Button>
            ))}
          </div>
          {/* Platform filter */}
          <div className="flex items-center gap-1">
            <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
            <Select value={platformFilter} onValueChange={v => setPlatformFilter(v as PlatformFilter)}>
              <SelectTrigger className="w-48 h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources ({platformCounts.total.toLocaleString()})</SelectItem>
                <SelectItem value="airbnb2">Airbnb ({platformCounts.airbnb2.toLocaleString()})</SelectItem>
                <SelectItem value="homeaway2">VRBO ({platformCounts.homeaway2.toLocaleString()})</SelectItem>
                <SelectItem value="bookingCom">Booking.com ({platformCounts.bookingCom.toLocaleString()})</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KPICard title="Average Rating" value={kpis.avg > 0 ? kpis.avg.toFixed(2) : '—'} icon={Star} subtitle="out of 5.0" accent />
          <KPICard title="Total Reviews" value={kpis.total.toLocaleString()} icon={MessageSquare} subtitle={`${kpis.withRating.toLocaleString()} with rating`} />
          <KPICard title="5-Star %" value={kpis.withRating > 0 ? `${kpis.fiveStarPct}%` : '—'} icon={ThumbsUp} subtitle="of rated reviews" />
          <KPICard title="Properties < 4.0" value={kpis.below4Props} icon={AlertTriangle} subtitle="need attention" />
        </div>
      )}

      {/* ── Rating Trend + Sub-Rating Breakdown ── */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Rating Trend */}
        <div className="glass-card rounded-lg p-5">
          <h3 className="text-sm font-semibold mb-4">Rating Trend</h3>
          {isLoading ? (
            <div className="h-[280px] flex items-center justify-center text-xs text-muted-foreground">Loading...</div>
          ) : ratingTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={ratingTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis yAxisId="rating" domain={[3.5, 5]} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis yAxisId="count" orientation="right" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} hide />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number, name: string) => name === 'Reviews' ? v : v.toFixed(2)} />
                <ReferenceLine yAxisId="rating" y={4.8} stroke="hsl(var(--success))" strokeDasharray="6 3" strokeWidth={1.5} label={{ value: '4.8 target', position: 'insideTopRight', fontSize: 10, fill: 'hsl(var(--success))' }} />
                <Bar yAxisId="count" dataKey="count" fill="hsl(var(--muted))" name="Reviews" radius={[2, 2, 0, 0]} />
                <Line yAxisId="rating" type="monotone" dataKey="avg" stroke="hsl(var(--primary))" strokeWidth={2} name="Avg Rating" dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs text-muted-foreground h-[280px] flex items-center justify-center">No rated reviews in this period</p>
          )}
        </div>

        {/* Sub-Rating Breakdown */}
        <div className="glass-card rounded-lg p-5">
          <h3 className="text-sm font-semibold mb-1">Sub-Rating Breakdown</h3>
          <p className="text-xs text-muted-foreground mb-4">
            {subRatings ? `Based on ${subRatings.totalSubRated.toLocaleString()} reviews with sub-ratings` : 'Loading...'}
          </p>
          {isLoading ? (
            <div className="h-[250px] flex items-center justify-center text-xs text-muted-foreground">Loading...</div>
          ) : subRatings ? (
            <ResponsiveContainer width="100%" height={250}>
              <RadarChart cx="50%" cy="50%" outerRadius="75%" data={subRatings.data}>
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <PolarRadiusAxis domain={[3.5, 5]} tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} />
                <Radar name="Avg" dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} strokeWidth={2} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => v.toFixed(2)} />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs text-muted-foreground h-[250px] flex items-center justify-center">No sub-rating data available</p>
          )}
        </div>
      </div>

      {/* ── Recent Low Reviews ── */}
      <div className="glass-card rounded-lg p-5">
        <h3 className="text-sm font-semibold mb-4">Recent Low Reviews (Below 4 Stars)</h3>
        {lowLoading ? (
          <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)}</div>
        ) : lowReviews && lowReviews.length > 0 ? (
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
            {lowReviews.map(r => (
              <div key={r.id} className="border border-border rounded-lg p-4 space-y-2 bg-destructive/5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{propRegistry?.[r.listing_id]?.name || r.listing_id?.slice(0, 12) || 'Unknown'}</span>
                    <Badge className={`text-[9px] px-1.5 py-0 ${platformColor(r.platform)}`}>
                      {platformDisplay(r.platform)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <StarDisplay rating={r.rating || 0} />
                    <span className="text-xs text-muted-foreground">
                      {r.created_at ? formatDistanceToNow(new Date(r.created_at), { addSuffix: true }) : ''}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                  {extractComment(r.comment) || <em>No comment</em>}
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">by {r.reviewer_name || 'Guest'}</span>
                  <span className="flex-1" />
                  {r.reply ? (
                    <span className="inline-flex items-center gap-1 text-[10px] text-[hsl(var(--success))]">
                      <CheckCircle2 className="h-3 w-3" /> Replied
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] text-destructive">
                      <XCircle className="h-3 w-3" /> No reply
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <CheckCircle2 className="h-8 w-8 text-[hsl(var(--success))]" />
            <p className="text-sm font-medium text-[hsl(var(--success))]">No reviews below 4 stars — great work!</p>
          </div>
        )}
      </div>

      {/* ── Quality Correlation + Cleaner Quality ── */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Quality Correlation Scatter */}
        <div className="glass-card rounded-lg p-5">
          <h3 className="text-sm font-semibold mb-1">Quality Correlation</h3>
          <p className="text-xs text-muted-foreground mb-4">Avg clean time vs guest rating (min 3 reviews)</p>
          {correlationLoading ? (
            <div className="h-[300px] flex items-center justify-center text-xs text-muted-foreground">Loading...</div>
          ) : scatterData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  type="number" dataKey="avgCleanMinutes" name="Clean Time"
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  label={{ value: 'Avg Clean Time (min)', position: 'insideBottom', offset: -5, fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis
                  type="number" dataKey="avgRating" name="Rating" domain={[3, 5]}
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  label={{ value: 'Avg Rating', angle: -90, position: 'insideLeft', fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v: number, name: string) => [name === 'Rating' ? v.toFixed(2) : `${v}m`, name]}
                  labelFormatter={() => ''}
                  cursor={{ strokeDasharray: '3 3' }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0]?.payload;
                    if (!d) return null;
                    return (
                      <div style={tooltipStyle} className="p-2">
                        <p className="font-medium text-xs">{d.name}</p>
                        <p className="text-[10px] text-muted-foreground">Rating: {d.avgRating.toFixed(2)} | Clean: {d.avgCleanMinutes}m | {d.reviewCount} reviews</p>
                      </div>
                    );
                  }}
                />
                <Scatter data={scatterData}>
                  {scatterData.map((d, i) => (
                    <Cell key={i} fill={d.fill} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs text-muted-foreground h-[300px] flex items-center justify-center">No correlation data available</p>
          )}
          {scatterData.length > 0 && (
            <div className="flex items-center gap-4 mt-2 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-destructive" /> &lt; 4.0</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary" /> 4.0–4.79</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[hsl(var(--success))]" /> ≥ 4.8</span>
            </div>
          )}
        </div>

        {/* Cleaner Quality Score */}
        <div className="glass-card rounded-lg p-5">
          <h3 className="text-sm font-semibold mb-1">Cleaner Quality Score</h3>
          <p className="text-xs text-muted-foreground mb-4">Avg guest rating per cleaner (attributed reviews, min 3)</p>
          {cleanerLoading ? (
            <TableSkeleton rows={6} />
          ) : cleanerData && cleanerData.cleaners.length > 0 ? (
            <>
              <div className="overflow-auto max-h-[260px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Cleaner</TableHead>
                      <TableHead className="text-xs text-right">Avg Rating</TableHead>
                      <TableHead className="text-xs text-right hidden sm:table-cell">Properties</TableHead>
                      <TableHead className="text-xs text-right hidden sm:table-cell">Reviews</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cleanerData.cleaners.slice(0, 25).map(c => (
                      <TableRow key={c.name}>
                        <TableCell className="text-xs font-medium py-1.5">{c.name}</TableCell>
                        <TableCell className={`text-xs text-right py-1.5 ${c.avgRating ? ratingColor(c.avgRating) : ''}`}>
                          {c.avgRating?.toFixed(2) ?? '—'}
                        </TableCell>
                        <TableCell className="text-xs text-right py-1.5 hidden sm:table-cell text-muted-foreground">{c.properties}</TableCell>
                        <TableCell className="text-xs text-right py-1.5 hidden sm:table-cell text-muted-foreground">{c.reviews}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <p className="text-[10px] text-muted-foreground mt-3 pt-2 border-t border-border">
                {cleanerData.attributedReviews.toLocaleString()} of {cleanerData.totalReviews.toLocaleString()} reviews attributed to cleaners ({cleanerData.totalReviews > 0 ? Math.round((cleanerData.attributedReviews / cleanerData.totalReviews) * 100) : 0}%)
              </p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground h-[200px] flex items-center justify-center">No attributed cleaner data in this period</p>
          )}
        </div>
      </div>

      {/* ── Property Ratings Table ── */}
      <div className="glass-card rounded-lg p-5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
          <h3 className="text-sm font-semibold">
            Property Ratings ({sortedProps.length} properties)
          </h3>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search properties..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-8 text-sm" />
          </div>
        </div>
        {isLoading ? <TableSkeleton /> : sortedProps.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">No rated reviews found for this date range / source</p>
        ) : (
          <div className="overflow-auto max-h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs cursor-pointer select-none" onClick={() => handlePropSort('name')}>Property{si('name')}</TableHead>
                  <TableHead className="text-xs text-right cursor-pointer select-none" onClick={() => handlePropSort('avg_rating')}>Avg Rating{si('avg_rating')}</TableHead>
                  <TableHead className="text-xs text-right cursor-pointer select-none" onClick={() => handlePropSort('count')}>Reviews{si('count')}</TableHead>
                  <TableHead className="text-xs text-right cursor-pointer select-none hidden md:table-cell" onClick={() => handlePropSort('cleanliness')}>Cleanliness{si('cleanliness')}</TableHead>
                  <TableHead className="text-xs text-right hidden md:table-cell">5-Star</TableHead>
                  <TableHead className="text-xs text-right cursor-pointer select-none hidden md:table-cell" onClick={() => handlePropSort('below_4')}>Below 4{si('below_4')}</TableHead>
                  <TableHead className="text-xs text-right cursor-pointer select-none hidden lg:table-cell" onClick={() => handlePropSort('latest')}>Latest{si('latest')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedProps.map(p => (
                  <TableRow key={p.listing_id} className={ratingBgColor(p.avg_rating)}>
                    <TableCell className="text-xs font-medium py-2 max-w-[180px] truncate">{p.name}</TableCell>
                    <TableCell className={`text-xs text-right py-2 ${ratingColor(p.avg_rating)}`}>{p.avg_rating.toFixed(2)}</TableCell>
                    <TableCell className="text-xs text-right py-2">{p.count}</TableCell>
                    <TableCell className={`text-xs text-right py-2 hidden md:table-cell ${p.avg_cleanliness ? ratingColor(p.avg_cleanliness) : 'text-muted-foreground'}`}>
                      {p.avg_cleanliness?.toFixed(2) ?? '—'}
                    </TableCell>
                    <TableCell className="text-xs text-right py-2 hidden md:table-cell text-muted-foreground">{p.five_star}</TableCell>
                    <TableCell className={`text-xs text-right py-2 hidden md:table-cell ${p.below_4 > 0 ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>{p.below_4}</TableCell>
                    <TableCell className="text-xs text-right py-2 hidden lg:table-cell text-muted-foreground">{p.latest}</TableCell>
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

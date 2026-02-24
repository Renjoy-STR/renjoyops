import { useState, useMemo, useRef } from 'react';
import { format, formatDistanceToNow, subMonths, subYears } from 'date-fns';
import {
  useAllReviews, usePropertyRegistryMap, useLowReviews,
  useCleanerQuality, useQualityCorrelation, useWeeklyScorecard,
  useUnrepliedCount, useReviewAttribution,
} from '@/hooks/useGuestSatisfactionData';
import { CardSkeleton, TableSkeleton, ChartSkeleton } from '@/components/dashboard/LoadingSkeleton';
import { KPICard } from '@/components/dashboard/KPICard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Star, MessageSquare, AlertTriangle, Search, Filter, CheckCircle2, XCircle,
  ThumbsUp, ArrowUp, ArrowDown, Minus, TriangleAlert,
} from 'lucide-react';
import {
  ResponsiveContainer, ComposedChart, Bar, Line,
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
type PropSortKey = 'name' | 'avg_rating' | 'count' | 'cleanliness' | 'below_4' | 'latest' | 'owner';
type LowReviewFilter = 'all' | 'needs_reply' | 'replied';

const PLATFORM_LABELS: Record<string, string> = { airbnb2: 'Airbnb', homeaway2: 'VRBO', bookingCom: 'Booking.com' };

function platformDisplay(raw: string | null): string {
  return raw ? PLATFORM_LABELS[raw] || raw : 'Unknown';
}

function platformColor(raw: string | null): string {
  if (raw === 'airbnb2') return 'bg-[hsl(356,100%,69%)] text-white';
  if (raw === 'homeaway2') return 'bg-[hsl(210,100%,45%)] text-white';
  if (raw === 'bookingCom') return 'bg-[hsl(220,60%,35%)] text-white';
  return 'bg-muted text-muted-foreground';
}

// Parse Booking.com JSON comments
function renderComment(raw: string | null | undefined) {
  if (!raw) return <em className="text-muted-foreground">No comment</em>;
  const trimmed = raw.trim();
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed === 'object' && parsed !== null) {
        const parts: React.ReactNode[] = [];
        if (parsed.headline) {
          parts.push(<span key="h" className="font-semibold block mb-1">{parsed.headline}</span>);
        }
        if (parsed.negative) {
          parts.push(
            <span key="neg" className="flex items-start gap-1.5">
              <span className="text-destructive font-bold shrink-0">−</span>
              <span>{parsed.negative}</span>
            </span>
          );
        }
        if (parsed.negative && parsed.positive) {
          parts.push(<span key="div" className="block border-t border-border my-1" />);
        }
        if (parsed.positive) {
          parts.push(
            <span key="pos" className="flex items-start gap-1.5">
              <span className="text-[hsl(var(--success))] font-bold shrink-0">+</span>
              <span>{parsed.positive}</span>
            </span>
          );
        }
        if (parts.length > 0) return <div className="space-y-0.5">{parts}</div>;
        // fallback if object but no known keys
        if (parsed.value) return <span>{String(parsed.value)}</span>;
      }
    } catch { /* not valid JSON, show as-is */ }
  }
  return <span>{raw}</span>;
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
        <Star key={i} className={`h-3.5 w-3.5 ${i < Math.round(rating) ? 'fill-[hsl(var(--warning))] text-[hsl(var(--warning))]' : 'text-muted-foreground/30'}`} />
      ))}
    </span>
  );
}

function DeltaArrow({ current, previous, invert = false }: { current: number; previous: number; invert?: boolean }) {
  const delta = current - previous;
  if (Math.abs(delta) < 0.005) return <Minus className="h-3 w-3 text-muted-foreground" />;
  const improving = invert ? delta < 0 : delta > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${improving ? 'text-[hsl(var(--success))]' : 'text-destructive'}`}>
      {improving ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      {Math.abs(delta) < 1 ? Math.abs(delta).toFixed(2) : Math.abs(Math.round(delta))}
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

// Calculate prior period of same length
function getPriorRange(from: string, to: string): { from: string; to: string } {
  const f = new Date(from);
  const t = new Date(to);
  const diffMs = t.getTime() - f.getTime();
  const priorTo = new Date(f.getTime() - 1);
  const priorFrom = new Date(priorTo.getTime() - diffMs);
  return { from: format(priorFrom, 'yyyy-MM-dd'), to: format(priorTo, 'yyyy-MM-dd') };
}

export default function GuestSatisfaction() {
  const [search, setSearch] = useState('');
  const [datePreset, setDatePreset] = useState<DatePreset>('6m');
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all');
  const [propSortKey, setPropSortKey] = useState<PropSortKey>('avg_rating');
  const [propSortDir, setPropSortDir] = useState<'asc' | 'desc'>('asc');
  const [lowReviewFilter, setLowReviewFilter] = useState<LowReviewFilter>('all');
  const [cleanerSortAsc, setCleanerSortAsc] = useState(true); // true = worst first

  const lowReviewsRef = useRef<HTMLDivElement>(null);

  const { from, to } = getDateRange(datePreset);
  const priorRange = getPriorRange(from, to);

  // Data hooks
  const { data: reviews, isLoading } = useAllReviews(from, to, platformFilter);
  const { data: priorReviews } = useAllReviews(priorRange.from, priorRange.to, platformFilter);
  const { data: propRegistry } = usePropertyRegistryMap();
  const { data: lowReviews, isLoading: lowLoading } = useLowReviews(from, to, platformFilter);
  const { data: cleanerData, isLoading: cleanerLoading } = useCleanerQuality(from, to);
  const { data: correlation, isLoading: correlationLoading } = useQualityCorrelation(from, to);
  const { data: scorecard, isLoading: scorecardLoading } = useWeeklyScorecard();
  const { data: unrepliedCount } = useUnrepliedCount();
  const { data: attributionMap } = useReviewAttribution(from, to);

  // Platform counts
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
  const calcKpis = (data: any[] | undefined) => {
    if (!data?.length) return { avg: 0, total: 0, withRating: 0, fiveStarPct: 0, below4Props: 0 };
    const withRating = data.filter(r => r.rating != null);
    const avg = withRating.length > 0 ? withRating.reduce((s, r) => s + (r.rating || 0), 0) / withRating.length : 0;
    const fiveStar = withRating.filter(r => r.rating === 5).length;
    const fiveStarPct = withRating.length > 0 ? (fiveStar / withRating.length) * 100 : 0;
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
    return { avg: Math.round(avg * 100) / 100, total: data.length, withRating: withRating.length, fiveStarPct: Math.round(fiveStarPct * 10) / 10, below4Props };
  };

  const kpis = useMemo(() => calcKpis(reviews), [reviews]);
  const priorKpis = useMemo(() => calcKpis(priorReviews), [priorReviews]);

  // ── Rating Trend (monthly) with cleanliness ──
  const ratingTrend = useMemo(() => {
    if (!reviews?.length) return [];
    const now = new Date();
    const currentMonth = format(now, 'yyyy-MM');
    const months: Record<string, { sum: number; count: number; cleanSum: number; cleanCount: number }> = {};
    reviews.forEach(r => {
      if (!r.created_at || r.rating == null) return;
      const m = r.created_at.slice(0, 7);
      if (!months[m]) months[m] = { sum: 0, count: 0, cleanSum: 0, cleanCount: 0 };
      months[m].sum += r.rating;
      months[m].count += 1;
      if (r.cleanliness_rating) { months[m].cleanSum += r.cleanliness_rating; months[m].cleanCount++; }
    });
    return Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({
        month,
        label: format(new Date(month + '-01'), 'MMM yy'),
        avg: Math.round((v.sum / v.count) * 100) / 100,
        cleanAvg: v.cleanCount > 0 ? Math.round((v.cleanSum / v.cleanCount) * 100) / 100 : null,
        count: v.count,
        isPartial: month === currentMonth,
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

    // Prior period for trend
    const priorByProp: Record<string, number[]> = {};
    priorReviews?.forEach(r => {
      if (!r.listing_id || r.rating == null) return;
      if (!priorByProp[r.listing_id]) priorByProp[r.listing_id] = [];
      priorByProp[r.listing_id].push(r.rating);
    });

    return Object.entries(byProp)
      .filter(([, d]) => d.ratings.length > 0)
      .map(([lid, d]) => {
        const avg = d.ratings.reduce((a, b) => a + b, 0) / d.ratings.length;
        const avgClean = d.cleanliness.length > 0 ? d.cleanliness.reduce((a, b) => a + b, 0) / d.cleanliness.length : null;
        const priorRatings = priorByProp[lid];
        const priorAvg = priorRatings?.length ? priorRatings.reduce((a, b) => a + b, 0) / priorRatings.length : null;
        return {
          listing_id: lid,
          name: propRegistry?.[lid]?.name || lid.slice(0, 12),
          ownerName: propRegistry?.[lid]?.ownerName || null,
          avg_rating: Math.round(avg * 100) / 100,
          prior_avg: priorAvg ? Math.round(priorAvg * 100) / 100 : null,
          count: d.ratings.length,
          avg_cleanliness: avgClean ? Math.round(avgClean * 100) / 100 : null,
          five_star: d.fiveStar,
          below_4: d.below4,
          latest: d.latest.slice(0, 10),
        };
      });
  }, [reviews, propRegistry, priorReviews]);

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
      case 'owner': cmp = (a.ownerName || '').localeCompare(b.ownerName || ''); break;
    }
    return propSortDir === 'desc' ? -cmp : cmp;
  });

  const handlePropSort = (key: PropSortKey) => {
    if (propSortKey === key) setPropSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setPropSortKey(key); setPropSortDir(key === 'avg_rating' ? 'asc' : 'desc'); }
  };
  const si = (key: PropSortKey) => propSortKey === key ? (propSortDir === 'desc' ? ' ↓' : ' ↑') : '';

  // ── Scatter data ──
  const scatterData = useMemo(() => {
    if (!correlation?.length) return [];
    return correlation.map(c => ({
      ...c,
      fill: c.avgRating < 4.0 ? 'hsl(var(--destructive))' : c.avgRating >= 4.8 ? 'hsl(var(--success))' : 'hsl(var(--primary))',
    }));
  }, [correlation]);

  // ── Filtered low reviews ──
  const filteredLowReviews = useMemo(() => {
    if (!lowReviews) return [];
    if (lowReviewFilter === 'needs_reply') return lowReviews.filter(r => !r.reply);
    if (lowReviewFilter === 'replied') return lowReviews.filter(r => r.reply);
    return lowReviews;
  }, [lowReviews, lowReviewFilter]);

  // ── Cleaner data sorted ──
  const sortedCleaners = useMemo(() => {
    if (!cleanerData?.cleaners) return [];
    return cleanerSortAsc
      ? [...cleanerData.cleaners].sort((a, b) => (a.avgRating ?? 5) - (b.avgRating ?? 5))
      : [...cleanerData.cleaners].sort((a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0));
  }, [cleanerData, cleanerSortAsc]);

  function cleanerRowColor(c: { avgRating: number | null; below4: number }) {
    if (!c.avgRating) return '';
    if (c.avgRating < 4.0) return 'bg-destructive/10';
    if (c.avgRating < 4.5) return 'bg-[hsl(var(--warning))]/10';
    if (c.avgRating >= 4.8 && c.below4 === 0) return 'bg-[hsl(var(--success))]/10';
    return '';
  }

  const scrollToLowReviews = () => {
    setLowReviewFilter('needs_reply');
    lowReviewsRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // ── Weekly scorecard helpers ──
  const scorecardRows = useMemo(() => {
    if (!scorecard) return [];
    const tw = scorecard.thisWeek;
    const lw = scorecard.lastWeek;
    return [
      { label: 'Avg Rating', thisWeek: tw.avg.toFixed(2), lastWeek: lw.avg.toFixed(2), delta: tw.avg - lw.avg, target: 4.8, improving: tw.avg >= lw.avg, format: 'decimal' },
      { label: 'Reviews Received', thisWeek: tw.count, lastWeek: lw.count, delta: tw.count - lw.count, target: null, improving: true, format: 'int' },
      { label: 'Below 4 Stars', thisWeek: tw.below4, lastWeek: lw.below4, delta: tw.below4 - lw.below4, target: 0, improving: tw.below4 <= lw.below4, format: 'int', invert: true },
      { label: '5-Star %', thisWeek: `${tw.fiveStarPct}%`, lastWeek: `${lw.fiveStarPct}%`, delta: tw.fiveStarPct - lw.fiveStarPct, target: 85, improving: tw.fiveStarPct >= lw.fiveStarPct, format: 'pct' },
      { label: 'Unreplied Low', thisWeek: tw.unrepliedLow, lastWeek: lw.unrepliedLow, delta: tw.unrepliedLow - lw.unrepliedLow, target: 0, improving: tw.unrepliedLow <= lw.unrepliedLow, format: 'int', invert: true },
      { label: 'Cleanliness Avg', thisWeek: tw.avgCleanliness.toFixed(2), lastWeek: lw.avgCleanliness.toFixed(2), delta: tw.avgCleanliness - lw.avgCleanliness, target: 4.8, improving: tw.avgCleanliness >= lw.avgCleanliness, format: 'decimal' },
    ];
  }, [scorecard]);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Guest Satisfaction</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Weekly L10 review dashboard</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-0.5 bg-muted rounded-md p-0.5">
            {(['1m', '3m', '6m', '1y', 'all'] as DatePreset[]).map(p => (
              <Button key={p} variant={datePreset === p ? 'default' : 'ghost'} size="sm" className="h-6 px-2 text-[10px] uppercase" onClick={() => setDatePreset(p)}>
                {p === 'all' ? 'All' : p}
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
            <Select value={platformFilter} onValueChange={v => setPlatformFilter(v as PlatformFilter)}>
              <SelectTrigger className="w-44 sm:w-48 h-7 text-xs"><SelectValue /></SelectTrigger>
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

      {/* ── Weekly Scorecard ── */}
      <div className="glass-card rounded-lg p-3 sm:p-5">
        <h3 className="text-sm font-semibold mb-3">Weekly Scorecard</h3>
        {scorecardLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-md" />)}
          </div>
        ) : scorecardRows.length > 0 ? (
          <div className="overflow-x-auto -mx-3 sm:mx-0">
            <table className="w-full text-xs min-w-[500px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-1.5 px-2 font-medium text-muted-foreground">Metric</th>
                  <th className="text-right py-1.5 px-2 font-medium text-muted-foreground">This Week</th>
                  <th className="text-right py-1.5 px-2 font-medium text-muted-foreground">Last Week</th>
                  <th className="text-right py-1.5 px-2 font-medium text-muted-foreground">Delta</th>
                  <th className="text-right py-1.5 px-2 font-medium text-muted-foreground">Target</th>
                </tr>
              </thead>
              <tbody>
                {scorecardRows.map(row => {
                  const deltaAbs = Math.abs(row.delta);
                  const deltaStr = row.format === 'pct' ? `${deltaAbs.toFixed(1)}%` : row.format === 'decimal' ? deltaAbs.toFixed(2) : String(deltaAbs);
                  const atTarget = row.target !== null && (row.invert ? Number(row.thisWeek) <= row.target : Number(row.thisWeek) >= row.target);
                  const trendingWrong = row.target !== null && !atTarget && !row.improving;
                  return (
                    <tr key={row.label} className="border-b border-border/50">
                      <td className="py-1.5 px-2 font-medium">{row.label}</td>
                      <td className="text-right py-1.5 px-2 font-semibold">{row.thisWeek}</td>
                      <td className="text-right py-1.5 px-2 text-muted-foreground">{row.lastWeek}</td>
                      <td className="text-right py-1.5 px-2">
                        {Math.abs(row.delta) < 0.005 ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <span className={row.improving ? 'text-[hsl(var(--success))]' : 'text-destructive'}>
                            {row.improving ? (row.invert ? '↓' : '↑') : (row.invert ? '↑' : '↓')} {deltaStr}
                          </span>
                        )}
                      </td>
                      <td className="text-right py-1.5 px-2">
                        {row.target !== null ? (
                          <span className="inline-flex items-center gap-1">
                            {row.target}
                            {atTarget ? <CheckCircle2 className="h-3 w-3 text-[hsl(var(--success))]" /> : trendingWrong ? <TriangleAlert className="h-3 w-3 text-destructive" /> : null}
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      {/* ── Unreplied Alert Banner ── */}
      {unrepliedCount != null && unrepliedCount > 0 && (
        <Alert variant="destructive" className="border-destructive/50 bg-destructive/5">
          <TriangleAlert className="h-4 w-4" />
          <AlertDescription className="flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="text-sm">
              <strong>{unrepliedCount}</strong> review{unrepliedCount > 1 ? 's' : ''} below 4 stars in the last 30 days {unrepliedCount > 1 ? 'have' : 'has'} no reply
            </span>
            <Button variant="outline" size="sm" className="h-6 text-xs w-fit" onClick={scrollToLowReviews}>
              View unreplied →
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* ── KPI Cards with WoW comparison ── */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KPICard
            title="Average Rating"
            value={kpis.avg > 0 ? kpis.avg.toFixed(2) : '—'}
            icon={Star}
            subtitle={priorKpis.avg > 0 ? <DeltaArrow current={kpis.avg} previous={priorKpis.avg} /> : 'out of 5.0'}
            accent
          />
          <KPICard
            title="Total Reviews"
            value={kpis.total.toLocaleString()}
            icon={MessageSquare}
            subtitle={priorKpis.total > 0 ? <DeltaArrow current={kpis.total} previous={priorKpis.total} /> : `${kpis.withRating.toLocaleString()} with rating`}
          />
          <KPICard
            title="5-Star %"
            value={kpis.withRating > 0 ? `${kpis.fiveStarPct}%` : '—'}
            icon={ThumbsUp}
            subtitle={priorKpis.fiveStarPct > 0 ? <DeltaArrow current={kpis.fiveStarPct} previous={priorKpis.fiveStarPct} /> : 'of rated reviews'}
          />
          <KPICard
            title="Properties < 4.0"
            value={kpis.below4Props}
            icon={AlertTriangle}
            subtitle={priorKpis.below4Props > 0 ? <DeltaArrow current={kpis.below4Props} previous={priorKpis.below4Props} invert /> : 'need attention'}
          />
        </div>
      )}

      {/* ── Rating Trend + Sub-Rating Breakdown ── */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="glass-card rounded-lg p-4 sm:p-5">
          <h3 className="text-sm font-semibold mb-4">Rating Trend</h3>
          {isLoading ? <ChartSkeleton /> : ratingTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={ratingTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} interval={ratingTrend.length > 24 ? 3 : ratingTrend.length > 12 ? 1 : 0} />
                <YAxis yAxisId="rating" domain={[3.5, 5]} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis yAxisId="count" orientation="right" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} hide />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number, name: string) => [name === 'Reviews' ? v : v.toFixed(2), name]} />
                <ReferenceLine yAxisId="rating" y={4.8} stroke="hsl(var(--success))" strokeDasharray="6 3" strokeWidth={1.5} label={{ value: '4.8 target', position: 'insideTopRight', fontSize: 10, fill: 'hsl(var(--success))' }} />
                <Bar yAxisId="count" dataKey="count" fill="hsl(var(--muted))" name="Reviews" radius={[2, 2, 0, 0]} />
                <Line yAxisId="rating" type="monotone" dataKey="avg" stroke="hsl(var(--primary))" strokeWidth={2} name="Avg Rating" dot={{ r: 3 }} />
                <Line yAxisId="rating" type="monotone" dataKey="cleanAvg" stroke="hsl(var(--warning))" strokeWidth={1.5} strokeDasharray="4 3" name="Cleanliness" dot={false} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs text-muted-foreground h-[280px] flex items-center justify-center">No rated reviews in this period</p>
          )}
        </div>

        <div className="glass-card rounded-lg p-4 sm:p-5">
          <h3 className="text-sm font-semibold mb-1">Sub-Rating Breakdown</h3>
          <p className="text-xs text-muted-foreground mb-4">
            {subRatings ? `Based on ${subRatings.totalSubRated.toLocaleString()} reviews with sub-ratings` : 'Loading...'}
          </p>
          {isLoading ? <ChartSkeleton /> : subRatings ? (
            <ResponsiveContainer width="100%" height={250}>
              <RadarChart cx="50%" cy="50%" outerRadius="75%" data={subRatings.data}>
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <PolarRadiusAxis domain={[3.5, 5]} tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} />
                <Radar name="Avg" dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.15} strokeWidth={2} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => v.toFixed(2)} />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs text-muted-foreground h-[250px] flex items-center justify-center">No sub-rating data available</p>
          )}
        </div>
      </div>

      {/* ── Recent Low Reviews ── */}
      <div ref={lowReviewsRef} className="glass-card rounded-lg p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <h3 className="text-sm font-semibold">Recent Low Reviews (Below 4 Stars)</h3>
          <div className="flex items-center gap-1 bg-muted rounded-md p-0.5">
            {([['all', 'All'], ['needs_reply', 'Needs Reply'], ['replied', 'Replied']] as const).map(([val, label]) => (
              <Button key={val} variant={lowReviewFilter === val ? 'default' : 'ghost'} size="sm" className="h-6 px-2 text-[10px]" onClick={() => setLowReviewFilter(val)}>
                {label}
              </Button>
            ))}
          </div>
        </div>
        {lowLoading ? (
          <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)}</div>
        ) : filteredLowReviews.length > 0 ? (
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {filteredLowReviews.map(r => {
              const cleanerName = attributionMap?.[r.id];
              return (
                <div key={r.id} className="border border-border rounded-lg p-3 sm:p-4 space-y-2 bg-destructive/5">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold">{propRegistry?.[r.listing_id]?.name || r.listing_id?.slice(0, 12) || 'Unknown'}</span>
                      <Badge className={`text-[9px] px-1.5 py-0 ${platformColor(r.platform)}`}>{platformDisplay(r.platform)}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <StarDisplay rating={r.rating || 0} />
                      <span className="text-xs text-muted-foreground">
                        {r.created_at ? formatDistanceToNow(new Date(r.created_at), { addSuffix: true }) : ''}
                      </span>
                    </div>
                  </div>
                  {/* Sub-rating pills */}
                  {(r.cleanliness_rating || r.checkin_rating || r.value_rating || r.accuracy_rating || r.communication_rating) && (
                    <div className="flex flex-wrap gap-1">
                      {r.cleanliness_rating && <Badge variant="outline" className="text-[9px] px-1 py-0">Clean: {r.cleanliness_rating}</Badge>}
                      {r.checkin_rating && <Badge variant="outline" className="text-[9px] px-1 py-0">Check-in: {r.checkin_rating}</Badge>}
                      {r.accuracy_rating && <Badge variant="outline" className="text-[9px] px-1 py-0">Accuracy: {r.accuracy_rating}</Badge>}
                      {r.communication_rating && <Badge variant="outline" className="text-[9px] px-1 py-0">Comms: {r.communication_rating}</Badge>}
                      {r.value_rating && <Badge variant="outline" className="text-[9px] px-1 py-0">Value: {r.value_rating}</Badge>}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground leading-relaxed">
                    {renderComment(r.comment)}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap text-[10px]">
                    <span className="text-muted-foreground">by {r.reviewer_name || 'Guest'}</span>
                    {cleanerName && (
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0">Cleaned by: {cleanerName}</Badge>
                    )}
                    <span className="flex-1" />
                    {r.reply ? (
                      <span className="inline-flex items-center gap-1 text-[hsl(var(--success))]">
                        <CheckCircle2 className="h-3 w-3" /> Replied
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-destructive">
                        <XCircle className="h-3 w-3" /> No reply
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <CheckCircle2 className="h-8 w-8 text-[hsl(var(--success))]" />
            <p className="text-sm font-medium text-[hsl(var(--success))]">
              {lowReviewFilter === 'needs_reply' ? 'All low reviews have been replied to!' : 'No reviews below 4 stars — great work!'}
            </p>
          </div>
        )}
      </div>

      {/* ── Quality Correlation + Cleaner Quality ── */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Scatter */}
        <div className="glass-card rounded-lg p-4 sm:p-5">
          <h3 className="text-sm font-semibold mb-1">Quality Correlation</h3>
          <p className="text-xs text-muted-foreground mb-4">Avg clean time vs guest rating (min 3 reviews, capped at 240 min)</p>
          {correlationLoading ? <ChartSkeleton /> : scatterData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={300}>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" dataKey="avgCleanMinutes" name="Clean Time" domain={[0, 240]}
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    label={{ value: 'Avg Clean Time (min)', position: 'insideBottom', offset: -5, fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis type="number" dataKey="avgRating" name="Rating" domain={[3, 5]}
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    label={{ value: 'Avg Rating', angle: -90, position: 'insideLeft', fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <Tooltip
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
                    {scatterData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
              <div className="flex items-center gap-4 mt-2 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-destructive" /> &lt; 4.0</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary" /> 4.0–4.79</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[hsl(var(--success))]" /> ≥ 4.8</span>
              </div>
            </>
          ) : (
            <p className="text-xs text-muted-foreground h-[300px] flex items-center justify-center">No correlation data available</p>
          )}
        </div>

        {/* Cleaner Quality */}
        <div className="glass-card rounded-lg p-4 sm:p-5">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-semibold">Cleaner Quality Score</h3>
            <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => setCleanerSortAsc(!cleanerSortAsc)}>
              {cleanerSortAsc ? 'Worst First' : 'Top Performers'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mb-4">Attributed reviews, min 3 — sorted {cleanerSortAsc ? 'worst first' : 'best first'}</p>
          {cleanerLoading ? <TableSkeleton rows={6} /> : sortedCleaners.length > 0 ? (
            <>
              <div className="overflow-auto max-h-[300px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Cleaner</TableHead>
                      <TableHead className="text-xs text-right">Avg Rating</TableHead>
                      <TableHead className="text-xs text-right hidden sm:table-cell">Cleanliness</TableHead>
                      <TableHead className="text-xs text-right hidden sm:table-cell">Below 4</TableHead>
                      <TableHead className="text-xs text-right hidden md:table-cell">Properties</TableHead>
                      <TableHead className="text-xs text-right">Reviews</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedCleaners.slice(0, 30).map(c => (
                      <TableRow key={c.name} className={cleanerRowColor(c)}>
                        <TableCell className="text-xs font-medium py-1.5 max-w-[120px] truncate">{c.name}</TableCell>
                        <TableCell className={`text-xs text-right py-1.5 ${c.avgRating ? ratingColor(c.avgRating) : ''}`}>
                          {c.avgRating?.toFixed(2) ?? '—'}
                        </TableCell>
                        <TableCell className={`text-xs text-right py-1.5 hidden sm:table-cell ${c.avgCleanliness ? ratingColor(c.avgCleanliness) : 'text-muted-foreground'}`}>
                          {c.avgCleanliness?.toFixed(2) ?? '—'}
                        </TableCell>
                        <TableCell className={`text-xs text-right py-1.5 hidden sm:table-cell ${c.below4 > 0 ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                          {c.below4}
                        </TableCell>
                        <TableCell className="text-xs text-right py-1.5 hidden md:table-cell text-muted-foreground">{c.properties}</TableCell>
                        <TableCell className="text-xs text-right py-1.5 text-muted-foreground">{c.reviews}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <p className="text-[10px] text-muted-foreground mt-3 pt-2 border-t border-border">
                {cleanerData!.attributedReviews.toLocaleString()} of {cleanerData!.totalReviews.toLocaleString()} reviews attributed to departure cleaners ({cleanerData!.totalReviews > 0 ? Math.round((cleanerData!.attributedReviews / cleanerData!.totalReviews) * 100) : 0}%)
              </p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground h-[200px] flex items-center justify-center">No attributed cleaner data in this period</p>
          )}
        </div>
      </div>

      {/* ── Property Ratings Table ── */}
      <div className="glass-card rounded-lg p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
          <h3 className="text-sm font-semibold">Property Ratings ({sortedProps.length} properties)</h3>
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
                  <TableHead className="text-xs text-right cursor-pointer select-none hidden lg:table-cell" onClick={() => handlePropSort('owner')}>Owner{si('owner')}</TableHead>
                  <TableHead className="text-xs text-right cursor-pointer select-none" onClick={() => handlePropSort('avg_rating')}>Avg Rating{si('avg_rating')}</TableHead>
                  <TableHead className="text-xs text-right w-12">Trend</TableHead>
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
                    <TableCell className="text-xs font-medium py-2 max-w-[160px] truncate">{p.name}</TableCell>
                    <TableCell className="text-xs text-right py-2 hidden lg:table-cell text-muted-foreground max-w-[100px] truncate">{p.ownerName || '—'}</TableCell>
                    <TableCell className={`text-xs text-right py-2 ${ratingColor(p.avg_rating)}`}>{p.avg_rating.toFixed(2)}</TableCell>
                    <TableCell className="text-xs text-right py-2">
                      {p.prior_avg ? <DeltaArrow current={p.avg_rating} previous={p.prior_avg} /> : <span className="text-muted-foreground">—</span>}
                    </TableCell>
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

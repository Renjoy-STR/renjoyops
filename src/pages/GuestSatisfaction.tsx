import { useState, useMemo, useRef } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import {
  useAllReviews, useAllReviewsForTrend, usePropertyRegistryMap, useLowReviews,
  useCleanerQuality, useQualityCorrelation, use6WeekScorecard,
  useUnrepliedCount, useReviewAttribution, useLatestReviewDate, WeekBucket,
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
import { useDateRange } from '@/contexts/DateRangeContext';

const tooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
  fontSize: 13,
  color: 'hsl(var(--foreground))',
};

type PlatformFilter = 'all' | 'airbnb2' | 'homeaway2' | 'bookingCom';
type PropSortKey = 'name' | 'avg_rating' | 'count' | 'cleanliness' | 'below_4' | 'latest';
type LowReviewFilter = 'all' | 'needs_reply' | 'replied';

const PLATFORM_LABELS: Record<string, string> = { airbnb2: 'Airbnb', homeaway2: 'VRBO', bookingCom: 'Booking.com' };
const OTA_COLORS: Record<string, string> = { Airbnb: '#F04C3B', VRBO: '#3B82F6', 'Booking.com': '#1E3A5F', Other: '#6B7280' };

function platformDisplay(raw: string | null): string {
  return raw ? PLATFORM_LABELS[raw] || raw : 'Unknown';
}

function platformColor(raw: string | null): string {
  if (raw === 'airbnb2') return 'bg-[hsl(5,87%,55%)] text-white';
  if (raw === 'homeaway2') return 'bg-[hsl(217,91%,60%)] text-white';
  if (raw === 'bookingCom') return 'bg-[hsl(216,54%,24%)] text-white';
  return 'bg-muted text-muted-foreground';
}

function platformDotColor(raw: string): string {
  if (raw === 'airbnb2') return 'bg-primary';
  if (raw === 'homeaway2') return 'bg-[hsl(217,91%,60%)]';
  if (raw === 'bookingCom') return 'bg-[hsl(216,54%,24%)]';
  return 'bg-muted-foreground';
}

function renderComment(raw: string | null | undefined) {
  if (!raw) return <em className="text-muted-foreground">No comment</em>;
  const trimmed = raw.trim();
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed === 'object' && parsed !== null) {
        const parts: React.ReactNode[] = [];
        if (parsed.headline) parts.push(<span key="h" className="font-semibold block mb-1">{parsed.headline}</span>);
        if (parsed.negative) parts.push(<span key="neg" className="flex items-start gap-1.5"><span className="text-destructive font-bold shrink-0">−</span><span>{parsed.negative}</span></span>);
        if (parsed.negative && parsed.positive) parts.push(<span key="div" className="block border-t border-border my-1" />);
        if (parsed.positive) parts.push(<span key="pos" className="flex items-start gap-1.5"><span className="text-[hsl(var(--success))] font-bold shrink-0">+</span><span>{parsed.positive}</span></span>);
        if (parts.length > 0) return <div className="space-y-0.5">{parts}</div>;
        if (parsed.value) return <span>{String(parsed.value)}</span>;
      }
    } catch { /* not valid JSON */ }
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
  if (Math.abs(delta) < 0.005) return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
  const improving = invert ? delta < 0 : delta > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 font-bold ${improving ? 'text-[hsl(142,76%,36%)]' : 'text-primary'}`} style={{ fontSize: '15px' }}>
      {improving ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
      {Math.abs(delta) < 1 ? Math.abs(delta).toFixed(2) : Math.abs(Math.round(delta))}
    </span>
  );
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
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all');
  const [propSortKey, setPropSortKey] = useState<PropSortKey>('avg_rating');
  const [propSortDir, setPropSortDir] = useState<'asc' | 'desc'>('asc');
  const [lowReviewFilter, setLowReviewFilter] = useState<LowReviewFilter>('needs_reply');
  const [cleanerSortAsc, setCleanerSortAsc] = useState(true);

  const lowReviewsRef = useRef<HTMLDivElement>(null);

  const { formatForQuery } = useDateRange();
  const { from, to } = formatForQuery();
  const priorRange = getPriorRange(from, to);

  // Data hooks
  const { data: reviews, isLoading } = useAllReviews(from, to, platformFilter);
  const { data: priorReviews } = useAllReviews(priorRange.from, priorRange.to, platformFilter);
  const { data: trendReviews, isLoading: trendLoading } = useAllReviewsForTrend(from);
  const { data: propRegistry } = usePropertyRegistryMap();
  const { data: lowReviews, isLoading: lowLoading } = useLowReviews(from, to, platformFilter);
  const { data: cleanerData, isLoading: cleanerLoading } = useCleanerQuality(from, to);
  const { data: correlation, isLoading: correlationLoading } = useQualityCorrelation(from, to);
  const { data: weeklyData, isLoading: weeklyLoading } = use6WeekScorecard();
  const { data: unrepliedCount } = useUnrepliedCount();
  const { data: attributionMap } = useReviewAttribution(from, to);
  const { data: latestReviewDate } = useLatestReviewDate();

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

  // ── Rating Trend (monthly) with stacked OTA bars ──
  const ratingTrend = useMemo(() => {
    if (!trendReviews?.length) return [];
    const now = new Date();
    const currentMonth = format(now, 'yyyy-MM');
    const months: Record<string, { sum: number; count: number; cleanSum: number; cleanCount: number; airbnb: number; vrbo: number; bookingCom: number; other: number }> = {};
    trendReviews.forEach(r => {
      if (!r.created_at || r.rating == null) return;
      const m = r.created_at.slice(0, 7);
      if (!months[m]) months[m] = { sum: 0, count: 0, cleanSum: 0, cleanCount: 0, airbnb: 0, vrbo: 0, bookingCom: 0, other: 0 };
      months[m].sum += r.rating;
      months[m].count += 1;
      if (r.cleanliness_rating) { months[m].cleanSum += r.cleanliness_rating; months[m].cleanCount++; }
      if (r.platform === 'airbnb2') months[m].airbnb++;
      else if (r.platform === 'homeaway2') months[m].vrbo++;
      else if (r.platform === 'bookingCom') months[m].bookingCom++;
      else months[m].other++;
    });
    return Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({
        month,
        label: month === currentMonth
          ? format(new Date(month + '-01'), 'MMM yy') + '*'
          : format(new Date(month + '-01'), 'MMM yy'),
        avg: Math.round((v.sum / v.count) * 100) / 100,
        cleanAvg: v.cleanCount > 0 ? Math.round((v.cleanSum / v.cleanCount) * 100) / 100 : null,
        total: v.count,
        Airbnb: v.airbnb,
        VRBO: v.vrbo,
        'Booking.com': v.bookingCom,
        Other: v.other,
        isPartial: month === currentMonth,
      }));
  }, [trendReviews]);

  // ── Sub-rating breakdown with prior period comparison ──
  const calcSubRatings = (data: any[] | undefined) => {
    if (!data?.length) return null;
    const sums = { cleanliness: 0, accuracy: 0, communication: 0, location: 0, checkin: 0, value: 0 };
    const counts = { cleanliness: 0, accuracy: 0, communication: 0, location: 0, checkin: 0, value: 0 };
    data.forEach(r => {
      if (r.cleanliness_rating) { sums.cleanliness += r.cleanliness_rating; counts.cleanliness++; }
      if (r.accuracy_rating) { sums.accuracy += r.accuracy_rating; counts.accuracy++; }
      if (r.communication_rating) { sums.communication += r.communication_rating; counts.communication++; }
      if (r.location_rating) { sums.location += r.location_rating; counts.location++; }
      if (r.checkin_rating) { sums.checkin += r.checkin_rating; counts.checkin++; }
      if (r.value_rating) { sums.value += r.value_rating; counts.value++; }
    });
    const totalSubRated = Math.max(counts.cleanliness, counts.accuracy);
    if (totalSubRated === 0) return null;
    const avg = (key: keyof typeof sums) => counts[key] > 0 ? Math.round((sums[key] / counts[key]) * 100) / 100 : 0;
    return {
      data: [
        { subject: 'Cleanliness', value: avg('cleanliness') },
        { subject: 'Accuracy', value: avg('accuracy') },
        { subject: 'Communication', value: avg('communication') },
        { subject: 'Location', value: avg('location') },
        { subject: 'Check-in', value: avg('checkin') },
        { subject: 'Value', value: avg('value') },
      ],
      totalSubRated,
    };
  };

  const subRatings = useMemo(() => calcSubRatings(reviews), [reviews]);
  const priorSubRatings = useMemo(() => calcSubRatings(priorReviews), [priorReviews]);

  const radarData = useMemo(() => {
    if (!subRatings) return [];
    return subRatings.data.map(d => {
      const prior = priorSubRatings?.data.find(p => p.subject === d.subject);
      return { ...d, prior: prior?.value ?? 0 };
    });
  }, [subRatings, priorSubRatings]);

  // ── Property ratings table ──
  const propertyRatings = useMemo(() => {
    if (!reviews?.length) return [];
    const byProp: Record<string, { ratings: number[]; cleanliness: number[]; fiveStar: number; below4: number; latest: string; latestComment: string | null; platforms: Set<string> }> = {};
    reviews.forEach(r => {
      if (!r.listing_id || r.rating == null) return;
      if (!byProp[r.listing_id]) byProp[r.listing_id] = { ratings: [], cleanliness: [], fiveStar: 0, below4: 0, latest: '', latestComment: null, platforms: new Set() };
      byProp[r.listing_id].ratings.push(r.rating);
      if (r.cleanliness_rating) byProp[r.listing_id].cleanliness.push(r.cleanliness_rating);
      if (r.rating === 5) byProp[r.listing_id].fiveStar++;
      if (r.rating < 4) byProp[r.listing_id].below4++;
      if (r.platform) byProp[r.listing_id].platforms.add(r.platform);
      if ((r.created_at || '') > byProp[r.listing_id].latest) {
        byProp[r.listing_id].latest = r.created_at || '';
        byProp[r.listing_id].latestComment = r.comment;
      }
    });

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
        let commentPreview: string | null = null;
        if (d.latestComment) {
          const trimmed = d.latestComment.trim();
          if (trimmed.startsWith('{')) {
            try {
              const p = JSON.parse(trimmed);
              commentPreview = p.negative || p.positive || p.headline || null;
            } catch { commentPreview = trimmed; }
          } else {
            commentPreview = trimmed;
          }
          if (commentPreview && commentPreview.length > 60) commentPreview = commentPreview.slice(0, 60) + '...';
        }
        return {
          listing_id: lid,
          name: propRegistry?.[lid]?.name || lid.slice(0, 12),
          avg_rating: Math.round(avg * 100) / 100,
          prior_avg: priorAvg ? Math.round(priorAvg * 100) / 100 : null,
          count: d.ratings.length,
          avg_cleanliness: avgClean ? Math.round(avgClean * 100) / 100 : null,
          five_star: d.fiveStar,
          below_4: d.below4,
          latest: d.latest.slice(0, 10),
          latestComment: commentPreview,
          platforms: Array.from(d.platforms),
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
      fill: c.avgRating < 4.0 ? 'hsl(var(--destructive))' : c.avgRating >= 4.8 ? 'hsl(142,76%,36%)' : 'hsl(var(--primary))',
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

  // ── 6-Week Scorecard Helpers ──
  const scorecardMetrics = [
    { key: 'avg', label: 'Avg Rating', target: 4.8, format: 'decimal', invert: false },
    { key: 'count', label: 'Reviews', target: null, format: 'int', invert: false },
    { key: 'below4', label: 'Below 4 Stars', target: 0, format: 'int', invert: true },
    { key: 'fiveStarPct', label: '5-Star %', target: 85, format: 'pct', invert: false },
    { key: 'unrepliedLow', label: 'Unreplied Low', target: 0, format: 'int', invert: true },
    { key: 'avgCleanliness', label: 'Cleanliness', target: 4.8, format: 'decimal', invert: false },
  ] as const;

  function getMetricValue(w: WeekBucket, key: string): number {
    return (w as any)[key] ?? 0;
  }

  function formatMetricValue(val: number, fmt: string): string {
    if (fmt === 'decimal') return val > 0 ? val.toFixed(2) : '—';
    if (fmt === 'pct') return val > 0 ? `${val}%` : '—';
    return String(val);
  }

  function scorecardCellStyle(val: number, allVals: number[], metric: typeof scorecardMetrics[number], isNewest: boolean): string {
    const classes: string[] = ['text-right py-3.5 px-3'];
    if (isNewest) classes.push('font-bold');
    
    // Target color
    if (metric.target !== null) {
      const atTarget = metric.invert ? val <= metric.target : val >= metric.target;
      if (atTarget) classes.push('text-[hsl(142,76%,36%)]');
      else classes.push('text-destructive');
    }
    
    // Best/worst background
    if (allVals.length > 1) {
      const sorted = [...allVals].sort((a, b) => a - b);
      const best = metric.invert ? sorted[0] : sorted[sorted.length - 1];
      const worst = metric.invert ? sorted[sorted.length - 1] : sorted[0];
      if (val === best && allVals.filter(v => v === best).length === 1) classes.push('bg-[hsl(var(--success))]/10');
      else if (val === worst && allVals.filter(v => v === worst).length === 1) classes.push('bg-destructive/5');
    }
    
    return classes.join(' ');
  }

  function targetCell(target: number | null, metric: typeof scorecardMetrics[number], weeks: WeekBucket[]): React.ReactNode {
    if (target === null) return <span className="text-muted-foreground">—</span>;
    const newest = weeks[0];
    if (!newest) return String(target);
    const val = getMetricValue(newest, metric.key);
    const atTarget = metric.invert ? val <= target : val >= target;
    const pctOff = target > 0 ? Math.abs(val - target) / target : Math.abs(val - target);
    if (atTarget) return <span className="inline-flex items-center gap-1 text-[hsl(142,76%,36%)]"><CheckCircle2 className="h-3.5 w-3.5" /> {metric.format === 'pct' ? `${target}%` : target}</span>;
    if (pctOff <= 0.05) return <span className="inline-flex items-center gap-1 text-[hsl(var(--warning))]"><TriangleAlert className="h-3.5 w-3.5" /> {metric.format === 'pct' ? `${target}%` : target}</span>;
    return <span className="inline-flex items-center gap-1 text-destructive"><XCircle className="h-3.5 w-3.5" /> {metric.format === 'pct' ? `${target}%` : target}</span>;
  }

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-page-title">Guest Satisfaction</h1>
          <p className="text-sm text-muted-foreground mt-1">Weekly L10 review dashboard</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {latestReviewDate && (
            <span className="text-xs text-muted-foreground italic">
              Latest review: {format(new Date(latestReviewDate), 'MMM d, yyyy')}
            </span>
          )}
          <div className="flex items-center gap-1">
            <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
            <Select value={platformFilter} onValueChange={v => setPlatformFilter(v as PlatformFilter)}>
              <SelectTrigger className="w-44 sm:w-48 h-8 text-sm"><SelectValue /></SelectTrigger>
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

      {/* 1. 6-Week Rolling Scorecard */}
      <div className="glass-card rounded-xl p-4 sm:p-6 border-l-4 border-l-primary" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <h3 className="text-section-header mb-4">6-Week Rolling Scorecard</h3>
        {weeklyLoading ? (
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-md" />)}
          </div>
        ) : weeklyData && weeklyData.length > 0 ? (
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full min-w-[700px]" style={{ fontSize: '16px' }}>
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-3 font-semibold text-muted-foreground" style={{ fontSize: '14px' }}>Metric</th>
                  {weeklyData.map((w, i) => (
                    <th key={w.weekStart} className={`text-right py-3 px-3 ${i === 0 ? 'text-foreground font-bold' : 'font-semibold text-muted-foreground'}`} style={{ fontSize: '14px' }}>
                      {w.label}{w.count < 7 && i === 0 ? '*' : ''}
                    </th>
                  ))}
                  <th className="text-right py-3 px-3 font-semibold text-muted-foreground bg-muted/50" style={{ fontSize: '14px' }}>Target</th>
                </tr>
              </thead>
              <tbody>
                {scorecardMetrics.map(metric => {
                  const allVals = weeklyData.map(w => getMetricValue(w, metric.key));
                  return (
                    <tr key={metric.key} className="border-b border-border/50">
                      <td className="py-3.5 px-3 font-semibold" style={{ fontSize: '14px' }}>{metric.label}</td>
                      {weeklyData.map((w, i) => {
                        const val = getMetricValue(w, metric.key);
                        return (
                          <td key={w.weekStart} className={scorecardCellStyle(val, allVals, metric, i === 0)} style={{ fontSize: '16px' }}>
                            {formatMetricValue(val, metric.format)}
                          </td>
                        );
                      })}
                      <td className="text-right py-3.5 px-3 bg-muted/50" style={{ fontSize: '14px' }}>
                        {targetCell(metric.target, metric, weeklyData)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      {/* 2. Unreplied Alert Banner */}
      {unrepliedCount != null && unrepliedCount > 0 && (
        <Alert variant="destructive" className="border-l-4 border-l-primary bg-[hsl(0,85%,97%)] dark:bg-destructive/10 rounded-xl" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <TriangleAlert className="h-5 w-5" />
          <AlertDescription className="flex flex-col sm:flex-row sm:items-center gap-2" style={{ fontSize: '15px' }}>
            <span className="font-medium">
              <strong>{unrepliedCount}</strong> review{unrepliedCount > 1 ? 's' : ''} below 4 stars in the last 30 days {unrepliedCount > 1 ? 'have' : 'has'} no reply
            </span>
            <Button variant="outline" size="sm" className="h-7 text-xs w-fit" onClick={scrollToLowReviews}>View unreplied →</Button>
          </AlertDescription>
        </Alert>
      )}

      {/* 3. KPI Cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="glass-card rounded-xl p-5 sm:p-7" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Average Rating</p>
            <p className="text-4xl font-bold tracking-tight mt-1">{kpis.avg > 0 ? kpis.avg.toFixed(2) : '—'}</p>
            <div className="mt-1" style={{ fontSize: '15px' }}>{priorKpis.avg > 0 ? <DeltaArrow current={kpis.avg} previous={priorKpis.avg} /> : <span className="text-muted-foreground text-sm">out of 5.0</span>}</div>
            <p className="text-muted-foreground italic mt-1" style={{ fontSize: '12px' }}>All ratings on 5-point scale (Guesty shows 10-point)</p>
          </div>
          <div className="glass-card rounded-xl p-5 sm:p-7" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Total Reviews</p>
            <p className="text-4xl font-bold tracking-tight mt-1">{kpis.total.toLocaleString()}</p>
            <div className="mt-1" style={{ fontSize: '15px' }}>{priorKpis.total > 0 ? <DeltaArrow current={kpis.total} previous={priorKpis.total} /> : <span className="text-muted-foreground text-sm">{kpis.withRating.toLocaleString()} with rating</span>}</div>
          </div>
          <div className="glass-card rounded-xl p-5 sm:p-7" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">5-Star %</p>
            <p className="text-4xl font-bold tracking-tight mt-1">{kpis.withRating > 0 ? `${kpis.fiveStarPct}%` : '—'}</p>
            <div className="mt-1" style={{ fontSize: '15px' }}>{priorKpis.fiveStarPct > 0 ? <DeltaArrow current={kpis.fiveStarPct} previous={priorKpis.fiveStarPct} /> : <span className="text-muted-foreground text-sm">of rated reviews</span>}</div>
          </div>
          <div className="glass-card rounded-xl p-5 sm:p-7" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Properties &lt; 4.0</p>
            <p className="text-4xl font-bold tracking-tight mt-1">{kpis.below4Props}</p>
            <div className="mt-1" style={{ fontSize: '15px' }}>{priorKpis.below4Props > 0 ? <DeltaArrow current={kpis.below4Props} previous={priorKpis.below4Props} invert /> : <span className="text-muted-foreground text-sm">need attention</span>}</div>
          </div>
        </div>
      )}

      {/* 4. Rating Trend + Sub-Rating Breakdown */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="glass-card rounded-xl p-5 sm:p-6" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <h3 className="text-section-header mb-1">Rating Trend</h3>
          <p className="text-xs text-muted-foreground mb-4">Monthly avg rating with OTA review volume &nbsp; * = partial month</p>
          {trendLoading ? <ChartSkeleton /> : ratingTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={ratingTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 13, fill: 'hsl(var(--muted-foreground))' }} interval={ratingTrend.length > 24 ? 3 : ratingTrend.length > 12 ? 1 : 0} />
                <YAxis yAxisId="rating" domain={[3.5, 5]} tick={{ fontSize: 13, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis yAxisId="count" orientation="right" tick={{ fontSize: 13, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v: number, name: string) => {
                    if (name === 'Avg Rating' || name === 'Cleanliness') return [v.toFixed(2), name];
                    return [v, name];
                  }}
                  labelFormatter={(label, payload) => {
                    const item = payload?.[0]?.payload;
                    return item?.isPartial ? `${label.replace('*', '')} (partial)` : label;
                  }}
                />
                <ReferenceLine yAxisId="rating" y={4.8} stroke="hsl(142,76%,36%)" strokeDasharray="6 3" strokeWidth={2} strokeOpacity={0.6} label={{ value: '4.8 target', position: 'insideTopRight', fontSize: 11, fill: 'hsl(142,76%,36%)' }} />
                {/* Stacked OTA bars — 60% opacity for TV visibility */}
                <Bar yAxisId="count" dataKey="Airbnb" stackId="ota" fill={OTA_COLORS.Airbnb} fillOpacity={0.6} radius={[0, 0, 0, 0]} />
                <Bar yAxisId="count" dataKey="VRBO" stackId="ota" fill={OTA_COLORS.VRBO} fillOpacity={0.6} />
                <Bar yAxisId="count" dataKey="Booking.com" stackId="ota" fill={OTA_COLORS['Booking.com']} fillOpacity={0.6} radius={[2, 2, 0, 0]} />
                {/* Rating lines */}
                <Line yAxisId="rating" type="monotone" dataKey="avg" stroke="hsl(var(--primary))" strokeWidth={2.5} name="Avg Rating" dot={{ r: 3 }} />
                <Line yAxisId="rating" type="monotone" dataKey="cleanAvg" stroke="hsl(var(--secondary))" strokeWidth={1.5} strokeDasharray="4 3" name="Cleanliness" dot={false} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground h-[320px] flex items-center justify-center">No rated reviews in this period</p>
          )}
          {ratingTrend.length > 0 && (
            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground flex-wrap" style={{ fontSize: '13px' }}>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: OTA_COLORS.Airbnb }} /> Airbnb</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: OTA_COLORS.VRBO }} /> VRBO</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: OTA_COLORS['Booking.com'] }} /> Booking.com</span>
              <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-primary" /> Overall</span>
              <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 border-t-2 border-dashed border-secondary" /> Cleanliness</span>
            </div>
          )}
        </div>

        {/* 5. Sub-Rating Breakdown */}
        <div className="glass-card rounded-xl p-5 sm:p-6" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <h3 className="text-section-header mb-1">Sub-Rating Breakdown</h3>
          <p className="text-xs text-muted-foreground mb-3">
            {subRatings ? `Based on ${subRatings.totalSubRated.toLocaleString()} reviews with sub-ratings` : 'Loading...'}
          </p>
          {isLoading ? <ChartSkeleton /> : radarData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={240}>
                <RadarChart cx="50%" cy="50%" outerRadius="65%" data={radarData}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis dataKey="subject" tick={({ x, y, payload, index }: any) => {
                    const val = radarData[index]?.value;
                    return (
                      <g>
                        <text x={x} y={y} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize={12}>{payload.value}</text>
                        {val ? <text x={x} y={y + 15} textAnchor="middle" fill="hsl(var(--foreground))" fontSize={14} fontWeight="700">{val.toFixed(2)}</text> : null}
                      </g>
                    );
                  }} />
                  <PolarRadiusAxis domain={[3.5, 5]} tick={false} axisLine={false} />
                  {priorSubRatings && <Radar name="Prior" dataKey="prior" stroke="hsl(var(--muted-foreground))" fill="hsl(var(--muted-foreground))" fillOpacity={0.08} strokeWidth={1} strokeDasharray="4 3" />}
                  <Radar name="Current" dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.15} strokeWidth={2} />
                </RadarChart>
              </ResponsiveContainer>
              <div className="overflow-x-auto mt-2">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-1.5 px-1 font-medium text-muted-foreground">Category</th>
                      <th className="text-right py-1.5 px-1 font-medium text-muted-foreground">Current</th>
                      <th className="text-right py-1.5 px-1 font-medium text-muted-foreground">Prior</th>
                      <th className="text-right py-1.5 px-1 font-medium text-muted-foreground">Δ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {radarData.map((d, idx) => {
                      const delta = d.value - d.prior;
                      return (
                        <tr key={d.subject} className={`border-b border-border/30 ${idx % 2 === 1 ? 'bg-muted/30' : ''}`}>
                          <td className="py-1.5 px-1">{d.subject}</td>
                          <td className="text-right py-1.5 px-1 font-semibold">{d.value.toFixed(2)}</td>
                          <td className="text-right py-1.5 px-1 text-muted-foreground">{d.prior > 0 ? d.prior.toFixed(2) : '—'}</td>
                          <td className="text-right py-1.5 px-1">
                            {d.prior > 0 && Math.abs(delta) >= 0.005 ? (
                              <span className={`font-bold ${delta > 0 ? 'text-[hsl(142,76%,36%)]' : 'text-primary'}`}>
                                {delta > 0 ? '↑' : '↓'} {Math.abs(delta).toFixed(2)}
                              </span>
                            ) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground h-[220px] flex items-center justify-center">No sub-rating data available</p>
          )}
        </div>
      </div>

      {/* 6. Recent Low Reviews */}
      <div ref={lowReviewsRef} className="glass-card rounded-xl p-5 sm:p-6" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <h3 className="text-section-header">Recent Low Reviews (Below 4 Stars)</h3>
          <div className="flex items-center gap-1 bg-muted rounded-md p-0.5">
            {([['all', 'All'], ['needs_reply', 'Needs Reply'], ['replied', 'Replied']] as const).map(([val, label]) => (
              <Button key={val} variant={lowReviewFilter === val ? 'default' : 'ghost'} size="sm" className="h-7 px-3 text-xs" onClick={() => setLowReviewFilter(val)}>
                {label} {val === 'needs_reply' && lowReviews ? `(${lowReviews.filter(r => !r.reply).length})` : ''}
              </Button>
            ))}
          </div>
        </div>
        {lowLoading ? (
          <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)}</div>
        ) : filteredLowReviews.length > 0 ? (
          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
            {filteredLowReviews.map(r => {
              const attribution = attributionMap?.[r.id];
              return (
                <div key={r.id} className="border border-border rounded-xl p-4 sm:p-5 space-y-2 bg-destructive/5">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold" style={{ fontSize: '16px' }}>{propRegistry?.[r.listing_id]?.name || r.listing_id?.slice(0, 12) || 'Unknown'}</span>
                      <Badge className={`text-[10px] px-1.5 py-0 ${platformColor(r.platform)}`}>{platformDisplay(r.platform)}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <StarDisplay rating={r.rating || 0} />
                      <span className="text-xs text-muted-foreground" style={{ fontSize: '13px' }}>
                        {r.created_at ? formatDistanceToNow(new Date(r.created_at), { addSuffix: true }) : ''}
                      </span>
                    </div>
                  </div>
                  {(r.cleanliness_rating || r.checkin_rating || r.value_rating || r.accuracy_rating || r.communication_rating) && (
                    <div className="flex flex-wrap gap-1">
                      {r.cleanliness_rating && <Badge variant="outline" className="text-[10px] px-1.5 py-0">Clean: {r.cleanliness_rating}</Badge>}
                      {r.checkin_rating && <Badge variant="outline" className="text-[10px] px-1.5 py-0">Check-in: {r.checkin_rating}</Badge>}
                      {r.accuracy_rating && <Badge variant="outline" className="text-[10px] px-1.5 py-0">Accuracy: {r.accuracy_rating}</Badge>}
                      {r.communication_rating && <Badge variant="outline" className="text-[10px] px-1.5 py-0">Comms: {r.communication_rating}</Badge>}
                      {r.value_rating && <Badge variant="outline" className="text-[10px] px-1.5 py-0">Value: {r.value_rating}</Badge>}
                    </div>
                  )}
                  <div className="text-muted-foreground leading-relaxed" style={{ fontSize: '14px' }}>{renderComment(r.comment)}</div>
                  <div className="flex items-center gap-3 flex-wrap" style={{ fontSize: '13px' }}>
                    <span className="text-muted-foreground">by {r.reviewer_name || 'Guest'}</span>
                    {attribution && (
                      <span className="text-muted-foreground">
                        Cleaned by: {attribution.assigneeName}
                        {attribution.cleanCompletedDate ? ` (${format(new Date(attribution.cleanCompletedDate), 'MMM d')})` : ''}
                      </span>
                    )}
                    <span className="flex-1" />
                    {r.reply ? (
                      <span className="inline-flex items-center gap-1 text-[hsl(142,76%,36%)] font-medium"><CheckCircle2 className="h-3.5 w-3.5" /> Replied</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-destructive font-medium"><XCircle className="h-3.5 w-3.5" /> No reply</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <CheckCircle2 className="h-10 w-10 text-[hsl(var(--success))]" />
            <p className="text-base font-medium text-[hsl(var(--success))]">
              {lowReviewFilter === 'needs_reply' ? 'All low reviews have been replied to!' : 'No reviews below 4 stars — great work!'}
            </p>
          </div>
        )}
      </div>

      {/* 7. Cleaner Quality Score */}
      <div className="glass-card rounded-xl p-5 sm:p-6" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-section-header">Cleaner Quality Score</h3>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setCleanerSortAsc(!cleanerSortAsc)}>
            {cleanerSortAsc ? 'Worst First' : 'Top Performers'}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mb-4">Departure/deep clean reviews, min 3 — sorted {cleanerSortAsc ? 'worst first' : 'best first'}</p>
        {cleanerLoading ? <TableSkeleton rows={6} /> : sortedCleaners.length > 0 ? (
          <>
            <div className="overflow-auto max-h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead style={{ fontSize: '14px' }}>Cleaner</TableHead>
                    <TableHead className="text-right" style={{ fontSize: '14px' }}>Avg Rating</TableHead>
                    <TableHead className="text-right hidden sm:table-cell" style={{ fontSize: '14px' }}>Cleanliness</TableHead>
                    <TableHead className="text-right hidden sm:table-cell" style={{ fontSize: '14px' }}>Below 4</TableHead>
                    <TableHead className="text-right hidden md:table-cell" style={{ fontSize: '14px' }}>Properties</TableHead>
                    <TableHead className="text-right" style={{ fontSize: '14px' }}>Reviews</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedCleaners.slice(0, 50).map(c => (
                    <TableRow key={c.name} className={cleanerRowColor(c)} style={{ height: '48px' }}>
                      <TableCell className="font-medium max-w-[160px] truncate" style={{ fontSize: '15px' }}>{c.name}</TableCell>
                      <TableCell className={`text-right ${c.avgRating ? ratingColor(c.avgRating) : ''}`} style={{ fontSize: '15px' }}>{c.avgRating?.toFixed(2) ?? '—'}</TableCell>
                      <TableCell className={`text-right hidden sm:table-cell ${c.avgCleanliness ? ratingColor(c.avgCleanliness) : 'text-muted-foreground'}`} style={{ fontSize: '15px' }}>{c.avgCleanliness?.toFixed(2) ?? '—'}</TableCell>
                      <TableCell className={`text-right hidden sm:table-cell ${c.below4 > 0 ? 'text-destructive font-semibold' : 'text-muted-foreground'}`} style={{ fontSize: '15px' }}>{c.below4}</TableCell>
                      <TableCell className="text-right hidden md:table-cell text-muted-foreground" style={{ fontSize: '15px' }}>{c.properties}</TableCell>
                      <TableCell className="text-right text-muted-foreground" style={{ fontSize: '15px' }}>{c.reviews}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="text-xs text-muted-foreground mt-3 pt-2 border-t border-border" style={{ fontSize: '13px' }}>
              {cleanerData!.attributedReviews.toLocaleString()} of {cleanerData!.totalReviews.toLocaleString()} reviews attributed to departure cleaners ({cleanerData!.totalReviews > 0 ? Math.round((cleanerData!.attributedReviews / cleanerData!.totalReviews) * 100 * 10) / 10 : 0}%)
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground h-[200px] flex items-center justify-center">No attributed cleaner data in this period</p>
        )}
      </div>

      {/* 8. Quality Correlation */}
      <div className="glass-card rounded-xl p-5 sm:p-6" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <h3 className="text-section-header mb-1">Quality Correlation</h3>
        <p className="text-xs text-muted-foreground mb-4">Avg clean time vs guest rating (min 3 reviews, capped at 240 min)</p>
        {correlationLoading ? <ChartSkeleton /> : scatterData.length > 0 ? (
          <>
            <ResponsiveContainer width="100%" height={320}>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" dataKey="avgCleanMinutes" name="Clean Time" domain={[0, 240]}
                  tick={{ fontSize: 13, fill: 'hsl(var(--muted-foreground))' }}
                  label={{ value: 'Avg Clean Time (min)', position: 'insideBottom', offset: -5, fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis type="number" dataKey="avgRating" name="Rating" domain={[3, 5]}
                  tick={{ fontSize: 13, fill: 'hsl(var(--muted-foreground))' }}
                  label={{ value: 'Avg Rating', angle: -90, position: 'insideLeft', fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0]?.payload;
                    if (!d) return null;
                    return (
                      <div style={tooltipStyle} className="p-2.5">
                        <p className="font-semibold text-sm">{d.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Rating: {d.avgRating.toFixed(2)} | Clean: {d.avgCleanMinutes}m | {d.reviewCount} reviews</p>
                      </div>
                    );
                  }}
                />
                <Scatter data={scatterData}>
                  {scatterData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground" style={{ fontSize: '13px' }}>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-destructive" /> &lt; 4.0</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-primary" /> 4.0–4.79</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[hsl(var(--success))]" /> ≥ 4.8</span>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground h-[320px] flex items-center justify-center">No correlation data available</p>
        )}
      </div>

      {/* 9. Property Ratings Table */}
      <div className="glass-card rounded-xl p-5 sm:p-6" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
          <h3 className="text-section-header">Property Ratings ({sortedProps.length} properties)</h3>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search properties..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
          </div>
        </div>
        {isLoading ? <TableSkeleton /> : sortedProps.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No rated reviews found for this date range / source</p>
        ) : (
          <div className="overflow-auto max-h-[600px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer select-none" style={{ fontSize: '14px' }} onClick={() => handlePropSort('name')}>Property{si('name')}</TableHead>
                  <TableHead className="text-right cursor-pointer select-none" style={{ fontSize: '14px' }} onClick={() => handlePropSort('avg_rating')}>Avg Rating{si('avg_rating')}</TableHead>
                  <TableHead className="text-right w-12" style={{ fontSize: '14px' }}>Trend</TableHead>
                  <TableHead className="text-right cursor-pointer select-none" style={{ fontSize: '14px' }} onClick={() => handlePropSort('count')}>Reviews{si('count')}</TableHead>
                  <TableHead className="text-center hidden md:table-cell" style={{ fontSize: '14px' }}>OTAs</TableHead>
                  <TableHead className="text-right cursor-pointer select-none hidden md:table-cell" style={{ fontSize: '14px' }} onClick={() => handlePropSort('cleanliness')}>Cleanliness{si('cleanliness')}</TableHead>
                  <TableHead className="text-right hidden md:table-cell" style={{ fontSize: '14px' }}>5-Star</TableHead>
                  <TableHead className="text-right cursor-pointer select-none hidden md:table-cell" style={{ fontSize: '14px' }} onClick={() => handlePropSort('below_4')}>Below 4{si('below_4')}</TableHead>
                  <TableHead className="hidden lg:table-cell" style={{ fontSize: '14px' }}>Last Review</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedProps.map(p => (
                  <TableRow key={p.listing_id} className={ratingBgColor(p.avg_rating)} style={{ height: '48px' }}>
                    <TableCell className="font-medium max-w-[180px] truncate" style={{ fontSize: '14px' }}>{p.name}</TableCell>
                    <TableCell className={`text-right ${ratingColor(p.avg_rating)}`} style={{ fontSize: '14px' }}>{p.avg_rating.toFixed(2)}</TableCell>
                    <TableCell className="text-right">
                      {p.prior_avg ? <DeltaArrow current={p.avg_rating} previous={p.prior_avg} /> : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-right" style={{ fontSize: '14px' }}>{p.count}</TableCell>
                    <TableCell className="text-center hidden md:table-cell">
                      <span className="inline-flex gap-1">
                        {p.platforms.map(pl => (
                          <span key={pl} className={`w-2.5 h-2.5 rounded-full ${platformDotColor(pl)}`} title={platformDisplay(pl)} />
                        ))}
                      </span>
                    </TableCell>
                    <TableCell className={`text-right hidden md:table-cell ${p.avg_cleanliness ? ratingColor(p.avg_cleanliness) : 'text-muted-foreground'}`} style={{ fontSize: '14px' }}>
                      {p.avg_cleanliness?.toFixed(2) ?? '—'}
                    </TableCell>
                    <TableCell className="text-right hidden md:table-cell text-muted-foreground" style={{ fontSize: '14px' }}>{p.five_star}</TableCell>
                    <TableCell className={`text-right hidden md:table-cell ${p.below_4 > 0 ? 'text-destructive font-semibold' : 'text-muted-foreground'}`} style={{ fontSize: '14px' }}>{p.below_4}</TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground max-w-[220px] truncate" style={{ fontSize: '14px' }} title={p.latestComment || ''}>
                      {p.latestComment || p.latest}
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

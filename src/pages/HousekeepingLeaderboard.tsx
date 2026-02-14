import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useDateRange } from '@/contexts/DateRangeContext';
import { Monitor, TrendingUp, TrendingDown, Minus, Maximize, Minimize, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, ReferenceLine, CartesianGrid, Tooltip, LabelList } from 'recharts';
import { Progress } from '@/components/ui/progress';
import { format, subDays, startOfWeek, endOfWeek, differenceInDays } from 'date-fns';

// --- Constants ---
const MOTIVATIONAL_QUOTES = [
  "Every clean is someone's first impression.",
  "Details make the difference.",
  "We don't just clean — we create experiences.",
  "Hospitality is a team sport.",
  "The goal isn't perfection — it's progress.",
  "Pride in the process, joy in the result.",
  "Small things done consistently create extraordinary results.",
  "A clean home is the first chapter of a great stay.",
];

const MIN_RATED_OPTIONS = [
  { label: 'All', value: 0 },
  { label: '5+', value: 5 },
  { label: '10+', value: 10 },
  { label: '20+', value: 20 },
  { label: '50+', value: 50 },
];

const DATA_COMPLETENESS_OPTIONS = [
  { label: 'All', value: 'all' },
  { label: 'Full Data', value: 'full' },
  { label: 'Rated Only', value: 'rated' },
  { label: 'Efficiency Only', value: 'efficiency' },
];

type TrendDir = 'improving' | 'stable' | 'worsening' | 'new';
type SortKey = 'rank' | 'name' | 'overallScore' | 'cleanScore' | 'efficiency' | 'cleans' | 'ratedCleans' | 'avgMin' | 'trend';

// --- Helpers ---
function displayName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length > 1) return `${parts[0]} ${parts[parts.length - 1][0]}.`;
  return parts[0];
}

function computeOverallScore(avgCleanliness: number | null, efficiencyPct: number | null, hasRatings: boolean, hasTimeero: boolean): number {
  const clean = hasRatings && avgCleanliness != null ? (avgCleanliness / 5) * 60 : 0;
  const eff = hasTimeero && efficiencyPct != null ? (efficiencyPct / 100) * 40 : 0;
  if (hasRatings && hasTimeero) return Math.round(clean + eff);
  if (hasRatings) return Math.round(clean);
  if (hasTimeero) return Math.round(eff);
  return 0;
}

export default function HousekeepingLeaderboard() {
  const { dateRange } = useDateRange();
  const [tvMode, setTvMode] = useState(false);
  const [quoteIdx, setQuoteIdx] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [showConfetti, setShowConfetti] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);
  const scrollDir = useRef<'down' | 'up'>('down');
  const scrollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Table filters
  const [minRated, setMinRated] = useState(0);
  const [dataCompleteness, setDataCompleteness] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey>('overallScore');
  const [sortAsc, setSortAsc] = useState(false);

  // Derive date strings from global filter
  const fromDate = format(dateRange.from, 'yyyy-MM-dd');
  const toDate = format(dateRange.to, 'yyyy-MM-dd');
  const periodDays = differenceInDays(dateRange.to, dateRange.from);
  const priorFrom = format(subDays(dateRange.from, periodDays), 'yyyy-MM-dd');
  const priorTo = format(subDays(dateRange.from, 1), 'yyyy-MM-dd');

  // Rotate quotes
  useEffect(() => {
    const t = setInterval(() => setQuoteIdx(i => (i + 1) % MOTIVATIONAL_QUOTES.length), 60000);
    return () => clearInterval(t);
  }, []);

  // TV Mode: auto-refresh every 5 min
  useEffect(() => {
    if (!tvMode) return;
    const t = setInterval(() => {
      setLastUpdated(new Date());
      setRefreshKey(k => k + 1);
    }, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [tvMode]);

  // TV Mode: fullscreen
  useEffect(() => {
    if (tvMode) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    }
  }, [tvMode]);

  // TV Mode: auto-scroll table
  useEffect(() => {
    if (!tvMode || !tableRef.current) {
      if (scrollTimer.current) clearInterval(scrollTimer.current);
      return;
    }
    const el = tableRef.current;
    let pauseUntil = 0;
    scrollTimer.current = setInterval(() => {
      if (Date.now() < pauseUntil) return;
      if (scrollDir.current === 'down') {
        el.scrollTop += 1;
        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 2) {
          scrollDir.current = 'up';
          pauseUntil = Date.now() + 5000;
        }
      } else {
        el.scrollTop -= 2;
        if (el.scrollTop <= 0) {
          scrollDir.current = 'down';
          pauseUntil = Date.now() + 3000;
        }
      }
    }, 50);
    return () => { if (scrollTimer.current) clearInterval(scrollTimer.current); };
  }, [tvMode]);

  // Hide sidebar in TV mode
  useEffect(() => {
    const sidebar = document.querySelector('[data-sidebar]') as HTMLElement;
    const header = document.querySelector('header') as HTMLElement;
    if (tvMode) {
      if (sidebar) sidebar.style.display = 'none';
      if (header) header.style.display = 'none';
    } else {
      if (sidebar) sidebar.style.display = '';
      if (header) header.style.display = '';
    }
    return () => {
      if (sidebar) sidebar.style.display = '';
      if (header) header.style.display = '';
    };
  }, [tvMode]);

  // ====== DATA QUERIES ======

  // 1. v_leaderboard_combined — main table + KPIs (not date-filtered at DB level, it's a materialized aggregate)
  const { data: combined } = useQuery({
    queryKey: ['lb-combined', refreshKey],
    queryFn: async () => {
      const { data } = await supabase.from('v_leaderboard_combined').select('*');
      return data || [];
    },
  });

  // 2. v_cleaner_ratings — for Clean Score Trend chart & date filtering ratings
  const { data: cleanerRatings } = useQuery({
    queryKey: ['lb-cleaner-ratings', refreshKey],
    queryFn: async () => {
      const { data } = await supabase
        .from('v_cleaner_ratings')
        .select('assignee_name, assignee_id, cleanliness_rating, review_date')
        .not('cleanliness_rating', 'is', null)
        .not('review_date', 'is', null)
        .order('review_date', { ascending: false })
        .limit(6000);
      return data || [];
    },
  });

  // 3. get_cleaner_efficiency RPC — current period
  const { data: efficiencyCurrent } = useQuery({
    queryKey: ['lb-efficiency-current', fromDate, toDate, refreshKey],
    queryFn: async () => {
      const { data } = await supabase.rpc('get_cleaner_efficiency', {
        start_date: fromDate,
        end_date: toDate,
      });
      return data || [];
    },
  });

  // 4. get_cleaner_efficiency RPC — prior period (for trend comparison)
  const { data: efficiencyPrior } = useQuery({
    queryKey: ['lb-efficiency-prior', priorFrom, priorTo, refreshKey],
    queryFn: async () => {
      const { data } = await supabase.rpc('get_cleaner_efficiency', {
        start_date: priorFrom,
        end_date: priorTo,
      });
      return data || [];
    },
  });

  // ====== DATE-FILTERED RATINGS per cleaner (current & prior) ======
  const currentRatingsByAssignee = useMemo(() => {
    const map = new Map<number, { sum: number; count: number }>();
    (cleanerRatings || []).forEach(r => {
      const d = new Date(r.review_date!);
      if (d >= dateRange.from && d <= dateRange.to && r.assignee_id != null) {
        const cur = map.get(r.assignee_id) || { sum: 0, count: 0 };
        cur.sum += r.cleanliness_rating || 0;
        cur.count += 1;
        map.set(r.assignee_id, cur);
      }
    });
    return map;
  }, [cleanerRatings, dateRange]);

  const priorRatingsByAssignee = useMemo(() => {
    const priorFromDate = subDays(dateRange.from, periodDays);
    const priorToDate = subDays(dateRange.from, 1);
    const map = new Map<number, { sum: number; count: number }>();
    (cleanerRatings || []).forEach(r => {
      const d = new Date(r.review_date!);
      if (d >= priorFromDate && d <= priorToDate && r.assignee_id != null) {
        const cur = map.get(r.assignee_id) || { sum: 0, count: 0 };
        cur.sum += r.cleanliness_rating || 0;
        cur.count += 1;
        map.set(r.assignee_id, cur);
      }
    });
    return map;
  }, [cleanerRatings, dateRange, periodDays]);

  // ====== Efficiency maps ======
  const efficiencyCurrentMap = useMemo(() => {
    const map = new Map<string, number>();
    (efficiencyCurrent || []).forEach(e => {
      if (e.assignee_name) map.set(e.assignee_name.toLowerCase(), Number(e.efficiency_pct) || 0);
    });
    return map;
  }, [efficiencyCurrent]);

  const efficiencyPriorMap = useMemo(() => {
    const map = new Map<string, number>();
    (efficiencyPrior || []).forEach(e => {
      if (e.assignee_name) map.set(e.assignee_name.toLowerCase(), Number(e.efficiency_pct) || 0);
    });
    return map;
  }, [efficiencyPrior]);

  // ====== KPIs (date-filtered) ======
  const teamCleanScore = useMemo(() => {
    let sum = 0, count = 0;
    currentRatingsByAssignee.forEach(v => {
      if (v.count > 0) { sum += v.sum / v.count; count++; }
    });
    return count > 0 ? Number((sum / count).toFixed(1)) : 0;
  }, [currentRatingsByAssignee]);

  const priorTeamCleanScore = useMemo(() => {
    let sum = 0, count = 0;
    priorRatingsByAssignee.forEach(v => {
      if (v.count > 0) { sum += v.sum / v.count; count++; }
    });
    return count > 0 ? Number((sum / count).toFixed(1)) : 0;
  }, [priorRatingsByAssignee]);

  const teamEfficiency = useMemo(() => {
    if (!efficiencyCurrent?.length) return 0;
    const vals = efficiencyCurrent.filter(e => e.efficiency_pct != null).map(e => Number(e.efficiency_pct));
    return vals.length ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : 0;
  }, [efficiencyCurrent]);

  const priorTeamEfficiency = useMemo(() => {
    if (!efficiencyPrior?.length) return 0;
    const vals = efficiencyPrior.filter(e => e.efficiency_pct != null).map(e => Number(e.efficiency_pct));
    return vals.length ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : 0;
  }, [efficiencyPrior]);

  const totalCleans = useMemo(() => {
    return (combined || []).reduce((s, c) => s + (Number(c.total_cleans) || 0), 0);
  }, [combined]);

  // Confetti
  useEffect(() => {
    if (tvMode && teamCleanScore >= 4.5 && teamEfficiency >= 70) {
      setShowConfetti(true);
      const t = setTimeout(() => setShowConfetti(false), 4000);
      return () => clearTimeout(t);
    }
  }, [tvMode, teamCleanScore, teamEfficiency]);

  // ====== TREND CHARTS (weekly, date-filtered) ======
  const cleanScoreTrend = useMemo(() => {
    const ratings = (cleanerRatings || []).filter(r => {
      const d = new Date(r.review_date!);
      return d >= dateRange.from && d <= dateRange.to;
    });
    const weekMap = new Map<string, { sum: number; count: number }>();
    ratings.forEach(r => {
      const wStart = startOfWeek(new Date(r.review_date!), { weekStartsOn: 1 });
      const key = format(wStart, 'yyyy-MM-dd');
      const cur = weekMap.get(key) || { sum: 0, count: 0 };
      cur.sum += r.cleanliness_rating || 0;
      cur.count += 1;
      weekMap.set(key, cur);
    });
    return Array.from(weekMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, v]) => ({
        label: format(new Date(key), 'MMM d'),
        score: Number((v.sum / v.count).toFixed(2)),
      }));
  }, [cleanerRatings, dateRange]);

  const efficiencyTrend = useMemo(() => {
    // We only have aggregate efficiency from the RPC, not weekly. Show single point for now.
    if (!efficiencyCurrent?.length) return [];
    const totalClocked = efficiencyCurrent.reduce((s, e) => s + (Number(e.total_clocked_minutes) || 0), 0);
    const totalTask = efficiencyCurrent.reduce((s, e) => s + (Number(e.total_task_minutes) || 0), 0);
    const overallEff = totalClocked > 0 ? Math.round((totalTask / totalClocked) * 100) : 0;
    // Create weekly placeholders across the date range
    const weeks: { label: string; efficiency: number }[] = [];
    let cursor = startOfWeek(dateRange.from, { weekStartsOn: 1 });
    const end = dateRange.to;
    while (cursor <= end) {
      weeks.push({ label: format(cursor, 'MMM d'), efficiency: overallEff });
      cursor = new Date(cursor.getTime() + 7 * 24 * 60 * 60 * 1000);
    }
    return weeks;
  }, [efficiencyCurrent, dateRange]);

  // ====== LEADERBOARD TABLE ======
  const cleanerRows = useMemo(() => {
    if (!combined?.length) return [];

    const rows = combined
      .filter(c => c.assignee_name && (Number(c.total_cleans) || 0) >= 5)
      .map(c => {
        const hasRatings = !!c.has_ratings;
        const hasTimeero = !!c.has_timeero;
        const assigneeId = Number(c.assignee_id) || 0;
        const nameLower = (c.assignee_name || '').toLowerCase();

        // Use date-filtered ratings if available, else fall back to view aggregate
        const curRating = currentRatingsByAssignee.get(assigneeId);
        const avgCleanliness = curRating && curRating.count > 0
          ? curRating.sum / curRating.count
          : (hasRatings && c.avg_cleanliness != null ? Number(c.avg_cleanliness) : null);
        const ratedCleans = curRating ? curRating.count : (Number(c.rated_cleans) || 0);

        // Use date-filtered efficiency
        const effPct = efficiencyCurrentMap.has(nameLower)
          ? efficiencyCurrentMap.get(nameLower)!
          : (hasTimeero && c.efficiency_pct != null ? Number(c.efficiency_pct) : null);

        const overallScore = computeOverallScore(
          avgCleanliness,
          effPct != null ? effPct : null,
          hasRatings && avgCleanliness != null,
          hasTimeero && effPct != null
        );

        // Prior period score for trend
        const priorRating = priorRatingsByAssignee.get(assigneeId);
        const priorAvgCleanliness = priorRating && priorRating.count > 0
          ? priorRating.sum / priorRating.count : null;
        const priorEffPct = efficiencyPriorMap.has(nameLower)
          ? efficiencyPriorMap.get(nameLower)! : null;
        const hasPriorRatings = priorAvgCleanliness != null;
        const hasPriorTimeero = priorEffPct != null;
        const priorScore = computeOverallScore(
          priorAvgCleanliness,
          priorEffPct,
          hasPriorRatings,
          hasPriorTimeero
        );
        const hasPriorData = hasPriorRatings || hasPriorTimeero;

        let trend: TrendDir = 'new';
        if (hasPriorData) {
          const delta = overallScore - priorScore;
          if (delta >= 2) trend = 'improving';
          else if (delta <= -2) trend = 'worsening';
          else trend = 'stable';
        }

        return {
          id: assigneeId,
          name: displayName(c.assignee_name!),
          fullName: c.assignee_name!,
          overallScore,
          priorScore,
          hasPriorData,
          cleanScore: avgCleanliness != null ? Number(avgCleanliness.toFixed(1)) : null,
          efficiency: effPct != null ? Math.round(effPct) : null,
          hasTimesheet: hasTimeero,
          hasRatings: hasRatings && avgCleanliness != null,
          cleans: Number(c.total_cleans) || 0,
          ratedCleans,
          avgMin: Math.round(Number(c.avg_minutes) || 0),
          trend,
          scoreDelta: hasPriorData ? overallScore - priorScore : 0,
        };
      });

    // Apply filters
    let filtered = rows;
    if (minRated > 0) filtered = filtered.filter(r => r.ratedCleans >= minRated);
    if (dataCompleteness === 'full') filtered = filtered.filter(r => r.hasRatings && r.hasTimesheet);
    else if (dataCompleteness === 'rated') filtered = filtered.filter(r => r.hasRatings);
    else if (dataCompleteness === 'efficiency') filtered = filtered.filter(r => r.hasTimesheet);

    // Sort
    filtered.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'name': cmp = a.name.localeCompare(b.name); break;
        case 'cleanScore': cmp = (a.cleanScore ?? -1) - (b.cleanScore ?? -1); break;
        case 'efficiency': cmp = (a.efficiency ?? -1) - (b.efficiency ?? -1); break;
        case 'cleans': cmp = a.cleans - b.cleans; break;
        case 'ratedCleans': cmp = a.ratedCleans - b.ratedCleans; break;
        case 'avgMin': cmp = a.avgMin - b.avgMin; break;
        case 'trend': cmp = a.scoreDelta - b.scoreDelta; break;
        default: cmp = a.overallScore - b.overallScore; break;
      }
      return sortAsc ? cmp : -cmp;
    });

    return filtered.slice(0, 20);
  }, [combined, currentRatingsByAssignee, efficiencyCurrentMap, priorRatingsByAssignee, efficiencyPriorMap, minRated, dataCompleteness, sortKey, sortAsc]);

  // Most improved
  const mostImprovedIdx = useMemo(() => {
    if (cleanerRows.length < 2) return -1;
    let bestIdx = -1;
    let bestDelta = 0;
    cleanerRows.forEach((r, i) => {
      if (r.hasPriorData && r.hasRatings && r.hasTimesheet && r.cleans >= 20 && r.scoreDelta > bestDelta) {
        bestDelta = r.scoreDelta;
        bestIdx = i;
      }
    });
    return bestIdx;
  }, [cleanerRows]);

  // Sort handler
  const handleSort = useCallback((key: SortKey) => {
    if (sortKey === key) setSortAsc(a => !a);
    else { setSortKey(key); setSortAsc(false); }
  }, [sortKey]);

  // ====== RENDER ======
  const tv = tvMode;

  return (
    <div className={`${tv ? 'fixed inset-0 z-[9999] bg-background overflow-auto p-6 md:p-10' : ''} animate-slide-in`}>
      {/* Confetti */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-[10000] flex items-center justify-center">
          {Array.from({ length: 30 }).map((_, i) => (
            <span
              key={i}
              className="absolute rounded-full animate-bounce"
              style={{
                width: 8 + Math.random() * 8,
                height: 8 + Math.random() * 8,
                background: ['hsl(5 87% 55%)', 'hsl(38 92% 50%)', 'hsl(142 71% 45%)', 'hsl(5 61% 28%)'][i % 4],
                left: `${10 + Math.random() * 80}%`,
                top: `${Math.random() * 60}%`,
                animationDuration: `${1 + Math.random() * 2}s`,
                animationDelay: `${Math.random() * 0.5}s`,
                opacity: 0.8,
              }}
            />
          ))}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Monitor className="h-6 w-6 text-primary" />
          <h1 className={`${tv ? 'text-4xl' : 'text-page-title'} font-black`}>Housekeeping Leaderboard</h1>
        </div>
        <button
          onClick={() => setTvMode(!tvMode)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-colors bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {tv ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          {tv ? 'Exit TV' : 'TV Mode'}
        </button>
      </div>

      {/* KPI Cards */}
      <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 ${tv ? 'gap-6' : ''} mb-6`}>
        <PulseCard
          title="Team Clean Score"
          value={teamCleanScore > 0 ? teamCleanScore.toFixed(1) : '—'}
          subtitle="/ 5.0"
          delta={teamCleanScore > 0 && priorTeamCleanScore > 0 ? Number((teamCleanScore - priorTeamCleanScore).toFixed(1)) : null}
          deltaLabel="vs last period"
          tv={tv}
        />
        <PulseCard
          title="Team Efficiency"
          value={teamEfficiency > 0 ? `${teamEfficiency}%` : '—'}
          subtitle=""
          delta={teamEfficiency > 0 && priorTeamEfficiency > 0 ? teamEfficiency - priorTeamEfficiency : null}
          deltaLabel="vs last period"
          deltaSuffix="%"
          tv={tv}
        />
        <PulseCard
          title="Total Cleans"
          value={totalCleans.toLocaleString()}
          subtitle=""
          delta={null}
          deltaLabel=""
          tv={tv}
        />
      </div>

      {/* Trend Charts */}
      <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${tv ? 'gap-6' : ''} mb-6`}>
        <TrendChart
          title="Clean Score Trend"
          data={cleanScoreTrend}
          dataKey="score"
          color="hsl(5 87% 55%)"
          targetValue={4.5}
          targetLabel="Target"
          yDomain={[3.5, 5]}
          tv={tv}
        />
        <TrendChart
          title="Efficiency Trend"
          data={efficiencyTrend}
          dataKey="efficiency"
          color="hsl(5 61% 28%)"
          targetValue={75}
          targetLabel="Target"
          yDomain={[0, 100]}
          suffix="%"
          tv={tv}
        />
      </div>

      {/* Filter Bar */}
      <div className="glass-card mb-4">
        <div className="px-4 py-3 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Min Rated:</span>
            <div className="flex gap-1 bg-muted rounded-md p-0.5">
              {MIN_RATED_OPTIONS.map(o => (
                <button
                  key={o.value}
                  onClick={() => setMinRated(o.value)}
                  className={`px-2 py-1 rounded text-xs font-semibold transition-colors ${minRated === o.value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Data:</span>
            <div className="flex gap-1 bg-muted rounded-md p-0.5">
              {DATA_COMPLETENESS_OPTIONS.map(o => (
                <button
                  key={o.value}
                  onClick={() => setDataCompleteness(o.value)}
                  className={`px-2 py-1 rounded text-xs font-semibold transition-colors ${dataCompleteness === o.value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Leaderboard Table */}
      <div className="glass-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-section-header">Cleaner Leaderboard</h2>
          <span className="text-xs text-muted-foreground">Top {cleanerRows.length} cleaners</span>
        </div>
        <div ref={tableRef} className={`overflow-auto ${tv ? 'max-h-[50vh]' : 'max-h-[500px]'}`} style={{ scrollBehavior: 'smooth' }}>
          <table className="w-full">
            <thead className="sticky top-0 bg-card z-10">
              <tr className="border-b border-border">
                {([
                  { key: 'rank' as SortKey, label: 'Rank' },
                  { key: 'name' as SortKey, label: 'Cleaner' },
                  { key: 'overallScore' as SortKey, label: 'Overall' },
                  { key: 'cleanScore' as SortKey, label: 'Clean Score' },
                  { key: 'efficiency' as SortKey, label: 'Efficiency' },
                  { key: 'cleans' as SortKey, label: 'Cleans' },
                  { key: 'avgMin' as SortKey, label: 'Avg Time' },
                  { key: 'trend' as SortKey, label: 'Trend' },
                ]).map(h => (
                  <th
                    key={h.key}
                    onClick={() => handleSort(h.key)}
                    className={`${tv ? 'px-5 py-4 text-base' : 'px-4 py-3 text-xs'} text-left font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors select-none`}
                  >
                    <span className="flex items-center gap-1">
                      {h.label}
                      {sortKey === h.key ? (
                        sortAsc ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-30" />
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cleanerRows.map((row, i) => {
                const rank = i + 1;
                const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;
                const borderColor = rank === 1 ? 'border-l-4 border-l-[hsl(38_92%_50%)]' : rank === 2 ? 'border-l-4 border-l-[hsl(0_0%_75%)]' : rank === 3 ? 'border-l-4 border-l-[hsl(25_60%_50%)]' : 'border-l-4 border-l-transparent';
                const rowBg = i % 2 === 0 ? 'bg-card' : 'bg-muted';
                const scoreColor = row.overallScore >= 90 ? 'text-[hsl(142_71%_45%)]' : row.overallScore < 70 ? 'text-[hsl(38_92%_50%)]' : 'text-foreground';
                const isImproved = i === mostImprovedIdx;

                return (
                  <tr key={row.id} className={`${rowBg} ${borderColor} transition-colors`}>
                    <td className={`${tv ? 'px-5 py-4 text-2xl' : 'px-4 py-3 text-lg'} font-bold`}>
                      {medal && <span className="mr-1">{medal}</span>}{rank}
                    </td>
                    <td className={`${tv ? 'px-5 py-4 text-xl' : 'px-4 py-3 text-base'} font-semibold`}>
                      <span>{row.name}</span>
                      {isImproved && (
                        <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary">
                          📈 Most Improved
                        </span>
                      )}
                    </td>
                    <td className={`${tv ? 'px-5 py-4' : 'px-4 py-3'}`}>
                      <span
                        className={`inline-flex items-center justify-center ${tv ? 'w-14 h-14 text-2xl' : 'w-10 h-10 text-base'} rounded-full font-black ${scoreColor}`}
                        style={{
                          background: row.overallScore >= 90 ? 'hsl(142 71% 45% / 0.12)' : row.overallScore < 70 ? 'hsl(38 92% 50% / 0.12)' : 'hsl(var(--muted))',
                        }}
                      >
                        {row.overallScore}
                      </span>
                    </td>
                    <td className={`${tv ? 'px-5 py-4 text-xl' : 'px-4 py-3 text-base'}`}>
                      {row.cleanScore !== null ? (
                        <span className="font-semibold">{row.cleanScore.toFixed(1)}</span>
                      ) : (
                        <span className="text-muted-foreground text-sm italic" title="No guest reviews yet">—</span>
                      )}
                    </td>
                    <td className={`${tv ? 'px-5 py-4' : 'px-4 py-3'}`}>
                      {row.efficiency !== null ? (
                        <div className="flex items-center gap-2">
                          <span className={`${tv ? 'text-xl' : 'text-base'} font-semibold min-w-[3ch]`}>{row.efficiency}%</span>
                          <div className={`${tv ? 'w-24' : 'w-16'} flex-shrink-0`}>
                            <Progress value={row.efficiency} className="h-2 bg-muted [&>div]:bg-secondary" />
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm italic" title="No timesheet data">—</span>
                      )}
                    </td>
                    <td className={`${tv ? 'px-5 py-4 text-xl' : 'px-4 py-3 text-base'}`}>
                      <span className="font-semibold">{row.cleans}</span>
                      {row.ratedCleans > 0 && (
                        <span className="text-muted-foreground text-xs ml-1">· {row.ratedCleans} rated</span>
                      )}
                    </td>
                    <td className={`${tv ? 'px-5 py-4 text-xl' : 'px-4 py-3 text-base'}`}>
                      <span className="font-semibold">{row.avgMin}</span>
                      <span className="text-muted-foreground text-xs ml-1">min</span>
                    </td>
                    <td className={`${tv ? 'px-5 py-4' : 'px-4 py-3'}`}>
                      <TrendArrow dir={row.trend} tv={tv} />
                    </td>
                  </tr>
                );
              })}
              {cleanerRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Loading leaderboard data…</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer */}
      <div className={`flex items-center justify-between mt-6 ${tv ? 'px-2' : ''}`}>
        <p
          key={quoteIdx}
          className={`italic text-muted-foreground ${tv ? 'text-lg' : 'text-sm'} max-w-2xl animate-fade-in`}
          style={{ fontFamily: 'Figtree, sans-serif' }}
        >
          "{MOTIVATIONAL_QUOTES[quoteIdx]}"
        </p>
        <span className={`text-muted-foreground ${tv ? 'text-base' : 'text-xs'}`}>
          Last updated: {format(lastUpdated, 'h:mm a')}
        </span>
      </div>
    </div>
  );
}

// --- Sub-components ---

function PulseCard({ title, value, subtitle, delta, deltaLabel, deltaSuffix, tv }: {
  title: string; value: string; subtitle: string; tv: boolean;
  delta?: number | null; deltaLabel?: string; deltaSuffix?: string;
}) {
  return (
    <div className="glass-card overflow-hidden">
      <div className="h-1.5 w-full bg-primary" />
      <div className={`${tv ? 'p-8' : 'p-5'}`}>
        <p className={`${tv ? 'text-lg' : 'text-xs'} font-semibold text-muted-foreground uppercase tracking-wider mb-2`}>{title}</p>
        <div className="flex items-baseline gap-2">
          <span className={`${tv ? 'text-7xl' : 'text-4xl'} font-black tracking-tight text-foreground`}>{value}</span>
          {subtitle && <span className={`${tv ? 'text-2xl' : 'text-lg'} text-muted-foreground font-medium`}>{subtitle}</span>}
        </div>
        {delta != null && delta !== 0 && (
          <div className={`mt-2 flex items-center gap-1 ${tv ? 'text-base' : 'text-xs'}`}>
            {delta > 0 ? (
              <TrendingUp className="h-3.5 w-3.5 text-[hsl(142_71%_45%)]" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5 text-destructive" />
            )}
            <span className={delta > 0 ? 'text-[hsl(142_71%_45%)] font-semibold' : 'text-destructive font-semibold'}>
              {delta > 0 ? '+' : ''}{delta}{deltaSuffix || ''}
            </span>
            <span className="text-muted-foreground">{deltaLabel}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function TrendChart({ title, data, dataKey, color, targetValue, targetLabel, yDomain, suffix, tv }: {
  title: string; data: any[]; dataKey: string; color: string;
  targetValue: number; targetLabel: string; yDomain: [number, number];
  suffix?: string; tv: boolean;
}) {
  const chartH = tv ? 'h-[300px]' : 'h-[240px]';
  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-section-header">{title}</h3>
      </div>
      <div className={chartH}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.2} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 90%)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: tv ? 14 : 12, fill: 'hsl(240 4% 40%)' }} axisLine={false} tickLine={false} />
            <YAxis domain={yDomain} tick={{ fontSize: tv ? 14 : 12, fill: 'hsl(240 4% 40%)' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}${suffix || ''}`} />
            <Tooltip
              contentStyle={{ fontSize: tv ? 14 : 12, borderRadius: 8, border: '1px solid hsl(0 0% 90%)' }}
              formatter={(v: number) => [`${v}${suffix || ''}`, title]}
            />
            <ReferenceLine y={targetValue} stroke="hsl(0 0% 70%)" strokeDasharray="6 4" label={{ value: targetLabel, position: 'right', fontSize: tv ? 14 : 11, fill: 'hsl(240 4% 40%)' }} />
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={tv ? 3 : 2}
              fill={`url(#grad-${dataKey})`}
              dot={{ r: tv ? 6 : 4, fill: color, strokeWidth: 2, stroke: 'white' }}
              activeDot={{ r: tv ? 8 : 6 }}
            >
              <LabelList
                dataKey={dataKey}
                position="top"
                style={{ fontSize: tv ? 13 : 10, fill: color, fontWeight: 600 }}
                formatter={(v: number) => `${v}${suffix || ''}`}
              />
            </Area>
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function TrendArrow({ dir, tv }: { dir: TrendDir; tv: boolean }) {
  const size = tv ? 'h-5 w-5' : 'h-4 w-4';
  if (dir === 'improving') return <TrendingUp className={`${size} text-[hsl(142_71%_45%)]`} />;
  if (dir === 'worsening') return <TrendingDown className={`${size} text-[hsl(38_92%_50%)]`} />;
  if (dir === 'new') return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary">NEW</span>;
  return <Minus className={`${size} text-muted-foreground`} />;
}

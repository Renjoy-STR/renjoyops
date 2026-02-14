import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useDateRange } from '@/contexts/DateRangeContext';
import { Monitor, TrendingUp, TrendingDown, Minus, Maximize, Minimize, ArrowUpDown, ArrowUp, ArrowDown, Info } from 'lucide-react';
import { ResponsiveContainer, ComposedChart, AreaChart, Area, Bar, XAxis, YAxis, ReferenceLine, CartesianGrid, Tooltip as RechartsTooltip, LabelList } from 'recharts';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { format, subDays, startOfWeek, differenceInDays, isThisWeek } from 'date-fns';

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

const DATA_COMPLETENESS_OPTIONS_ALL = [
  { label: 'All', value: 'all' },
  { label: 'Full Data', value: 'full' },
  { label: 'Rated Only', value: 'rated' },
  { label: 'Efficiency Only', value: 'efficiency' },
];

const DATA_COMPLETENESS_OPTIONS_1099 = [
  { label: 'All', value: 'all' },
  { label: 'Rated Only', value: 'rated' },
];

type WorkerFilter = 'w2' | '1099' | null;
type TrendDir = 'improving' | 'stable' | 'worsening' | 'new';
type SortKey = 'rank' | 'name' | 'overallScore' | 'cleanScore' | 'efficiency' | 'cleans' | 'ratedCleans' | 'avgMin' | 'trend';

// --- Helpers ---
function displayName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length > 1) return `${parts[0]} ${parts[parts.length - 1][0]}.`;
  return parts[0];
}

function computeOverallScore(avgCleanliness: number | null, efficiencyPct: number | null, hasRatings: boolean, hasTimeero: boolean, workerType?: string): number {
  // 1099 workers: 100% quality
  if (workerType === '1099') {
    if (hasRatings && avgCleanliness != null) return Math.round((avgCleanliness / 5) * 100);
    return 0;
  }
  // W2 workers: 80% quality, 20% efficiency
  const clean = hasRatings && avgCleanliness != null ? (avgCleanliness / 5) * 80 : 0;
  const eff = hasTimeero && efficiencyPct != null ? (efficiencyPct / 100) * 20 : 0;
  return Math.round(clean + eff);
}

export default function HousekeepingLeaderboard() {
  const { dateRange } = useDateRange();
  const [tvMode, setTvMode] = useState(false);
  const [quoteIdx, setQuoteIdx] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [showConfetti, setShowConfetti] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);
  const scrollPhase = useRef<'pause-top' | 'scrolling-down' | 'pause-bottom' | 'scrolling-up'>('pause-top');
  const scrollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseStart = useRef(Date.now());
  const [refreshKey, setRefreshKey] = useState(0);

  // Worker type toggle
  const [workerFilter, setWorkerFilter] = useState<WorkerFilter>('w2');
  const is1099 = workerFilter === '1099';

  // Table filters
  const [minRated, setMinRated] = useState(0);
  const [dataCompleteness, setDataCompleteness] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey>('overallScore');
  const [sortAsc, setSortAsc] = useState(false);

  // TV exit button fade
  const [showExitBtn, setShowExitBtn] = useState(true);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Derive date strings
  const fromDate = format(dateRange.from, 'yyyy-MM-dd');
  const toDate = format(dateRange.to, 'yyyy-MM-dd');
  const periodDays = differenceInDays(dateRange.to, dateRange.from);
  const priorFrom = format(subDays(dateRange.from, periodDays), 'yyyy-MM-dd');
  const priorTo = format(subDays(dateRange.from, 1), 'yyyy-MM-dd');

  // RPC worker type param
  const rpcWorkerType = workerFilter === 'w2' ? 'w2' : workerFilter === '1099' ? '1099' : undefined;

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
      setWorkerFilter('w2'); // default to W2 in TV mode
    } else {
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    }
  }, [tvMode]);

  // TV exit button: fade after 10s, reappear on mouse move
  useEffect(() => {
    if (!tvMode) { setShowExitBtn(true); return; }
    const startFade = () => {
      if (exitTimer.current) clearTimeout(exitTimer.current);
      setShowExitBtn(true);
      exitTimer.current = setTimeout(() => setShowExitBtn(false), 10000);
    };
    startFade();
    const onMove = () => startFade();
    window.addEventListener('mousemove', onMove);
    return () => {
      window.removeEventListener('mousemove', onMove);
      if (exitTimer.current) clearTimeout(exitTimer.current);
    };
  }, [tvMode]);

  // TV Mode: auto-scroll with pause-scroll-pause-scroll pattern
  useEffect(() => {
    if (!tvMode || !tableRef.current) {
      if (scrollTimer.current) clearInterval(scrollTimer.current);
      return;
    }
    const el = tableRef.current;
    el.scrollTop = 0;
    scrollPhase.current = 'pause-top';
    phaseStart.current = Date.now();

    scrollTimer.current = setInterval(() => {
      const elapsed = Date.now() - phaseStart.current;
      const maxScroll = el.scrollHeight - el.clientHeight;
      if (maxScroll <= 0) return;

      switch (scrollPhase.current) {
        case 'pause-top':
          if (elapsed >= 10000) { scrollPhase.current = 'scrolling-down'; phaseStart.current = Date.now(); }
          break;
        case 'scrolling-down': {
          const progress = Math.min(elapsed / 20000, 1);
          el.scrollTop = progress * maxScroll;
          if (progress >= 1) { scrollPhase.current = 'pause-bottom'; phaseStart.current = Date.now(); }
          break;
        }
        case 'pause-bottom':
          if (elapsed >= 5000) { scrollPhase.current = 'scrolling-up'; phaseStart.current = Date.now(); }
          break;
        case 'scrolling-up': {
          const progress = Math.min(elapsed / 3000, 1);
          el.scrollTop = maxScroll * (1 - progress);
          if (progress >= 1) { scrollPhase.current = 'pause-top'; phaseStart.current = Date.now(); }
          break;
        }
      }
    }, 33);
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

  // 1. get_leaderboard RPC — current period
  const { data: leaderboardCurrent } = useQuery({
    queryKey: ['lb-rpc-current', fromDate, toDate, rpcWorkerType, refreshKey],
    queryFn: async () => {
      const params: { p_start: string; p_end: string; p_worker_type?: string } = { p_start: fromDate, p_end: toDate };
      if (rpcWorkerType) params.p_worker_type = rpcWorkerType;
      const { data } = await supabase.rpc('get_leaderboard', params);
      return data || [];
    },
  });

  // 2. get_leaderboard RPC — prior period
  const { data: leaderboardPrior } = useQuery({
    queryKey: ['lb-rpc-prior', priorFrom, priorTo, rpcWorkerType, refreshKey],
    queryFn: async () => {
      const params: { p_start: string; p_end: string; p_worker_type?: string } = { p_start: priorFrom, p_end: priorTo };
      if (rpcWorkerType) params.p_worker_type = rpcWorkerType;
      const { data } = await supabase.rpc('get_leaderboard', params);
      return data || [];
    },
  });

  // 3. v_cleaner_ratings — for Clean Score Trend chart (weekly)
  const { data: cleanerRatings } = useQuery({
    queryKey: ['lb-cleaner-ratings', fromDate, toDate, refreshKey],
    queryFn: async () => {
      const { data } = await supabase
        .from('v_cleaner_ratings')
        .select('cleanliness_rating, review_date')
        .not('cleanliness_rating', 'is', null)
        .not('review_date', 'is', null)
        .gte('review_date', fromDate)
        .lte('review_date', toDate)
        .order('review_date', { ascending: true })
        .limit(6000);
      return data || [];
    },
  });

  // 4. v_weekly_efficiency — for Efficiency Trend chart & KPI
  const { data: weeklyEfficiency } = useQuery({
    queryKey: ['lb-weekly-eff', fromDate, refreshKey],
    queryFn: async () => {
      const { data } = await supabase
        .from('v_weekly_efficiency')
        .select('*')
        .gte('week_start', fromDate)
        .order('week_start', { ascending: true });
      return data || [];
    },
  });

  // 5. v_weekly_efficiency for prior period (for KPI delta)
  const { data: weeklyEfficiencyPrior } = useQuery({
    queryKey: ['lb-weekly-eff-prior', priorFrom, priorTo, refreshKey],
    queryFn: async () => {
      const { data } = await supabase
        .from('v_weekly_efficiency')
        .select('*')
        .gte('week_start', priorFrom)
        .lte('week_start', priorTo)
        .order('week_start', { ascending: true });
      return data || [];
    },
  });

  // ====== Prior period map (by assignee_id) ======
  const priorMap = useMemo(() => {
    const map = new Map<number, typeof leaderboardPrior extends (infer T)[] | null ? T : never>();
    (leaderboardPrior || []).forEach(r => {
      if (r.assignee_id != null) map.set(Number(r.assignee_id), r);
    });
    return map;
  }, [leaderboardPrior]);

  // ====== KPIs ======
  const teamCleanScore = useMemo(() => {
    const rated = (leaderboardCurrent || []).filter(r => r.has_ratings && r.avg_cleanliness != null);
    if (!rated.length) return 0;
    return Number((rated.reduce((s, r) => s + Number(r.avg_cleanliness), 0) / rated.length).toFixed(1));
  }, [leaderboardCurrent]);

  const priorTeamCleanScore = useMemo(() => {
    const rated = (leaderboardPrior || []).filter(r => r.has_ratings && r.avg_cleanliness != null);
    if (!rated.length) return 0;
    return Number((rated.reduce((s, r) => s + Number(r.avg_cleanliness), 0) / rated.length).toFixed(1));
  }, [leaderboardPrior]);

  // Weighted efficiency from v_weekly_efficiency (consistent with chart)
  const teamEfficiency = useMemo(() => {
    const weeks = weeklyEfficiency || [];
    if (!weeks.length) return 0;
    const totalTask = weeks.reduce((s, w) => s + (Number(w.total_task) || 0), 0);
    const totalClocked = weeks.reduce((s, w) => s + (Number(w.total_clocked) || 0), 0);
    if (totalClocked === 0) return 0;
    return Math.round((totalTask / totalClocked) * 100);
  }, [weeklyEfficiency]);

  const priorTeamEfficiency = useMemo(() => {
    const weeks = weeklyEfficiencyPrior || [];
    if (!weeks.length) return 0;
    const totalTask = weeks.reduce((s, w) => s + (Number(w.total_task) || 0), 0);
    const totalClocked = weeks.reduce((s, w) => s + (Number(w.total_clocked) || 0), 0);
    if (totalClocked === 0) return 0;
    return Math.round((totalTask / totalClocked) * 100);
  }, [weeklyEfficiencyPrior]);

  const totalCleans = useMemo(() => {
    return (leaderboardCurrent || []).reduce((s, c) => s + (Number(c.total_cleans) || 0), 0);
  }, [leaderboardCurrent]);

  const priorTotalCleans = useMemo(() => {
    return (leaderboardPrior || []).reduce((s, c) => s + (Number(c.total_cleans) || 0), 0);
  }, [leaderboardPrior]);

  // Confetti
  useEffect(() => {
    if (tvMode && teamCleanScore >= 4.5 && teamEfficiency >= 70) {
      setShowConfetti(true);
      const t = setTimeout(() => setShowConfetti(false), 4000);
      return () => clearTimeout(t);
    }
  }, [tvMode, teamCleanScore, teamEfficiency]);

  // ====== TREND CHARTS ======
  const cleanScoreTrend = useMemo(() => {
    const weekMap = new Map<string, { sum: number; count: number }>();
    (cleanerRatings || []).forEach(r => {
      const wStart = startOfWeek(new Date(r.review_date!), { weekStartsOn: 1 });
      const key = format(wStart, 'yyyy-MM-dd');
      const cur = weekMap.get(key) || { sum: 0, count: 0 };
      cur.sum += r.cleanliness_rating || 0;
      cur.count += 1;
      weekMap.set(key, cur);
    });
    return Array.from(weekMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .filter(([_, v]) => v.count > 0) // skip 0-rating weeks
      .map(([key, v]) => ({
        label: format(new Date(key), 'MMM d'),
        score: Number((v.sum / v.count).toFixed(2)),
        ratingCount: v.count,
        isPartial: isThisWeek(new Date(key), { weekStartsOn: 1 }),
      }));
  }, [cleanerRatings]);

  const efficiencyTrend = useMemo(() => {
    return (weeklyEfficiency || []).map(w => ({
      label: format(new Date(w.week_start as string), 'MMM d'),
      efficiency: Number(w.team_efficiency_pct) || 0,
      people: Number(w.people_count) || 0,
    }));
  }, [weeklyEfficiency]);

  // ====== LEADERBOARD TABLE ======
  const cleanerRows = useMemo(() => {
    if (!leaderboardCurrent?.length) return [];

    const rows = leaderboardCurrent
      .filter(c => c.assignee_name && (Number(c.total_cleans) || 0) >= 5)
      .map(c => {
        const hasRatings = !!c.has_ratings;
        const hasTimeero = !!c.has_timeero;
        const assigneeId = Number(c.assignee_id) || 0;
        const wType = (c as any).worker_type as string | undefined;

        const avgCleanliness = hasRatings && c.avg_cleanliness != null ? Number(c.avg_cleanliness) : null;
        const effPct = hasTimeero && c.efficiency_pct != null ? Number(c.efficiency_pct) : null;
        const ratedCleans = Number(c.rated_cleans) || 0;

        const overallScore = computeOverallScore(avgCleanliness, effPct, hasRatings, hasTimeero, wType);

        // Prior period comparison
        const prior = priorMap.get(assigneeId);
        let trend: TrendDir = 'new';
        let priorScore = 0;
        if (prior) {
          const priorHasRatings = !!prior.has_ratings;
          const priorHasTimeero = !!prior.has_timeero;
          const priorAvg = priorHasRatings && prior.avg_cleanliness != null ? Number(prior.avg_cleanliness) : null;
          const priorEff = priorHasTimeero && prior.efficiency_pct != null ? Number(prior.efficiency_pct) : null;
          const priorWType = (prior as any).worker_type as string | undefined;
          priorScore = computeOverallScore(priorAvg, priorEff, priorHasRatings, priorHasTimeero, priorWType);
          const delta = overallScore - priorScore;
          if (delta >= 2) trend = 'improving';
          else if (delta <= -2) trend = 'worsening';
          else trend = 'stable';
        }

        return {
          id: assigneeId,
          name: displayName(c.assignee_name!),
          fullName: c.assignee_name!,
          workerType: wType || 'w2',
          overallScore,
          priorScore,
          hasPriorData: !!prior,
          cleanScore: avgCleanliness != null ? Number(avgCleanliness.toFixed(1)) : null,
          efficiency: effPct != null ? Math.round(effPct) : null,
          hasTimesheet: hasTimeero,
          hasRatings: hasRatings && avgCleanliness != null,
          cleans: Number(c.total_cleans) || 0,
          ratedCleans,
          avgMin: Math.round(Number(c.avg_minutes) || 0),
          trend,
          scoreDelta: prior ? overallScore - priorScore : 0,
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

    return filtered;
  }, [leaderboardCurrent, priorMap, minRated, dataCompleteness, sortKey, sortAsc]);

  // Most improved
  const mostImprovedIdx = useMemo(() => {
    if (cleanerRows.length < 2) return -1;
    let bestIdx = -1;
    let bestDelta = 0;
    cleanerRows.forEach((r, i) => {
      if (r.hasPriorData && r.hasRatings && (is1099 || r.hasTimesheet) && r.cleans >= 20 && r.scoreDelta > bestDelta) {
        bestDelta = r.scoreDelta;
        bestIdx = i;
      }
    });
    return bestIdx;
  }, [cleanerRows, is1099]);

  // Sort handler
  const handleSort = useCallback((key: SortKey) => {
    if (sortKey === key) setSortAsc(a => !a);
    else { setSortKey(key); setSortAsc(false); }
  }, [sortKey]);

  // Reset data completeness when switching worker type
  useEffect(() => {
    if (is1099 && (dataCompleteness === 'full' || dataCompleteness === 'efficiency')) {
      setDataCompleteness('all');
    }
  }, [is1099, dataCompleteness]);

  const tv = tvMode;
  const showEfficiency = !is1099;
  const dataComplOptions = is1099 ? DATA_COMPLETENESS_OPTIONS_1099 : DATA_COMPLETENESS_OPTIONS_ALL;

  // Score tooltip text
  const scoreTooltipText = is1099
    ? 'Score = 100% Clean Rating (contract cleaners)'
    : 'Score = 80% Clean Rating + 20% Efficiency. Clean quality is the #1 priority.';

  // Table column definitions
  const tableHeaders: { key: SortKey; label: string; tooltip: string; show: boolean }[] = [
    { key: 'rank', label: 'Rank', tooltip: '', show: true },
    { key: 'name', label: 'Cleaner', tooltip: '', show: true },
    { key: 'overallScore', label: 'Overall', tooltip: scoreTooltipText, show: true },
    { key: 'cleanScore', label: 'Clean Score', tooltip: '', show: true },
    { key: 'efficiency', label: 'Efficiency', tooltip: '', show: showEfficiency },
    { key: 'cleans', label: 'Cleans', tooltip: '', show: true },
    { key: 'avgMin', label: 'Avg Time', tooltip: '', show: true },
    { key: 'trend', label: 'Trend', tooltip: '', show: true },
  ];
  const visibleHeaders = tableHeaders.filter(h => h.show);
  const colSpan = visibleHeaders.length;

  // Worker toggle pills
  const workerPills: { label: string; value: WorkerFilter }[] = [
    { label: 'Our Team', value: 'w2' },
    { label: 'Contract Cleaners', value: '1099' },
    { label: 'Everyone', value: null },
  ];

  return (
    <div className={`${tv ? 'fixed inset-0 z-[9999] bg-background overflow-auto' : ''} animate-slide-in`}
      style={tv ? { padding: '20px 40px' } : undefined}
    >
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
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Monitor className={`${tv ? 'h-8 w-8' : 'h-6 w-6'} text-primary`} />
          <h1 className={`${tv ? 'text-5xl' : 'text-page-title'} font-black`}>Housekeeping Leaderboard</h1>
        </div>
        {/* TV exit button — fades in TV mode */}
        <button
          onClick={() => setTvMode(!tvMode)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all bg-primary text-primary-foreground hover:bg-primary/90 ${tv && !showExitBtn ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
          style={tv ? { position: 'fixed', bottom: 24, left: 40, zIndex: 10001 } : undefined}
        >
          {tv ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          {tv ? 'Exit TV' : 'TV Mode'}
        </button>
      </div>

      {/* Worker Type Toggle */}
      <div className={`flex items-center gap-2 mb-4 ${tv ? 'mb-5' : ''}`}>
        {workerPills.map(p => (
          <button
            key={p.label}
            onClick={() => setWorkerFilter(p.value)}
            className={`rounded-full font-bold transition-all border ${
              workerFilter === p.value
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card text-foreground border-border hover:border-primary/40'
            } ${tv ? 'px-6 py-3 text-lg h-[44px]' : 'px-4 py-1.5 text-sm'}`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* KPI Cards */}
      <div className={`grid gap-4 ${tv ? 'gap-6' : ''} mb-5 ${showEfficiency ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2'}`}>
        <PulseCard
          title="Team Clean Score"
          value={teamCleanScore > 0 ? teamCleanScore.toFixed(1) : '—'}
          subtitle="/ 5.0"
          delta={teamCleanScore > 0 && priorTeamCleanScore > 0 ? Number((teamCleanScore - priorTeamCleanScore).toFixed(1)) : null}
          deltaLabel="vs last period"
          tv={tv}
        />
        {showEfficiency && (
          <PulseCard
            title="Team Efficiency"
            value={teamEfficiency > 0 ? `${teamEfficiency}%` : '—'}
            subtitle=""
            delta={teamEfficiency > 0 && priorTeamEfficiency > 0 ? teamEfficiency - priorTeamEfficiency : null}
            deltaLabel="vs last period"
            deltaSuffix="%"
            tv={tv}
          />
        )}
        <PulseCard
          title="Total Cleans"
          value={totalCleans.toLocaleString()}
          subtitle=""
          delta={totalCleans > 0 && priorTotalCleans > 0 ? totalCleans - priorTotalCleans : null}
          deltaLabel="vs last period"
          deltaPrefix={totalCleans - priorTotalCleans > 0 ? '+' : ''}
          tv={tv}
        />
      </div>

      {/* Trend Charts */}
      <div className={`grid gap-4 ${tv ? 'gap-6' : ''} mb-5 ${showEfficiency ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
        {/* Clean Score Trend */}
        <div className="glass-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className={`text-section-header ${tv ? 'text-[22px]' : ''}`}>Clean Score Trend</h3>
          </div>
          <div style={{ height: tv ? 390 : 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={cleanScoreTrend} margin={{ top: 25, right: 40, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="grad-score" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(5 87% 55%)" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="hsl(5 87% 55%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 90%)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: tv ? 14 : 12, fill: 'hsl(240 4% 40%)' }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" domain={[3.5, 5]} tick={{ fontSize: tv ? 14 : 12, fill: 'hsl(240 4% 40%)' }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: tv ? 14 : 10, fill: 'hsl(240 4% 60%)' }} axisLine={false} tickLine={false} label={{ value: 'Reviews', angle: 90, position: 'insideRight', fontSize: tv ? 12 : 10, fill: 'hsl(240 4% 60%)' }} />
                <RechartsTooltip
                  contentStyle={{ fontSize: tv ? 14 : 12, borderRadius: 8, border: '1px solid hsl(0 0% 90%)' }}
                  formatter={(v: number, name: string) => {
                    if (name === 'ratingCount') return [v, 'Reviews'];
                    return [v, 'Avg Score'];
                  }}
                />
                <ReferenceLine yAxisId="left" y={4.5} stroke="hsl(0 0% 70%)" strokeDasharray="6 4" label={{ value: 'Target', position: 'right', fontSize: tv ? 16 : 11, fill: 'hsl(240 4% 40%)' }} />
                <Bar yAxisId="right" dataKey="ratingCount" fill="hsl(5 87% 95%)" stroke="hsl(5 87% 55%)" strokeWidth={1} barSize={tv ? 28 : 16} radius={[2, 2, 0, 0]}>
                  <LabelList dataKey="ratingCount" position="top" style={{ fontSize: tv ? 16 : 9, fill: 'hsl(240 4% 50%)', fontWeight: tv ? 700 : 400 }} />
                </Bar>
                <Area yAxisId="left" type="monotone" dataKey="score" stroke="hsl(5 87% 55%)" strokeWidth={tv ? 3 : 2} fill="url(#grad-score)" dot={{ r: tv ? 10 : 4, fill: 'hsl(5 87% 55%)', strokeWidth: 2, stroke: 'white' }} activeDot={{ r: tv ? 12 : 6 }}>
                  <LabelList dataKey="score" position="top" style={{ fontSize: tv ? 16 : 10, fill: 'hsl(5 87% 55%)', fontWeight: 700 }} />
                </Area>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Efficiency Trend — only for W2 / Everyone */}
        {showEfficiency && (
          <div className="glass-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className={`text-section-header ${tv ? 'text-[22px]' : ''}`}>Efficiency Trend</h3>
            </div>
            <div style={{ height: tv ? 390 : 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={efficiencyTrend} margin={{ top: 25, right: 20, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id="grad-eff" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(5 61% 28%)" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="hsl(5 61% 28%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 90%)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: tv ? 14 : 12, fill: 'hsl(240 4% 40%)' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: tv ? 14 : 12, fill: 'hsl(240 4% 40%)' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                  <RechartsTooltip
                    contentStyle={{ fontSize: tv ? 14 : 12, borderRadius: 8, border: '1px solid hsl(0 0% 90%)' }}
                    formatter={(v: number) => [`${v}%`, 'Efficiency']}
                  />
                  <ReferenceLine y={75} stroke="hsl(0 0% 70%)" strokeDasharray="6 4" label={{ value: 'Target', position: 'right', fontSize: tv ? 16 : 11, fill: 'hsl(240 4% 40%)' }} />
                  <Area type="monotone" dataKey="efficiency" stroke="hsl(5 61% 28%)" strokeWidth={tv ? 3 : 2} fill="url(#grad-eff)" dot={{ r: tv ? 10 : 4, fill: 'hsl(5 61% 28%)', strokeWidth: 2, stroke: 'white' }} activeDot={{ r: tv ? 12 : 6 }}>
                    <LabelList dataKey="efficiency" position="top" style={{ fontSize: tv ? 16 : 10, fill: 'hsl(5 61% 28%)', fontWeight: 700 }} formatter={(v: number) => `${v}%`} />
                  </Area>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Filter Bar — hidden in TV mode */}
      {!tv && (
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
                {dataComplOptions.map(o => (
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
      )}

      {/* Leaderboard Table */}
      <div className="glass-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className={`text-section-header ${tv ? 'text-[22px]' : ''}`}>Cleaner Leaderboard</h2>
          <span className={`text-muted-foreground ${tv ? 'text-sm' : 'text-xs'}`}>{cleanerRows.length} cleaners</span>
        </div>
        <div ref={tableRef} className={`overflow-auto ${tv ? 'max-h-[50vh]' : 'max-h-[500px]'}`} style={{ scrollBehavior: 'auto' }}>
          <table className="w-full">
            <thead className="sticky top-0 bg-card z-10">
              <tr className="border-b border-border">
                {visibleHeaders.map(h => (
                  <th
                    key={h.key}
                    onClick={() => handleSort(h.key)}
                    className={`${tv ? 'px-5 py-4 text-base' : 'px-4 py-3 text-xs'} text-left font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors select-none`}
                  >
                    <span className="flex items-center gap-1">
                      {h.label}
                      {h.tooltip && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3 w-3 text-muted-foreground/60" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-[220px] text-xs">{h.tooltip}</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
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
                const isTop3 = rank <= 3;
                const borderColor = rank === 1 ? 'border-l-4 border-l-[hsl(38_92%_50%)]' : rank === 2 ? 'border-l-4 border-l-[hsl(0_0%_75%)]' : rank === 3 ? 'border-l-4 border-l-[hsl(25_60%_50%)]' : 'border-l-4 border-l-transparent';
                const rowBg = rank === 1 ? 'bg-gradient-to-r from-card to-[hsl(38_92%_50%_/_0.04)]' : i % 2 === 0 ? 'bg-card' : 'bg-muted';
                const scoreColor = row.overallScore >= 90 ? 'text-[hsl(142_71%_45%)]' : row.overallScore < 70 ? 'text-[hsl(38_92%_50%)]' : 'text-foreground';
                const isImproved = i === mostImprovedIdx;
                const isRank1 = rank === 1;
                const showWorkerBadge = workerFilter === null;

                return (
                  <tr key={row.id} className={`${rowBg} ${borderColor} transition-colors`} style={tv ? { height: 80 } : undefined}>
                    {/* Rank */}
                    <td className={`${tv ? 'px-5 py-4' : 'px-4 py-3'}`}>
                      <span className={`font-black ${tv ? (isRank1 ? 'text-[32px]' : 'text-[28px]') : 'text-lg'}`}>
                        {medal && <span className={`mr-1 ${tv ? 'text-[28px]' : ''}`}>{medal}</span>}{rank}
                      </span>
                    </td>
                    {/* Name */}
                    <td className={`${tv ? 'px-5 py-4' : 'px-4 py-3'}`}>
                      <span className={`font-bold ${tv ? (isRank1 ? 'text-[24px]' : 'text-[22px]') : 'text-base'}`}>{row.name}</span>
                      {showWorkerBadge && (
                        <span className="ml-2 text-[10px] font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded uppercase">
                          {row.workerType}
                        </span>
                      )}
                      {isImproved && (
                        <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary">
                          📈 Most Improved
                        </span>
                      )}
                    </td>
                    {/* Overall Score */}
                    <td className={`${tv ? 'px-5 py-4' : 'px-4 py-3'}`}>
                      <span
                        className={`inline-flex items-center justify-center rounded-full font-black ${scoreColor} ${
                          tv ? (isRank1 ? 'w-[56px] h-[56px] text-[28px]' : 'w-[48px] h-[48px] text-[24px]') : 'w-10 h-10 text-base'
                        }`}
                        style={{
                          background: row.overallScore >= 90 ? 'hsl(142 71% 45% / 0.12)' : row.overallScore < 70 ? 'hsl(38 92% 50% / 0.12)' : 'hsl(var(--muted))',
                        }}
                      >
                        {row.overallScore}
                        {tv && isRank1 && row.overallScore >= 95 && <span className="ml-0.5 text-sm">✨</span>}
                      </span>
                    </td>
                    {/* Clean Score */}
                    <td className={`${tv ? 'px-5 py-4' : 'px-4 py-3'}`}>
                      {row.cleanScore !== null ? (
                        <span className={`font-semibold ${tv ? 'text-[22px]' : 'text-base'}`}>{row.cleanScore.toFixed(1)}</span>
                      ) : (
                        <span className="text-muted-foreground text-sm italic" title="No guest reviews yet">—</span>
                      )}
                    </td>
                    {/* Efficiency — only if showing */}
                    {showEfficiency && (
                      <td className={`${tv ? 'px-5 py-4' : 'px-4 py-3'}`}>
                        {row.efficiency !== null ? (
                          <div className="flex items-center gap-2">
                            <span className={`font-semibold min-w-[3ch] ${tv ? 'text-[20px]' : 'text-base'}`}>{row.efficiency}%</span>
                            <div className={`${tv ? 'w-24' : 'w-16'} flex-shrink-0`}>
                              <Progress value={row.efficiency} className={`${tv ? 'h-3' : 'h-2'} bg-muted [&>div]:bg-secondary`} />
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm italic" title="No timesheet data">—</span>
                        )}
                      </td>
                    )}
                    {/* Cleans */}
                    <td className={`${tv ? 'px-5 py-4' : 'px-4 py-3'}`}>
                      <div>
                        <div className={`font-bold ${tv ? 'text-[20px]' : 'text-base'}`}>{row.cleans}</div>
                        <div className={`text-muted-foreground ${tv ? 'text-[14px]' : 'text-xs'}`}>{row.ratedCleans} rated</div>
                      </div>
                    </td>
                    {/* Avg Time */}
                    <td className={`${tv ? 'px-5 py-4' : 'px-4 py-3'}`}>
                      <span className={`font-semibold ${tv ? 'text-[20px]' : 'text-base'}`}>{row.avgMin}</span>
                      <span className={`text-muted-foreground ml-1 ${tv ? 'text-[14px]' : 'text-xs'}`}>min</span>
                    </td>
                    {/* Trend */}
                    <td className={`${tv ? 'px-5 py-4' : 'px-4 py-3'}`}>
                      <TrendArrow dir={row.trend} tv={tv} />
                    </td>
                  </tr>
                );
              })}
              {cleanerRows.length === 0 && (
                <tr>
                  <td colSpan={colSpan} className="px-4 py-8 text-center text-muted-foreground">Loading leaderboard data…</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer */}
      <div className={`flex items-center justify-between mt-5 ${tv ? 'px-2' : ''}`}>
        <p
          key={quoteIdx}
          className={`italic text-muted-foreground max-w-2xl animate-fade-in ${tv ? 'text-[20px]' : 'text-sm'}`}
          style={{ fontFamily: 'Figtree, sans-serif' }}
        >
          "{MOTIVATIONAL_QUOTES[quoteIdx]}"
        </p>
        <span className={`text-muted-foreground ${tv ? 'text-sm' : 'text-xs'}`}>
          Last updated: {format(lastUpdated, 'h:mm a')}
        </span>
      </div>
    </div>
  );
}

// --- Sub-components ---

function PulseCard({ title, value, subtitle, delta, deltaLabel, deltaSuffix, deltaPrefix, tv }: {
  title: string; value: string; subtitle: string; tv: boolean;
  delta?: number | null; deltaLabel?: string; deltaSuffix?: string; deltaPrefix?: string;
}) {
  return (
    <div className="glass-card overflow-hidden">
      <div className="h-1.5 w-full bg-primary" />
      <div className={`${tv ? 'p-8' : 'p-5'}`}>
        <p className={`font-semibold text-muted-foreground uppercase tracking-wider mb-2 ${tv ? 'text-[18px]' : 'text-xs'}`}>{title}</p>
        <div className="flex items-baseline gap-2">
          <span className={`font-black tracking-tight text-foreground ${tv ? 'text-[72px] leading-none' : 'text-4xl'}`}>{value}</span>
          {subtitle && <span className={`text-muted-foreground font-medium ${tv ? 'text-2xl' : 'text-lg'}`}>{subtitle}</span>}
        </div>
        {delta != null && delta !== 0 && (
          <div className={`mt-2 flex items-center gap-1 ${tv ? 'text-[16px]' : 'text-xs'}`}>
            {delta > 0 ? (
              <TrendingUp className={`${tv ? 'h-5 w-5' : 'h-3.5 w-3.5'} text-[hsl(142_71%_45%)]`} />
            ) : (
              <TrendingDown className={`${tv ? 'h-5 w-5' : 'h-3.5 w-3.5'} text-destructive`} />
            )}
            <span className={delta > 0 ? 'text-[hsl(142_71%_45%)] font-semibold' : 'text-destructive font-semibold'}>
              {deltaPrefix ?? (delta > 0 ? '+' : '')}{delta}{deltaSuffix || ''}
            </span>
            <span className="text-muted-foreground">{deltaLabel}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function TrendArrow({ dir, tv }: { dir: TrendDir; tv: boolean }) {
  const size = tv ? 'h-6 w-6' : 'h-4 w-4';
  if (dir === 'improving') return <TrendingUp className={`${size} text-[hsl(142_71%_45%)]`} />;
  if (dir === 'worsening') return <TrendingDown className={`${size} text-[hsl(38_92%_50%)]`} />;
  if (dir === 'new') return <span className={`font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary ${tv ? 'text-sm' : 'text-[10px]'}`}>NEW</span>;
  return <Minus className={`${size} text-muted-foreground`} />;
}

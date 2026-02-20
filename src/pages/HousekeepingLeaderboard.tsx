import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useDateRange } from '@/contexts/DateRangeContext';
import { Monitor, TrendingUp, TrendingDown, Minus, Maximize, Minimize, ArrowUpDown, ArrowUp, ArrowDown, Info, ChevronDown, Settings, Star, X, Ban, RotateCcw, Search, RefreshCw, Users } from 'lucide-react';
import { ResponsiveContainer, ComposedChart, AreaChart, Area, Bar, XAxis, YAxis, ReferenceLine, CartesianGrid, Tooltip as RechartsTooltip, LabelList } from 'recharts';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format, subDays, subMonths, startOfWeek, differenceInDays, isThisWeek } from 'date-fns';

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

// TODO: make goal configurable via settings
const CLEAN_SCORE_GOAL = 4.85;
// TODO: make efficiency goal configurable via settings
const EFFICIENCY_GOAL = 70;

const EXCLUSION_REASONS = ['Retaliatory review', 'Not cleaning related', 'Wrong attribution', 'Other'];
const STAFF_EXCLUSION_REASONS = ['Depot worker', 'Maintenance tech', 'Manager/supervisor', 'Runner', 'No longer cleaning', 'Other'];

type WorkerFilter = 'w2' | '1099' | 'inspectors' | null;
type TrendDir = 'improving' | 'stable' | 'worsening' | 'new';
type SortKey = 'rank' | 'name' | 'streak' | 'overallScore' | 'cleanScore' | 'efficiency' | 'cleans' | 'ratedCleans' | 'avgMin' | 'trend';

// --- Helpers ---
function displayName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length > 1) return `${parts[0]} ${parts[parts.length - 1][0]}.`;
  return parts[0];
}

function abbreviateName(fullName: string): string {
  return displayName(fullName);
}

function computeOverallScore(avgCleanliness: number | null, efficiencyPct: number | null, hasRatings: boolean, hasTimeero: boolean, workerType?: string): number {
  if (workerType === '1099') {
    if (hasRatings && avgCleanliness != null) return Math.round((avgCleanliness / 5) * 100);
    return 0;
  }
  const clean = hasRatings && avgCleanliness != null ? (avgCleanliness / 5) * 80 : 0;
  const eff = hasTimeero && efficiencyPct != null ? (efficiencyPct / 100) * 20 : 0;
  return Math.round(clean + eff);
}

function shouldShowLabel(index: number, total: number, periodDays: number, dataArr: any[], valueKey: string): boolean {
  if (total <= 5) return true;
  if (periodDays <= 95) return index % 2 === 0 || index === total - 1;
  if (index === 0 || index === total - 1) return true;
  const values = dataArr.map(d => Number(d[valueKey]) || 0);
  const maxVal = Math.max(...values);
  const minVal = Math.min(...values);
  const val = values[index];
  if (val === maxVal || val === minVal) return true;
  return false;
}

function dateRangeLabel(from: Date, to: Date): string {
  const days = differenceInDays(to, from);
  let prefix = '';
  if (days <= 35) prefix = 'Last 30 Days';
  else if (days <= 95) prefix = 'Last 3 Months';
  else if (days <= 185) prefix = 'Last 6 Months';
  else if (days <= 370) prefix = 'Last Year';
  else prefix = 'All Time';
  return `${prefix} (${format(from, 'MMM d')} – ${format(to, 'MMM d, yyyy')})`;
}

function minRatedLabel(value: number): string {
  if (value === 0) return 'All Ratings';
  return `${value}+ Ratings`;
}

function workerTypeLabel(filter: WorkerFilter): string {
  if (filter === 'w2') return 'Our Team';
  if (filter === '1099') return 'Contract Cleaners';
  if (filter === 'inspectors') return 'Inspectors';
  return 'Everyone';
}

function renderStars(rating: number | null, size = 14) {
  if (rating == null) return <span className="text-muted-foreground text-xs italic">Not yet rated</span>;
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <Star key={s} className={`${s <= rating ? 'fill-[hsl(38,92%,50%)] text-[hsl(38,92%,50%)]' : 'text-muted-foreground/30'}`} style={{ width: size, height: size }} />
      ))}
    </span>
  );
}

function getLocalToday(): string {
  // Use Mountain Time / America/Denver
  const now = new Date();
  const mtDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Denver' }));
  return format(mtDate, 'yyyy-MM-dd');
}

function getLocalYesterday(): string {
  const now = new Date();
  const mtDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Denver' }));
  mtDate.setDate(mtDate.getDate() - 1);
  return format(mtDate, 'yyyy-MM-dd');
}

function getLocalTodayFormatted(): string {
  const now = new Date();
  const mtDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Denver' }));
  return format(mtDate, 'MMM d, yyyy');
}

function getLocalYesterdayFormatted(): string {
  const now = new Date();
  const mtDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Denver' }));
  mtDate.setDate(mtDate.getDate() - 1);
  return format(mtDate, 'MMM d, yyyy');
}

// Error boundary wrapper for cleaner detail
class DetailErrorBoundary extends React.Component<{ children: React.ReactNode; onError?: () => void }, { hasError: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: any, info: any) {
    console.error('CleanerDetail error:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-center">
          <p className="text-destructive font-semibold mb-2">Unable to load cleaner details</p>
          <Button variant="outline" size="sm" onClick={() => { this.setState({ hasError: false }); this.props.onError?.(); }}>
            Retry
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function HousekeepingLeaderboard() {
  const { dateRange, setDateRange } = useDateRange();
  const queryClient = useQueryClient();
  const [tvMode, setTvMode] = useState(false);
  const [quoteIdx, setQuoteIdx] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [showConfetti, setShowConfetti] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);
  const scrollPhase = useRef<'pause-top' | 'scrolling-down' | 'pause-bottom' | 'spotlight' | 'scrolling-up'>('pause-top');
  const scrollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseStart = useRef(Date.now());
  const [refreshKey, setRefreshKey] = useState(0);
  const [showSpotlight, setShowSpotlight] = useState(false);
  const [spotlightReview, setSpotlightReview] = useState<any>(null);
  const lastSpotlightCleanerId = useRef<number | null>(null);
  const [expandedRowId, setExpandedRowId] = useState<number | null>(null);

  // Cleaner Detail Modal
  const [detailCleanerId, setDetailCleanerId] = useState<number | null>(null);
  const [detailCleanerName, setDetailCleanerName] = useState('');
  const [detailCleanerRow, setDetailCleanerRow] = useState<any>(null);
  const [detailPage, setDetailPage] = useState(0);
  const [detailError, setDetailError] = useState(false);
  const DETAIL_PAGE_SIZE = 50;

  // Admin panel
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminSearch, setAdminSearch] = useState('');
  const [adminExcludeReason, setAdminExcludeReason] = useState('');
  const [adminExcludeTarget, setAdminExcludeTarget] = useState<{ id: string; name: string } | null>(null);

  // Review exclusion popover
  const [excludePopoverId, setExcludePopoverId] = useState<string | null>(null);
  const [excludeReason, setExcludeReason] = useState('');

  // Today's Tasks modal
  const [showTodayTasks, setShowTodayTasks] = useState(false);

  // Shoutout ticker
  const [shoutoutIdx, setShoutoutIdx] = useState(0);

  // Worker type toggle
  const [workerFilter, setWorkerFilter] = useState<WorkerFilter>('w2');
  const is1099 = workerFilter === '1099';
  const isInspectorsTab = workerFilter === 'inspectors';

  // Table filters
  const [minRated, setMinRated] = useState(10);
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
  const rpcWorkerType = workerFilter === 'w2' ? 'w2' : workerFilter === '1099' ? '1099' : workerFilter === 'inspectors' ? undefined : undefined;
  const isInspectors = workerFilter === 'inspectors';

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
      setWorkerFilter('w2');
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

  // TV Mode: auto-scroll with spotlight phase
  useEffect(() => {
    if (!tvMode || !tableRef.current) {
      if (scrollTimer.current) clearInterval(scrollTimer.current);
      setShowSpotlight(false);
      return;
    }
    const el = tableRef.current;
    el.scrollTop = 0;
    scrollPhase.current = 'pause-top';
    phaseStart.current = Date.now();

    scrollTimer.current = setInterval(() => {
      const elapsed = Date.now() - phaseStart.current;
      const maxScroll = el.scrollHeight - el.clientHeight;
      if (maxScroll <= 0 && scrollPhase.current !== 'spotlight') return;
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
          if (elapsed >= 5000) {
            scrollPhase.current = 'spotlight';
            phaseStart.current = Date.now();
            pickSpotlightReview();
          }
          break;
        case 'spotlight':
          if (elapsed >= 12000) {
            setShowSpotlight(false);
            scrollPhase.current = 'scrolling-up';
            phaseStart.current = Date.now();
          }
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

  const { data: leaderboardCurrent, isLoading: lbLoading, isError: lbError, refetch: refetchLb } = useQuery({
    queryKey: ['lb-rpc-current', fromDate, toDate, rpcWorkerType, isInspectors, refreshKey],
    queryFn: async () => {
      if (isInspectors) {
        const { data, error } = await supabase.rpc('get_inspector_leaderboard', { p_start: fromDate, p_end: toDate });
        if (error) { console.error('[RPC] get_inspector_leaderboard error:', error.message); throw error; }
        // Normalize inspector data to match leaderboard shape
        return (data || []).map((r: any) => ({
          assignee_name: r.inspector_name,
          assignee_id: r.inspector_id,
          total_cleans: r.total_inspections,
          avg_minutes: 0,
          avg_cleanliness: r.avg_cleanliness,
          avg_overall: r.avg_overall,
          rated_cleans: r.rated_inspections,
          cleanliness_rated_cleans: r.cleanliness_rated,
          efficiency_pct: null,
          has_timeero: false,
          has_ratings: (r.cleanliness_rated || 0) >= 1,
          last_clean_date: null,
          worker_type: 'inspector',
          bad_reviews: r.bad_reviews,
          perfect_reviews: r.perfect_reviews,
        }));
      }
      const params: { p_start: string; p_end: string; p_worker_type?: string } = { p_start: fromDate, p_end: toDate };
      if (rpcWorkerType) params.p_worker_type = rpcWorkerType;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      try {
        const { data, error } = await supabase.rpc('get_leaderboard', params, { signal: controller.signal } as any);
        clearTimeout(timeout);
        if (error) { console.error('[RPC] get_leaderboard error:', error.message, params); throw error; }
        return data || [];
      } catch (e: any) {
        clearTimeout(timeout);
        console.error('[RPC] get_leaderboard failed:', e?.message, params);
        throw e;
      }
    },
    retry: 2,
    retryDelay: 2000,
  });

  // Also fetch ALL workers (no filter) for admin search
  const { data: leaderboardAll } = useQuery({
    queryKey: ['lb-rpc-all', fromDate, toDate, refreshKey],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_leaderboard', { p_start: fromDate, p_end: toDate });
      if (error) console.error('[RPC] get_leaderboard (all) error:', error.message);
      return data || [];
    },
    retry: 1,
  });

  const { data: leaderboardPrior } = useQuery({
    queryKey: ['lb-rpc-prior', priorFrom, priorTo, rpcWorkerType, refreshKey],
    queryFn: async () => {
      const params: { p_start: string; p_end: string; p_worker_type?: string } = { p_start: priorFrom, p_end: priorTo };
      if (rpcWorkerType) params.p_worker_type = rpcWorkerType;
      const { data, error } = await supabase.rpc('get_leaderboard', params);
      if (error) console.error('[RPC] get_leaderboard (prior) error:', error.message, params);
      return data || [];
    },
    retry: 1,
    retryDelay: 2000,
  });

  // Clean Score Trend - fetch raw ratings data
  const { data: cleanerRatings } = useQuery({
    queryKey: ['lb-cleaner-ratings', fromDate, toDate, refreshKey],
    queryFn: async () => {
      console.log('[CleanScoreTrend] Fetching ratings from', fromDate, 'to', toDate);
      let allRows: { cleanliness_rating: number; reviewed_at: string }[] = [];
      let page = 0;
      const PAGE_SIZE = 5000;
      while (true) {
        const { data, error } = await supabase
          .from('cleaner_ratings_mat')
          .select('cleanliness_rating, reviewed_at')
          .not('cleanliness_rating', 'is', null)
          .not('reviewed_at', 'is', null)
          .gte('reviewed_at', `${fromDate}T00:00:00`)
          .lte('reviewed_at', `${toDate}T23:59:59`)
          .eq('attribution_status', 'cleaner')
          .order('reviewed_at', { ascending: true })
          .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
        if (error) { console.error('[CleanScoreTrend] Error:', error); break; }
        if (!data?.length) break;
        allRows = allRows.concat(data);
        if (data.length < PAGE_SIZE) break;
        page++;
      }
      console.log('[CleanScoreTrend] Got', allRows.length, 'total rows. Last date:', allRows.length ? allRows[allRows.length - 1].reviewed_at : 'none');
      return allRows;
    },
  });

  const { data: weeklyEfficiency } = useQuery({
    queryKey: ['lb-weekly-eff', fromDate, toDate, refreshKey],
    queryFn: async () => {
      const { data } = await supabase
        .from('v_weekly_efficiency')
        .select('*')
        .gte('week_start', fromDate)
        .lte('week_start', toDate)
        .order('week_start', { ascending: true });
      return data || [];
    },
  });

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

  // Clean streaks
  const { data: cleanStreaks } = useQuery({
    queryKey: ['lb-clean-streaks', refreshKey],
    queryFn: async () => {
      const { data } = await supabase.rpc('get_clean_streaks');
      return data || [];
    },
  });

  // Today stats (refresh every 60s)
  const [todayRefreshKey, setTodayRefreshKey] = useState(0);
  const [prevTodayStats, setPrevTodayStats] = useState<any>(null);
  const [todayPulse, setTodayPulse] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setTodayRefreshKey(k => k + 1), 60000);
    return () => clearInterval(t);
  }, []);

  const localToday = getLocalToday();
  const localYesterday = getLocalYesterday();

  const { data: todayStats } = useQuery({
    queryKey: ['lb-today-stats', todayRefreshKey, localToday],
    queryFn: async () => {
      const { data } = await supabase.rpc('get_today_stats', { p_date: localToday });
      const stats = data?.[0] || { total_scheduled: 0, cleans_completed: 0, cleans_in_progress: 0, cleaners_active: 0, avg_completion_minutes: null, cleans_upcoming: 0 };
      return stats;
    },
  });

  // Yesterday fallback stats
  const isZeroToday = todayStats && todayStats.total_scheduled === 0;
  const { data: yesterdayStats } = useQuery({
    queryKey: ['lb-yesterday-stats', localYesterday],
    queryFn: async () => {
      const { data } = await supabase.rpc('get_today_stats', { p_date: localYesterday });
      return data?.[0] || null;
    },
    enabled: !!isZeroToday,
  });

  // Pulse animation when today stats change
  useEffect(() => {
    if (todayStats && prevTodayStats && todayStats.cleans_completed !== prevTodayStats.cleans_completed) {
      setTodayPulse(true);
      const t = setTimeout(() => setTodayPulse(false), 1500);
      return () => clearTimeout(t);
    }
    if (todayStats) setPrevTodayStats(todayStats);
  }, [todayStats]);

  // Today tasks
  const { data: todayTasks, refetch: refetchTodayTasks } = useQuery({
    queryKey: ['lb-today-tasks', localToday],
    queryFn: async () => {
      const { data } = await supabase.rpc('get_today_tasks', { p_date: localToday });
      return data || [];
    },
    enabled: showTodayTasks,
  });

  // Deduplicate today tasks by task_id
  const dedupedTodayTasks = useMemo(() => {
    if (!todayTasks?.length) return [];
    const map = new Map<string, any>();
    todayTasks.forEach((t: any) => {
      if (!map.has(t.task_id)) map.set(t.task_id, t);
    });
    return Array.from(map.values());
  }, [todayTasks]);

  const todayTasksByStatus = useMemo(() => {
    const inProgress = dedupedTodayTasks.filter((t: any) => t.status === 'in_progress');
    const upcoming = dedupedTodayTasks.filter((t: any) => t.status === 'upcoming' || t.status === 'pending' || t.status === 'assigned');
    const completed = dedupedTodayTasks.filter((t: any) => t.status === 'completed' || t.status === 'finished');
    return { inProgress, upcoming, completed };
  }, [dedupedTodayTasks]);

   // Spotlight reviews — use get_cleanliness_shoutouts RPC (v_cleaner_spotlight_reviews was removed)
   const { data: spotlightReviews } = useQuery({
    queryKey: ['lb-spotlight-reviews', refreshKey],
    queryFn: async () => {
      const { data } = await supabase.rpc('get_cleanliness_shoutouts', { since_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() });
      return (data || []).map((r: any) => ({
        ...r,
        assignee_name: r.cleaner_names,
        assignee_id: null, // RPC doesn't return assignee_id directly
        review_date: r.reviewed_at,
        listing_name: r.property_name,
      }));
    },
  });

  // Weekly shoutouts (refresh every 30 min)
  const [shoutoutRefreshKey, setShoutoutRefreshKey] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setShoutoutRefreshKey(k => k + 1), 30 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  const { data: weeklyShoutouts } = useQuery({
    queryKey: ['lb-weekly-shoutouts', shoutoutRefreshKey],
    queryFn: async () => {
      const { data } = await supabase.rpc('get_weekly_shoutouts');
      return data || [];
    },
  });

  // Rotate shoutouts every 6 seconds
  useEffect(() => {
    if (!weeklyShoutouts?.length) return;
    const t = setInterval(() => setShoutoutIdx(i => (i + 1) % weeklyShoutouts.length), 6000);
    return () => clearInterval(t);
  }, [weeklyShoutouts?.length]);

  // Rating distribution — computed from cleaner_ratings_mat (v_cleaner_rating_distribution was removed)
  const { data: ratingDistribution } = useQuery({
    queryKey: ['lb-rating-dist', refreshKey],
    queryFn: async () => {
      const { data } = await supabase
        .from('cleaner_ratings_mat')
        .select('assignee_id, cleanliness_rating')
        .not('cleanliness_rating', 'is', null)
        .eq('attribution_status', 'cleaner');
      if (!data?.length) return [];
      // Aggregate into distribution per assignee
      const byAssignee = new Map<number, { five: number; four: number; three: number; two: number; one: number; total: number }>();
      data.forEach((r: any) => {
        const id = Number(r.assignee_id);
        if (!byAssignee.has(id)) byAssignee.set(id, { five: 0, four: 0, three: 0, two: 0, one: 0, total: 0 });
        const d = byAssignee.get(id)!;
        const rating = Number(r.cleanliness_rating);
        if (rating >= 4.5) d.five++;
        else if (rating >= 3.5) d.four++;
        else if (rating >= 2.5) d.three++;
        else if (rating >= 1.5) d.two++;
        else d.one++;
        d.total++;
      });
      return Array.from(byAssignee.entries()).map(([id, dist]) => ({
        assignee_id: id,
        five_star: dist.five,
        four_star: dist.four,
        three_star: dist.three,
        two_star: dist.two,
        one_star: dist.one,
        total_ratings: dist.total,
      }));
    },
  });

  // Spotlight reviews per cleaner (for expandable rows) — use RPC
  const { data: allSpotlightReviews } = useQuery({
    queryKey: ['lb-all-spotlight', refreshKey],
    queryFn: async () => {
      const { data } = await supabase.rpc('get_cleanliness_shoutouts', { since_date: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString() });
      return (data || []).map((r: any) => ({
        ...r,
        assignee_name: r.cleaner_names,
        review_date: r.reviewed_at,
      }));
    },
  });

  // Cleaner detail query — FIX: cast assignee_id to number
  const { data: cleanerDetail, isLoading: detailLoading, error: detailQueryError } = useQuery({
    queryKey: ['lb-cleaner-detail', detailCleanerId, fromDate, toDate],
    queryFn: async () => {
      if (!detailCleanerId) return [];
      const numericId = Number(detailCleanerId);
      if (isNaN(numericId)) {
        console.error('[CleanerDetail] Invalid assignee_id:', detailCleanerId);
        return [];
      }
      console.log('[CleanerDetail] Fetching for assignee_id:', numericId);
      const { data, error } = await supabase.rpc('get_cleaner_detail', {
        p_assignee_id: numericId,
        p_start: fromDate,
        p_end: toDate,
      });
      if (error) {
        console.error('[CleanerDetail] RPC error:', error);
        throw error;
      }
      console.log('[CleanerDetail] Got', data?.length, 'rows');
      return data || [];
    },
    enabled: detailCleanerId != null,
    retry: 1,
  });

  // Admin: fetch exclusions
  const { data: staffExclusions, refetch: refetchStaffExclusions } = useQuery({
    queryKey: ['lb-staff-exclusions'],
    queryFn: async () => {
      const { data } = await supabase
        .from('leaderboard_exclusions')
        .select('*')
        .order('excluded_at', { ascending: false });
      return data || [];
    },
    enabled: showAdmin,
  });

  const { data: reviewExclusions, refetch: refetchReviewExclusions } = useQuery({
    queryKey: ['lb-review-exclusions'],
    queryFn: async () => {
      const { data } = await supabase
        .from('review_exclusions')
        .select('*')
        .order('excluded_at', { ascending: false });
      return data || [];
    },
    enabled: showAdmin || detailCleanerId != null,
  });

  // Build maps
  const streakMap = useMemo(() => {
    const map = new Map<number, { current_streak: number; best_streak: number; streak_start_date: string }>();
    (cleanStreaks || []).forEach((s: any) => {
      map.set(Number(s.assignee_id), { current_streak: s.current_streak, best_streak: s.best_streak, streak_start_date: s.streak_start_date });
    });
    return map;
  }, [cleanStreaks]);

  const ratingDistMap = useMemo(() => {
    const map = new Map<number, { five: number; four: number; three: number; two: number; one: number; total: number }>();
    (ratingDistribution || []).forEach((r: any) => {
      map.set(Number(r.assignee_id), {
        five: Number(r.five_star) || 0,
        four: Number(r.four_star) || 0,
        three: Number(r.three_star) || 0,
        two: Number(r.two_star) || 0,
        one: Number(r.one_star) || 0,
        total: Number(r.total_ratings) || 0,
      });
    });
    return map;
  }, [ratingDistribution]);

  // W2 assignee IDs set for spotlight filtering (FIX 3)
  const w2AssigneeIds = useMemo(() => {
    const set = new Set<number>();
    (leaderboardAll || []).forEach((r: any) => {
      if (r.worker_type === 'w2') set.add(Number(r.assignee_id));
    });
    return set;
  }, [leaderboardAll]);

  // Pick spotlight review (avoid same cleaner twice in a row, dedup review text, W2 only)
  const pickSpotlightReview = useCallback(() => {
    if (!spotlightReviews?.length) { setShowSpotlight(false); return; }
    const seen = new Set<string>();
    const deduped = spotlightReviews
      .filter((r: any) => w2AssigneeIds.size === 0 || w2AssigneeIds.has(Number(r.assignee_id)))
      .filter((r: any) => {
        const key = r.review_text || '';
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    const candidates = deduped.filter((r: any) => Number(r.assignee_id) !== lastSpotlightCleanerId.current);
    const pool = candidates.length > 0 ? candidates : deduped;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (pick) {
      lastSpotlightCleanerId.current = Number(pick.assignee_id);
      setSpotlightReview(pick);
      setShowSpotlight(true);
    }
  }, [spotlightReviews, w2AssigneeIds]);

  // ====== Prior period map ======
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
    return Number((rated.reduce((s, r) => s + Number(r.avg_cleanliness), 0) / rated.length).toFixed(2));
  }, [leaderboardCurrent]);

  const priorTeamCleanScore = useMemo(() => {
    const rated = (leaderboardPrior || []).filter(r => r.has_ratings && r.avg_cleanliness != null);
    if (!rated.length) return 0;
    return Number((rated.reduce((s, r) => s + Number(r.avg_cleanliness), 0) / rated.length).toFixed(2));
  }, [leaderboardPrior]);

  const teamEfficiency = useMemo(() => {
    const withEff = (leaderboardCurrent || []).filter((r: any) => r.has_timeero && r.efficiency_pct != null);
    if (!withEff.length) return 0;
    const totalTasks = withEff.reduce((s: number, r: any) => s + (Number(r.total_cleans) || 0), 0);
    if (totalTasks === 0) return 0;
    const weightedSum = withEff.reduce((s: number, r: any) => s + (Number(r.efficiency_pct) || 0) * (Number(r.total_cleans) || 0), 0);
    return Math.round(weightedSum / totalTasks);
  }, [leaderboardCurrent]);

  const priorTeamEfficiency = useMemo(() => {
    const withEff = (leaderboardPrior || []).filter((r: any) => r.has_timeero && r.efficiency_pct != null);
    if (!withEff.length) return 0;
    const totalTasks = withEff.reduce((s: number, r: any) => s + (Number(r.total_cleans) || 0), 0);
    if (totalTasks === 0) return 0;
    const weightedSum = withEff.reduce((s: number, r: any) => s + (Number(r.efficiency_pct) || 0) * (Number(r.total_cleans) || 0), 0);
    return Math.round(weightedSum / totalTasks);
  }, [leaderboardPrior]);

  const totalCleans = useMemo(() => {
    return (leaderboardCurrent || []).reduce((s, c) => s + (Number(c.total_cleans) || 0), 0);
  }, [leaderboardCurrent]);

  const priorTotalCleans = useMemo(() => {
    return (leaderboardPrior || []).reduce((s, c) => s + (Number(c.total_cleans) || 0), 0);
  }, [leaderboardPrior]);

  // Confetti
  useEffect(() => {
    if (tvMode && teamCleanScore >= 4.5 && teamEfficiency >= EFFICIENCY_GOAL) {
      setShowConfetti(true);
      const t = setTimeout(() => setShowConfetti(false), 4000);
      return () => clearTimeout(t);
    }
  }, [tvMode, teamCleanScore, teamEfficiency]);

  // ====== TREND CHARTS ======
  const cleanScoreTrend = useMemo(() => {
    const weekMap = new Map<string, { sum: number; count: number }>();
    (cleanerRatings || []).forEach((r: any) => {
      const dateVal = r.review_date || r.reviewed_at;
      if (!dateVal) return;
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return;
      const wStart = startOfWeek(d, { weekStartsOn: 1 });
      const key = format(wStart, 'yyyy-MM-dd');
      const cur = weekMap.get(key) || { sum: 0, count: 0 };
      cur.sum += Number(r.cleanliness_rating) || 0;
      cur.count += 1;
      weekMap.set(key, cur);
    });
    const result = Array.from(weekMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .filter(([_, v]) => v.count > 0)
      .map(([key, v]) => ({
        week: key,
        label: format(new Date(key + 'T00:00:00'), 'MMM d'),
        score: Number((v.sum / v.count).toFixed(2)),
        ratingCount: v.count,
        isPartial: isThisWeek(new Date(key + 'T00:00:00'), { weekStartsOn: 1 }),
      }));
    console.log('[CleanScoreTrend] Processed', result.length, 'weeks. First:', result[0]?.week, 'Last:', result[result.length - 1]?.week);
    return result;
  }, [cleanerRatings]);

  const efficiencyTrend = useMemo(() => {
    const weeks = weeklyEfficiency || [];
    if (!weeks.length) return [];
    const byWeek = new Map<string, { totalMins: number; totalCleans: number; people: Set<number> }>();
    weeks.forEach((w: any) => {
      const key = w.week_start as string;
      if (!key) return;
      const cur = byWeek.get(key) || { totalMins: 0, totalCleans: 0, people: new Set<number>() };
      const cleanCount = Number(w.clean_count) || 0;
      const avgMin = Number(w.avg_minutes) || 0;
      cur.totalMins += avgMin * cleanCount;
      cur.totalCleans += cleanCount;
      if (w.assignee_id) cur.people.add(Number(w.assignee_id));
      byWeek.set(key, cur);
    });
    return Array.from(byWeek.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .filter(([_, v]) => v.totalCleans > 0)
      .map(([key, v]) => ({
        week: key,
        label: format(new Date(key), 'MMM d'),
        efficiency: Math.round(v.totalMins / v.totalCleans),
        people: v.people.size,
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

        const streak = streakMap.get(assigneeId);

        return {
          id: assigneeId,
          name: displayName(c.assignee_name!),
          fullName: c.assignee_name!,
          workerType: wType || 'w2',
          overallScore,
          priorScore,
          hasPriorData: !!prior,
          cleanScore: avgCleanliness != null ? Number(avgCleanliness.toFixed(2)) : null,
          efficiency: effPct != null ? Math.round(effPct) : null,
          hasTimesheet: hasTimeero,
          hasRatings: hasRatings && avgCleanliness != null,
          cleans: Number(c.total_cleans) || 0,
          ratedCleans,
          avgOverall: c.avg_overall != null ? Number(c.avg_overall) : null,
          avgMin: Math.round(Number(c.avg_minutes) || 0),
          trend,
          scoreDelta: prior ? overallScore - priorScore : 0,
          currentStreak: streak?.current_streak || 0,
          bestStreak: streak?.best_streak || 0,
          badReviews: (c as any).bad_reviews != null ? Number((c as any).bad_reviews) : null,
          perfectReviews: (c as any).perfect_reviews != null ? Number((c as any).perfect_reviews) : null,
        };
      });

    let filtered = rows;
    const effectiveMinRated = tvMode ? Math.max(minRated, 10) : minRated;
    if (effectiveMinRated > 0) filtered = filtered.filter(r => r.ratedCleans >= effectiveMinRated);
    if (dataCompleteness === 'full') filtered = filtered.filter(r => r.hasRatings && r.hasTimesheet);
    else if (dataCompleteness === 'rated') filtered = filtered.filter(r => r.hasRatings);
    else if (dataCompleteness === 'efficiency') filtered = filtered.filter(r => r.hasTimesheet);

    filtered.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'name': cmp = a.name.localeCompare(b.name); break;
        case 'streak': cmp = a.currentStreak - b.currentStreak; break;
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
  }, [leaderboardCurrent, priorMap, streakMap, minRated, dataCompleteness, sortKey, sortAsc, tvMode]);

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

  const handleSort = useCallback((key: SortKey) => {
    if (sortKey === key) setSortAsc(a => !a);
    else { setSortKey(key); setSortAsc(false); }
  }, [sortKey]);

  useEffect(() => {
    if (is1099 && (dataCompleteness === 'full' || dataCompleteness === 'efficiency')) {
      setDataCompleteness('all');
    }
  }, [is1099, dataCompleteness]);

  const tv = tvMode;
  const showEfficiency = !is1099 && !isInspectorsTab;
  const dataComplOptions = is1099 ? DATA_COMPLETENESS_OPTIONS_1099 : DATA_COMPLETENESS_OPTIONS_ALL;

  const scoreTooltipText = is1099
    ? 'Score = 100% Clean Rating (contract cleaners)'
    : 'Score = 80% Clean Rating + 20% Efficiency. Clean quality is the #1 priority.';

  const showEfficiencyCol = showEfficiency && !isInspectorsTab;
  const tableHeaders: { key: SortKey; label: string; tooltip: string; show: boolean }[] = [
    { key: 'rank', label: 'Rank', tooltip: '', show: true },
    { key: 'name', label: isInspectorsTab ? 'Inspector' : 'Cleaner', tooltip: '', show: true },
    { key: 'streak', label: 'Streak', tooltip: 'Consecutive 5-star cleanliness ratings', show: !isInspectorsTab },
    { key: 'overallScore', label: 'Overall', tooltip: scoreTooltipText, show: !isInspectorsTab },
    { key: 'cleanScore', label: 'Clean Score', tooltip: '', show: true },
    { key: 'efficiency', label: 'Efficiency', tooltip: '', show: showEfficiencyCol },
    { key: 'cleans', label: isInspectorsTab ? 'Inspections' : 'Cleans', tooltip: '', show: true },
    { key: 'avgMin', label: isInspectorsTab ? 'Bad Reviews' : 'Avg Time', tooltip: isInspectorsTab ? 'Sub-4.0 cleanliness reviews' : '', show: true },
    { key: 'trend', label: 'Trend', tooltip: '', show: !isInspectorsTab },
  ];
  const visibleHeaders = tableHeaders.filter(h => h.show);
  const colSpan = visibleHeaders.length;

  const workerPills: { label: string; value: WorkerFilter }[] = [
    { label: 'Our Team', value: 'w2' },
    { label: 'Contract Cleaners', value: '1099' },
    { label: 'Inspectors', value: 'inspectors' },
    { label: 'Everyone', value: null },
  ];

  const datePresets = [
    { label: '1M', months: 1 },
    { label: '3M', months: 3 },
    { label: '6M', months: 6 },
    { label: '1Y', months: 12 },
  ];

  const getActiveDateLabel = () => {
    if (periodDays > 360 && periodDays < 370) return '1Y';
    if (periodDays > 175 && periodDays < 185) return '6M';
    if (periodDays > 88 && periodDays < 93) return '3M';
    if (periodDays > 28 && periodDays < 32) return '1M';
    if (periodDays > 700) return 'All';
    return '';
  };
  const activeDateLabel = getActiveDateLabel();

  const contextLine = `${workerTypeLabel(workerFilter)} · ${dateRangeLabel(dateRange.from, dateRange.to)} · ${minRatedLabel(minRated)}`;

  // Formatted shoutout text with privacy names
  // Active cleaner IDs from current leaderboard (for filtering shoutouts/streaks)
  const activeCleanerIds = useMemo(() => {
    const set = new Set<number>();
    (leaderboardCurrent || []).forEach((r: any) => set.add(Number(r.assignee_id)));
    // Also include leaderboardAll to catch everyone toggle
    (leaderboardAll || []).forEach((r: any) => set.add(Number(r.assignee_id)));
    return set;
  }, [leaderboardCurrent, leaderboardAll]);

  const formattedShoutouts = useMemo(() => {
    if (!weeklyShoutouts?.length) return [];
    const icons: Record<string, string> = {
      most_cleans: '🏆',
      biggest_improvement: '📈',
      hot_streak: '🔥',
      perfect_week: '⭐',
    };
    // Filter to only active cleaners (those who appear in the current leaderboard data)
    const filtered = weeklyShoutouts.filter((s: any) => {
      if (!s.assignee_id) return true;
      return activeCleanerIds.has(Number(s.assignee_id));
    });
    return filtered.map((s: any) => {
      const icon = icons[s.shoutout_type] || '✨';
      let desc = s.description || '';
      if (s.assignee_name) {
        desc = desc.replace(s.assignee_name, abbreviateName(s.assignee_name));
        desc = desc.replace(new RegExp(s.assignee_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "'s", 'g'), abbreviateName(s.assignee_name) + "'s");
      }
      return `${icon} ${desc}`;
    });
  }, [weeklyShoutouts, activeCleanerIds]);

  // Goal thermometer
  const goalProgress = useMemo(() => {
    if (teamCleanScore <= 0) return 0;
    const min = 4.5;
    const max = 5.0;
    return Math.max(0, Math.min(100, ((teamCleanScore - min) / (max - min)) * 100));
  }, [teamCleanScore]);

  const goalMarkerPosition = useMemo(() => {
    return ((CLEAN_SCORE_GOAL - 4.5) / 0.5) * 100;
  }, []);

  const goalReached = teamCleanScore >= CLEAN_SCORE_GOAL;
  const distanceToGoal = Math.max(0, CLEAN_SCORE_GOAL - teamCleanScore);

  // Efficiency goal thermometer
  const effGoalProgress = useMemo(() => {
    return Math.max(0, Math.min(100, teamEfficiency));
  }, [teamEfficiency]);

  const effGoalMarkerPosition = EFFICIENCY_GOAL;
  const effGoalReached = teamEfficiency >= EFFICIENCY_GOAL;
  const effDistanceToGoal = Math.max(0, EFFICIENCY_GOAL - teamEfficiency);

  // Custom label renderers
  const ScoreLabelRenderer = useCallback((props: any) => {
    const { x, y, index, value } = props;
    if (!shouldShowLabel(index, cleanScoreTrend.length, periodDays, cleanScoreTrend, 'score')) return null;
    return (
      <g>
        {tv && <rect x={x - 18} y={y - 22} width={36} height={18} rx={4} fill="white" fillOpacity={0.85} />}
        <text x={x} y={y - 12} textAnchor="middle" fill="hsl(5, 87%, 55%)" fontSize={tv ? 16 : 10} fontWeight={700} fontFamily="Figtree, sans-serif">
          {value}
        </text>
      </g>
    );
  }, [cleanScoreTrend.length, periodDays, tv]);

  const EffLabelRenderer = useCallback((props: any) => {
    const { x, y, index, value } = props;
    if (!shouldShowLabel(index, efficiencyTrend.length, periodDays, efficiencyTrend, 'efficiency')) return null;
    return (
      <g>
        {tv && <rect x={x - 22} y={y - 22} width={44} height={18} rx={4} fill="white" fillOpacity={0.85} />}
        <text x={x} y={y - 12} textAnchor="middle" fill="hsl(5, 61%, 28%)" fontSize={tv ? 16 : 10} fontWeight={700} fontFamily="Figtree, sans-serif">
          {value}%
        </text>
      </g>
    );
  }, [efficiencyTrend.length, periodDays, tv]);

  const RatingCountLabelRenderer = useCallback((props: any) => {
    const { x, y, index, value } = props;
    if (!shouldShowLabel(index, cleanScoreTrend.length, periodDays, cleanScoreTrend, 'ratingCount')) return null;
    return (
      <text x={x} y={y - 4} textAnchor="middle" fill="hsl(240, 4%, 50%)" fontSize={tv ? 16 : 9} fontWeight={tv ? 700 : 400} fontFamily="Figtree, sans-serif">
        {value}
      </text>
    );
  }, [cleanScoreTrend.length, periodDays, tv]);

  // Featured review for non-TV mode
  const featuredReview = useMemo(() => {
    if (!spotlightReviews?.length) return null;
    const w2Only = spotlightReviews.filter((r: any) => w2AssigneeIds.size === 0 || w2AssigneeIds.has(Number(r.assignee_id)));
    return w2Only[0] || spotlightReviews[0];
  }, [spotlightReviews, w2AssigneeIds]);

  // Exclude review action
  const handleExcludeReview = async (reviewId: string, assigneeId: number, reason: string) => {
    await supabase.from('review_exclusions').insert({
      review_id: reviewId,
      assignee_id: String(assigneeId),
      reason,
      excluded_by: 'manager',
    });
    setExcludePopoverId(null);
    setExcludeReason('');
    queryClient.invalidateQueries({ queryKey: ['lb-review-exclusions'] });
    queryClient.invalidateQueries({ queryKey: ['lb-cleaner-detail'] });
  };

  const handleRestoreReview = async (reviewId: string, assigneeId: string | null) => {
    let q = supabase.from('review_exclusions').delete().eq('review_id', reviewId);
    if (assigneeId) q = q.eq('assignee_id', assigneeId);
    await q;
    queryClient.invalidateQueries({ queryKey: ['lb-review-exclusions'] });
    queryClient.invalidateQueries({ queryKey: ['lb-cleaner-detail'] });
  };

  // Admin: exclude staff
  const handleExcludeStaff = async () => {
    if (!adminExcludeTarget || !adminExcludeReason) return;
    await supabase.from('leaderboard_exclusions').insert({
      assignee_id: adminExcludeTarget.id,
      assignee_name: adminExcludeTarget.name,
      reason: adminExcludeReason,
      excluded_by: 'manager',
    });
    setAdminExcludeTarget(null);
    setAdminExcludeReason('');
    setAdminSearch('');
    refetchStaffExclusions();
    setRefreshKey(k => k + 1);
  };

  const handleRestoreStaff = async (assigneeId: string) => {
    await supabase.from('leaderboard_exclusions').delete().eq('assignee_id', assigneeId);
    refetchStaffExclusions();
    setRefreshKey(k => k + 1);
  };

  const handleRestoreReviewAdmin = async (reviewId: string) => {
    await supabase.from('review_exclusions').delete().eq('review_id', reviewId);
    refetchReviewExclusions();
  };

  // Open cleaner detail
  const openCleanerDetail = (row: any) => {
    setDetailCleanerId(Number(row.id));
    setDetailCleanerName(row.name);
    setDetailCleanerRow(row);
    setDetailPage(0);
    setDetailError(false);
  };

  // Admin search results
  const adminSearchResults = useMemo(() => {
    if (!adminSearch.trim() || !leaderboardAll?.length) return [];
    const q = adminSearch.toLowerCase();
    return leaderboardAll
      .filter(c => c.assignee_name?.toLowerCase().includes(q))
      .slice(0, 10)
      .map(c => ({ id: String(c.assignee_id), name: c.assignee_name! }));
  }, [adminSearch, leaderboardAll]);

  // Detail pagination
  const detailPaginated = useMemo(() => {
    if (!cleanerDetail?.length) return [];
    return cleanerDetail.slice(0, (detailPage + 1) * DETAIL_PAGE_SIZE);
  }, [cleanerDetail, detailPage]);

  const hasMoreDetail = (cleanerDetail?.length || 0) > (detailPage + 1) * DETAIL_PAGE_SIZE;

  // Total cleans delta for footnote
  const totalCleansDelta = totalCleans - priorTotalCleans;

  // Today's ops computed values
  const todayRemaining = todayStats ? Math.max(0, (todayStats.total_scheduled || 0) - (todayStats.cleans_completed || 0) - (todayStats.cleans_in_progress || 0)) : 0;
  const todayCompletionPct = todayStats && todayStats.total_scheduled > 0 ? Math.round(((todayStats.cleans_completed || 0) / todayStats.total_scheduled) * 100) : 0;
  const todayCompletedWidth = todayStats && todayStats.total_scheduled > 0 ? ((todayStats.cleans_completed || 0) / todayStats.total_scheduled) * 100 : 0;
  const todayInProgressWidth = todayStats && todayStats.total_scheduled > 0 ? ((todayStats.cleans_in_progress || 0) / todayStats.total_scheduled) * 100 : 0;

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
                background: ['hsl(5, 87%, 55%)', 'hsl(38, 92%, 50%)', 'hsl(142, 71%, 45%)', 'hsl(5, 61%, 28%)'][i % 4],
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

      {/* TV Spotlight Overlay */}
      {tv && showSpotlight && spotlightReview && (
        <div className="fixed inset-0 z-[10002] flex items-center justify-center bg-black/30 animate-fade-in" style={{ animationDuration: '0.6s' }}>
        <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-8 p-12 text-center" style={{ animation: 'spotlightIn 0.6s ease-out' }}>
            <div className="flex justify-center gap-1 mb-2">
              {[1, 2, 3, 4, 5].map(s => (
                <span key={s} className="text-[28px]">⭐</span>
              ))}
            </div>
            <p className="font-bold text-lg mb-4" style={{ color: 'hsl(38, 92%, 50%)', fontFamily: 'Figtree, sans-serif' }}>5-Star Clean</p>
            <h2 className="font-black text-5xl mb-3" style={{ color: 'hsl(5, 87%, 55%)', fontFamily: 'Figtree, sans-serif' }}>
              {abbreviateName(spotlightReview.assignee_name || '')}
            </h2>
            {(() => {
              const sid = Number(spotlightReview.assignee_id);
              const streak = streakMap.get(sid);
              if (streak && streak.current_streak >= 3) {
                return <div className="text-xl mb-2" style={{ color: 'hsl(5, 87%, 55%)' }}>🔥 {streak.current_streak} streak</div>;
              }
              return null;
            })()}
            <p className="text-xl text-muted-foreground mb-6" style={{ fontFamily: 'Figtree, sans-serif' }}>
              Cleaned at {spotlightReview.property_name || spotlightReview.listing_name || 'a property'}
            </p>
            {spotlightReview.review_text && (
              <p className="text-[28px] italic text-foreground mb-6" style={{ fontFamily: 'Figtree, sans-serif', lineHeight: 1.5 }}>
                &ldquo;{spotlightReview.review_text.length > 150 ? spotlightReview.review_text.slice(0, 150) + '...' : spotlightReview.review_text}&rdquo;
              </p>
            )}
            {spotlightReview.review_date && (
              <p className="text-sm text-muted-foreground">{format(new Date(spotlightReview.review_date), 'MMMM d, yyyy')}</p>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-1 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Monitor className={`${tv ? 'h-8 w-8' : 'h-6 w-6'} text-primary`} />
          <h1 className={`${tv ? 'text-5xl' : 'text-page-title'} font-black`}>Housekeeping Leaderboard</h1>
          {!tv && (
            <button onClick={() => setShowAdmin(true)} className="text-muted-foreground hover:text-foreground transition-colors" title="Manage Exclusions">
              <Settings className="h-5 w-5" />
            </button>
          )}
        </div>
        {!tv && (
          <Link
            to="/leaderboard/tv"
            target="_blank"
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all border border-primary text-primary hover:bg-primary/10"
          >
            📺 TV Slideshow
          </Link>
        )}
        <button
          onClick={() => setTvMode(!tvMode)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all bg-primary text-primary-foreground hover:bg-primary/90 ${tv && !showExitBtn ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
          style={tv ? { position: 'fixed', top: 20, right: 40, zIndex: 10001 } : undefined}
        >
          {tv ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          {tv ? 'Exit TV' : 'TV Mode'}
        </button>
      </div>

      {/* Context Line + Date pills */}
      <div className={`flex items-center flex-wrap gap-3 mb-3 ${tv ? 'mb-4' : ''}`}>
        <p className="text-muted-foreground" style={{ fontSize: tv ? 20 : 14, fontFamily: 'Figtree, sans-serif', opacity: 0.6 }}>
          {contextLine}
        </p>
        {tv && (
          <div className="flex gap-1 ml-2">
            {datePresets.map(p => (
              <button
                key={p.label}
                onClick={() => setDateRange({ from: subMonths(new Date(), p.months), to: new Date() })}
                className={`rounded-full font-semibold transition-all border ${
                  activeDateLabel === p.label
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-card text-muted-foreground border-border hover:border-primary/40'
                }`}
                style={{ fontSize: 14, padding: '2px 12px' }}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}
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

      {/* ===== TWO-SECTION KPI ROW ===== */}
      <div className={`grid gap-4 ${tv ? 'gap-6' : ''} mb-5 items-start`} style={{ gridTemplateColumns: '3fr 2fr' }}>
        {/* LEFT: Today's Operations */}
        <div
          className={`glass-card overflow-hidden ${!tv ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
          onClick={!tv ? () => setShowTodayTasks(true) : undefined}
        >
          <div className="h-1.5 w-full" style={{ background: 'hsl(5, 87%, 55%)' }} />
          <div className={tv ? 'p-6' : 'p-4'}>
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-foreground" style={{ fontSize: tv ? 18 : 14, fontFamily: 'Figtree, sans-serif' }}>
                {isZeroToday && yesterdayStats ? `Yesterday's Results · ${getLocalYesterdayFormatted()}` : `Today's Operations · ${getLocalTodayFormatted()}`}
              </h3>
              {!tv && !isZeroToday && (
                <span className="text-[10px] text-muted-foreground">Click for details</span>
              )}
            </div>

            {isZeroToday && yesterdayStats ? (
              /* Yesterday fallback — static summary */
              <div className="flex items-center justify-center gap-6 flex-wrap" style={{ fontFamily: 'Figtree, sans-serif' }}>
                <span className="flex items-center gap-1.5">
                  <span className={tv ? 'text-[24px]' : 'text-lg'}>📋</span>
                  <span className={`font-black ${tv ? 'text-[28px]' : 'text-xl'}`}>{yesterdayStats.total_scheduled}</span>
                  <span className="text-muted-foreground text-sm">Scheduled</span>
                </span>
                <span className="text-muted-foreground/40">·</span>
                <span className="flex items-center gap-1.5">
                  <span className={tv ? 'text-[24px]' : 'text-lg'}>✅</span>
                  <span className={`font-black ${tv ? 'text-[28px]' : 'text-xl'}`}>{yesterdayStats.cleans_completed}</span>
                  <span className="text-muted-foreground text-sm">Completed</span>
                </span>
                <span className="text-muted-foreground/40">·</span>
                <span className="flex items-center gap-1.5">
                  <span className={tv ? 'text-[24px]' : 'text-lg'}>👥</span>
                  <span className={`font-black ${tv ? 'text-[28px]' : 'text-xl'}`}>{yesterdayStats.cleaners_active}</span>
                  <span className="text-muted-foreground text-sm">Cleaners</span>
                </span>
                {yesterdayStats.avg_completion_minutes && (
                  <>
                    <span className="text-muted-foreground/40">·</span>
                    <span className="flex items-center gap-1.5">
                      <span className={tv ? 'text-[24px]' : 'text-lg'}>⏱️</span>
                      <span className={`font-black ${tv ? 'text-[28px]' : 'text-xl'}`}>{Math.round(yesterdayStats.avg_completion_minutes)}</span>
                      <span className="text-muted-foreground text-sm">min avg</span>
                    </span>
                  </>
                )}
              </div>
            ) : todayStats ? (
              <>
                {/* Four stat boxes */}
                <div className="grid grid-cols-4 gap-3 mb-3">
                  {[
                    { emoji: '📋', value: todayStats.total_scheduled || 0, label: 'Scheduled', color: 'text-foreground' },
                    { emoji: '✅', value: todayStats.cleans_completed || 0, label: 'Completed', color: 'text-[hsl(142,71%,45%)]' },
                    { emoji: '🔄', value: todayStats.cleans_in_progress || 0, label: 'In Progress', color: 'text-primary', pulse: (todayStats.cleans_in_progress || 0) > 0 },
                    { emoji: '⏳', value: todayRemaining, label: 'Remaining', color: 'text-muted-foreground' },
                  ].map(s => (
                    <div key={s.label} className="text-center">
                      <span className={tv ? 'text-[24px]' : 'text-lg'}>{s.emoji}</span>
                      <div
                        className={`font-black ${s.color} ${s.pulse ? 'animate-pulse' : ''} ${todayPulse && s.label === 'Completed' ? 'text-[hsl(142,71%,45%)]' : ''}`}
                        style={{ fontSize: tv ? 36 : 28, fontFamily: 'Figtree, sans-serif', transition: 'color 0.3s' }}
                      >
                        {s.value}
                      </div>
                      <div className="text-muted-foreground" style={{ fontSize: tv ? 14 : 12 }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Progress bar */}
                {(todayStats.total_scheduled || 0) > 0 && (
                  <div>
                    <div className="w-full rounded-full overflow-hidden flex" style={{ height: tv ? 10 : 6, background: 'hsl(0, 0%, 92%)' }}>
                      <div style={{ width: `${todayCompletedWidth}%`, background: 'hsl(142, 71%, 45%)', transition: 'width 0.5s' }} />
                      <div className={(todayStats.cleans_in_progress || 0) > 0 ? 'animate-pulse' : ''} style={{ width: `${todayInProgressWidth}%`, background: 'hsl(5, 87%, 55%)', transition: 'width 0.5s' }} />
                    </div>
                    <p className="text-muted-foreground mt-0.5" style={{ fontSize: tv ? 11 : 9 }}>
                      {todayStats.cleans_completed} of {todayStats.total_scheduled} complete — {todayCompletionPct}%
                    </p>
                  </div>
                )}
                {/* Mini summary stats */}
                <div className="flex items-center gap-3 mt-2 flex-wrap" style={{ fontSize: tv ? 14 : 11, color: 'hsl(240, 4%, 40%)' }}>
                  <span>👥 {todayStats.cleaners_active || 0} cleaners</span>
                  <span className="text-muted-foreground/40">·</span>
                  <span>⏱️ avg {todayStats.avg_completion_minutes ? Math.round(todayStats.avg_completion_minutes) : '—'} min</span>
                </div>
              </>
            ) : (
              <div className="text-center text-muted-foreground py-4">Loading...</div>
            )}
          </div>
        </div>

        {/* RIGHT: Team Performance stacked */}
        <div className="glass-card overflow-hidden">
          <div className="h-1.5 w-full bg-primary" />
          <div className={tv ? 'p-6' : 'p-4'}>
            {/* Team Clean Score */}
            <p className={`font-semibold text-muted-foreground uppercase tracking-wider mb-1 ${tv ? 'text-[16px]' : 'text-[10px]'}`}>Team Clean Score</p>
            <div className="flex items-baseline gap-2">
              <span className={`font-black tracking-tight text-foreground ${tv ? 'text-[48px] leading-none' : 'text-3xl'}`}>
                {lbLoading ? '—' : lbError ? 'Error' : teamCleanScore > 0 ? teamCleanScore.toFixed(2) : '—'}
              </span>
              <span className={`text-muted-foreground font-medium ${tv ? 'text-xl' : 'text-sm'}`}>/ 5.00</span>
              {lbError && (
                <Button variant="ghost" size="sm" className="text-xs h-6 text-primary" onClick={() => refetchLb()}>
                  <RefreshCw className="h-3 w-3 mr-1" /> Retry
                </Button>
              )}
            </div>
            {/* Thermometer */}
            {teamCleanScore > 0 && (
              <div className="mt-2">
                <div className="relative w-full" style={{ height: tv ? 12 : 8 }}>
                  <div className="absolute inset-0 rounded-full overflow-hidden" style={{ background: 'hsl(0, 0%, 92%)' }}>
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${goalProgress}%`,
                        background: goalReached
                          ? 'linear-gradient(90deg, hsl(38, 92%, 50%), hsl(142, 71%, 45%))'
                          : `linear-gradient(90deg, hsl(0, 84%, 60%), hsl(38, 92%, 50%) 40%, hsl(142, 71%, 45%))`,
                        boxShadow: goalReached ? '0 0 8px hsl(142, 71%, 45%, 0.5)' : 'none',
                      }}
                    />
                  </div>
                  <div className="absolute top-0 flex flex-col items-center" style={{ left: `${goalMarkerPosition}%`, transform: 'translateX(-50%)' }}>
                    <div style={{ width: 2, height: tv ? 16 : 10, background: 'hsl(240, 4%, 30%)' }} />
                  </div>
                </div>
                <div className="flex justify-between items-center mt-0.5">
                  <span className="text-muted-foreground" style={{ fontSize: tv ? 11 : 9 }}>4.50</span>
                  <span className="text-muted-foreground font-medium" style={{ fontSize: tv ? 10 : 9 }}>Goal: {CLEAN_SCORE_GOAL.toFixed(2)}</span>
                  <span className="text-muted-foreground" style={{ fontSize: tv ? 11 : 9 }}>5.00</span>
                </div>
                <p className="text-muted-foreground" style={{ fontSize: tv ? 11 : 9 }}>
                  {goalReached ? '✅ Goal reached!' : `${distanceToGoal.toFixed(2)} away from goal`}
                </p>
              </div>
            )}
            {/* Delta */}
            {teamCleanScore > 0 && priorTeamCleanScore > 0 && (() => {
              const delta = Number((teamCleanScore - priorTeamCleanScore).toFixed(2));
              if (delta === 0) return null;
              return (
                <div className={`flex items-center gap-1 ${tv ? 'text-[14px]' : 'text-[10px]'}`}>
                  {delta > 0 ? (
                    <span className="font-black" style={{ color: 'hsl(142, 71%, 45%)' }}>▲</span>
                  ) : (
                    <span className="font-black" style={{ color: 'hsl(0, 84%, 60%)' }}>▼</span>
                  )}
                  <span className="font-semibold" style={{ color: delta > 0 ? 'hsl(142, 71%, 45%)' : 'hsl(0, 84%, 60%)' }}>
                    {delta > 0 ? '+' : ''}{delta.toFixed(2)}
                  </span>
                  <span className="text-muted-foreground">vs last period (was {priorTeamCleanScore.toFixed(2)})</span>
                </div>
              );
            })()}

            {/* Divider */}
            {showEfficiency && <div className="border-t border-border my-3" />}

            {/* Team Efficiency */}
            {showEfficiency && (
              <>
                <p className={`font-semibold text-muted-foreground uppercase tracking-wider mb-1 ${tv ? 'text-[16px]' : 'text-[10px]'}`}>Team Efficiency</p>
                <div className="flex items-baseline gap-2">
                  <span className={`font-black tracking-tight text-foreground ${tv ? 'text-[48px] leading-none' : 'text-3xl'}`}>
                    {teamEfficiency > 0 ? `${teamEfficiency}%` : '—'}
                  </span>
                </div>
                {/* Efficiency Thermometer */}
                {teamEfficiency > 0 && (
                  <div className="mt-2">
                    <div className="relative w-full" style={{ height: tv ? 12 : 8 }}>
                      <div className="absolute inset-0 rounded-full overflow-hidden" style={{ background: 'hsl(0, 0%, 92%)' }}>
                      <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${effGoalProgress}%`,
                            background: (() => {
                              // Fill from 0% to current value with gradient that ends at current color
                              if (effGoalReached) return 'linear-gradient(90deg, hsl(0, 84%, 60%) 0%, hsl(38, 92%, 50%) 30%, hsl(45, 93%, 58%) 55%, hsl(142, 71%, 45%) 100%)';
                              if (teamEfficiency >= 65) return 'linear-gradient(90deg, hsl(0, 84%, 60%) 0%, hsl(38, 92%, 50%) 35%, hsl(45, 93%, 58%) 65%, hsl(142, 71%, 45%) 100%)';
                              if (teamEfficiency >= 55) return 'linear-gradient(90deg, hsl(0, 84%, 60%) 0%, hsl(38, 92%, 50%) 40%, hsl(45, 93%, 58%) 100%)';
                              if (teamEfficiency >= 40) return 'linear-gradient(90deg, hsl(0, 84%, 60%) 0%, hsl(38, 92%, 50%) 100%)';
                              return 'hsl(0, 84%, 60%)';
                            })(),
                            boxShadow: effGoalReached ? '0 0 8px hsl(142, 71%, 45%, 0.5)' : 'none',
                          }}
                        />
                      </div>
                      <div className="absolute top-0 flex flex-col items-center" style={{ left: `${effGoalMarkerPosition}%`, transform: 'translateX(-50%)' }}>
                        <div style={{ width: 2, height: tv ? 16 : 10, background: 'hsl(240, 4%, 30%)' }} />
                      </div>
                    </div>
                    <div className="flex justify-between items-center mt-0.5">
                      <span className="text-muted-foreground" style={{ fontSize: tv ? 11 : 9 }}>0%</span>
                      <span className="text-muted-foreground font-medium" style={{ fontSize: tv ? 10 : 9 }}>Goal: {EFFICIENCY_GOAL}%</span>
                      <span className="text-muted-foreground" style={{ fontSize: tv ? 11 : 9 }}>100%</span>
                    </div>
                    <p className="text-muted-foreground" style={{ fontSize: tv ? 11 : 9 }}>
                      {effGoalReached ? '✅ Goal reached!' : `${effDistanceToGoal}% away from goal`}
                    </p>
                  </div>
                )}
                {/* Efficiency Delta */}
                {teamEfficiency > 0 && priorTeamEfficiency > 0 && (() => {
                  const delta = teamEfficiency - priorTeamEfficiency;
                  if (delta === 0) return null;
                  return (
                    <div className={`flex items-center gap-1 ${tv ? 'text-[14px]' : 'text-[10px]'}`}>
                      {delta > 0 ? (
                        <span className="font-black" style={{ color: 'hsl(142, 71%, 45%)' }}>▲</span>
                      ) : (
                        <span className="font-black" style={{ color: 'hsl(0, 84%, 60%)' }}>▼</span>
                      )}
                      <span className="font-semibold" style={{ color: delta > 0 ? 'hsl(142, 71%, 45%)' : 'hsl(0, 84%, 60%)' }}>
                        {delta > 0 ? '+' : ''}{delta}%
                      </span>
                      <span className="text-muted-foreground">vs last period (was {priorTeamEfficiency}%)</span>
                    </div>
                  );
                })()}
              </>
            )}

            {/* Total cleans footnote */}
            <div className="border-t border-border mt-3 pt-2">
              <p className="text-muted-foreground" style={{ fontSize: tv ? 12 : 10 }}>
                {lbLoading ? '— total cleans this period' : (
                  <>
                    {totalCleans.toLocaleString()} total cleans this period
                    {totalCleansDelta !== 0 && (
                      <span style={{ color: totalCleansDelta > 0 ? 'hsl(142, 71%, 45%)' : 'hsl(0, 84%, 60%)' }}>
                        {' '}({totalCleansDelta > 0 ? '+' : ''}{totalCleansDelta} vs last period)
                      </span>
                    )}
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Trend Charts */}
      <div className={`grid gap-4 ${tv ? 'gap-6' : ''} mb-5 ${showEfficiency ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
        {/* Clean Score Trend */}
        <div className="glass-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className={`text-section-header ${tv ? 'text-[22px]' : ''}`}>Clean Score Trend</h3>
            {cleanScoreTrend.length > 0 && (
              <span className="text-xs text-muted-foreground">{cleanScoreTrend.length} weeks</span>
            )}
          </div>
          <div style={{ height: tv ? 420 : 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={cleanScoreTrend} margin={{ top: 25, right: 40, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="grad-score" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(5, 87%, 55%)" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="hsl(5, 87%, 55%)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0, 0%, 90%)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: tv ? 14 : 11, fill: 'hsl(240, 4%, 40%)' }} axisLine={false} tickLine={false} interval={cleanScoreTrend.length > 20 ? Math.floor(cleanScoreTrend.length / 6) : cleanScoreTrend.length > 10 ? 1 : 0} />
                <YAxis yAxisId="left" domain={[3.5, 5]} tick={{ fontSize: tv ? 14 : 12, fill: 'hsl(240, 4%, 40%)' }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: tv ? 14 : 10, fill: 'hsl(240, 4%, 60%)' }} axisLine={false} tickLine={false} label={{ value: 'Reviews', angle: 90, position: 'insideRight', fontSize: tv ? 12 : 10, fill: 'hsl(240, 4%, 60%)' }} />
                <RechartsTooltip
                  contentStyle={{ fontSize: tv ? 14 : 12, borderRadius: 8, border: '1px solid hsl(0, 0%, 90%)' }}
                  formatter={(v: number, name: string) => {
                    if (name === 'ratingCount') return [v, 'Reviews'];
                    return [v, 'Avg Score'];
                  }}
                />
                <ReferenceLine yAxisId="left" y={4.5} stroke="hsl(0, 0%, 70%)" strokeDasharray="6 4" label={{ value: 'Target', position: 'right', fontSize: tv ? 16 : 11, fill: 'hsl(240, 4%, 40%)' }} />
                <Bar yAxisId="right" dataKey="ratingCount" fill="hsl(5, 87%, 95%)" stroke="hsl(5, 87%, 55%)" strokeWidth={1} barSize={tv ? 28 : 16} radius={[2, 2, 0, 0]}>
                  <LabelList dataKey="ratingCount" content={<RatingCountLabelRenderer />} />
                </Bar>
                <Area yAxisId="left" type="monotone" dataKey="score" stroke="hsl(5, 87%, 55%)" strokeWidth={tv ? 3 : 2} fill="url(#grad-score)" dot={{ r: tv ? 10 : 4, fill: 'hsl(5, 87%, 55%)', strokeWidth: 2, stroke: 'white' }} activeDot={{ r: tv ? 12 : 6 }}>
                  <LabelList dataKey="score" content={<ScoreLabelRenderer />} />
                </Area>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Efficiency Trend */}
        {showEfficiency && (
          <div className="glass-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className={`text-section-header ${tv ? 'text-[22px]' : ''}`}>Avg Clean Time Trend</h3>
            </div>
            <div style={{ height: tv ? 420 : 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={efficiencyTrend} margin={{ top: 25, right: 20, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id="grad-eff" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(5, 61%, 28%)" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="hsl(5, 61%, 28%)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(0, 0%, 90%)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: tv ? 14 : 11, fill: 'hsl(240, 4%, 40%)' }} axisLine={false} tickLine={false} interval={efficiencyTrend.length > 20 ? Math.floor(efficiencyTrend.length / 6) : efficiencyTrend.length > 10 ? 1 : 0} />
                  <YAxis tick={{ fontSize: tv ? 14 : 12, fill: 'hsl(240, 4%, 40%)' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}m`} />
                  <RechartsTooltip
                    contentStyle={{ fontSize: tv ? 14 : 12, borderRadius: 8, border: '1px solid hsl(0, 0%, 90%)' }}
                    formatter={(v: number) => [`${v} min`, 'Avg Clean Time']}
                  />
                  <Area type="monotone" dataKey="efficiency" stroke="hsl(5, 61%, 28%)" strokeWidth={tv ? 3 : 2} fill="url(#grad-eff)" dot={{ r: tv ? 10 : 4, fill: 'hsl(5, 61%, 28%)', strokeWidth: 2, stroke: 'white' }} activeDot={{ r: tv ? 12 : 6 }}>
                    <LabelList dataKey="efficiency" content={<EffLabelRenderer />} />
                  </Area>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Weekly Shoutouts Ticker */}
      {formattedShoutouts.length > 0 && (
        <div
          className={`rounded-lg mb-3 text-center overflow-hidden`}
          style={{
            background: 'hsl(5, 87%, 95%)',
            fontFamily: 'Figtree, sans-serif',
            padding: tv ? '12px 16px' : '6px 12px',
            borderTop: '1px solid hsl(5, 87%, 55%, 0.2)',
            borderBottom: '1px solid hsl(5, 87%, 55%, 0.2)',
          }}
        >
          <div key={shoutoutIdx} className="font-bold text-foreground animate-fade-in" style={{ animationDuration: '0.5s', fontSize: tv ? 26 : 16 }}>
            {formattedShoutouts[shoutoutIdx % formattedShoutouts.length]}
          </div>
        </div>
      )}

      {/* Leaderboard Table */}
      <div className="glass-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between flex-wrap gap-2">
          <h2 className={`text-section-header ${tv ? 'text-[22px]' : ''}`}>Cleaner Leaderboard</h2>
          {/* Filter pills — inline, hidden in TV mode */}
          {!tv && (
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Min Rated:</span>
                <div className="flex gap-0.5 bg-muted rounded-md p-0.5">
                  {MIN_RATED_OPTIONS.map(o => (
                    <button
                      key={o.value}
                      onClick={() => setMinRated(o.value)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition-colors ${minRated === o.value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Data:</span>
                <div className="flex gap-0.5 bg-muted rounded-md p-0.5">
                  {dataComplOptions.map(o => (
                    <button
                      key={o.value}
                      onClick={() => setDataCompleteness(o.value)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition-colors ${dataCompleteness === o.value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          <span className={`text-muted-foreground ${tv ? 'text-sm' : 'text-xs'}`}>
            {lbLoading ? '—' : `${cleanerRows.length}`} cleaners
          </span>
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
                const borderColor = rank === 1 ? 'border-l-4 border-l-[hsl(38,92%,50%)]' : rank === 2 ? 'border-l-4 border-l-[hsl(0,0%,75%)]' : rank === 3 ? 'border-l-4 border-l-[hsl(25,60%,50%)]' : 'border-l-4 border-l-transparent';
                const rowBg = rank === 1 ? 'bg-gradient-to-r from-card to-[hsl(38,92%,50%,0.04)]' : i % 2 === 0 ? 'bg-card' : 'bg-muted';
                const scoreColor = row.overallScore >= 90 ? 'text-[hsl(142,71%,45%)]' : row.overallScore < 70 ? 'text-[hsl(38,92%,50%)]' : 'text-foreground';
                const isImproved = i === mostImprovedIdx;
                const isRank1 = rank === 1;
                const showWorkerBadge = workerFilter === null;
                const isExpanded = expandedRowId === row.id && !tv;
                const dist = ratingDistMap.get(row.id);

                return (
                  <React.Fragment key={row.id}>
                    <tr
                      className={`${rowBg} ${borderColor} transition-colors ${!tv ? 'hover:bg-[hsl(5,87%,55%,0.03)] cursor-pointer' : ''}`}
                      style={tv ? { height: 80 } : undefined}
                      onClick={() => !tv && setExpandedRowId(isExpanded ? null : row.id)}
                    >
                      <td className={`${tv ? 'px-5 py-4' : 'px-4 py-3'}`}>
                        <span className={`font-black ${tv ? (isRank1 ? 'text-[32px]' : 'text-[28px]') : 'text-lg'}`}>
                          {medal && <span className={`mr-1 ${tv ? 'text-[28px]' : ''}`}>{medal}</span>}{rank}
                        </span>
                      </td>
                      <td className={`${tv ? 'px-5 py-4' : 'px-4 py-3'}`}>
                        <span
                          className={`font-bold ${tv ? (isRank1 ? 'text-[24px]' : 'text-[22px]') : 'text-base'} ${
                            !tv ? 'cursor-pointer hover:text-primary hover:underline transition-colors' : ''
                          }`}
                          onClick={!tv ? (e) => { e.stopPropagation(); openCleanerDetail(row); } : undefined}
                        >
                          {row.name}
                        </span>
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
                        {!tv && <ChevronDown className={`inline ml-1 h-3 w-3 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />}
                      </td>
                      {/* Streak Column */}
                      {!isInspectorsTab && (
                      <td className={`${tv ? 'px-5 py-4' : 'px-4 py-3'}`}>
                        {row.currentStreak >= 3 ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className={`font-bold ${tv ? 'text-[22px]' : 'text-base'}`} style={{ color: 'hsl(5, 87%, 55%)' }}>
                                  {row.currentStreak >= 20 ? '🔥🔥🔥' : row.currentStreak >= 10 ? '🔥🔥' : '🔥'}{' '}
                                  <span style={row.currentStreak >= 10 ? { textShadow: '0 0 8px hsl(5, 87%, 55%, 0.3)' } : undefined}>
                                    {row.currentStreak}
                                  </span>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent className="text-xs">
                                {row.currentStreak} consecutive 5-star ratings. Best ever: {row.bestStreak}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </td>
                      )}
                      {/* Overall Score Column */}
                      {!isInspectorsTab && (
                      <td className={`${tv ? 'px-5 py-4' : 'px-4 py-3'}`}>
                        <span
                          className={`inline-flex items-center justify-center rounded-full font-black ${scoreColor} ${
                            tv ? (isRank1 ? 'w-[56px] h-[56px] text-[28px]' : 'w-[48px] h-[48px] text-[24px]') : 'w-10 h-10 text-base'
                          }`}
                          style={{
                            background: row.overallScore >= 90 ? 'hsl(142, 71%, 45%, 0.12)' : row.overallScore < 70 ? 'hsl(38, 92%, 50%, 0.12)' : 'hsl(var(--muted))',
                          }}
                        >
                          {row.overallScore}
                          {tv && isRank1 && row.overallScore >= 95 && <span className="ml-0.5 text-sm">✨</span>}
                        </span>
                      </td>
                      )}
                      <td className={`${tv ? 'px-5 py-4' : 'px-4 py-3'}`}>
                        {row.cleanScore !== null ? (
                          <div>
                            <span className={`font-semibold ${tv ? 'text-[22px]' : 'text-base'}`}>{row.cleanScore.toFixed(2)}</span>
                            <div className={`text-muted-foreground ${tv ? 'text-[14px]' : 'text-xs'}`}>{row.ratedCleans} rated</div>
                            {tv && dist && dist.total > 0 && (
                              <div className="flex mt-1 rounded-full overflow-hidden" style={{ height: 6, width: tv ? 80 : 60 }}>
                                {dist.five > 0 && <div style={{ flex: dist.five, background: 'hsl(142, 71%, 45%)' }} />}
                                {dist.four > 0 && <div style={{ flex: dist.four, background: 'hsl(142, 50%, 65%)' }} />}
                                {dist.three > 0 && <div style={{ flex: dist.three, background: 'hsl(45, 93%, 58%)' }} />}
                                {dist.two > 0 && <div style={{ flex: dist.two, background: 'hsl(25, 95%, 53%)' }} />}
                                {dist.one > 0 && <div style={{ flex: dist.one, background: 'hsl(0, 84%, 60%)' }} />}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm italic">—</span>
                        )}
                      </td>
                      {showEfficiencyCol && (
                        <td className={`${tv ? 'px-5 py-4' : 'px-4 py-3'}`}>
                          {row.efficiency !== null ? (
                            <div className="flex items-center gap-2">
                              <span className={`font-semibold min-w-[3ch] ${tv ? 'text-[20px]' : 'text-base'}`}>{row.efficiency}%</span>
                              <div className={`${tv ? 'w-24' : 'w-16'} flex-shrink-0`}>
                                <Progress value={row.efficiency} className={`${tv ? 'h-3' : 'h-2'} bg-muted ${
                                  row.efficiency >= 75 ? '[&>div]:bg-[hsl(142,71%,45%)]' :
                                  row.efficiency >= 60 ? '[&>div]:bg-[hsl(45,93%,58%)]' :
                                  row.efficiency >= 45 ? '[&>div]:bg-[hsl(25,95%,53%)]' :
                                  '[&>div]:bg-[hsl(0,84%,60%)]'
                                }`} />
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm italic">—</span>
                          )}
                        </td>
                      )}
                      <td className={`${tv ? 'px-5 py-4' : 'px-4 py-3'}`}>
                        <div>
                          <div className={`font-bold ${tv ? 'text-[20px]' : 'text-base'}`}>{row.cleans}</div>
                          <div className={`text-muted-foreground ${tv ? 'text-[14px]' : 'text-xs'}`}>{row.ratedCleans} rated</div>
                        </div>
                      </td>
                      <td className={`${tv ? 'px-5 py-4' : 'px-4 py-3'}`}>
                        {isInspectorsTab ? (
                          <span className={`font-semibold ${tv ? 'text-[20px]' : 'text-base'} ${(row.badReviews || 0) > 0 ? 'text-[hsl(0,84%,60%)]' : 'text-[hsl(142,71%,45%)]'}`}>
                            {row.badReviews ?? 0}
                          </span>
                        ) : (
                          <>
                            <span className={`font-semibold ${tv ? 'text-[20px]' : 'text-base'}`}>{row.avgMin}</span>
                            <span className={`text-muted-foreground ml-1 ${tv ? 'text-[14px]' : 'text-xs'}`}>min</span>
                          </>
                        )}
                      </td>
                      {/* Trend Column */}
                      {!isInspectorsTab && (
                      <td className={`${tv ? 'px-5 py-4' : 'px-4 py-3'}`}>
                        <div className="flex flex-col items-start">
                          <TrendArrow dir={row.trend} tv={tv} />
                          {row.hasPriorData && row.scoreDelta !== 0 && (
                            <span className={`font-bold ${tv ? 'text-[12px]' : 'text-[10px]'}`} style={{ color: row.scoreDelta > 0 ? 'hsl(142, 71%, 45%)' : 'hsl(0, 84%, 60%)' }}>
                              {row.scoreDelta > 0 ? '▲' : '▼'} {Math.abs(row.scoreDelta)}pt
                            </span>
                          )}
                        </div>
                      </td>
                      )}
                    </tr>
                    {/* Expandable row detail (non-TV only) */}
                    {isExpanded && dist && (
                      <tr className="bg-muted/30">
                        <td colSpan={colSpan} className="px-6 py-4">
                          <div className="flex flex-col md:flex-row gap-6">
                            {/* Rating distribution bar */}
                            <div className="flex-1">
                              <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Rating Distribution</p>
                              <div className="flex rounded-full overflow-hidden h-5 w-full max-w-md">
                                {dist.five > 0 && <div className="flex items-center justify-center text-[10px] font-bold text-white" style={{ flex: dist.five, background: 'hsl(142, 71%, 45%)' }}>{dist.five}</div>}
                                {dist.four > 0 && <div className="flex items-center justify-center text-[10px] font-bold text-white" style={{ flex: dist.four, background: 'hsl(142, 50%, 65%)' }}>{dist.four}</div>}
                                {dist.three > 0 && <div className="flex items-center justify-center text-[10px] font-bold text-white" style={{ flex: dist.three, background: 'hsl(45, 93%, 58%)' }}>{dist.three}</div>}
                                {dist.two > 0 && <div className="flex items-center justify-center text-[10px] font-bold text-white" style={{ flex: dist.two, background: 'hsl(25, 95%, 53%)' }}>{dist.two}</div>}
                                {dist.one > 0 && <div className="flex items-center justify-center text-[10px] font-bold text-white" style={{ flex: dist.one, background: 'hsl(0, 84%, 60%)' }}>{dist.one}</div>}
                              </div>
                              <div className="flex gap-3 mt-1.5 text-[10px] text-muted-foreground">
                                <span>⭐5: {dist.five}</span>
                                <span>⭐4: {dist.four}</span>
                                <span>⭐3: {dist.three}</span>
                                <span>⭐2: {dist.two}</span>
                                <span>⭐1: {dist.one}</span>
                                <span className="font-semibold">{dist.total} total</span>
                              </div>
                            </div>
                            {/* Recent reviews — FIX: show cleanliness rating */}
                            <div className="flex-1">
                              <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Recent Reviews</p>
                              {(allSpotlightReviews || [])
                                .filter((r: any) => Number(r.assignee_id) === row.id)
                                .slice(0, 3)
                                .map((r: any, ri: number) => {
                                  const rating = Number(r.cleanliness_rating) || 0;
                                  const ratingColor = rating >= 5 ? 'hsl(142, 71%, 45%)' : rating >= 4 ? 'hsl(240, 4%, 30%)' : 'hsl(5, 87%, 55%)';
                                  return (
                                    <div key={ri} className="mb-2 text-xs">
                                      <span className="font-bold mr-1" style={{ color: ratingColor }}>⭐ {rating.toFixed(1)}</span>
                                      <span className="text-muted-foreground">· {r.property_name || r.listing_name} — </span>
                                      <span className="italic">&ldquo;{r.review_text?.slice(0, 80)}{(r.review_text?.length || 0) > 80 ? '...' : ''}&rdquo;</span>
                                    </div>
                                  );
                                })}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {cleanerRows.length === 0 && (
                <tr>
                  <td colSpan={colSpan} className="px-4 py-8 text-center text-muted-foreground">
                    {lbLoading ? (
                      <div className="flex flex-col items-center gap-2">
                        <RefreshCw className="h-5 w-5 animate-spin" />
                        <span>Loading leaderboard data…</span>
                      </div>
                    ) : lbError ? (
                      <div className="flex flex-col items-center gap-2">
                        <p className="text-destructive font-semibold">Data is taking longer than expected.</p>
                        <p className="text-xs">Try a shorter date range or refresh.</p>
                        <Button variant="outline" size="sm" onClick={() => refetchLb()}>
                          <RefreshCw className="h-3 w-3 mr-1" /> Retry
                        </Button>
                      </div>
                    ) : (
                      'No cleaners found for this period and filter combination.'
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Featured Review (non-TV mode) */}
      {!tv && featuredReview && (
        <div className="glass-card mt-4 p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">⭐ Featured Review</p>
          <div className="flex items-start gap-3">
            <div>
              <span className="font-bold text-sm" style={{ color: 'hsl(5, 87%, 55%)' }}>{abbreviateName(featuredReview.assignee_name || '')}</span>
              <span className="text-muted-foreground text-xs ml-2">{featuredReview.property_name || featuredReview.listing_name}</span>
              {featuredReview.review_text && (
                <p className="text-sm italic mt-1 text-foreground">
                  &ldquo;{featuredReview.review_text.slice(0, 120)}{featuredReview.review_text.length > 120 ? '...' : ''}&rdquo;
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className={`flex items-center justify-between mt-5 ${tv ? 'px-2' : ''}`}>
        <p
          key={quoteIdx}
          className={`italic text-muted-foreground max-w-2xl animate-fade-in ${tv ? 'text-[20px]' : 'text-sm'}`}
          style={{ fontFamily: 'Figtree, sans-serif' }}
        >
          &ldquo;{MOTIVATIONAL_QUOTES[quoteIdx]}&rdquo;
        </p>
        <span className={`text-muted-foreground ${tv ? 'text-sm' : 'text-xs'}`}>
          Last updated: {format(lastUpdated, 'h:mm a')}
        </span>
      </div>

      {/* ===== CLEANER DETAIL MODAL ===== */}
      <Sheet open={detailCleanerId != null} onOpenChange={(open) => { if (!open) { setDetailCleanerId(null); setDetailCleanerRow(null); setDetailError(false); } }}>
        <SheetContent className="w-full sm:max-w-[40%] min-w-[400px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-black text-[32px]" style={{ fontFamily: 'Figtree, sans-serif' }}>
              {detailCleanerName}
            </SheetTitle>
            <SheetDescription>Clean history and rating details</SheetDescription>
          </SheetHeader>

          <DetailErrorBoundary onError={() => { setDetailCleanerId(null); setDetailCleanerRow(null); }}>
            {detailCleanerRow && (
              <div className="mt-4">
                {/* Stats row */}
                <div className="flex flex-wrap gap-3 mb-4">
                  {detailCleanerRow.overallScore != null && (
                    <span className="inline-flex items-center justify-center rounded-full font-black w-10 h-10 text-base"
                      style={{ background: detailCleanerRow.overallScore >= 90 ? 'hsl(142, 71%, 45%, 0.12)' : 'hsl(var(--muted))', color: detailCleanerRow.overallScore >= 90 ? 'hsl(142, 71%, 45%)' : 'inherit' }}>
                      {detailCleanerRow.overallScore}
                    </span>
                  )}
                  {detailCleanerRow.cleanScore != null && (
                    <Badge variant="outline" className="text-sm">Cleanliness: {detailCleanerRow.cleanScore.toFixed(2)} ({detailCleanerRow.ratedCleans} rated)</Badge>
                  )}
                  {detailCleanerRow.avgOverall != null && (
                    <Badge variant="outline" className="text-sm">Overall: {detailCleanerRow.avgOverall.toFixed(2)}</Badge>
                  )}
                  {detailCleanerRow.efficiency != null && (
                    <Badge variant="outline" className="text-sm">Eff: {detailCleanerRow.efficiency}%</Badge>
                  )}
                  {detailCleanerRow.currentStreak >= 3 && (
                    <Badge variant="outline" className="text-sm" style={{ color: 'hsl(5, 87%, 55%)' }}>
                      🔥 {detailCleanerRow.currentStreak}
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-sm">{detailCleanerRow.cleans} cleans</Badge>
                </div>

                {/* Rating distribution */}
                {(() => {
                  const dist = ratingDistMap.get(detailCleanerRow.id);
                  if (!dist || dist.total === 0) return null;
                  return (
                    <div className="mb-4">
                      <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Rating Distribution</p>
                      <div className="flex rounded-full overflow-hidden h-6 w-full">
                        {[
                          { val: dist.five, color: 'hsl(142, 71%, 45%)', label: '5★' },
                          { val: dist.four, color: 'hsl(142, 50%, 65%)', label: '4★' },
                          { val: dist.three, color: 'hsl(45, 93%, 58%)', label: '3★' },
                          { val: dist.two, color: 'hsl(25, 95%, 53%)', label: '2★' },
                          { val: dist.one, color: 'hsl(0, 84%, 60%)', label: '1★' },
                        ].filter(s => s.val > 0).map(s => (
                          <div key={s.label} className="flex items-center justify-center text-[11px] font-bold text-white" style={{ flex: s.val, background: s.color }}>
                            {s.val}
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{dist.total} total ratings</p>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Clean history table */}
            <div className="mt-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Clean History</p>
              {detailLoading ? (
                <div className="text-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">Loading clean history...</p>
                </div>
              ) : detailQueryError ? (
                <div className="text-center py-8">
                  <p className="text-sm text-destructive mb-2">Unable to load cleaner details</p>
                  <Button variant="outline" size="sm" onClick={() => { queryClient.invalidateQueries({ queryKey: ['lb-cleaner-detail'] }); }}>
                    <RefreshCw className="h-3 w-3 mr-1" /> Retry
                  </Button>
                </div>
              ) : !cleanerDetail?.length ? (
                <p className="text-sm text-muted-foreground text-center py-4">No clean history found for this period.</p>
              ) : (
                <div className="border rounded-md overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Date</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Property</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Time</th>
                        <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground">Rating</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Review</th>
                        <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailPaginated.map((row: any, ri: number) => (
                        <DetailRow
                          key={ri}
                          row={row}
                          ri={ri}
                          detailCleanerId={detailCleanerId!}
                          detailCleanerName={detailCleanerName}
                          excludeReason={excludeReason}
                          setExcludeReason={setExcludeReason}
                          handleExcludeReview={handleExcludeReview}
                          handleRestoreReview={handleRestoreReview}
                          queryClient={queryClient}
                          supabase={supabase}
                        />
                      ))}
                    </tbody>
                  </table>
                  {hasMoreDetail && (
                    <div className="p-3 text-center border-t border-border">
                      <Button variant="outline" size="sm" onClick={() => setDetailPage(p => p + 1)}>
                        Load more ({(cleanerDetail?.length || 0) - detailPaginated.length} remaining)
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </DetailErrorBoundary>
        </SheetContent>
      </Sheet>

      {/* ===== TODAY'S TASKS MODAL ===== */}
      <Dialog open={showTodayTasks} onOpenChange={setShowTodayTasks}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Today&apos;s Cleans — {getLocalTodayFormatted()}
              <Button variant="ghost" size="sm" className="ml-auto" onClick={() => refetchTodayTasks()}>
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </DialogTitle>
            <DialogDescription>{dedupedTodayTasks.length} properties</DialogDescription>
          </DialogHeader>

          {/* In Progress */}
          <Collapsible defaultOpen>
            <CollapsibleTrigger className="flex items-center gap-2 w-full text-left py-2 text-sm font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground">
              <ChevronDown className="h-4 w-4" /> 🔄 In Progress ({todayTasksByStatus.inProgress.length})
            </CollapsibleTrigger>
            <CollapsibleContent>
              {todayTasksByStatus.inProgress.length === 0 ? (
                <p className="text-xs text-muted-foreground pl-6 pb-2">None right now</p>
              ) : todayTasksByStatus.inProgress.map((t: any) => (
                <div key={t.task_id} className="pl-6 py-1.5 text-sm border-b border-border/50">
                  <span className="font-semibold">{t.property_name}</span>
                  <span className="text-muted-foreground ml-2">— {t.all_assignees ? t.all_assignees.split(',').map((n: string) => abbreviateName(n.trim())).join(' + ') : abbreviateName(t.assignee_name || '')}</span>
                  {t.total_time_minutes && <span className="text-muted-foreground ml-1">· {t.total_time_minutes} min</span>}
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>

          {/* Upcoming */}
          <Collapsible defaultOpen>
            <CollapsibleTrigger className="flex items-center gap-2 w-full text-left py-2 text-sm font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground">
              <ChevronDown className="h-4 w-4" /> ⏳ Upcoming ({todayTasksByStatus.upcoming.length})
            </CollapsibleTrigger>
            <CollapsibleContent>
              {todayTasksByStatus.upcoming.length === 0 ? (
                <p className="text-xs text-muted-foreground pl-6 pb-2">None</p>
              ) : todayTasksByStatus.upcoming.map((t: any) => (
                <div key={t.task_id} className="pl-6 py-1.5 text-sm border-b border-border/50">
                  <span className="font-semibold">{t.property_name}</span>
                  <span className="text-muted-foreground ml-2">— {t.all_assignees ? t.all_assignees.split(',').map((n: string) => abbreviateName(n.trim())).join(' + ') : abbreviateName(t.assignee_name || '')}</span>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>

          {/* Completed */}
          <Collapsible>
            <CollapsibleTrigger className="flex items-center gap-2 w-full text-left py-2 text-sm font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground">
              <ChevronDown className="h-4 w-4" /> ✅ Completed ({todayTasksByStatus.completed.length})
            </CollapsibleTrigger>
            <CollapsibleContent>
              {todayTasksByStatus.completed.length === 0 ? (
                <p className="text-xs text-muted-foreground pl-6 pb-2">None yet</p>
              ) : todayTasksByStatus.completed.map((t: any) => (
                <div key={t.task_id} className="pl-6 py-1.5 text-sm border-b border-border/50">
                  <span className="font-semibold">{t.property_name}</span>
                  <span className="text-muted-foreground ml-2">— {t.all_assignees ? t.all_assignees.split(',').map((n: string) => abbreviateName(n.trim())).join(' + ') : abbreviateName(t.assignee_name || '')}</span>
                  {t.total_time_minutes && <span className="text-muted-foreground ml-1">· {t.total_time_minutes} min</span>}
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        </DialogContent>
      </Dialog>

      {/* ===== ADMIN PANEL ===== */}
      <Dialog open={showAdmin} onOpenChange={setShowAdmin}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" /> Exclusion Management
            </DialogTitle>
            <DialogDescription>Manage which staff and reviews are excluded from the leaderboard</DialogDescription>
          </DialogHeader>

          {/* Section 1: Excluded Staff */}
          <div className="mt-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-2">Excluded Staff</h3>
            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Name</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Reason</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Date</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground w-20">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(staffExclusions || []).map((e: any) => (
                    <tr key={e.id} className="border-t border-border">
                      <td className="px-3 py-2 text-xs font-medium">{e.assignee_name || e.assignee_id}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{e.reason || '—'}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{e.excluded_at ? format(new Date(e.excluded_at), 'MMM d, yyyy') : '—'}</td>
                      <td className="px-3 py-2 text-center">
                        <Button size="sm" variant="ghost" className="text-xs h-7 text-primary" onClick={() => handleRestoreStaff(e.assignee_id)}>
                          <RotateCcw className="h-3 w-3 mr-1" /> Restore
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {(!staffExclusions || staffExclusions.length === 0) && (
                    <tr><td colSpan={4} className="px-3 py-4 text-center text-xs text-muted-foreground">No excluded staff</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 2: Add Exclusion */}
          <div className="mt-6">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-2">Add Exclusion</h3>
            <div className="flex flex-col gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search by name..."
                  value={adminSearch}
                  onChange={e => { setAdminSearch(e.target.value); setAdminExcludeTarget(null); }}
                  className="w-full pl-9 pr-3 py-2 rounded-md border border-border bg-background text-sm"
                />
                {adminSearch && adminSearchResults.length > 0 && !adminExcludeTarget && (
                  <div className="absolute top-full left-0 right-0 bg-card border border-border rounded-md shadow-lg z-20 max-h-48 overflow-auto mt-1">
                    {adminSearchResults.map(r => (
                      <button
                        key={r.id}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                        onClick={() => { setAdminExcludeTarget(r); setAdminSearch(displayName(r.name)); }}
                      >
                        {displayName(r.name)} <span className="text-muted-foreground text-xs">({r.name})</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {adminExcludeTarget && (
                <div className="flex items-center gap-2">
                  <Select onValueChange={setAdminExcludeReason}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select reason" />
                    </SelectTrigger>
                    <SelectContent>
                      {STAFF_EXCLUSION_REASONS.map(r => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" disabled={!adminExcludeReason} onClick={handleExcludeStaff}>
                    Exclude
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Excluded Reviews */}
          <div className="mt-6">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-2">Excluded Reviews</h3>
            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Review ID</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Reason</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Date</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground w-20">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(reviewExclusions || []).map((e: any) => (
                    <tr key={e.id} className="border-t border-border">
                      <td className="px-3 py-2 text-xs font-mono truncate max-w-[120px]">{e.review_id}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{e.reason || '—'}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{e.excluded_at ? format(new Date(e.excluded_at), 'MMM d, yyyy') : '—'}</td>
                      <td className="px-3 py-2 text-center">
                        <Button size="sm" variant="ghost" className="text-xs h-7 text-primary" onClick={() => handleRestoreReviewAdmin(e.review_id)}>
                          <RotateCcw className="h-3 w-3 mr-1" /> Restore
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {(!reviewExclusions || reviewExclusions.length === 0) && (
                    <tr><td colSpan={4} className="px-3 py-4 text-center text-xs text-muted-foreground">No excluded reviews</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Spotlight animation keyframes */}
      <style>{`
        @keyframes spotlightIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

// --- Sub-components ---

// DetailRow: extracted to avoid useState inside .map()
function DetailRow({ row, ri, detailCleanerId, detailCleanerName, excludeReason, setExcludeReason, handleExcludeReview, handleRestoreReview, queryClient, supabase: sb }: any) {
  const [showFullReview, setShowFullReview] = useState(false);
  const isExcluded = row.is_excluded;
  const hasRating = row.cleanliness_rating != null;
  const isTeamClean = (row.team_size || 1) > 1;
  const displayMinutes = row.per_person_minutes || row.task_time_minutes;
  const isSuspiciouslyFast = displayMinutes != null && displayMinutes < 30;
  const isUnrated = !hasRating && !isExcluded;

  return (
    <tr className={`border-t border-border ${isExcluded ? 'opacity-50' : ''} ${isUnrated ? 'opacity-60' : ''} ${ri % 2 === 1 ? 'bg-muted/30' : ''} group`}>
      <td className={`px-3 py-2 text-xs whitespace-nowrap ${isExcluded ? 'line-through' : ''} ${isUnrated ? 'italic' : ''}`}>
        {row.clean_date ? format(new Date(row.clean_date), 'MMM d, yyyy') : '—'}
      </td>
      <td className={`px-3 py-2 text-xs max-w-[150px] ${isExcluded ? 'line-through' : ''} ${isUnrated ? 'italic' : ''}`}>
        <div className="truncate">{row.property_name || '—'}</div>
        {isTeamClean && row.co_cleaners && (
          <div className="text-[10px] text-muted-foreground mt-0.5">
            Cleaned with {row.co_cleaners.split(',').map((n: string) => abbreviateName(n.trim())).join(', ')}
          </div>
        )}
      </td>
      <td className={`px-3 py-2 text-xs text-right font-mono ${isExcluded ? 'line-through' : ''} ${isUnrated ? 'italic' : ''}`}>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center gap-0.5">
                {isTeamClean && <span>👥</span>}
                {isSuspiciouslyFast && <span title="Unusually fast">⚡</span>}
                {displayMinutes ? `${displayMinutes} min` : '—'}
              </span>
            </TooltipTrigger>
            {isTeamClean && row.task_time_minutes && (
              <TooltipContent className="text-xs">
                Total task time: {row.task_time_minutes} min · Your share: {row.per_person_minutes || '?'} min ({row.team_size}-person team)
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      </td>
      <td className="px-3 py-2 text-center">
        <div className="flex items-center justify-center gap-1">
          {renderStars(row.cleanliness_rating, 12)}
          {isExcluded && <Badge variant="destructive" className="text-[9px] px-1 py-0 ml-1">Excluded</Badge>}
        </div>
      </td>
      <td className="px-3 py-2 text-xs max-w-[200px]">
        {row.review_text ? (
          <span
            className={`italic cursor-pointer ${isExcluded ? 'line-through' : ''}`}
            onClick={() => setShowFullReview(!showFullReview)}
          >
            &ldquo;{showFullReview ? row.review_text : (row.review_text.length > 120 ? row.review_text.slice(0, 120) + '...' : row.review_text)}&rdquo;
          </span>
        ) : null}
      </td>
      <td className="px-3 py-2 text-center">
        {hasRating && !isExcluded && (
          <Popover>
            <PopoverTrigger asChild>
              <button className="opacity-0 group-hover:opacity-100 hover:opacity-100 focus:opacity-100 text-muted-foreground hover:text-destructive transition-opacity p-1" title="Exclude this review">
                <Ban className="h-3.5 w-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3">
              <p className="text-sm font-semibold mb-2">Exclude this review from {detailCleanerName}&apos;s score?</p>
              <Select onValueChange={setExcludeReason}>
                <SelectTrigger className="mb-2">
                  <SelectValue placeholder="Select reason" />
                </SelectTrigger>
                <SelectContent>
                  {EXCLUSION_REASONS.map(r => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="destructive"
                className="w-full"
                disabled={!excludeReason}
                onClick={async () => {
                  const { data: matchingReviews } = await sb
                    .from('v_cleaner_ratings')
                    .select('review_id')
                    .eq('assignee_id', detailCleanerId)
                    .eq('clean_date', row.clean_date)
                    .limit(1);
                  if (matchingReviews?.[0]?.review_id) {
                    await handleExcludeReview(matchingReviews[0].review_id, detailCleanerId, excludeReason);
                    queryClient.invalidateQueries({ queryKey: ['lb-cleaner-detail'] });
                  }
                }}
              >
                Exclude Review
              </Button>
            </PopoverContent>
          </Popover>
        )}
        {hasRating && isExcluded && (
          <button
            className="text-xs text-primary hover:underline"
            onClick={async () => {
              const { data: matchingReviews } = await sb
                .from('v_cleaner_ratings')
                .select('review_id')
                .eq('assignee_id', detailCleanerId)
                .eq('clean_date', row.clean_date)
                .limit(1);
              if (matchingReviews?.[0]?.review_id) {
                await handleRestoreReview(matchingReviews[0].review_id, String(detailCleanerId));
                queryClient.invalidateQueries({ queryKey: ['lb-cleaner-detail'] });
              }
            }}
          >
            Restore
          </button>
        )}
      </td>
    </tr>
  );
}

function PulseCard({ title, value, subtitle, delta, deltaLabel, deltaSuffix, deltaPrefix, priorValue, paceText, tv }: {
  title: string; value: string; subtitle: string; tv: boolean;
  delta?: number | null; deltaLabel?: string; deltaSuffix?: string; deltaPrefix?: string;
  priorValue?: string; paceText?: string;
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
        {paceText && (
          <div className={`mt-2 ${tv ? 'text-[18px]' : 'text-xs'} text-muted-foreground font-medium`}>
            {paceText}
          </div>
        )}
        {delta != null && delta !== 0 && (
          <div className={`mt-2 flex items-center gap-1 ${tv ? 'text-[18px]' : 'text-xs'}`}>
            {delta > 0 ? (
              <span className="font-black" style={{ color: 'hsl(142, 71%, 45%)' }}>▲</span>
            ) : (
              <span className="font-black" style={{ color: 'hsl(0, 84%, 60%)' }}>▼</span>
            )}
            <span className="font-semibold" style={{ color: delta > 0 ? 'hsl(142, 71%, 45%)' : 'hsl(0, 84%, 60%)' }}>
              {deltaPrefix ?? (delta > 0 ? '+' : '')}{delta}{deltaSuffix || ''}
            </span>
            <span className="text-muted-foreground">{deltaLabel}</span>
            {priorValue && (
              <span className="text-muted-foreground">(was {priorValue})</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TrendArrow({ dir, tv }: { dir: TrendDir; tv: boolean }) {
  const size = tv ? 'h-6 w-6' : 'h-4 w-4';
  if (dir === 'improving') return <TrendingUp className={`${size} text-[hsl(142,71%,45%)]`} />;
  if (dir === 'worsening') return <TrendingDown className={`${size} text-[hsl(38,92%,50%)]`} />;
  if (dir === 'new') return <span className={`font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary ${tv ? 'text-sm' : 'text-[10px]'}`}>NEW</span>;
  return <Minus className={`${size} text-muted-foreground`} />;
}


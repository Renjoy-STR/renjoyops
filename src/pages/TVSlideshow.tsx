import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, subMonths, startOfWeek, differenceInDays, isThisWeek } from 'date-fns';
import { ResponsiveContainer, ComposedChart, Area, Bar, XAxis, YAxis, ReferenceLine, CartesianGrid, Tooltip as RechartsTooltip, LabelList } from 'recharts';
import { X } from 'lucide-react';

// ---- Constants ----
const SLIDE_TIMINGS = [10000, 10000, 10000, 10000, 10000, 8000, 8000]; // ms per slide
const CROSSFADE_MS = 200;
const CLEAN_SCORE_GOAL = 4.85;
const EFFICIENCY_GOAL = 70;

const MOTIVATIONAL_QUOTES = [
  "Every clean is someone's first impression.",
  "Details make the difference.",
  "We don't just clean — we create experiences.",
  "Hospitality is a team sport.",
  "The goal isn't perfection — it's progress.",
  "Pride in the process, joy in the result.",
  "Small things done consistently create extraordinary results.",
  "A clean home is the first chapter of a great stay.",
  "Five stars isn't a goal — it's who we are.",
  "The standard is the standard.",
  "Every detail matters.",
];

// ---- Helpers ----
function displayName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length > 1) return `${parts[0]} ${parts[parts.length - 1][0]}.`;
  return parts[0];
}

function getMountainNow(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Denver' }));
}

function getLocalToday(): string {
  return format(getMountainNow(), 'yyyy-MM-dd');
}

function getLocalYesterday(): string {
  const d = getMountainNow();
  d.setDate(d.getDate() - 1);
  return format(d, 'yyyy-MM-dd');
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

function scoreBadgeColor(score: number): string {
  if (score >= 90) return '#22C55E';
  if (score >= 70) return '#242427';
  return '#F97316';
}

function encouragement(gap: number): string {
  if (gap <= 0) return "Goal reached! 🎉";
  if (gap < 0.05 || gap < 3) return "Almost there! 🔥";
  if (gap < 0.15 || gap < 8) return "SO close!";
  return "Keep pushing!";
}

// ---- Component ----
export default function TVSlideshow() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [fadeState, setFadeState] = useState<'in' | 'out'>('in');
  const [clockStr, setClock] = useState('');
  const [showExit, setShowExit] = useState(true);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [quoteIdx, setQuoteIdx] = useState(0);
  const [spotlightIdx, setSpotlightIdx] = useState(0);
  const lastSpotlightCleanerId = useRef<number | null>(null);

  // Default date range: 3M
  const [dateRange] = useState(() => ({
    from: subMonths(new Date(), 3),
    to: new Date(),
  }));
  const fromDate = format(dateRange.from, 'yyyy-MM-dd');
  const toDate = format(dateRange.to, 'yyyy-MM-dd');
  const periodDays = differenceInDays(dateRange.to, dateRange.from);
  const priorFrom = format(new Date(dateRange.from.getTime() - periodDays * 86400000), 'yyyy-MM-dd');
  const priorTo = format(new Date(dateRange.from.getTime() - 86400000), 'yyyy-MM-dd');

  // Clock
  useEffect(() => {
    const upd = () => setClock(getMountainNow().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }));
    upd();
    const t = setInterval(upd, 60000);
    return () => clearInterval(t);
  }, []);

  // Exit button fade
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const resetFade = () => {
      setShowExit(true);
      if (exitTimer.current) clearTimeout(exitTimer.current);
      exitTimer.current = setTimeout(() => setShowExit(false), 10000);
    };
    resetFade();
    window.addEventListener('mousemove', resetFade);
    return () => {
      window.removeEventListener('mousemove', resetFade);
      if (exitTimer.current) clearTimeout(exitTimer.current);
    };
  }, []);

  // Rotate quotes
  useEffect(() => {
    const t = setInterval(() => setQuoteIdx(i => (i + 1) % MOTIVATIONAL_QUOTES.length), 30000);
    return () => clearInterval(t);
  }, []);

  // Slide rotation with crossfade
  useEffect(() => {
    const timer = setTimeout(() => {
      setFadeState('out');
      setTimeout(() => {
        setCurrentSlide(s => (s + 1) % 7);
        setFadeState('in');
      }, CROSSFADE_MS);
    }, SLIDE_TIMINGS[currentSlide]);
    return () => clearTimeout(timer);
  }, [currentSlide]);

  // ---- Data Queries ----
  const localToday = getLocalToday();
  const localYesterday = getLocalYesterday();
  const mtHour = getMountainNow().getHours();

  const [todayRefreshKey, setTodayRefreshKey] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTodayRefreshKey(k => k + 1), 60000);
    return () => clearInterval(t);
  }, []);

  const { data: todayStats } = useQuery({
    queryKey: ['tv-today-stats', todayRefreshKey, localToday],
    queryFn: async () => {
      const { data } = await supabase.rpc('get_today_stats', { p_date: localToday });
      return data?.[0] || { total_scheduled: 0, cleans_completed: 0, cleans_in_progress: 0, cleaners_active: 0, avg_completion_minutes: null, cleans_upcoming: 0 };
    },
  });

  const isZeroToday = todayStats && todayStats.total_scheduled === 0;
  const { data: yesterdayStats } = useQuery({
    queryKey: ['tv-yesterday-stats', localYesterday],
    queryFn: async () => {
      const { data } = await supabase.rpc('get_today_stats', { p_date: localYesterday });
      return data?.[0] || null;
    },
    enabled: !!isZeroToday,
  });

  const { data: leaderboardCurrent } = useQuery({
    queryKey: ['tv-lb-current', fromDate, toDate],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_leaderboard', { p_start: fromDate, p_end: toDate, p_worker_type: 'w2' });
      if (error) console.error('[TV] get_leaderboard error:', error);
      return data || [];
    },
    refetchInterval: 5 * 60 * 1000,
  });

  const { data: leaderboardPrior } = useQuery({
    queryKey: ['tv-lb-prior', priorFrom, priorTo],
    queryFn: async () => {
      const { data } = await supabase.rpc('get_leaderboard', { p_start: priorFrom, p_end: priorTo, p_worker_type: 'w2' });
      return data || [];
    },
  });

  const { data: weeklyEfficiency } = useQuery({
    queryKey: ['tv-weekly-eff', fromDate, toDate],
    queryFn: async () => {
      const { data } = await supabase.from('v_weekly_efficiency').select('*').gte('week_start', fromDate).lte('week_start', toDate).order('week_start', { ascending: true });
      return data || [];
    },
  });

  const { data: weeklyEfficiencyPrior } = useQuery({
    queryKey: ['tv-weekly-eff-prior', priorFrom, priorTo],
    queryFn: async () => {
      const { data } = await supabase.from('v_weekly_efficiency').select('*').gte('week_start', priorFrom).lte('week_start', priorTo).order('week_start', { ascending: true });
      return data || [];
    },
  });

  const { data: cleanStreaks } = useQuery({
    queryKey: ['tv-clean-streaks'],
    queryFn: async () => {
      const { data } = await supabase.rpc('get_clean_streaks');
      return data || [];
    },
  });

  const { data: spotlightReviews } = useQuery({
    queryKey: ['tv-spotlight-reviews'],
    queryFn: async () => {
      const { data } = await supabase.rpc('get_cleanliness_shoutouts', { since_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() });
      return (data || []).map((r: any) => ({
        ...r,
        assignee_name: r.cleaner_names,
        assignee_id: null,
        review_date: r.reviewed_at,
        listing_name: r.property_name,
      }));
    },
  });

  const { data: weeklyShoutouts } = useQuery({
    queryKey: ['tv-weekly-shoutouts'],
    queryFn: async () => {
      const { data } = await supabase.rpc('get_weekly_shoutouts');
      return data || [];
    },
    refetchInterval: 30 * 60 * 1000,
  });

  const { data: cleanerRatings } = useQuery({
    queryKey: ['tv-cleaner-ratings', fromDate, toDate],
    queryFn: async () => {
      let allRows: any[] = [];
      let page = 0;
      const PAGE_SIZE = 5000;
      while (true) {
        const { data, error } = await supabase
          .from('cleaner_ratings_mat')
          .select('cleanliness_rating, review_date')
          .not('cleanliness_rating', 'is', null)
          .not('review_date', 'is', null)
          .gte('review_date', `${fromDate}T00:00:00`)
          .lte('review_date', `${toDate}T23:59:59`)
          .eq('attribution_type', 'cleaner')
          .order('review_date', { ascending: true })
          .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
        if (error) break;
        if (!data?.length) break;
        allRows = allRows.concat(data);
        if (data.length < PAGE_SIZE) break;
        page++;
      }
      return allRows;
    },
  });

  // ---- Computed Data ----
  const streakMap = useMemo(() => {
    const map = new Map<number, { current_streak: number }>();
    (cleanStreaks || []).forEach((s: any) => map.set(Number(s.assignee_id), { current_streak: s.current_streak }));
    return map;
  }, [cleanStreaks]);

  const priorMap = useMemo(() => {
    const map = new Map<number, any>();
    (leaderboardPrior || []).forEach((r: any) => { if (r.assignee_id) map.set(Number(r.assignee_id), r); });
    return map;
  }, [leaderboardPrior]);

  const top5 = useMemo(() => {
    if (!leaderboardCurrent?.length) return [];
    return leaderboardCurrent
      .filter((c: any) => c.assignee_name && (Number(c.cleanliness_rated_cleans) || Number(c.rated_cleans) || 0) >= 10)
      .map((c: any) => {
        const id = Number(c.assignee_id);
        const avgCleanliness = c.has_ratings && c.avg_cleanliness != null ? Number(c.avg_cleanliness) : null;
        const effPct = c.has_timeero && c.efficiency_pct != null ? Number(c.efficiency_pct) : null;
        const overall = computeOverallScore(avgCleanliness, effPct, !!c.has_ratings, !!c.has_timeero, c.worker_type);
        const streak = streakMap.get(id)?.current_streak || 0;
        return { id, name: displayName(c.assignee_name), overall, cleanScore: avgCleanliness, streak, cleans: Number(c.total_cleans) || 0 };
      })
      .sort((a: any, b: any) => b.overall - a.overall)
      .slice(0, 5);
  }, [leaderboardCurrent, streakMap]);

  const teamCleanScore = useMemo(() => {
    const rated = (leaderboardCurrent || []).filter((r: any) => r.has_ratings && r.avg_cleanliness != null);
    if (!rated.length) return 0;
    return Number((rated.reduce((s: number, r: any) => s + Number(r.avg_cleanliness), 0) / rated.length).toFixed(2));
  }, [leaderboardCurrent]);

  const priorTeamCleanScore = useMemo(() => {
    const rated = (leaderboardPrior || []).filter((r: any) => r.has_ratings && r.avg_cleanliness != null);
    if (!rated.length) return 0;
    return Number((rated.reduce((s: number, r: any) => s + Number(r.avg_cleanliness), 0) / rated.length).toFixed(2));
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
    return (leaderboardCurrent || []).reduce((s: number, c: any) => s + (Number(c.total_cleans) || 0), 0);
  }, [leaderboardCurrent]);

  const cleanScoreTrend = useMemo(() => {
    const weekMap = new Map<string, { sum: number; count: number }>();
    (cleanerRatings || []).forEach((r: any) => {
      const dateVal = r.reviewed_at || r.review_date;
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
    return Array.from(weekMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .filter(([_, v]) => v.count > 0)
      .map(([key, v]) => ({
        week: key,
        label: format(new Date(key + 'T00:00:00'), 'MMM d'),
        score: Number((v.sum / v.count).toFixed(2)),
        ratingCount: v.count,
      }));
  }, [cleanerRatings]);

  // W2 IDs for spotlight filtering
  const w2Ids = useMemo(() => {
    const set = new Set<number>();
    (leaderboardCurrent || []).forEach((r: any) => set.add(Number(r.assignee_id)));
    return set;
  }, [leaderboardCurrent]);

  // Filtered spotlight reviews (W2 only, deduped)
  const filteredSpotlight = useMemo(() => {
    if (!spotlightReviews?.length) return [];
    const seen = new Set<string>();
    return spotlightReviews.filter((r: any) => {
      if (w2Ids.size > 0 && !w2Ids.has(Number(r.assignee_id))) return false;
      const key = r.review_text || '';
      if (seen.has(key)) return false;
      seen.add(key);
      return !!r.review_text;
    });
  }, [spotlightReviews, w2Ids]);

  // Rotate spotlight on each cycle
  useEffect(() => {
    if (currentSlide === 3 && filteredSpotlight.length > 0) {
      // Pick one different from last
      const candidates = filteredSpotlight.filter((r: any) => Number(r.assignee_id) !== lastSpotlightCleanerId.current);
      const pool = candidates.length > 0 ? candidates : filteredSpotlight;
      const idx = Math.floor(Math.random() * pool.length);
      lastSpotlightCleanerId.current = Number(pool[idx].assignee_id);
      setSpotlightIdx(filteredSpotlight.indexOf(pool[idx]) >= 0 ? filteredSpotlight.indexOf(pool[idx]) : 0);
    }
  }, [currentSlide, filteredSpotlight]);

  // Active shoutouts filtered to active cleaners
  const activeCleanerIds = useMemo(() => {
    const set = new Set<number>();
    (leaderboardCurrent || []).forEach((r: any) => set.add(Number(r.assignee_id)));
    return set;
  }, [leaderboardCurrent]);

  const activeShoutouts = useMemo(() => {
    if (!weeklyShoutouts?.length) return [];
    return weeklyShoutouts.filter((s: any) => activeCleanerIds.has(Number(s.assignee_id)));
  }, [weeklyShoutouts, activeCleanerIds]);

  const ops = isZeroToday && yesterdayStats ? yesterdayStats : todayStats;
  const opsIsYesterday = isZeroToday && yesterdayStats;
  const allComplete = ops && ops.total_scheduled > 0 && ops.cleans_completed >= ops.total_scheduled;

  const dateLabel = `Our Team · Last 3 Months (${format(dateRange.from, 'MMM d')} – ${format(dateRange.to, 'MMM d, yyyy')})`;
  const cleanScoreDelta = teamCleanScore - priorTeamCleanScore;
  const effDelta = teamEfficiency - priorTeamEfficiency;
  const cleanScoreGap = Math.max(0, CLEAN_SCORE_GOAL - teamCleanScore);
  const effGap = Math.max(0, EFFICIENCY_GOAL - teamEfficiency);

  // Skip slide 3 (spotlight) if no reviews
  const shouldSkipSlide = (idx: number) => idx === 3 && filteredSpotlight.length === 0;

  // Handle skip
  useEffect(() => {
    if (shouldSkipSlide(currentSlide)) {
      setCurrentSlide(s => (s + 1) % 7);
    }
  }, [currentSlide]);

  // ---- Thermometer Component ----
  const Thermometer = ({ value, goal, min, max, label }: { value: number; goal: number; min: number; max: number; label: string }) => {
    const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
    const goalPct = Math.max(0, Math.min(100, ((goal - min) / (max - min)) * 100));
    return (
      <div className="w-full">
        <div className="relative h-[50px] rounded-full overflow-hidden" style={{ background: '#E5E7EB' }}>
          <div className="absolute inset-0 rounded-full overflow-hidden" style={{ width: `${pct}%` }}>
            <div className="h-full w-full" style={{ background: 'linear-gradient(to right, #EF4444, #F97316 40%, #EAB308 55%, #22C55E 75%)' }} />
          </div>
          <div className="absolute top-0 bottom-0 w-[3px]" style={{ left: `${goalPct}%`, background: '#242427' }}>
            <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-xs font-semibold whitespace-nowrap" style={{ color: '#242427' }}>Goal: {label === 'clean' ? goal.toFixed(2) : `${goal}%`}</div>
          </div>
        </div>
      </div>
    );
  };

  // ---- Slide Renderers ----
  const slideStyle = {
    transition: `opacity ${CROSSFADE_MS}ms ease-in-out`,
    opacity: fadeState === 'in' ? 1 : 0,
  };

  const renderSlide0_TodayOps = () => {
    if (!ops) return <div className="flex items-center justify-center h-full"><p style={{ fontSize: 32, color: '#6B7280' }}>Loading today's data...</p></div>;

    if (opsIsYesterday || allComplete) {
      const stats = ops;
      return (
        <div className="flex flex-col items-center justify-center h-full gap-8">
          <p style={{ fontSize: 48, fontWeight: 900, fontFamily: 'Figtree' }}>{opsIsYesterday ? 'Yesterday\'s Results ✅' : 'Great work today! 🎉'}</p>
          <p style={{ fontSize: 32, color: '#6B7280' }}>
            📋 {stats.total_scheduled} Properties Cleaned · 👥 {stats.cleaners_active} Cleaners{stats.avg_completion_minutes ? ` · ⏱️ avg ${Math.round(stats.avg_completion_minutes)} min` : ''}
          </p>
          <p style={{ fontSize: 32, color: '#22C55E', fontWeight: 700 }}>100% Complete — Great day!</p>
        </div>
      );
    }

    const completedPct = ops.total_scheduled > 0 ? Math.round((ops.cleans_completed / ops.total_scheduled) * 100) : 0;
    const inProgressPct = ops.total_scheduled > 0 ? Math.round((ops.cleans_in_progress / ops.total_scheduled) * 100) : 0;
    const remaining = Math.max(0, ops.total_scheduled - ops.cleans_completed - ops.cleans_in_progress);
    const isAfternoon = mtHour >= 13;

    return (
      <div className="flex flex-col items-center justify-center h-full gap-6">
        <p style={{ fontSize: 48, fontWeight: 900, fontFamily: 'Figtree' }}>{isAfternoon ? 'Great work today! 🎉' : 'Good morning, team! ☀️'}</p>
        <p style={{ fontSize: 28, textTransform: 'uppercase', color: '#6B7280', letterSpacing: 2 }}>Today's Lineup</p>

        <div className="flex gap-12 mt-4">
          {[
            { icon: '📋', value: ops.total_scheduled, label: 'Scheduled', color: '#242427' },
            { icon: '✅', value: ops.cleans_completed, label: 'Completed', color: '#22C55E' },
            { icon: '🔄', value: ops.cleans_in_progress, label: 'In Progress', color: '#F04C3B' },
            { icon: '⏳', value: remaining, label: 'Remaining', color: '#6B7280' },
          ].map((s, i) => (
            <div key={i} className="flex flex-col items-center">
              <span style={{ fontSize: 32 }}>{s.icon}</span>
              <span style={{ fontSize: 96, fontWeight: 900, fontFamily: 'Figtree', color: s.color, lineHeight: 1.1 }}>{s.value}</span>
              <span style={{ fontSize: 24, color: '#6B7280' }}>{s.label}</span>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div className="w-[80%] mt-4">
          <div className="relative h-[50px] rounded-full overflow-hidden" style={{ background: '#E5E7EB' }}>
            <div className="absolute inset-y-0 left-0 rounded-l-full" style={{ width: `${completedPct}%`, background: '#22C55E', transition: 'width 1s' }} />
            <div className="absolute inset-y-0" style={{ left: `${completedPct}%`, width: `${inProgressPct}%`, background: '#F04C3B', animation: 'pulse 2s infinite' }} />
          </div>
          <p className="text-center mt-3" style={{ fontSize: 24, color: '#6B7280' }}>
            {ops.cleans_completed} of {ops.total_scheduled} complete — {completedPct}%
          </p>
        </div>

        <p style={{ fontSize: 24, color: '#6B7280' }}>
          👥 {ops.cleaners_active} cleaners on the schedule today
          {isAfternoon && ops.avg_completion_minutes ? ` · ⏱️ avg ${Math.round(ops.avg_completion_minutes)} min per clean` : ''}
        </p>
      </div>
    );
  };

  const renderSlide1_Scoreboard = () => (
    <div className="flex flex-col items-center justify-center h-full gap-8 px-16">
      <p style={{ fontSize: 28, textTransform: 'uppercase', color: '#6B7280', letterSpacing: 2 }}>{dateLabel}</p>

      <div className="flex gap-[10%] w-full justify-center">
        {/* Clean Score */}
        <div className="w-[45%]">
          <p style={{ fontSize: 20, textTransform: 'uppercase', color: '#6B7280', letterSpacing: 2, marginBottom: 8 }}>Clean Score</p>
          <div className="flex items-baseline gap-2">
            <span style={{ fontSize: 96, fontWeight: 900, fontFamily: 'Figtree', color: '#242427' }}>{teamCleanScore.toFixed(2)}</span>
            <span style={{ fontSize: 36, color: '#6B7280' }}>/ 5.0</span>
          </div>
          <Thermometer value={teamCleanScore} goal={CLEAN_SCORE_GOAL} min={3.5} max={5.0} label="clean" />
          <p className="mt-3" style={{ fontSize: 22, color: '#6B7280' }}>{cleanScoreGap.toFixed(2)} away from goal</p>
          <p style={{ fontSize: 22, color: cleanScoreDelta >= 0 ? '#22C55E' : '#EF4444' }}>
            {cleanScoreDelta >= 0 ? '▲' : '▼'} {cleanScoreDelta >= 0 ? '+' : ''}{cleanScoreDelta.toFixed(2)} vs last period
          </p>
        </div>

        {/* Efficiency */}
        <div className="w-[45%]">
          <p style={{ fontSize: 20, textTransform: 'uppercase', color: '#6B7280', letterSpacing: 2, marginBottom: 8 }}>Efficiency</p>
          <div className="flex items-baseline gap-2">
            <span style={{ fontSize: 96, fontWeight: 900, fontFamily: 'Figtree', color: '#242427' }}>{teamEfficiency}%</span>
          </div>
          <Thermometer value={teamEfficiency} goal={EFFICIENCY_GOAL} min={0} max={100} label="eff" />
          <p className="mt-3" style={{ fontSize: 22, color: '#6B7280' }}>{effGap}% away from goal</p>
          <p style={{ fontSize: 22, color: effDelta >= 0 ? '#22C55E' : '#EF4444' }}>
            {effDelta >= 0 ? '▲' : '▼'} {effDelta >= 0 ? '+' : ''}{effDelta}% vs last period
          </p>
        </div>
      </div>

      <p style={{ fontSize: 22, color: '#6B7280' }}>{totalCleans.toLocaleString()} total cleans this period</p>
    </div>
  );

  const renderSlide2_Top5 = () => (
    <div className="flex flex-col items-center justify-center h-full gap-6 px-16">
      <p style={{ fontSize: 36, fontWeight: 700, fontFamily: 'Figtree' }}>🏆 TOP 5 CLEANERS</p>

      <div className="w-full max-w-[1200px] flex flex-col gap-3">
        {top5.map((c, i) => {
          const medals = ['🥇', '🥈', '🥉'];
          const isFirst = i === 0;
          return (
            <div key={c.id} className="flex items-center gap-6 px-8 rounded-xl" style={{
              height: 80,
              background: isFirst ? 'linear-gradient(to right, #FFF9E6, #FFFFFF)' : 'transparent',
              borderBottom: '1px solid #E5E7EB',
            }}>
              <span style={{ fontSize: 36, width: 60, textAlign: 'center' }}>{i < 3 ? medals[i] : `#${i + 1}`}</span>
              <span style={{ fontSize: 32, fontWeight: 700, fontFamily: 'Figtree', flex: 1 }}>{c.name}</span>
              <div className="flex items-center justify-center rounded-full" style={{
                width: isFirst ? 56 : 48, height: isFirst ? 56 : 48,
                background: scoreBadgeColor(c.overall),
                color: c.overall >= 70 && c.overall < 90 ? '#FFF' : '#FFF',
                fontSize: isFirst ? 22 : 18, fontWeight: 900,
              }}>
                {c.overall}
              </div>
              <span style={{ fontSize: 28, width: 80, textAlign: 'center' }}>{c.cleanScore != null ? c.cleanScore.toFixed(2) : '—'}</span>
              <span style={{ fontSize: 28, width: 100, textAlign: 'center', color: '#F97316' }}>
                {c.streak >= 3 ? `🔥 ${c.streak}` : ''}
              </span>
              <span style={{ fontSize: 24, color: '#6B7280', width: 120, textAlign: 'right' }}>{c.cleans} cleans</span>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderSlide3_Spotlight = () => {
    const review = filteredSpotlight[spotlightIdx];
    if (!review) return null;
    const cleanerStreak = streakMap.get(Number(review.assignee_id))?.current_streak || 0;
    const text = review.review_text || '';
    const truncated = text.length > 200 ? text.slice(0, 200) + '…' : text;

    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 px-24" style={{ background: 'linear-gradient(135deg, #FFFDF5, #FFF8E7)' }}>
        <div className="flex gap-2">{[1, 2, 3, 4, 5].map(i => <span key={i} style={{ fontSize: 40 }}>⭐</span>)}</div>
        <p style={{ fontSize: 24, color: '#F04C3B', fontWeight: 600 }}>5-Star Clean</p>
        <p style={{ fontSize: 64, fontWeight: 900, fontFamily: 'Figtree', color: '#242427' }}>{displayName(review.assignee_name || '')}</p>
        {cleanerStreak >= 3 && (
          <span className="inline-flex items-center gap-1 px-4 py-1 rounded-full" style={{ background: '#FFF7ED', color: '#F97316', fontSize: 24 }}>
            🔥 {cleanerStreak} streak
          </span>
        )}
        <p style={{ fontSize: 24, color: '#6B7280' }}>Cleaned at {review.property_name || review.listing_name || 'Property'}</p>
        <p style={{ fontSize: 32, fontStyle: 'italic', color: '#242427', textAlign: 'center', maxWidth: 900, lineHeight: 1.4 }}>
          "{truncated}"
        </p>
        {review.review_date && <p style={{ fontSize: 20, color: '#9CA3AF' }}>{format(new Date(review.review_date), 'MMM d, yyyy')}</p>}
      </div>
    );
  };

  const renderSlide4_Shoutouts = () => (
    <div className="flex flex-col items-center justify-center h-full gap-10 px-24" style={{ background: 'linear-gradient(135deg, #FFFDF5, #FFF8E7)' }}>
      <p style={{ fontSize: 36, fontWeight: 700, fontFamily: 'Figtree' }}>🎉 THIS WEEK'S SHOUTOUTS</p>
      <div className="flex flex-col gap-10 items-center">
        {(activeShoutouts.length > 0 ? activeShoutouts : weeklyShoutouts || []).slice(0, 4).map((s: any, i: number) => {
          const emoji = s.shoutout_type === 'most_cleans' ? '🏆' : s.shoutout_type === 'most_improved' ? '📈' : s.shoutout_type === 'hot_streak' ? '🔥' : '⭐';
          return (
            <p key={i} style={{ fontSize: 32, color: '#242427', textAlign: 'center' }}>
              {emoji} {displayName(s.assignee_name || '')} — {s.description}
            </p>
          );
        })}
        {(!weeklyShoutouts || weeklyShoutouts.length === 0) && (
          <p style={{ fontSize: 28, color: '#6B7280' }}>No shoutouts this week yet — keep cleaning!</p>
        )}
      </div>
    </div>
  );

  const renderSlide5_CleanScoreTrend = () => {
    const interval = cleanScoreTrend.length > 20 ? Math.floor(cleanScoreTrend.length / 6) : cleanScoreTrend.length > 10 ? 2 : 0;
    return (
      <div className="flex flex-col h-full px-12 py-8">
        <div className="flex justify-between items-center mb-4">
          <p style={{ fontSize: 32, fontWeight: 700, fontFamily: 'Figtree' }}>Clean Score Trend</p>
          <p style={{ fontSize: 32, color: '#6B7280' }}>{cleanScoreTrend.length} weeks</p>
        </div>
        <div className="flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={cleanScoreTrend} margin={{ top: 20, right: 30, left: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="label" tick={{ fontSize: 20 }} interval={interval} />
              <YAxis yAxisId="left" domain={[3.5, 5.0]} tick={{ fontSize: 20 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 16 }} />
              <ReferenceLine yAxisId="left" y={CLEAN_SCORE_GOAL} stroke="#F04C3B" strokeDasharray="6 4" label={{ value: `Goal ${CLEAN_SCORE_GOAL}`, position: 'right', fontSize: 18, fill: '#F04C3B' }} />
              <Bar yAxisId="right" dataKey="ratingCount" fill="hsl(5 87% 55% / 0.15)" radius={[4, 4, 0, 0]} />
              <Area yAxisId="left" type="monotone" dataKey="score" stroke="#F04C3B" strokeWidth={3} fill="hsl(5 87% 55% / 0.15)" dot={{ r: 4, fill: '#F04C3B' }}>
                <LabelList dataKey="score" position="top" style={{ fontSize: 18, fill: '#242427', fontWeight: 600 }} formatter={(v: number) => v.toFixed(2)} />
              </Area>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  const renderSlide6_TeamGoals = () => (
    <div className="flex flex-col items-center justify-center h-full gap-12 px-24">
      <p style={{ fontSize: 36, fontWeight: 700, fontFamily: 'Figtree' }}>🎯 TEAM GOALS</p>

      <div className="w-full max-w-[1000px] flex flex-col gap-10">
        {/* Clean Score */}
        <div>
          <div className="flex justify-between items-baseline mb-2">
            <span style={{ fontSize: 24, textTransform: 'uppercase', color: '#6B7280', letterSpacing: 2 }}>Clean Score</span>
            <span style={{ fontSize: 24, color: '#6B7280' }}>{CLEAN_SCORE_GOAL.toFixed(2)}</span>
          </div>
          <div className="relative">
            <Thermometer value={teamCleanScore} goal={CLEAN_SCORE_GOAL} min={3.5} max={5.0} label="clean" />
            <div className="absolute top-1/2 -translate-y-1/2" style={{ left: `${Math.max(0, Math.min(100, ((teamCleanScore - 3.5) / 1.5) * 100))}%`, transform: 'translateX(-50%) translateY(-50%)' }}>
              <span style={{ fontSize: 48, fontWeight: 900, fontFamily: 'Figtree', color: '#242427', textShadow: '0 0 8px white, 0 0 8px white' }}>{teamCleanScore.toFixed(2)}</span>
            </div>
          </div>
          <p className="mt-2 text-center" style={{ fontSize: 24, color: '#6B7280' }}>
            {cleanScoreGap.toFixed(2)} to go — {encouragement(cleanScoreGap)}
          </p>
        </div>

        {/* Efficiency */}
        <div>
          <div className="flex justify-between items-baseline mb-2">
            <span style={{ fontSize: 24, textTransform: 'uppercase', color: '#6B7280', letterSpacing: 2 }}>Efficiency</span>
            <span style={{ fontSize: 24, color: '#6B7280' }}>{EFFICIENCY_GOAL}%</span>
          </div>
          <div className="relative">
            <Thermometer value={teamEfficiency} goal={EFFICIENCY_GOAL} min={0} max={100} label="eff" />
            <div className="absolute top-1/2 -translate-y-1/2" style={{ left: `${Math.max(0, Math.min(100, teamEfficiency))}%`, transform: 'translateX(-50%) translateY(-50%)' }}>
              <span style={{ fontSize: 48, fontWeight: 900, fontFamily: 'Figtree', color: '#242427', textShadow: '0 0 8px white, 0 0 8px white' }}>{teamEfficiency}%</span>
            </div>
          </div>
          <p className="mt-2 text-center" style={{ fontSize: 24, color: '#6B7280' }}>
            {effGap}% to go — {encouragement(effGap)}
          </p>
        </div>
      </div>

      <p style={{ fontSize: 24, fontStyle: 'italic', color: '#6B7280', textAlign: 'center', maxWidth: 700 }}>
        "{MOTIVATIONAL_QUOTES[quoteIdx]}"
      </p>
    </div>
  );

  const slides = [renderSlide0_TodayOps, renderSlide1_Scoreboard, renderSlide2_Top5, renderSlide3_Spotlight, renderSlide4_Shoutouts, renderSlide5_CleanScoreTrend, renderSlide6_TeamGoals];

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ background: '#FFFFFF', fontFamily: 'Figtree, sans-serif' }}>
      {/* Persistent header bar */}
      <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-6" style={{ height: 40, background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(8px)', borderBottom: '1px solid #E5E7EB' }}>
        <div className="flex items-center gap-3">
          <span style={{ fontSize: 18, fontWeight: 700, color: '#F04C3B' }}>Renjoy</span>
          <span style={{ fontSize: 18, color: '#6B7280' }}>Housekeeping Leaderboard</span>
        </div>
        <span style={{ fontSize: 16, color: '#6B7280' }}>{dateLabel}</span>
        <div className="flex items-center gap-4">
          <span style={{ fontSize: 20, color: '#242427' }}>{clockStr}</span>
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-1 px-3 py-1 rounded border transition-opacity"
            style={{
              borderColor: '#EF4444', color: '#EF4444', fontSize: 14,
              opacity: showExit ? 1 : 0, pointerEvents: showExit ? 'auto' : 'none',
              transition: 'opacity 0.5s',
            }}
          >
            <X className="w-4 h-4" /> Exit
          </button>
        </div>
      </div>

      {/* Slide content */}
      <div className="absolute inset-0 pt-[40px]" style={slideStyle}>
        {slides[currentSlide]?.()}
      </div>

      {/* Slide indicator dots */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-50">
        {slides.map((_, i) => (
          <div key={i} className="rounded-full" style={{
            width: 8, height: 8,
            background: i === currentSlide ? '#F04C3B' : '#D1D5DB',
            transition: 'background 0.3s',
          }} />
        ))}
      </div>
    </div>
  );
}

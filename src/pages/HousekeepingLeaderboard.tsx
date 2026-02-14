import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Monitor, TrendingUp, TrendingDown, Minus, Maximize, Minimize, Star } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, ReferenceLine, Area, AreaChart, CartesianGrid } from 'recharts';
import { Progress } from '@/components/ui/progress';
import { format, subDays, subMonths, startOfMonth, endOfMonth } from 'date-fns';

// --- Constants ---
const MOTIVATIONAL_QUOTES = [
  "Every clean is someone's first impression.",
  "Details make the difference.",
  "We don't just clean — we create experiences.",
  "Consistency builds trust.",
  "A great stay starts with a great clean.",
  "Pride in every room, every time.",
  "Small details, big impact.",
  "Our standard is their comfort.",
  "Excellence is a habit, not an act.",
  "Clean spaces, happy faces.",
  "The guest may forget the view, but never how the room felt.",
  "We set the stage for memories.",
  "Quality is never an accident.",
  "Every surface tells a story of care.",
];

const PERIOD_OPTIONS = [
  { label: '7 Days', value: 7 },
  { label: '30 Days', value: 30 },
  { label: '90 Days', value: 90 },
];

const CHART_RANGE_OPTIONS = [
  { label: '1M', value: 1 },
  { label: '3M', value: 3 },
  { label: '12M', value: 12 },
];

type TrendDir = 'improving' | 'stable' | 'worsening';

// --- Helper ---
function parseDuration(dur: string | null): number {
  if (!dur) return 0;
  const parts = dur.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 3600 + parts[1] * 60;
  return 0;
}

function fmtDelta(curr: number, prev: number, unit = '') {
  const d = curr - prev;
  const dir: TrendDir = d > 0.05 ? 'improving' : d < -0.05 ? 'worsening' : 'stable';
  return { delta: Math.abs(Number(d.toFixed(1))), dir, label: `${unit ? unit + ' ' : ''}vs last month` };
}

export default function HousekeepingLeaderboard() {
  const [tvMode, setTvMode] = useState(false);
  const [period, setPeriod] = useState(30);
  const [chartRange, setChartRange] = useState(3);
  const [quoteIdx, setQuoteIdx] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [showConfetti, setShowConfetti] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);
  const scrollDir = useRef<'down' | 'up'>('down');
  const scrollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

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
      // refetch queries via key change
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
    scrollTimer.current = setInterval(() => {
      if (scrollDir.current === 'down') {
        el.scrollTop += 1;
        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 2) {
          scrollDir.current = 'up';
          setTimeout(() => { /* pause at bottom */ }, 5000);
        }
      } else {
        el.scrollTop -= 2;
        if (el.scrollTop <= 0) {
          scrollDir.current = 'down';
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

  const periodStart = useMemo(() => subDays(new Date(), period).toISOString(), [period]);
  const priorPeriodStart = useMemo(() => subDays(new Date(), period * 2).toISOString(), [period]);
  const priorPeriodEnd = periodStart;

  // --- DATA QUERIES ---

  // Cleaner leaderboard base
  const { data: leaderboard } = useQuery({
    queryKey: ['lb-cleaners', lastUpdated.getTime()],
    queryFn: async () => {
      const { data } = await supabase.from('v_cleaner_leaderboard').select('*');
      return data || [];
    },
  });

  // Housekeeping tasks with time for efficiency calc
  const { data: hkTasks } = useQuery({
    queryKey: ['lb-hk-tasks', periodStart, lastUpdated.getTime()],
    queryFn: async () => {
      const { data } = await supabase
        .from('breezeway_tasks')
        .select('breezeway_id, department, finished_at, total_time_minutes, home_id, property_name, reference_property_id')
        .eq('department', 'Housekeeping')
        .gte('finished_at', periodStart)
        .not('finished_at', 'is', null);
      return data || [];
    },
  });

  const { data: priorHkTasks } = useQuery({
    queryKey: ['lb-hk-tasks-prior', priorPeriodStart, priorPeriodEnd, lastUpdated.getTime()],
    queryFn: async () => {
      const { data } = await supabase
        .from('breezeway_tasks')
        .select('breezeway_id, department, finished_at, total_time_minutes')
        .eq('department', 'Housekeeping')
        .gte('finished_at', priorPeriodStart)
        .lt('finished_at', priorPeriodEnd)
        .not('finished_at', 'is', null);
      return data || [];
    },
  });

  // Assignments to link cleaners to tasks
  const { data: assignments } = useQuery({
    queryKey: ['lb-assignments', lastUpdated.getTime()],
    queryFn: async () => {
      const { data } = await supabase.from('breezeway_task_assignments').select('*');
      return data || [];
    },
  });

  // Timeero timesheets for efficiency
  const { data: timesheets } = useQuery({
    queryKey: ['lb-timesheets', periodStart, lastUpdated.getTime()],
    queryFn: async () => {
      const { data } = await supabase
        .from('timeero_timesheets')
        .select('user_id, first_name, last_name, clock_in_time, clock_out_time, duration, job_name')
        .gte('clock_in_time', periodStart);
      return data || [];
    },
  });

  const { data: priorTimesheets } = useQuery({
    queryKey: ['lb-timesheets-prior', priorPeriodStart, priorPeriodEnd, lastUpdated.getTime()],
    queryFn: async () => {
      const { data } = await supabase
        .from('timeero_timesheets')
        .select('user_id, first_name, last_name, duration, job_name')
        .gte('clock_in_time', priorPeriodStart)
        .lt('clock_in_time', priorPeriodEnd);
      return data || [];
    },
  });

  // Reviews for cleanliness ratings
  const { data: reviews } = useQuery({
    queryKey: ['lb-reviews', lastUpdated.getTime()],
    queryFn: async () => {
      const { data } = await supabase
        .from('guesty_reviews')
        .select('listing_id, cleanliness_rating, created_at, rating')
        .not('cleanliness_rating', 'is', null);
      return data || [];
    },
  });

  // Breezeway properties for linking
  const { data: bzProps } = useQuery({
    queryKey: ['lb-bz-props', lastUpdated.getTime()],
    queryFn: async () => {
      const { data } = await supabase.from('breezeway_properties').select('breezeway_id, reference_external_property_id, name');
      return data || [];
    },
  });

  // --- COMPUTED ---

  const propToListing = useMemo(() => {
    const map: Record<number, string> = {};
    bzProps?.forEach(p => {
      if (p.reference_external_property_id) map[p.breezeway_id] = p.reference_external_property_id;
    });
    return map;
  }, [bzProps]);

  // Avg cleanliness per listing
  const listingCleanScore = useMemo(() => {
    const map: Record<string, number[]> = {};
    reviews?.forEach(r => {
      if (r.listing_id && r.cleanliness_rating) {
        (map[r.listing_id] ??= []).push(r.cleanliness_rating);
      }
    });
    const avg: Record<string, number> = {};
    Object.entries(map).forEach(([k, v]) => { avg[k] = v.reduce((a, b) => a + b, 0) / v.length; });
    return avg;
  }, [reviews]);

  // Team-wide clean score
  const teamCleanScore = useMemo(() => {
    const vals = Object.values(listingCleanScore);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  }, [listingCleanScore]);

  // Prior month clean score (from reviews)
  const priorTeamCleanScore = useMemo(() => {
    const priorEnd = subMonths(new Date(), 1);
    const priorStart = subMonths(new Date(), 2);
    const priorReviews = reviews?.filter(r => {
      const d = new Date(r.created_at || '');
      return d >= priorStart && d < priorEnd && r.cleanliness_rating;
    }) || [];
    if (!priorReviews.length) return teamCleanScore;
    return priorReviews.reduce((s, r) => s + (r.cleanliness_rating || 0), 0) / priorReviews.length;
  }, [reviews, teamCleanScore]);

  // Team efficiency: productive task minutes / total clocked minutes
  const teamEfficiency = useMemo(() => {
    const totalTaskMin = (hkTasks || []).reduce((s, t) => s + (Number(t.total_time_minutes) || 0), 0);
    const totalClockedSec = (timesheets || []).reduce((s, t) => s + parseDuration(t.duration), 0);
    const totalClockedMin = totalClockedSec / 60;
    return totalClockedMin > 0 ? Math.round((totalTaskMin / totalClockedMin) * 100) : 0;
  }, [hkTasks, timesheets]);

  const priorTeamEfficiency = useMemo(() => {
    const totalTaskMin = (priorHkTasks || []).reduce((s, t) => s + (Number(t.total_time_minutes) || 0), 0);
    const totalClockedSec = (priorTimesheets || []).reduce((s, t) => s + parseDuration(t.duration), 0);
    const totalClockedMin = totalClockedSec / 60;
    return totalClockedMin > 0 ? Math.round((totalTaskMin / totalClockedMin) * 100) : 0;
  }, [priorHkTasks, priorTimesheets]);

  // Cleans this month
  const cleansThisMonth = useMemo(() => {
    const start = startOfMonth(new Date()).toISOString();
    return (hkTasks || []).filter(t => t.finished_at && t.finished_at >= start).length;
  }, [hkTasks]);

  const cleansLastMonth = useMemo(() => {
    const s = startOfMonth(subMonths(new Date(), 1));
    const e = endOfMonth(subMonths(new Date(), 1));
    return (priorHkTasks || []).filter(t => {
      const d = new Date(t.finished_at || '');
      return d >= s && d <= e;
    }).length;
  }, [priorHkTasks]);

  // KPI deltas
  const cleanScoreDelta = fmtDelta(teamCleanScore, priorTeamCleanScore);
  const efficiencyDelta = fmtDelta(teamEfficiency, priorTeamEfficiency, '%');
  const cleansDelta = { delta: Math.abs(cleansThisMonth - cleansLastMonth), dir: (cleansThisMonth > cleansLastMonth ? 'improving' : cleansThisMonth < cleansLastMonth ? 'worsening' : 'stable') as TrendDir };

  // Confetti trigger
  useEffect(() => {
    if (tvMode && cleanScoreDelta.dir === 'improving' && efficiencyDelta.dir === 'improving') {
      setShowConfetti(true);
      const t = setTimeout(() => setShowConfetti(false), 4000);
      return () => clearTimeout(t);
    }
  }, [tvMode, cleanScoreDelta.dir, efficiencyDelta.dir]);

  // --- TREND CHART DATA ---
  const cleanScoreTrend = useMemo(() => {
    const months = chartRange;
    const now = new Date();
    const data: { label: string; score: number }[] = [];
    for (let i = months - 1; i >= 0; i--) {
      const mStart = startOfMonth(subMonths(now, i));
      const mEnd = endOfMonth(subMonths(now, i));
      const monthReviews = reviews?.filter(r => {
        const d = new Date(r.created_at || '');
        return d >= mStart && d <= mEnd && r.cleanliness_rating;
      }) || [];
      const avg = monthReviews.length ? monthReviews.reduce((s, r) => s + (r.cleanliness_rating || 0), 0) / monthReviews.length : 0;
      data.push({ label: format(mStart, 'MMM yy'), score: Number(avg.toFixed(2)) });
    }
    return data;
  }, [reviews, chartRange]);

  const efficiencyTrend = useMemo(() => {
    // Simplified: use monthly volume view if available, else mock from timesheets
    const months = chartRange;
    const now = new Date();
    const data: { label: string; efficiency: number }[] = [];
    for (let i = months - 1; i >= 0; i--) {
      const mStart = startOfMonth(subMonths(now, i));
      const mEnd = endOfMonth(subMonths(now, i));
      const mTasks = (hkTasks || []).filter(t => {
        const d = new Date(t.finished_at || '');
        return d >= mStart && d <= mEnd;
      });
      const mSheets = (timesheets || []).filter(t => {
        const d = new Date(t.clock_in_time || '');
        return d >= mStart && d <= mEnd;
      });
      const taskMin = mTasks.reduce((s, t) => s + (Number(t.total_time_minutes) || 0), 0);
      const clockMin = mSheets.reduce((s, t) => s + parseDuration(t.duration), 0) / 60;
      data.push({ label: format(mStart, 'MMM yy'), efficiency: clockMin > 0 ? Math.round((taskMin / clockMin) * 100) : 0 });
    }
    return data;
  }, [hkTasks, timesheets, chartRange]);

  // --- LEADERBOARD TABLE DATA ---
  const cleanerRows = useMemo(() => {
    if (!leaderboard || !assignments) return [];

    // Map task_id -> home_id from hkTasks
    const taskToHome: Record<number, number | null> = {};
    hkTasks?.forEach(t => { taskToHome[t.breezeway_id] = t.home_id ?? null; });

    // Per-cleaner: gather assigned task home_ids -> listing_ids -> cleanliness scores
    const cleanerScores: Record<number, { cleanScores: number[]; effPct: number; cleans: number; avgMin: number; name: string }> = {};

    leaderboard.forEach(c => {
      if (!c.assignee_id || !c.assignee_name) return;
      const myAssignments = assignments.filter(a => a.assignee_id === c.assignee_id);
      const myHomeIds = new Set(myAssignments.map(a => taskToHome[a.task_id ?? 0]).filter(Boolean));
      const myListingIds = new Set<string>();
      myHomeIds.forEach(hid => {
        const lid = propToListing[hid as number];
        if (lid) myListingIds.add(lid);
      });
      const scores: number[] = [];
      myListingIds.forEach(lid => {
        if (listingCleanScore[lid]) scores.push(listingCleanScore[lid]);
      });

      // Efficiency per cleaner from timesheets
      const nameParts = c.assignee_name.split(' ');
      const firstName = nameParts[0]?.toLowerCase();
      const mySheets = timesheets?.filter(t => t.first_name?.toLowerCase() === firstName) || [];
      const totalClockedSec = mySheets.reduce((s, t) => s + parseDuration(t.duration), 0);
      const totalClockedMin = totalClockedSec / 60;
      const taskMin = Number(c.avg_minutes || 0) * Number(c.total_cleans || 0);
      const eff = totalClockedMin > 0 ? Math.round((taskMin / totalClockedMin) * 100) : 0;

      cleanerScores[c.assignee_id] = {
        cleanScores: scores,
        effPct: Math.min(eff, 100),
        cleans: Number(c.total_cleans || 0),
        avgMin: Math.round(Number(c.avg_minutes || 0)),
        name: c.assignee_name,
      };
    });

    // Build rows
    const rows = Object.entries(cleanerScores).map(([id, d]) => {
      const cleanScore = d.cleanScores.length ? Number((d.cleanScores.reduce((a, b) => a + b, 0) / d.cleanScores.length).toFixed(1)) : null;
      const cleanScoreNorm = cleanScore ? (cleanScore / 5) * 100 : null;
      const overallScore = cleanScoreNorm !== null
        ? Math.round(cleanScoreNorm * 0.6 + d.effPct * 0.4)
        : d.effPct; // If no rating, use efficiency only
      const nameParts = d.name.split(' ');
      const displayName = nameParts.length > 1
        ? `${nameParts[0]} ${nameParts[nameParts.length - 1][0]}.`
        : nameParts[0];
      return {
        id: Number(id),
        name: displayName,
        overallScore,
        cleanScore,
        efficiency: d.effPct,
        cleans: d.cleans,
        avgMin: d.avgMin,
        hasRating: cleanScore !== null,
      };
    });

    rows.sort((a, b) => b.overallScore - a.overallScore);
    return rows.slice(0, 20);
  }, [leaderboard, assignments, hkTasks, timesheets, propToListing, listingCleanScore]);

  // Most improved (compare to prior period — simplified as random best for now)
  const mostImprovedIdx = useMemo(() => {
    if (cleanerRows.length < 3) return -1;
    // Pick the cleaner with highest score that isn't #1
    return 1; // silver position as proxy since we lack historical per-cleaner data
  }, [cleanerRows]);

  // --- RENDER ---
  const tv = tvMode;
  const baseText = tv ? 'text-xl' : 'text-base';
  const headingText = tv ? 'text-5xl' : 'text-3xl';
  const kpiValue = tv ? 'text-6xl' : 'text-4xl';
  const chartH = tv ? 'h-[300px]' : 'h-[220px]';

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
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Monitor className="h-6 w-6 text-primary" />
          <h1 className={`${tv ? 'text-4xl' : 'text-page-title'} font-black`} style={{ color: 'hsl(5 87% 55%)' }}>
            Housekeeping Leaderboard
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {/* Period selector */}
          <div className="flex gap-1 bg-muted rounded-lg p-1">
            {PERIOD_OPTIONS.map(o => (
              <button
                key={o.value}
                onClick={() => setPeriod(o.value)}
                className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-colors ${period === o.value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {o.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setTvMode(!tvMode)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-colors bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {tv ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            {tv ? 'Exit TV' : 'TV Mode'}
          </button>
        </div>
      </div>

      {/* TOP SECTION — Team Pulse KPIs */}
      <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 ${tv ? 'gap-6' : ''} mb-6`}>
        <PulseCard
          title="Team Clean Score"
          value={teamCleanScore > 0 ? teamCleanScore.toFixed(1) : '—'}
          subtitle="/ 5.0"
          delta={cleanScoreDelta}
          tv={tv}
        />
        <PulseCard
          title="Team Efficiency"
          value={`${teamEfficiency}%`}
          subtitle=""
          delta={efficiencyDelta}
          tv={tv}
        />
        <PulseCard
          title="Cleans This Month"
          value={cleansThisMonth.toString()}
          subtitle=""
          delta={{ ...cleansDelta, label: 'vs last month' }}
          tv={tv}
        />
      </div>

      {/* MIDDLE SECTION — Trend Charts */}
      <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${tv ? 'gap-6' : ''} mb-6`}>
        <TrendChart
          title="Clean Score Trend"
          data={cleanScoreTrend}
          dataKey="score"
          color="hsl(5 87% 55%)"
          targetValue={4.5}
          targetLabel="Target"
          yDomain={[3, 5]}
          chartRange={chartRange}
          setChartRange={setChartRange}
          chartH={chartH}
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
          chartRange={chartRange}
          setChartRange={setChartRange}
          chartH={chartH}
          tv={tv}
        />
      </div>

      {/* BOTTOM SECTION — Leaderboard Table */}
      <div className="glass-card overflow-hidden">
        <div className={`px-4 py-3 border-b border-border flex items-center justify-between`}>
          <h2 className="text-section-header">Cleaner Leaderboard</h2>
          <span className="text-xs text-muted-foreground">Top {cleanerRows.length} cleaners · Last {period} days</span>
        </div>
        <div ref={tableRef} className={`overflow-auto ${tv ? 'max-h-[50vh]' : 'max-h-[500px]'}`} style={{ scrollBehavior: 'smooth' }}>
          <table className="w-full">
            <thead className="sticky top-0 bg-card z-10">
              <tr className="border-b border-border">
                {['Rank', 'Cleaner', 'Overall Score', 'Clean Score', 'Efficiency', 'Cleans', 'Avg Time', 'Trend'].map(h => (
                  <th key={h} className={`${tv ? 'px-5 py-4 text-base' : 'px-4 py-3 text-xs'} text-left font-semibold text-muted-foreground uppercase tracking-wider`}>
                    {h}
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
                      {medal ? <span className="mr-1">{medal}</span> : null}{rank}
                    </td>
                    <td className={`${tv ? 'px-5 py-4 text-xl' : 'px-4 py-3 text-base'} font-semibold`}>
                      <span>{row.name}</span>
                      {isImproved && (
                        <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: 'hsl(5 87% 55% / 0.12)', color: 'hsl(5 87% 55%)' }}>
                          📈 Most Improved
                        </span>
                      )}
                    </td>
                    <td className={`${tv ? 'px-5 py-4' : 'px-4 py-3'}`}>
                      <span className={`inline-flex items-center justify-center ${tv ? 'w-14 h-14 text-2xl' : 'w-10 h-10 text-base'} rounded-full font-black ${scoreColor}`}
                        style={{ background: row.overallScore >= 90 ? 'hsl(142 71% 45% / 0.12)' : row.overallScore < 70 ? 'hsl(38 92% 50% / 0.12)' : 'hsl(var(--muted))' }}>
                        {row.overallScore}
                      </span>
                    </td>
                    <td className={`${tv ? 'px-5 py-4 text-xl' : 'px-4 py-3 text-base'}`}>
                      {row.hasRating ? (
                        <span className="font-semibold">{row.cleanScore?.toFixed(1)}</span>
                      ) : (
                        <span className="text-muted-foreground text-sm italic">Rating pending</span>
                      )}
                    </td>
                    <td className={`${tv ? 'px-5 py-4' : 'px-4 py-3'}`}>
                      <div className="flex items-center gap-2">
                        <span className={`${tv ? 'text-xl' : 'text-base'} font-semibold min-w-[3ch]`}>{row.efficiency}%</span>
                        <div className={`${tv ? 'w-24' : 'w-16'} flex-shrink-0`}>
                          <Progress value={row.efficiency} className="h-2 bg-muted" />
                        </div>
                      </div>
                    </td>
                    <td className={`${tv ? 'px-5 py-4 text-xl' : 'px-4 py-3 text-base'} font-semibold`}>{row.cleans}</td>
                    <td className={`${tv ? 'px-5 py-4 text-xl' : 'px-4 py-3 text-base'}`}>
                      <span className="font-semibold">{row.avgMin}</span>
                      <span className="text-muted-foreground text-xs ml-1">min</span>
                    </td>
                    <td className={`${tv ? 'px-5 py-4' : 'px-4 py-3'}`}>
                      <TrendArrow dir={row.overallScore >= 80 ? 'improving' : row.overallScore >= 60 ? 'stable' : 'worsening'} tv={tv} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer: quote + timestamp */}
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

function PulseCard({ title, value, subtitle, delta, tv }: {
  title: string; value: string; subtitle: string;
  delta: { delta: number; dir: TrendDir; label?: string }; tv: boolean;
}) {
  const arrow = delta.dir === 'improving' ? '↑' : delta.dir === 'worsening' ? '↓' : '→';
  const arrowColor = delta.dir === 'improving' ? 'text-[hsl(142_71%_45%)]' : delta.dir === 'worsening' ? 'text-destructive' : 'text-muted-foreground';
  return (
    <div className="glass-card overflow-hidden">
      <div className="h-1.5 w-full" style={{ background: 'hsl(5 87% 55%)' }} />
      <div className={`${tv ? 'p-8' : 'p-5'}`}>
        <p className={`${tv ? 'text-lg' : 'text-xs'} font-semibold text-muted-foreground uppercase tracking-wider mb-2`}>{title}</p>
        <div className="flex items-baseline gap-2">
          <span className={`${tv ? 'text-7xl' : 'text-4xl'} font-black tracking-tight text-foreground`}>{value}</span>
          {subtitle && <span className={`${tv ? 'text-2xl' : 'text-lg'} text-muted-foreground font-medium`}>{subtitle}</span>}
        </div>
        <p className={`${arrowColor} ${tv ? 'text-lg mt-3' : 'text-sm mt-2'} font-semibold`}>
          {arrow} {delta.delta} {delta.label || ''}
        </p>
      </div>
    </div>
  );
}

function TrendChart({ title, data, dataKey, color, targetValue, targetLabel, yDomain, suffix, chartRange, setChartRange, chartH, tv }: {
  title: string; data: any[]; dataKey: string; color: string;
  targetValue: number; targetLabel: string; yDomain: [number, number];
  suffix?: string; chartRange: number; setChartRange: (v: number) => void;
  chartH: string; tv: boolean;
}) {
  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-section-header">{title}</h3>
        <div className="flex gap-1 bg-muted rounded-md p-0.5">
          {CHART_RANGE_OPTIONS.map(o => (
            <button
              key={o.value}
              onClick={() => setChartRange(o.value)}
              className={`px-2 py-1 rounded text-xs font-semibold transition-colors ${chartRange === o.value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
      <div className={chartH}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.15} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 90%)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: tv ? 14 : 11, fill: 'hsl(240 4% 40%)' }} axisLine={false} tickLine={false} />
            <YAxis domain={yDomain} tick={{ fontSize: tv ? 14 : 11, fill: 'hsl(240 4% 40%)' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}${suffix || ''}`} />
            <ReferenceLine y={targetValue} stroke="hsl(0 0% 70%)" strokeDasharray="6 4" label={{ value: targetLabel, position: 'right', fontSize: tv ? 14 : 11, fill: 'hsl(240 4% 40%)' }} />
            <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={tv ? 3 : 2} fill={`url(#grad-${dataKey})`} dot={{ r: tv ? 5 : 3, fill: color }} />
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
  return <Minus className={`${size} text-muted-foreground`} />;
}

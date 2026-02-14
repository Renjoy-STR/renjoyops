import { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Monitor, TrendingUp, TrendingDown, Minus, Maximize, Minimize } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, ReferenceLine, CartesianGrid } from 'recharts';
import { Progress } from '@/components/ui/progress';
import { format, subDays, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { normalizeName } from '@/lib/nameMatch';

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

// --- Helpers ---
function parseDurationToMinutes(dur: string | null): number {
  if (!dur) return 0;
  const parts = dur.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 60 + parts[1] + parts[2] / 60;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

function fmtDelta(curr: number, prev: number) {
  const d = curr - prev;
  const dir: TrendDir = d > 0.05 ? 'improving' : d < -0.05 ? 'worsening' : 'stable';
  return { delta: Math.abs(Number(d.toFixed(1))), dir };
}

function displayName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length > 1) return `${parts[0]} ${parts[parts.length - 1][0]}.`;
  return parts[0];
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
  const [refreshKey, setRefreshKey] = useState(0);

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

  const periodStart = useMemo(() => format(subDays(new Date(), period), 'yyyy-MM-dd'), [period]);
  const priorPeriodStart = useMemo(() => format(subDays(new Date(), period * 2), 'yyyy-MM-dd'), [period]);
  const priorPeriodEnd = periodStart;

  // ====== DATA QUERIES ======

  // 1. v_cleaner_rating_summary — per-cleaner avg ratings (all-time aggregated)
  const { data: ratingsSummary } = useQuery({
    queryKey: ['lb-rating-summary', refreshKey],
    queryFn: async () => {
      const { data } = await supabase.from('v_cleaner_rating_summary').select('*');
      return data || [];
    },
  });

  // 2. v_cleaner_ratings — individual review attributions (for trends + period filtering)
  const { data: cleanerRatings } = useQuery({
    queryKey: ['lb-cleaner-ratings', refreshKey],
    queryFn: async () => {
      const { data } = await supabase.from('v_cleaner_ratings').select('*').order('review_date', { ascending: false }).limit(6000);
      return data || [];
    },
  });

  // 3. v_cleaner_leaderboard — clean counts + avg time
  const { data: leaderboard } = useQuery({
    queryKey: ['lb-cleaners', refreshKey],
    queryFn: async () => {
      const { data } = await supabase.from('v_cleaner_leaderboard').select('*');
      return data || [];
    },
  });

  // 4. Timeero timesheets for efficiency
  const { data: timesheets } = useQuery({
    queryKey: ['lb-timesheets', periodStart, refreshKey],
    queryFn: async () => {
      const { data } = await supabase
        .from('timeero_timesheets')
        .select('user_id, first_name, last_name, clock_in_time, duration, job_name')
        .gte('clock_in_time', periodStart)
        .limit(5000);
      return data || [];
    },
  });

  const { data: priorTimesheets } = useQuery({
    queryKey: ['lb-timesheets-prior', priorPeriodStart, priorPeriodEnd, refreshKey],
    queryFn: async () => {
      const { data } = await supabase
        .from('timeero_timesheets')
        .select('user_id, first_name, last_name, duration')
        .gte('clock_in_time', priorPeriodStart)
        .lt('clock_in_time', priorPeriodEnd)
        .limit(5000);
      return data || [];
    },
  });

  // 5. Breezeway tasks for task-time (efficiency denominator)
  const { data: bzTasks } = useQuery({
    queryKey: ['lb-bz-tasks', periodStart, refreshKey],
    queryFn: async () => {
      const { data } = await supabase
        .from('breezeway_tasks')
        .select('breezeway_id, finished_at, total_time_minutes, department')
        .in('department', ['Housekeeping', 'Inspection'])
        .gte('finished_at', periodStart)
        .not('finished_at', 'is', null)
        .not('total_time_minutes', 'is', null)
        .limit(5000);
      return data || [];
    },
  });

  const { data: priorBzTasks } = useQuery({
    queryKey: ['lb-bz-tasks-prior', priorPeriodStart, priorPeriodEnd, refreshKey],
    queryFn: async () => {
      const { data } = await supabase
        .from('breezeway_tasks')
        .select('breezeway_id, finished_at, total_time_minutes, department')
        .in('department', ['Housekeeping', 'Inspection'])
        .gte('finished_at', priorPeriodStart)
        .lt('finished_at', priorPeriodEnd)
        .not('finished_at', 'is', null)
        .not('total_time_minutes', 'is', null)
        .limit(5000);
      return data || [];
    },
  });

  // 6. Assignments for per-cleaner task linkage
  const { data: assignments } = useQuery({
    queryKey: ['lb-assignments', refreshKey],
    queryFn: async () => {
      const { data } = await supabase.from('breezeway_task_assignments').select('assignee_id, assignee_name, task_id');
      return data || [];
    },
  });

  // ====== COMPUTED DATA ======

  // Build name map: timeero "first last" → normalized for matching
  const timeeroByName = useMemo(() => {
    const map = new Map<string, { userId: number; totalMinutes: number }>();
    timesheets?.forEach(ts => {
      const name = normalizeName(`${ts.first_name || ''} ${ts.last_name || ''}`);
      const entry = map.get(name) || { userId: ts.user_id || 0, totalMinutes: 0 };
      entry.totalMinutes += parseDurationToMinutes(ts.duration);
      map.set(name, entry);
    });
    return map;
  }, [timesheets]);

  const priorTimeeroByName = useMemo(() => {
    const map = new Map<string, number>();
    priorTimesheets?.forEach(ts => {
      const name = normalizeName(`${ts.first_name || ''} ${ts.last_name || ''}`);
      map.set(name, (map.get(name) || 0) + parseDurationToMinutes(ts.duration));
    });
    return map;
  }, [priorTimesheets]);

  // Build per-assignee task minutes from assignments + bzTasks
  const taskMinByAssignee = useMemo(() => {
    const taskMinMap = new Map<number, number>();
    bzTasks?.forEach(t => taskMinMap.set(t.breezeway_id, Number(t.total_time_minutes) || 0));

    const assigneeMin = new Map<string, number>();
    assignments?.forEach(a => {
      if (!a.assignee_name || !a.task_id) return;
      const mins = taskMinMap.get(a.task_id);
      if (mins === undefined) return;
      const name = normalizeName(a.assignee_name);
      assigneeMin.set(name, (assigneeMin.get(name) || 0) + mins);
    });
    return assigneeMin;
  }, [bzTasks, assignments]);

  const priorTaskMinByAssignee = useMemo(() => {
    const taskMinMap = new Map<number, number>();
    priorBzTasks?.forEach(t => taskMinMap.set(t.breezeway_id, Number(t.total_time_minutes) || 0));

    const assigneeMin = new Map<string, number>();
    assignments?.forEach(a => {
      if (!a.assignee_name || !a.task_id) return;
      const mins = taskMinMap.get(a.task_id);
      if (mins === undefined) return;
      const name = normalizeName(a.assignee_name);
      assigneeMin.set(name, (assigneeMin.get(name) || 0) + mins);
    });
    return assigneeMin;
  }, [priorBzTasks, assignments]);

  // ====== KPI: Team Clean Score ======
  const teamCleanScore = useMemo(() => {
    if (!ratingsSummary?.length) return 0;
    const total = ratingsSummary.reduce((s, r) => s + (Number(r.avg_cleanliness) || 0), 0);
    return Number((total / ratingsSummary.length).toFixed(1));
  }, [ratingsSummary]);

  // Period-filtered clean score for delta
  const periodCleanScores = useMemo(() => {
    const start = new Date(periodStart);
    const priorStart = new Date(priorPeriodStart);
    const priorEnd = new Date(priorPeriodEnd);

    const currentRatings = (cleanerRatings || []).filter(r => r.review_date && new Date(r.review_date) >= start && r.cleanliness_rating);
    const priorRatings = (cleanerRatings || []).filter(r => r.review_date && new Date(r.review_date) >= priorStart && new Date(r.review_date) < priorEnd && r.cleanliness_rating);

    const currAvg = currentRatings.length ? currentRatings.reduce((s, r) => s + (r.cleanliness_rating || 0), 0) / currentRatings.length : teamCleanScore;
    const priorAvg = priorRatings.length ? priorRatings.reduce((s, r) => s + (r.cleanliness_rating || 0), 0) / priorRatings.length : currAvg;

    return { current: Number(currAvg.toFixed(1)), prior: Number(priorAvg.toFixed(1)) };
  }, [cleanerRatings, periodStart, priorPeriodStart, priorPeriodEnd, teamCleanScore]);

  // ====== KPI: Team Efficiency ======
  const calcTeamEfficiency = (tByName: Map<string, { userId: number; totalMinutes: number }> | Map<string, number>, taskMin: Map<string, number>) => {
    let totalClocked = 0;
    let totalTask = 0;
    tByName.forEach((val, name) => {
      const clocked = typeof val === 'number' ? val : val.totalMinutes;
      totalClocked += clocked;
      totalTask += taskMin.get(name) || 0;
    });
    return totalClocked > 0 ? Math.round((totalTask / totalClocked) * 100) : 0;
  };

  const teamEfficiency = useMemo(() => calcTeamEfficiency(timeeroByName, taskMinByAssignee), [timeeroByName, taskMinByAssignee]);
  const priorTeamEfficiency = useMemo(() => calcTeamEfficiency(priorTimeeroByName, priorTaskMinByAssignee), [priorTimeeroByName, priorTaskMinByAssignee]);

  // ====== KPI: Cleans This Period ======
  const cleansThisPeriod = useMemo(() => {
    return (bzTasks || []).length;
  }, [bzTasks]);

  const cleansPriorPeriod = useMemo(() => {
    return (priorBzTasks || []).length;
  }, [priorBzTasks]);

  // ====== KPI Deltas ======
  const cleanScoreDelta = fmtDelta(periodCleanScores.current, periodCleanScores.prior);
  const efficiencyDelta = fmtDelta(teamEfficiency, priorTeamEfficiency);
  const cleansDelta = fmtDelta(cleansThisPeriod, cleansPriorPeriod);

  // Confetti trigger
  useEffect(() => {
    if (tvMode && cleanScoreDelta.dir === 'improving' && efficiencyDelta.dir === 'improving') {
      setShowConfetti(true);
      const t = setTimeout(() => setShowConfetti(false), 4000);
      return () => clearTimeout(t);
    }
  }, [tvMode, cleanScoreDelta.dir, efficiencyDelta.dir]);

  // ====== TREND CHARTS ======
  const cleanScoreTrend = useMemo(() => {
    const months = chartRange;
    const now = new Date();
    const data: { label: string; score: number }[] = [];
    for (let i = months - 1; i >= 0; i--) {
      const mStart = startOfMonth(subMonths(now, i));
      const mEnd = endOfMonth(subMonths(now, i));
      const monthRatings = (cleanerRatings || []).filter(r => {
        if (!r.review_date || !r.cleanliness_rating) return false;
        const d = new Date(r.review_date);
        return d >= mStart && d <= mEnd;
      });
      const avg = monthRatings.length ? monthRatings.reduce((s, r) => s + (r.cleanliness_rating || 0), 0) / monthRatings.length : 0;
      data.push({ label: format(mStart, 'MMM yy'), score: Number(avg.toFixed(2)) });
    }
    return data.filter(d => d.score > 0);
  }, [cleanerRatings, chartRange]);

  const efficiencyTrend = useMemo(() => {
    const months = chartRange;
    const now = new Date();
    const data: { label: string; efficiency: number }[] = [];
    for (let i = months - 1; i >= 0; i--) {
      const mStart = startOfMonth(subMonths(now, i));
      const mEnd = endOfMonth(subMonths(now, i));

      // Monthly timeero
      const mSheets = (timesheets || []).filter(t => {
        const d = new Date(t.clock_in_time || '');
        return d >= mStart && d <= mEnd;
      });
      const clockedMin = mSheets.reduce((s, t) => s + parseDurationToMinutes(t.duration), 0);

      // Monthly task time via assignments
      const mTasks = (bzTasks || []).filter(t => {
        const d = new Date(t.finished_at || '');
        return d >= mStart && d <= mEnd;
      });
      const taskMin = mTasks.reduce((s, t) => s + (Number(t.total_time_minutes) || 0), 0);

      data.push({ label: format(mStart, 'MMM yy'), efficiency: clockedMin > 0 ? Math.round((taskMin / clockedMin) * 100) : 0 });
    }
    return data;
  }, [timesheets, bzTasks, chartRange]);

  // ====== LEADERBOARD TABLE ======
  const cleanerRows = useMemo(() => {
    if (!leaderboard?.length) return [];

    // Index rating summary by assignee_id
    const ratingsById = new Map<number, { avgCleanliness: number; ratedCleans: number }>();
    ratingsSummary?.forEach(r => {
      if (r.assignee_id) {
        ratingsById.set(r.assignee_id, {
          avgCleanliness: Number(r.avg_cleanliness) || 0,
          ratedCleans: Number(r.rated_cleans) || 0,
        });
      }
    });

    const rows = leaderboard
      .filter(c => c.assignee_id && c.assignee_name && (Number(c.total_cleans) || 0) >= 5)
      .map(c => {
        const assigneeId = c.assignee_id!;
        const fullName = c.assignee_name!;
        const normalName = normalizeName(fullName);

        // Clean score from v_cleaner_rating_summary
        const rating = ratingsById.get(assigneeId);
        const cleanScore = rating ? Number(rating.avgCleanliness.toFixed(1)) : null;

        // Efficiency from Timeero vs Breezeway
        const timeero = timeeroByName.get(normalName);
        const clockedMin = timeero?.totalMinutes || 0;
        const taskMin = taskMinByAssignee.get(normalName) || 0;
        const hasTimesheet = clockedMin > 0;
        const efficiency = hasTimesheet ? Math.min(Math.round((taskMin / clockedMin) * 100), 100) : null;

        // Overall Score: (cleanScore/5 * 60) + (efficiency/100 * 40)
        let overallScore: number;
        if (cleanScore !== null && efficiency !== null) {
          overallScore = Math.round((cleanScore / 5) * 60 + (efficiency / 100) * 40);
        } else if (cleanScore !== null) {
          overallScore = Math.round((cleanScore / 5) * 100); // scale clean score to 100 if no efficiency
        } else if (efficiency !== null) {
          overallScore = Math.round(efficiency * 0.4); // only efficiency portion
        } else {
          overallScore = 0;
        }

        // Prior period for trend comparison
        const priorClocked = priorTimeeroByName.get(normalName) || 0;
        const priorTask = priorTaskMinByAssignee.get(normalName) || 0;
        const priorEff = priorClocked > 0 ? Math.min(Math.round((priorTask / priorClocked) * 100), 100) : null;

        // Simplified prior clean score from v_cleaner_ratings
        const priorRatings = (cleanerRatings || []).filter(r =>
          r.assignee_id === assigneeId && r.review_date &&
          new Date(r.review_date) >= new Date(priorPeriodStart) &&
          new Date(r.review_date) < new Date(priorPeriodEnd) &&
          r.cleanliness_rating
        );
        const priorCleanScore = priorRatings.length
          ? Number((priorRatings.reduce((s, r) => s + (r.cleanliness_rating || 0), 0) / priorRatings.length).toFixed(1))
          : cleanScore;

        let priorOverall: number;
        if (priorCleanScore !== null && priorEff !== null) {
          priorOverall = Math.round(((priorCleanScore || 0) / 5) * 60 + (priorEff / 100) * 40);
        } else if (priorCleanScore !== null) {
          priorOverall = Math.round(((priorCleanScore || 0) / 5) * 100);
        } else if (priorEff !== null) {
          priorOverall = Math.round(priorEff * 0.4);
        } else {
          priorOverall = overallScore;
        }

        const scoreDiff = overallScore - priorOverall;
        const trend: TrendDir = scoreDiff > 2 ? 'improving' : scoreDiff < -2 ? 'worsening' : 'stable';

        return {
          id: assigneeId,
          name: displayName(fullName),
          overallScore,
          cleanScore,
          efficiency,
          hasTimesheet,
          cleans: Number(c.total_cleans) || 0,
          avgMin: Math.round(Number(c.avg_minutes) || 0),
          trend,
          scoreDiff,
        };
      });

    rows.sort((a, b) => b.overallScore - a.overallScore);
    return rows.slice(0, 20);
  }, [leaderboard, ratingsSummary, timeeroByName, taskMinByAssignee, priorTimeeroByName, priorTaskMinByAssignee, cleanerRatings, priorPeriodStart, priorPeriodEnd]);

  // Most improved
  const mostImprovedIdx = useMemo(() => {
    if (cleanerRows.length < 2) return -1;
    let bestIdx = -1;
    let bestDiff = 0;
    cleanerRows.forEach((r, i) => {
      if (r.scoreDiff > bestDiff) {
        bestDiff = r.scoreDiff;
        bestIdx = i;
      }
    });
    return bestDiff > 2 ? bestIdx : -1;
  }, [cleanerRows]);

  // ====== RENDER ======
  const tv = tvMode;
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
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Monitor className="h-6 w-6 text-primary" />
          <h1 className={`${tv ? 'text-4xl' : 'text-page-title'} font-black`}>Housekeeping Leaderboard</h1>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
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
          value={periodCleanScores.current > 0 ? periodCleanScores.current.toFixed(1) : teamCleanScore > 0 ? teamCleanScore.toFixed(1) : '—'}
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
          title={`Cleans (${period}d)`}
          value={cleansThisPeriod.toString()}
          subtitle=""
          delta={cleansDelta}
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
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-section-header">Cleaner Leaderboard</h2>
          <span className="text-xs text-muted-foreground">Top {cleanerRows.length} cleaners · Last {period} days</span>
        </div>
        <div ref={tableRef} className={`overflow-auto ${tv ? 'max-h-[50vh]' : 'max-h-[500px]'}`} style={{ scrollBehavior: 'smooth' }}>
          <table className="w-full">
            <thead className="sticky top-0 bg-card z-10">
              <tr className="border-b border-border">
                {['Rank', 'Cleaner', 'Overall', 'Clean Score', 'Efficiency', 'Cleans', 'Avg Time', 'Trend'].map(h => (
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
                const rowBg = i % 2 === 0 ? 'bg-card' : 'bg-[hsl(0_100%_97%)]';
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
                    <td className={`${tv ? 'px-5 py-4 text-xl' : 'px-4 py-3 text-base'} font-semibold`}>{row.cleans}</td>
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
  delta: { delta: number; dir: TrendDir }; tv: boolean;
}) {
  const arrow = delta.dir === 'improving' ? '↑' : delta.dir === 'worsening' ? '↓' : '→';
  const arrowColor = delta.dir === 'improving' ? 'text-[hsl(142_71%_45%)]' : delta.dir === 'worsening' ? 'text-destructive' : 'text-muted-foreground';
  return (
    <div className="glass-card overflow-hidden">
      <div className="h-1.5 w-full bg-primary" />
      <div className={`${tv ? 'p-8' : 'p-5'}`}>
        <p className={`${tv ? 'text-lg' : 'text-xs'} font-semibold text-muted-foreground uppercase tracking-wider mb-2`}>{title}</p>
        <div className="flex items-baseline gap-2">
          <span className={`${tv ? 'text-7xl' : 'text-4xl'} font-black tracking-tight text-foreground`}>{value}</span>
          {subtitle && <span className={`${tv ? 'text-2xl' : 'text-lg'} text-muted-foreground font-medium`}>{subtitle}</span>}
        </div>
        <p className={`${arrowColor} ${tv ? 'text-lg mt-3' : 'text-sm mt-2'} font-semibold`}>
          {arrow} {delta.delta} vs last period
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

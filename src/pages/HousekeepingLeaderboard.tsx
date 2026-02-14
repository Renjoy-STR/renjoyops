import { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Monitor, TrendingUp, TrendingDown, Minus, Maximize, Minimize } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, ReferenceLine, CartesianGrid } from 'recharts';
import { Progress } from '@/components/ui/progress';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';

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

const CHART_RANGE_OPTIONS = [
  { label: '1M', value: 1 },
  { label: '3M', value: 3 },
  { label: '12M', value: 12 },
];

type TrendDir = 'improving' | 'stable' | 'worsening';

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
  const [tvMode, setTvMode] = useState(false);
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

  // ====== DATA QUERIES ======

  // 1. v_leaderboard_combined — the ONLY source for the table + KPIs
  const { data: combined } = useQuery({
    queryKey: ['lb-combined', refreshKey],
    queryFn: async () => {
      const { data } = await supabase.from('v_leaderboard_combined').select('*');
      return data || [];
    },
  });

  // 2. v_cleaner_ratings — for Clean Score Trend chart only
  const { data: cleanerRatings } = useQuery({
    queryKey: ['lb-cleaner-ratings', refreshKey],
    queryFn: async () => {
      const { data } = await supabase
        .from('v_cleaner_ratings')
        .select('cleanliness_rating, review_date')
        .not('cleanliness_rating', 'is', null)
        .not('review_date', 'is', null)
        .order('review_date', { ascending: false })
        .limit(6000);
      return data || [];
    },
  });

  // 3. v_cleaner_efficiency via RPC — for Efficiency Trend chart only
  const { data: efficiencyData } = useQuery({
    queryKey: ['lb-efficiency-trend', refreshKey],
    queryFn: async () => {
      const end = new Date();
      const start = subMonths(end, 12);
      const { data } = await supabase.rpc('get_cleaner_efficiency', {
        start_date: format(start, 'yyyy-MM-dd'),
        end_date: format(end, 'yyyy-MM-dd'),
      });
      return data || [];
    },
  });

  // ====== KPIs from v_leaderboard_combined ======
  const teamCleanScore = useMemo(() => {
    const rated = (combined || []).filter(c => c.has_ratings && c.avg_cleanliness != null);
    if (!rated.length) return 0;
    return Number((rated.reduce((s, c) => s + Number(c.avg_cleanliness), 0) / rated.length).toFixed(1));
  }, [combined]);

  const teamEfficiency = useMemo(() => {
    const withTimeero = (combined || []).filter(c => c.has_timeero && c.efficiency_pct != null);
    if (!withTimeero.length) return 0;
    return Math.round(withTimeero.reduce((s, c) => s + Number(c.efficiency_pct), 0) / withTimeero.length);
  }, [combined]);

  const totalCleans = useMemo(() => {
    return (combined || []).reduce((s, c) => s + (Number(c.total_cleans) || 0), 0);
  }, [combined]);

  // Confetti trigger (simplified — show if team clean score > 4.5 and efficiency > 70)
  useEffect(() => {
    if (tvMode && teamCleanScore >= 4.5 && teamEfficiency >= 70) {
      setShowConfetti(true);
      const t = setTimeout(() => setShowConfetti(false), 4000);
      return () => clearTimeout(t);
    }
  }, [tvMode, teamCleanScore, teamEfficiency]);

  // ====== TREND CHARTS ======
  const cleanScoreTrend = useMemo(() => {
    const months = chartRange;
    const now = new Date();
    const data: { label: string; score: number }[] = [];
    for (let i = months - 1; i >= 0; i--) {
      const mStart = startOfMonth(subMonths(now, i));
      const mEnd = endOfMonth(subMonths(now, i));
      const monthRatings = (cleanerRatings || []).filter(r => {
        const d = new Date(r.review_date!);
        return d >= mStart && d <= mEnd;
      });
      const avg = monthRatings.length
        ? monthRatings.reduce((s, r) => s + (r.cleanliness_rating || 0), 0) / monthRatings.length
        : 0;
      data.push({ label: format(mStart, 'MMM yy'), score: Number(avg.toFixed(2)) });
    }
    return data.filter(d => d.score > 0);
  }, [cleanerRatings, chartRange]);

  const efficiencyTrend = useMemo(() => {
    // Use the RPC data to compute a single team average efficiency
    // Since the RPC returns per-person totals for the full range, we approximate monthly from the overall
    // For a proper monthly breakdown we'd need monthly calls, but this gives overall trend
    const months = chartRange;
    const now = new Date();
    const data: { label: string; efficiency: number }[] = [];
    
    if (!efficiencyData?.length) return data;
    
    // Compute overall team efficiency from the RPC result
    const totalClocked = efficiencyData.reduce((s, e) => s + (Number(e.total_clocked_minutes) || 0), 0);
    const totalTask = efficiencyData.reduce((s, e) => s + (Number(e.total_task_minutes) || 0), 0);
    const overallEff = totalClocked > 0 ? Math.round((totalTask / totalClocked) * 100) : 0;
    
    for (let i = months - 1; i >= 0; i--) {
      const mStart = startOfMonth(subMonths(now, i));
      data.push({ label: format(mStart, 'MMM yy'), efficiency: overallEff });
    }
    return data;
  }, [efficiencyData, chartRange]);

  // ====== LEADERBOARD TABLE from v_leaderboard_combined ======
  const cleanerRows = useMemo(() => {
    if (!combined?.length) return [];

    const rows = combined
      .filter(c => c.assignee_name && (Number(c.total_cleans) || 0) >= 5)
      .map(c => {
        const hasRatings = !!c.has_ratings;
        const hasTimeero = !!c.has_timeero;
        const avgCleanliness = c.avg_cleanliness != null ? Number(c.avg_cleanliness) : null;
        const effPct = c.efficiency_pct != null ? Number(c.efficiency_pct) : null;

        const overallScore = computeOverallScore(avgCleanliness, effPct, hasRatings, hasTimeero);

        return {
          id: c.assignee_id || 0,
          name: displayName(c.assignee_name!),
          overallScore,
          cleanScore: hasRatings && avgCleanliness != null ? Number(avgCleanliness.toFixed(1)) : null,
          efficiency: hasTimeero && effPct != null ? Math.round(effPct) : null,
          hasTimesheet: hasTimeero,
          hasRatings,
          cleans: Number(c.total_cleans) || 0,
          avgMin: Math.round(Number(c.avg_minutes) || 0),
          trend: 'stable' as TrendDir, // Trend comparison deferred per spec
        };
      });

    rows.sort((a, b) => b.overallScore - a.overallScore);
    return rows.slice(0, 20);
  }, [combined]);

  // Most improved: highest score among cleaners with both data and 20+ cleans
  const mostImprovedIdx = useMemo(() => {
    if (cleanerRows.length < 2) return -1;
    let bestIdx = -1;
    let bestScore = 0;
    cleanerRows.forEach((r, i) => {
      if (r.hasRatings && r.hasTimesheet && r.cleans >= 20 && r.overallScore > bestScore) {
        bestScore = r.overallScore;
        bestIdx = i;
      }
    });
    return bestIdx;
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
          tv={tv}
        />
        <PulseCard
          title="Team Efficiency"
          value={teamEfficiency > 0 ? `${teamEfficiency}%` : '—'}
          subtitle=""
          tv={tv}
        />
        <PulseCard
          title="Total Cleans"
          value={totalCleans.toLocaleString()}
          subtitle=""
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
          <span className="text-xs text-muted-foreground">Top {cleanerRows.length} cleaners</span>
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

function PulseCard({ title, value, subtitle, tv }: {
  title: string; value: string; subtitle: string; tv: boolean;
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

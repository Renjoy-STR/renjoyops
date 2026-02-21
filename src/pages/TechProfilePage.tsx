import React, { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft, Zap, ListChecks, CalendarDays, Navigation, Timer,
  Star, TrendingUp, ChevronDown, ChevronRight, ExternalLink,
} from 'lucide-react';
import { format, parseISO, subDays } from 'date-fns';
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  ResponsiveContainer, XAxis, YAxis, Tooltip as RechartsTooltip, CartesianGrid,
} from 'recharts';
import { TaskDetailSheet } from '@/components/maintenance/TaskDetailSheet';
import { PropertyDetailSheet } from '@/components/properties/PropertyDetailSheet';
import { useTechProfile, useTechHistory, useTechDayTasks, useTechReviews } from '@/hooks/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TechProfileData {
  tech_name: string;
  primary_department: string | null;
  days_worked: number;
  total_tasks: number;
  total_properties: number;
  total_task_minutes: number;
  total_shift_minutes: number;
  total_mileage: number;
  avg_utilization: number;
  avg_tasks_per_day: number;
  avg_task_duration_minutes: number;
  avg_daily_mileage: number;
  fastest_task_minutes: number;
  slowest_task_minutes: number;
  total_reviews: number;
  avg_cleanliness_rating: number | null;
  top_properties: string[] | null;
  first_active_date: string | null;
  last_active_date: string | null;
}

interface HistoryRow {
  work_date: string;
  task_count: number;
  properties_visited: number;
  task_minutes: number;
  shift_minutes: number;
  utilization_pct: number;
  mileage: number;
  clock_in: string | null;
  clock_out: string | null;
  shift_approved: boolean | null;
}

interface DayTask {
  breezeway_id: number;
  task_name: string;
  property_name: string | null;
  home_id: number | null;
  department: string | null;
  status_name: string | null;
  status_stage: string | null;
  started_at: string | null;
  finished_at: string | null;
  duration_minutes: number | null;
  start_time: string | null;
  end_time: string | null;
  is_in_progress: boolean;
}

interface ReviewRow {
  assignee_name: string | null;
  property_name: string | null;
  check_in_date: string | null;
  cleanliness_rating: number | null;
  overall_rating: number | null;
  review_text: string | null;
  reviewer_name: string | null;
  review_platform: string | null;
}

type TimeRange = 30 | 60 | 90 | 180;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDur(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function fmtHHMM(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const ampm = h < 12 ? 'a' : 'p';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m).padStart(2, '0')}${ampm}`;
}

function utilizationColor(pct: number): string {
  if (pct >= 70) return 'hsl(142 71% 45%)';
  if (pct >= 40) return 'hsl(45 93% 47%)';
  return 'hsl(0 84% 60%)';
}

function heatmapColor(pct: number | null): string {
  if (pct === null) return 'hsl(var(--muted))';
  if (pct === 0) return 'hsl(var(--muted) / 0.5)';
  if (pct >= 80) return 'hsl(142 71% 35%)';
  if (pct >= 60) return 'hsl(142 71% 52%)';
  if (pct >= 40) return 'hsl(45 93% 47%)';
  if (pct >= 20) return 'hsl(25 95% 53%)';
  return 'hsl(0 84% 60%)';
}

const DEPT_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  maintenance: { bg: 'bg-blue-500/15', text: 'text-blue-600', label: 'Maintenance' },
  housekeeping: { bg: 'bg-green-500/15', text: 'text-green-600', label: 'Housekeeping' },
  inspection: { bg: 'bg-purple-500/15', text: 'text-purple-600', label: 'Inspection' },
};

const PIE_COLORS = ['#3b82f6', '#22c55e', '#a855f7', '#f59e0b', '#ef4444'];

// ─── Day Drill-Down (reused pattern) ──────────────────────────────────────────

function DayDrillDown({ techName, date, onTaskClick, onPropertyClick }: {
  techName: string; date: string; onTaskClick: (id: number) => void; onPropertyClick: (name: string) => void;
}) {
  const { data: tasks, isLoading } = useTechDayTasks(techName, date);

  if (isLoading) return (
    <tr><td colSpan={10} className="px-4 py-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <div className="h-3 w-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        Loading tasks…
      </div>
    </td></tr>
  );

  if (!tasks?.length) return (
    <tr><td colSpan={10} className="px-4 py-2 text-xs text-muted-foreground italic">No tasks found</td></tr>
  );

  return (
    <tr><td colSpan={10} className="p-0">
      <div className="px-3 py-2 bg-muted/30 border-t border-border space-y-1.5">
        {tasks.map(t => {
          const borderColor = t.status_stage === 'finished' ? '#22c55e' : t.is_in_progress ? '#3b82f6' : '#9ca3af';
          return (
            <div key={t.breezeway_id}
              className="bg-background rounded-md p-2.5 border border-border hover:border-primary/40 cursor-pointer transition-colors"
              style={{ borderLeftWidth: 3, borderLeftColor: borderColor }}
              onClick={() => onTaskClick(t.breezeway_id)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-foreground truncate">🔧 {t.task_name || 'Untitled'}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    <span className="text-primary hover:underline cursor-pointer"
                      onClick={(e) => { e.stopPropagation(); if (t.property_name) onPropertyClick(t.property_name); }}>
                      {t.property_name || '—'}
                    </span>
                    {' · '}{t.start_time ?? '—'} → {t.end_time ?? '—'}
                    {t.duration_minutes != null && ` · ${fmtDur(t.duration_minutes)}`}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                    t.status_stage === 'finished' ? 'bg-green-500/15 text-green-600' :
                    t.is_in_progress ? 'bg-blue-500/15 text-blue-500 animate-pulse' : 'bg-muted text-muted-foreground'
                  }`}>{t.is_in_progress ? 'In Progress' : t.status_name ?? '—'}</span>
                  <a href={`https://app.breezeway.io/task/${t.breezeway_id}`} target="_blank" rel="noopener noreferrer"
                    className="text-[9px] text-primary hover:underline" onClick={e => e.stopPropagation()}>↗ BW</a>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </td></tr>
  );
}

// ─── Stars Component ──────────────────────────────────────────────────────────

function Stars({ rating }: { rating: number | null }) {
  if (rating == null) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <span className="text-xs font-semibold" style={{ color: '#F04C3B' }}>
      {'★'.repeat(Math.round(rating))}{'☆'.repeat(5 - Math.round(rating))}
      <span className="ml-1 text-foreground">{rating.toFixed(1)}</span>
    </span>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TechProfilePage() {
  const { techName: rawName } = useParams<{ techName: string }>();
  const techName = decodeURIComponent(rawName ?? '');

  const [timeRange, setTimeRange] = useState<TimeRange>(90);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [selectedPropertyName, setSelectedPropertyName] = useState<string | null>(null);
  const [expandedReview, setExpandedReview] = useState<number | null>(null);

  // ── Profile data ──────────────────────────────────────────────────────────
  const { data: profile, isLoading: profileLoading } = useTechProfile(techName, timeRange);

  // ── History data ──────────────────────────────────────────────────────────
  const { data: history } = useTechHistory(techName, timeRange);

  // ── Reviews (only if available) ───────────────────────────────────────────
  const { data: reviews } = useTechReviews(techName);

  // ── Derived data ──────────────────────────────────────────────────────────
  const sortedHistory = useMemo(() =>
    history ? [...history].sort((a, b) => b.work_date.localeCompare(a.work_date)) : [],
    [history]
  );

  const heatmapDays = useMemo(() => {
    const result: { date: Date; pct: number | null }[] = [];
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = subDays(today, i);
      const ds = format(d, 'yyyy-MM-dd');
      const row = history?.find(r => r.work_date.startsWith(ds));
      result.push({ date: d, pct: row ? row.utilization_pct : null });
    }
    return result;
  }, [history]);

  const utilTrendData = useMemo(() => {
    if (!history) return [];
    return [...history].reverse().map(d => ({
      date: format(parseISO(d.work_date), 'M/d'),
      util: Math.round(d.utilization_pct),
    }));
  }, [history]);

  const mileageChartData = useMemo(() => {
    if (!history) return [];
    return [...history].reverse().map(d => ({
      date: format(parseISO(d.work_date), 'M/d'),
      miles: Math.round((d.mileage ?? 0) * 10) / 10,
    }));
  }, [history]);

  const shiftPatterns = useMemo(() => {
    if (!history?.length) return null;
    const withShift = history.filter(h => h.clock_in && h.clock_out && h.shift_minutes > 0);
    if (!withShift.length) return null;
    const avgShiftMin = Math.round(withShift.reduce((s, h) => s + h.shift_minutes, 0) / withShift.length);
    const clockInMins = withShift.map(h => {
      const [hh, mm] = (h.clock_in ?? '0:0').split(':').map(Number);
      return hh * 60 + mm;
    });
    const clockOutMins = withShift.map(h => {
      const [hh, mm] = (h.clock_out ?? '0:0').split(':').map(Number);
      return hh * 60 + mm;
    });
    const avgIn = Math.round(clockInMins.reduce((a, b) => a + b, 0) / clockInMins.length);
    const avgOut = Math.round(clockOutMins.reduce((a, b) => a + b, 0) / clockOutMins.length);
    const noTimesheetDays = (history?.length ?? 0) - withShift.length;
    const fmtMin = (m: number) => {
      const h = Math.floor(m / 60);
      const mm = m % 60;
      const ampm = h < 12 ? 'a' : 'p';
      const hh = h % 12 === 0 ? 12 : h % 12;
      return `${hh}:${String(mm).padStart(2, '0')}${ampm}`;
    };
    return { avgClockIn: fmtMin(avgIn), avgClockOut: fmtMin(avgOut), avgShift: fmtDur(avgShiftMin), noTimesheetDays };
  }, [history]);

  // Task breakdown by department
  const taskBreakdown = useMemo(() => {
    // We'll derive from history which doesn't have dept. Use top-level profile dept as primary.
    // For a proper breakdown we'd need per-task dept data. Approximate with profile.
    if (!profile) return [];
    return [
      { name: profile.primary_department ?? 'Unknown', value: profile.total_tasks },
    ];
  }, [profile]);

  const dept = DEPT_COLORS[profile?.primary_department ?? ''] ?? DEPT_COLORS.maintenance;
  const TIME_RANGES: { value: TimeRange; label: string }[] = [
    { value: 30, label: '30 Days' },
    { value: 60, label: '60 Days' },
    { value: 90, label: '90 Days' },
    { value: 180, label: '6 Months' },
  ];

  if (profileLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link to="/ops/timeline" className="text-sm text-primary hover:underline flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" /> Back to Task Timeline
          </Link>
        </div>
        <div className="space-y-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="space-y-6">
        <Link to="/ops/timeline" className="text-sm text-primary hover:underline flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Back to Task Timeline
        </Link>
        <div className="glass-card p-12 text-center">
          <p className="text-lg font-semibold text-muted-foreground">No profile data found for "{techName}"</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* BACK LINK */}
      <Link to="/ops/timeline" className="text-sm text-primary hover:underline flex items-center gap-1">
        <ArrowLeft className="h-4 w-4" /> Back to Task Timeline
      </Link>

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{profile.tech_name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-xs font-bold px-2 py-0.5 rounded ${dept.bg} ${dept.text}`}>
              {dept.label}
            </span>
            {profile.first_active_date && (
              <span className="text-sm text-muted-foreground">
                Active since {format(parseISO(profile.first_active_date), 'MMM d, yyyy')}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-1">
          {TIME_RANGES.map(r => (
            <Button key={r.value} variant={timeRange === r.value ? 'default' : 'ghost'} size="sm"
              className="h-7 px-2.5 text-xs" onClick={() => setTimeRange(r.value)}>
              {r.label}
            </Button>
          ))}
        </div>
      </div>

      {/* STATS ROW */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard icon={Zap} label="Avg Utilization" value={`${Math.round(profile.avg_utilization)}%`}
          color={utilizationColor(profile.avg_utilization)} />
        <StatCard icon={ListChecks} label="Total Tasks" value={String(profile.total_tasks)}
          subtitle={`${profile.avg_tasks_per_day}/day avg`} />
        <StatCard icon={CalendarDays} label="Days Worked" value={String(profile.days_worked)}
          subtitle={`of ${timeRange}d period`} />
        <StatCard icon={Navigation} label="Total Mileage" value={`${Math.round(profile.total_mileage)} mi`}
          subtitle={`${profile.avg_daily_mileage} mi/day avg`} />
        <StatCard icon={Timer} label="Avg Task Duration" value={`${Math.round(profile.avg_task_duration_minutes)}m`}
          subtitle={`fastest ${Math.round(profile.fastest_task_minutes)}m · slowest ${Math.round(profile.slowest_task_minutes)}m`} />
        <StatCard icon={Star} label="Guest Rating"
          value={profile.avg_cleanliness_rating != null ? `${profile.avg_cleanliness_rating.toFixed(1)} ⭐` : 'N/A'}
          subtitle={profile.total_reviews > 0 ? `${profile.total_reviews} reviews` : 'No guest reviews'}
          color={profile.avg_cleanliness_rating != null ? '#F04C3B' : undefined} />
      </div>

      {/* SECTION 1: UTILIZATION HEATMAP + TREND */}
      <div className="glass-card p-5 space-y-4">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <TrendingUp className="h-4 w-4" style={{ color: '#F04C3B' }} /> Utilization Trend
        </h3>
        <div className="flex flex-wrap gap-1">
          {heatmapDays.map(({ date, pct }) => (
            <div key={date.toISOString()} className="group relative"
              title={`${format(date, 'MMM d')}: ${pct !== null ? `${Math.round(pct)}%` : 'No work'}`}>
              <div className="w-6 h-6 rounded-sm transition-transform group-hover:scale-110"
                style={{ backgroundColor: heatmapColor(pct) }} />
              <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 text-[7px] text-muted-foreground/60 pointer-events-none">
                {format(date, 'd')}
              </span>
            </div>
          ))}
        </div>
        {utilTrendData.length > 1 && (
          <div className="h-36 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={utilTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 9 }} tickLine={false} />
                <YAxis tick={{ fontSize: 9 }} tickLine={false} domain={[0, 100]} />
                <RechartsTooltip contentStyle={{ fontSize: 11, borderRadius: 6 }} formatter={(v: number) => [`${v}%`, 'Utilization']} />
                <Line type="monotone" dataKey="util" stroke="#F04C3B" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* SECTION 2: DAILY LOG */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-bold text-foreground mb-3">Daily Log</h3>
        <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="w-5 px-1" />
                {['Date', 'Tasks', 'Props', 'Task Time', 'Shift', 'Util%', 'Miles', 'Clock In/Out'].map(h => (
                  <th key={h} className="text-left px-2 py-1.5 text-[10px] font-semibold text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedHistory.map((row, i) => {
                const dateKey = row.work_date.substring(0, 10);
                const isExpanded = expandedDay === dateKey;
                return (
                  <React.Fragment key={row.work_date}>
                    <tr className={`cursor-pointer hover:bg-muted/40 transition-colors ${i % 2 === 0 ? 'bg-background' : 'bg-muted/20'}`}
                      onClick={() => setExpandedDay(isExpanded ? null : dateKey)}>
                      <td className="px-1 text-center text-muted-foreground">
                        <span className="text-[10px]">{isExpanded ? '▼' : '▶'}</span>
                      </td>
                      <td className="px-2 py-1.5 font-medium text-foreground">{format(parseISO(row.work_date), 'MMM d')}</td>
                      <td className="px-2 py-1.5 text-foreground">{row.task_count}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">{row.properties_visited}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">{row.task_minutes > 0 ? fmtDur(row.task_minutes) : '—'}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">{row.shift_minutes > 0 ? fmtDur(row.shift_minutes) : '—'}</td>
                      <td className="px-2 py-1.5 font-bold" style={{ color: row.shift_minutes > 0 ? utilizationColor(row.utilization_pct) : 'hsl(var(--muted-foreground))' }}>
                        {row.shift_minutes > 0 ? `${Math.round(row.utilization_pct)}%` : '—'}
                      </td>
                      <td className="px-2 py-1.5 text-muted-foreground">{(row.mileage ?? 0) > 0 ? `${(row.mileage ?? 0).toFixed(1)}` : '—'}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">
                        {row.clock_in && row.clock_out ? `${fmtHHMM(row.clock_in)} – ${fmtHHMM(row.clock_out)}` : '—'}
                      </td>
                    </tr>
                    {isExpanded && (
                      <DayDrillDown techName={techName} date={dateKey}
                        onTaskClick={id => setSelectedTaskId(id)}
                        onPropertyClick={name => setSelectedPropertyName(name)} />
                    )}
                  </React.Fragment>
                );
              })}
              {sortedHistory.length === 0 && (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-sm text-muted-foreground">No work days in this period</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 3: TOP PROPERTIES */}
      {profile.top_properties && profile.top_properties.length > 0 && (
        <div className="glass-card p-5">
          <h3 className="text-sm font-bold text-foreground mb-3">Top Properties</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {profile.top_properties.map((prop, i) => (
              <div key={prop} className="glass-card p-3 hover:border-primary/40 transition-colors">
                <p className="text-sm font-semibold text-foreground cursor-pointer hover:text-primary"
                  onClick={() => setSelectedPropertyName(prop)}>{prop}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">#{i + 1} most visited</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 5: MILEAGE & SHIFT PATTERNS */}
      <div className="glass-card p-5 space-y-4">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Navigation className="h-4 w-4" style={{ color: '#F04C3B' }} /> Mileage & Shift Patterns
        </h3>
        {mileageChartData.length > 1 && (
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mileageChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 9 }} tickLine={false} />
                <YAxis tick={{ fontSize: 9 }} tickLine={false} />
                <RechartsTooltip contentStyle={{ fontSize: 11, borderRadius: 6 }} formatter={(v: number) => [`${v} mi`, 'Mileage']} />
                <Bar dataKey="miles" fill="#75241C" radius={2} maxBarSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        {shiftPatterns && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MiniStat label="Avg Clock-In" value={shiftPatterns.avgClockIn} />
            <MiniStat label="Avg Clock-Out" value={shiftPatterns.avgClockOut} />
            <MiniStat label="Avg Shift Length" value={shiftPatterns.avgShift} />
            <MiniStat label="No Timesheet Days" value={String(shiftPatterns.noTimesheetDays)} />
          </div>
        )}
      </div>

      {/* SECTION 6: GUEST REVIEWS */}
      {(profile.total_reviews > 0) && reviews && reviews.length > 0 && (
        <div className="glass-card p-5">
          <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            <Star className="h-4 w-4" style={{ color: '#F04C3B' }} /> Guest Reviews ({profile.total_reviews})
          </h3>
          <div className="space-y-2">
            {reviews.map((r, i) => (
              <div key={i} className="glass-card p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-foreground cursor-pointer hover:text-primary"
                        onClick={() => r.property_name && setSelectedPropertyName(r.property_name)}>
                        {r.property_name ?? '—'}
                      </span>
                      {r.check_in_date && (
                        <span className="text-[10px] text-muted-foreground">{format(parseISO(r.check_in_date), 'MMM d, yyyy')}</span>
                      )}
                      {r.review_platform && (
                        <Badge variant="outline" className="text-[9px] h-4 px-1">{r.review_platform}</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[10px] text-muted-foreground">Clean:</span>
                      <Stars rating={r.cleanliness_rating} />
                      <span className="text-[10px] text-muted-foreground ml-2">Overall:</span>
                      <Stars rating={r.overall_rating} />
                    </div>
                    {r.review_text && (
                      <p className={`text-xs text-muted-foreground mt-1 ${expandedReview === i ? '' : 'line-clamp-2'} cursor-pointer`}
                        onClick={() => setExpandedReview(expandedReview === i ? null : i)}>
                        {r.review_text}
                      </p>
                    )}
                    {r.reviewer_name && (
                      <p className="text-[10px] text-muted-foreground/70 mt-0.5">— {r.reviewer_name}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SHEETS */}
      <TaskDetailSheet taskId={selectedTaskId} onClose={() => setSelectedTaskId(null)} />
      <PropertyDetailSheet propertyName={selectedPropertyName} onClose={() => setSelectedPropertyName(null)} />
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, subtitle, color }: {
  icon: React.ElementType; label: string; value: string; subtitle?: string; color?: string;
}) {
  return (
    <div className="glass-card p-3 sm:p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[10px] text-muted-foreground font-medium">{label}</span>
      </div>
      <p className="text-xl font-bold" style={{ color: color ?? 'hsl(var(--foreground))' }}>{value}</p>
      {subtitle && <p className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</p>}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-card p-2.5 text-center">
      <p className="text-sm font-bold text-foreground">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

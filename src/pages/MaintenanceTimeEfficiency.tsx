import { useState, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, ZAxis,
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Clock, Zap, Activity, Users, ChevronLeft, ChevronRight, AlertTriangle,
  BarChart2, Timer,
} from 'lucide-react';
import {
  format, parseISO, differenceInMinutes, startOfDay, endOfDay,
  subDays, addDays, isToday,
} from 'date-fns';

// ─── Types ───────────────────────────────────────────────────────────────────

interface RawTask {
  breezeway_id: number;
  name: string | null;
  ai_title: string | null;
  property_name: string | null;
  started_at: string | null;
  finished_at: string | null;
  work_duration_minutes: number | null;
  ai_skill_category: string | null;
  priority: string | null;
  ai_guest_impact: boolean | null;
  assignees: { assignee_name: string }[] | null;
}

interface TaskBlock {
  task: RawTask;
  startMin: number;   // minutes from midnight
  endMin: number;
  durationMin: number;
  assigneeName: string;
}

interface ShiftInfo {
  clockInMin: number;
  clockOutMin: number;
  clockInStr: string;
  clockOutStr: string;
  shiftDurationMin: number;
}

interface TechRow {
  name: string;
  blocks: TaskBlock[];
  shift: ShiftInfo | null;  // null = no timesheet found for this date
}

// ─── Constants ───────────────────────────────────────────────────────────────

const GANTT_START_HOUR = 6;   // 6 AM
const GANTT_END_HOUR   = 22;  // 10 PM
const GANTT_TOTAL_MIN  = (GANTT_END_HOUR - GANTT_START_HOUR) * 60;

const PRIORITY_COLOR: Record<string, string> = {
  urgent:  'hsl(var(--destructive))',
  high:    'hsl(var(--primary))',
  normal:  'hsl(var(--success))',
  low:     'hsl(var(--muted-foreground))',
};

const CATEGORY_COLOR_PALETTE = [
  'hsl(var(--primary))',
  'hsl(var(--success))',
  'hsl(var(--warning))',
  '#8b5cf6', '#06b6d4', '#f59e0b', '#10b981', '#6366f1', '#ec4899', '#14b8a6',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function minutesFromMidnight(isoStr: string): number {
  const d = parseISO(isoStr);
  return d.getHours() * 60 + d.getMinutes();
}

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

function pct(min: number): number {
  const shifted = clamp(min - GANTT_START_HOUR * 60, 0, GANTT_TOTAL_MIN);
  return (shifted / GANTT_TOTAL_MIN) * 100;
}

function fmtDur(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function fmtTime(isoStr: string | null): string {
  if (!isoStr) return '—';
  return format(parseISO(isoStr), 'h:mm a');
}

/** Compact: "8:02a" */
function fmtTimeShort(isoStr: string): string {
  const d = parseISO(isoStr);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h < 12 ? 'a' : 'p';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m).padStart(2, '0')}${ampm}`;
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="p-2 rounded-lg gradient-accent shrink-0">
        <Icon className="h-4 w-4 text-primary-foreground" />
      </div>
      <div>
        <h3 className="text-base font-bold text-foreground">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}

// ─── Gantt Tooltip ────────────────────────────────────────────────────────────

function GanttTooltip({ block, x, y }: { block: TaskBlock; x: number; y: number }) {
  return (
    <div
      className="absolute z-50 glass-card p-3 text-xs shadow-xl border border-border pointer-events-none w-56"
      style={{ left: Math.min(x + 12, window.innerWidth - 240), top: y - 8 }}
    >
      <p className="font-bold text-sm text-foreground mb-1 leading-tight">
        {block.task.ai_title || block.task.name || 'Untitled'}
      </p>
      <p className="text-muted-foreground mb-1">{block.task.property_name || '—'}</p>
      <div className="flex gap-3 text-[11px] text-muted-foreground">
        <span>{fmtTime(block.task.started_at)} → {fmtTime(block.task.finished_at)}</span>
        <span className="font-semibold text-foreground">{fmtDur(block.durationMin)}</span>
      </div>
      {block.task.ai_skill_category && (
        <p className="mt-1 text-[10px] text-muted-foreground capitalize">{block.task.ai_skill_category}</p>
      )}
    </div>
  );
}

// ─── Scatter Custom Tooltip ───────────────────────────────────────────────────

function ScatterTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="glass-card p-2.5 text-xs shadow-lg border border-border w-44">
      <p className="font-semibold text-foreground mb-0.5">{d.taskTitle}</p>
      <p className="text-muted-foreground">{d.property}</p>
      <p className="mt-1"><span className="text-foreground font-bold">{fmtDur(d.duration)}</span> · {d.category}</p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MaintenanceTimeEfficiency() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [hoveredBlock, setHoveredBlock] = useState<{ block: TaskBlock; x: number; y: number } | null>(null);
  const ganttRef = useRef<HTMLDivElement>(null);

  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  const dayStart = startOfDay(selectedDate).toISOString();
  const dayEnd   = endOfDay(selectedDate).toISOString();
  const thirtyDayStart = subDays(startOfDay(new Date()), 30).toISOString();

  // ── Today's tasks (for Gantt + today KPIs) ─────────────────────────────────
  const { data: todayTasks, isLoading: todayLoading } = useQuery({
    queryKey: ['maint-time-today', dateStr],
    queryFn: async () => {
      // Fetch tasks
      const { data: tasks, error } = await supabase
        .from('breezeway_tasks')
        .select('breezeway_id, name, ai_title, property_name, started_at, finished_at, work_duration_minutes, ai_skill_category, priority, ai_guest_impact')
        .eq('department', 'maintenance')
        .gte('started_at', dayStart)
        .lt('started_at', dayEnd)
        .not('started_at', 'is', null)
        .order('started_at', { ascending: true })
        .limit(500);
      if (error) throw error;
      if (!tasks?.length) return [] as RawTask[];

      // Fetch assignments
      const ids = tasks.map(t => t.breezeway_id);
      const { data: assignments } = await supabase
        .from('breezeway_task_assignments')
        .select('task_id, assignee_name')
        .in('task_id', ids);

      const assignMap = new Map<number, string[]>();
      (assignments ?? []).forEach(a => {
        if (!a.task_id || !a.assignee_name) return;
        if (!assignMap.has(a.task_id)) assignMap.set(a.task_id, []);
        assignMap.get(a.task_id)!.push(a.assignee_name);
      });

      return tasks.map(t => ({
        ...t,
        assignees: (assignMap.get(t.breezeway_id) ?? []).map(n => ({ assignee_name: n })),
      })) as RawTask[];
    },
  });

  // ── Timeero timesheets for selected date ──────────────────────────────────
  const { data: timesheets } = useQuery({
    queryKey: ['maint-time-timesheets', dateStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('timeero_timesheets')
        .select('first_name, last_name, clock_in_time, clock_out_time')
        .gte('clock_in_time', dayStart)
        .lt('clock_in_time', dayEnd)
        .not('clock_out_time', 'is', null);
      if (error) {
        console.warn('Timeero timesheets query failed:', error.message);
        return [];
      }
      return (data ?? []) as {
        first_name: string | null;
        last_name: string | null;
        clock_in_time: string;
        clock_out_time: string;
      }[];
    },
  });

  // ── 30-day baseline tasks (for averages + scatter + outliers) ──────────────
  const { data: baselineTasks, isLoading: baselineLoading } = useQuery({
    queryKey: ['maint-time-baseline'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('breezeway_tasks')
        .select('breezeway_id, name, ai_title, property_name, started_at, finished_at, work_duration_minutes, ai_skill_category, priority')
        .eq('department', 'maintenance')
        .gte('started_at', thirtyDayStart)
        .not('started_at', 'is', null)
        .not('finished_at', 'is', null)
        .order('started_at', { ascending: false })
        .limit(3000);
      if (error) throw error;
      return (data ?? []) as RawTask[];
    },
  });

  // ── Compute durations (use finished_at - started_at as source of truth) ─────
  function calcDur(t: RawTask): number | null {
    if (t.started_at && t.finished_at) {
      const d = differenceInMinutes(parseISO(t.finished_at), parseISO(t.started_at));
      if (d > 0 && d < 900) return d;
    }
    if (t.work_duration_minutes && t.work_duration_minutes > 0) return t.work_duration_minutes;
    return null;
  }

  // ── Build timesheet map: normalized full name → ShiftInfo ─────────────────
  const timesheetMap = useMemo(() => {
    const map = new Map<string, ShiftInfo>();
    (timesheets ?? []).forEach(ts => {
      const fullName = `${(ts.first_name || '').trim()} ${(ts.last_name || '').trim()}`.trim();
      if (!fullName || !ts.clock_in_time || !ts.clock_out_time) return;
      const clockInMin  = minutesFromMidnight(ts.clock_in_time);
      const clockOutMin = minutesFromMidnight(ts.clock_out_time);
      if (clockOutMin <= clockInMin) return;
      const key = fullName.toLowerCase().replace(/\s+/g, ' ');
      // Aggregate multiple entries for the same person (take earliest in / latest out)
      const existing = map.get(key);
      if (existing) {
        map.set(key, {
          clockInMin:       Math.min(existing.clockInMin, clockInMin),
          clockOutMin:      Math.max(existing.clockOutMin, clockOutMin),
          clockInStr:       clockInMin < existing.clockInMin ? ts.clock_in_time : existing.clockInStr,
          clockOutStr:      clockOutMin > existing.clockOutMin ? ts.clock_out_time : existing.clockOutStr,
          shiftDurationMin: Math.max(existing.clockOutMin, clockOutMin) - Math.min(existing.clockInMin, clockInMin),
        });
      } else {
        map.set(key, {
          clockInMin, clockOutMin,
          clockInStr: ts.clock_in_time,
          clockOutStr: ts.clock_out_time,
          shiftDurationMin: clockOutMin - clockInMin,
        });
      }
    });
    return map;
  }, [timesheets]);

  // ── Build Gantt rows ────────────────────────────────────────────────────────
  const ganttRows = useMemo<TechRow[]>(() => {
    if (!todayTasks) return [];

    const techMap = new Map<string, TaskBlock[]>();

    todayTasks.forEach(task => {
      if (!task.started_at) return;
      const names = task.assignees?.map(a => a.assignee_name) ?? ['Unassigned'];
      const startMin = minutesFromMidnight(task.started_at);
      const endMin   = task.finished_at
        ? minutesFromMidnight(task.finished_at)
        : startMin + (calcDur(task) ?? 30);
      const durationMin = Math.max(endMin - startMin, 5);

      names.forEach(name => {
        if (!techMap.has(name)) techMap.set(name, []);
        techMap.get(name)!.push({ task, startMin, endMin, durationMin, assigneeName: name });
      });
    });

    return Array.from(techMap.entries())
      .map(([name, blocks]) => {
        const key = name.toLowerCase().replace(/\s+/g, ' ');
        // Try exact match first, then fuzzy (first/last swap)
        let shift = timesheetMap.get(key) ?? null;
        if (!shift) {
          // Try matching by first+last in any order
          for (const [tsKey, tsShift] of timesheetMap) {
            const bParts = key.split(' ');
            const tParts = tsKey.split(' ');
            if (bParts.length >= 2 && tParts.length >= 2) {
              const [bFirst, bLast] = [bParts[0], bParts[bParts.length - 1]];
              const [tFirst, tLast] = [tParts[0], tParts[tParts.length - 1]];
              if ((bFirst === tFirst && bLast === tLast) || (bFirst === tLast && bLast === tFirst)) {
                shift = tsShift;
                break;
              }
            }
          }
        }
        return {
          name,
          blocks: blocks.sort((a, b) => a.startMin - b.startMin),
          shift,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [todayTasks, timesheetMap]);

  // ── Category color map ──────────────────────────────────────────────────────
  const categoryColorMap = useMemo(() => {
    const cats = new Set<string>();
    (baselineTasks ?? []).forEach(t => cats.add(t.ai_skill_category || 'General'));
    const map = new Map<string, string>();
    Array.from(cats).forEach((c, i) => map.set(c, CATEGORY_COLOR_PALETTE[i % CATEGORY_COLOR_PALETTE.length]));
    return map;
  }, [baselineTasks]);

  // ── KPI computations ────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const todayFinished = (todayTasks ?? []).filter(t => t.finished_at);
    const todayDurations = todayFinished.map(calcDur).filter((d): d is number => d !== null);

    const baselineFinished = (baselineTasks ?? []).filter(t => t.finished_at);
    const baseDurations = baselineFinished.map(calcDur).filter((d): d is number => d !== null);

    const avgDurToday     = todayDurations.length > 0
      ? Math.round(todayDurations.reduce((s, d) => s + d, 0) / todayDurations.length) : null;
    const avgDur30d       = baseDurations.length > 0
      ? Math.round(baseDurations.reduce((s, d) => s + d, 0) / baseDurations.length) : null;

    // Response time = minutes from created_at to started_at (use created_at proxy via first task ordering)
    // We'll use response_time_minutes if available; otherwise use started_at - created_at
    const todayResponse   = (todayTasks ?? [])
      .map(t => (t as any).response_time_minutes as number | null)
      .filter((v): v is number => v != null && v > 0 && v < 1440);
    const baseResponse    = (baselineTasks ?? [])
      .map(t => (t as any).response_time_minutes as number | null)
      .filter((v): v is number => v != null && v > 0 && v < 1440);

    const avgRespToday    = todayResponse.length > 0
      ? Math.round(todayResponse.reduce((s, d) => s + d, 0) / todayResponse.length) : null;
    const avgResp30d      = baseResponse.length > 0
      ? Math.round(baseResponse.reduce((s, d) => s + d, 0) / baseResponse.length) : null;

    // Tasks per tech today
    const techCountToday  = ganttRows.length;
    const tasksPerTechToday = techCountToday > 0
      ? (todayTasks?.length ?? 0) / techCountToday : null;

    // 30d tasks per tech (approximate via unique assignee count)
    const baseAssigneeSet = new Set<string>();
    (baselineTasks ?? []).forEach(t => {
      // assignees may not be loaded on baseline — use worker field or skip
    });

    // Total active work hours today
    const totalActiveMin  = todayDurations.reduce((s, d) => s + d, 0);

    return {
      avgDurToday, avgDur30d,
      avgRespToday, avgResp30d,
      tasksPerTechToday, techCountToday,
      totalActiveMin,
      todayTaskCount: todayTasks?.length ?? 0,
    };
  }, [todayTasks, baselineTasks, ganttRows]);

  // ── Scatter data ────────────────────────────────────────────────────────────
  const scatterData = useMemo(() => {
    if (!baselineTasks) return { data: [], categories: [] };

    const catSet = new Set<string>();
    const catList: string[] = [];

    const data = baselineTasks
      .map(t => {
        const dur = calcDur(t);
        if (dur == null || dur < 1) return null;
        const cat = t.ai_skill_category || 'General';
        if (!catSet.has(cat)) { catSet.add(cat); catList.push(cat); }
        return {
          category: cat,
          catIndex: 0, // assigned below
          duration: dur,
          taskTitle: t.ai_title || t.name || 'Untitled',
          property: t.property_name || '—',
        };
      })
      .filter(Boolean) as any[];

    // Map category → index for x-axis positioning
    data.forEach(d => { d.catIndex = catList.indexOf(d.category); });

    return { data, categories: catList };
  }, [baselineTasks]);

  // ── Category averages (for outlier detection) ──────────────────────────────
  const catAvgMap = useMemo(() => {
    const groups = new Map<string, number[]>();
    (baselineTasks ?? []).forEach(t => {
      const dur = calcDur(t);
      if (dur == null || dur < 1) return;
      const cat = t.ai_skill_category || 'General';
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat)!.push(dur);
    });
    const avgs = new Map<string, number>();
    groups.forEach((durs, cat) => avgs.set(cat, durs.reduce((s, d) => s + d, 0) / durs.length));
    return avgs;
  }, [baselineTasks]);

  // ── Outliers ────────────────────────────────────────────────────────────────
  const outliers = useMemo(() => {
    if (!baselineTasks) return [];
    return baselineTasks
      .map(t => {
        const dur = calcDur(t);
        if (dur == null || dur < 1) return null;
        const cat = t.ai_skill_category || 'General';
        const catAvg = catAvgMap.get(cat);
        if (!catAvg) return null;
        const multiple = dur / catAvg;
        if (multiple < 2) return null;
        return {
          property: t.property_name || '—',
          taskTitle: t.ai_title || t.name || 'Untitled',
          category: cat,
          actualDuration: dur,
          catAvg: Math.round(catAvg),
          multiple: parseFloat(multiple.toFixed(1)),
          startedAt: t.started_at,
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b.multiple - a.multiple)
      .slice(0, 50) as {
        property: string; taskTitle: string; category: string;
        actualDuration: number; catAvg: number; multiple: number; startedAt: string | null;
      }[];
  }, [baselineTasks, catAvgMap]);

  // ── Hour tick marks for Gantt ───────────────────────────────────────────────
  const hourTicks = Array.from({ length: GANTT_END_HOUR - GANTT_START_HOUR + 1 }, (_, i) => {
    const h = GANTT_START_HOUR + i;
    return { label: format(new Date(2000, 0, 1, h), 'ha'), pct: ((h - GANTT_START_HOUR) / (GANTT_END_HOUR - GANTT_START_HOUR)) * 100 };
  });

  // ── KPI delta helper ────────────────────────────────────────────────────────
  function DeltaBadge({ today, baseline, lowerIsBetter = false }: { today: number | null; baseline: number | null; lowerIsBetter?: boolean }) {
    if (today == null || baseline == null || baseline === 0) return null;
    const pctChange = ((today - baseline) / baseline) * 100;
    const improved = lowerIsBetter ? pctChange < 0 : pctChange > 0;
    const color = improved ? 'text-[hsl(var(--success))]' : 'text-destructive';
    return (
      <span className={`text-[10px] font-semibold ${color}`}>
        {pctChange > 0 ? '+' : ''}{pctChange.toFixed(0)}% vs 30d
      </span>
    );
  }

  return (
    <div className="space-y-8">
      {/* PAGE HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Time & Efficiency</h2>
          <p className="text-sm text-muted-foreground">Daily task timelines, efficiency benchmarks, and outlier detection</p>
        </div>
        {/* Date Picker Row */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedDate(d => subDays(d, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Input
            type="date"
            className="h-8 w-38 text-xs"
            value={format(selectedDate, 'yyyy-MM-dd')}
            max={format(new Date(), 'yyyy-MM-dd')}
            onChange={e => { if (e.target.value) setSelectedDate(new Date(e.target.value + 'T12:00:00')); }}
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={isToday(selectedDate)}
            onClick={() => setSelectedDate(d => addDays(d, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          {!isToday(selectedDate) && (
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setSelectedDate(new Date())}>
              Today
            </Button>
          )}
        </div>
      </div>

      {/* ── SECTION 2 FIRST: KPI Cards ─────────────────────────────────────── */}
      <div>
        <SectionHeader icon={Zap} title="Efficiency Metrics" subtitle={`${format(selectedDate, 'MMM d, yyyy')} vs 30-day average`} />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            {
              label: 'Avg Work Duration',
              todayVal: kpis.avgDurToday != null ? fmtDur(kpis.avgDurToday) : '—',
              base: kpis.avgDur30d != null ? fmtDur(kpis.avgDur30d) : null,
              today: kpis.avgDurToday, baseline: kpis.avgDur30d,
              lowerIsBetter: true, icon: Timer,
              color: 'gradient-accent', textColor: 'text-primary-foreground',
            },
            {
              label: 'Avg Response Time',
              todayVal: kpis.avgRespToday != null ? fmtDur(kpis.avgRespToday) : '—',
              base: kpis.avgResp30d != null ? fmtDur(kpis.avgResp30d) : null,
              today: kpis.avgRespToday, baseline: kpis.avgResp30d,
              lowerIsBetter: true, icon: Clock,
              color: 'bg-[hsl(var(--warning)/0.15)]', textColor: 'text-[hsl(var(--warning))]',
            },
            {
              label: 'Tasks per Tech',
              todayVal: kpis.tasksPerTechToday != null ? kpis.tasksPerTechToday.toFixed(1) : '—',
              base: null, today: null, baseline: null, lowerIsBetter: false,
              icon: Activity,
              color: 'bg-[hsl(var(--success)/0.15)]', textColor: 'text-[hsl(var(--success))]',
              sub: `${kpis.todayTaskCount} tasks · ${kpis.techCountToday} techs`,
            },
            {
              label: 'Total Active Hours',
              todayVal: kpis.totalActiveMin > 0 ? fmtDur(kpis.totalActiveMin) : '—',
              base: null, today: null, baseline: null, lowerIsBetter: false,
              icon: Users,
              color: 'bg-muted', textColor: 'text-muted-foreground',
              sub: `${kpis.todayTaskCount} completed tasks`,
            },
          ].map(({ label, todayVal, base, today, baseline, lowerIsBetter, icon: Icon, color, textColor, sub }) => (
            <div key={label} className="glass-card p-3 sm:p-4">
              <div className="flex items-start gap-3 mb-2">
                <div className={`p-2 rounded-lg shrink-0 ${color}`}>
                  <Icon className={`h-4 w-4 ${textColor}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground font-medium">{label}</p>
                  <p className="text-xl font-bold text-foreground">{todayVal}</p>
                </div>
              </div>
              {base && <p className="text-[11px] text-muted-foreground">30d avg: {base}</p>}
              {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
              <DeltaBadge today={today} baseline={baseline} lowerIsBetter={lowerIsBetter} />
            </div>
          ))}
        </div>
      </div>

      {/* ── SECTION 1: GANTT TIMELINE ──────────────────────────────────────── */}
      <div>
        <SectionHeader
          icon={BarChart2}
          title={`Daily Timeline — ${format(selectedDate, 'EEEE, MMM d')}`}
          subtitle="Task blocks per tech · hover for details · gaps indicate idle/travel time"
        />
        <div className="glass-card p-4 overflow-x-auto">
          {todayLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-3 items-center">
                  <div className="h-4 w-28 bg-muted rounded animate-pulse shrink-0" />
                  <div className="h-8 flex-1 bg-muted/30 rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : ganttRows.length === 0 ? (
            <div className="py-12 text-center">
              <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No started tasks found for {format(selectedDate, 'MMM d, yyyy')}</p>
              <p className="text-xs text-muted-foreground mt-1">Try a different date or check that tasks have started_at timestamps</p>
            </div>
          ) : (
            <div ref={ganttRef} className="relative">
              {/* Hour axis */}
              <div className="flex ml-32 mb-1 relative h-5">
                {hourTicks.map(tick => (
                  <div
                    key={tick.label}
                    className="absolute text-[10px] text-muted-foreground -translate-x-1/2"
                    style={{ left: `${tick.pct}%` }}
                  >
                    {tick.label}
                  </div>
                ))}
              </div>

              {/* Grid lines + rows */}
              <div className="space-y-1.5">
                {ganttRows.map(row => {
                  const { shift } = row;
                  const taskTotalMin = row.blocks.reduce((s, b) => s + b.durationMin, 0);
                  const utilizationPct = shift && shift.shiftDurationMin > 0
                    ? Math.min(100, Math.round((taskTotalMin / shift.shiftDurationMin) * 100))
                    : null;
                  const hasNoTimesheet = !shift;

                  // Shift bar position
                  const shiftLeftPct  = shift ? pct(shift.clockInMin)  : 0;
                  const shiftRightPct = shift ? pct(shift.clockOutMin) : 0;
                  const shiftWidthPct = shift ? Math.max(shiftRightPct - shiftLeftPct, 0) : 0;

                  return (
                    <div key={row.name} className="flex items-center gap-2">
                      {/* Tech name */}
                      <div className="w-28 shrink-0 text-right">
                        <p className="text-[11px] font-semibold text-foreground truncate">{row.name.split(' ')[0]}</p>
                        <p className="text-[9px] text-muted-foreground truncate">{row.name.split(' ').slice(1).join(' ')}</p>
                      </div>

                      {/* Timeline track */}
                      <div
                        className="flex-1 relative h-8 bg-muted/20 rounded overflow-visible"
                        style={{
                          border: hasNoTimesheet
                            ? '1.5px dashed hsl(var(--muted-foreground) / 0.5)'
                            : '1px solid hsl(var(--border) / 0.4)',
                        }}
                      >
                        {/* Hour grid lines */}
                        {hourTicks.map(tick => (
                          <div
                            key={tick.label}
                            className="absolute top-0 bottom-0 w-px bg-border/30"
                            style={{ left: `${tick.pct}%` }}
                          />
                        ))}

                        {/* Shift background bar */}
                        {shift && (
                          <>
                            <div
                              className="absolute top-0 bottom-0 rounded"
                              style={{
                                left:            `${shiftLeftPct}%`,
                                width:           `${shiftWidthPct}%`,
                                backgroundColor: 'hsl(210 40% 70% / 0.15)',
                              }}
                            />
                            {/* Clock-in label */}
                            <span
                              className="absolute top-0.5 text-[8px] text-[hsl(210_40%_60%)] font-medium pointer-events-none select-none z-10"
                              style={{ left: `calc(${shiftLeftPct}% + 2px)` }}
                            >
                              In: {fmtTimeShort(shift.clockInStr)}
                            </span>
                            {/* Clock-out label */}
                            <span
                              className="absolute bottom-0.5 text-[8px] text-[hsl(210_40%_60%)] font-medium pointer-events-none select-none z-10"
                              style={{ right: `calc(${100 - shiftRightPct}% + 2px)` }}
                            >
                              Out: {fmtTimeShort(shift.clockOutStr)}
                            </span>
                          </>
                        )}

                        {/* "No timesheet" label */}
                        {hasNoTimesheet && (
                          <span className="absolute inset-0 flex items-center justify-end pr-2 pointer-events-none">
                            <span className="text-[9px] text-muted-foreground/60 italic">No timesheet</span>
                          </span>
                        )}

                        {/* Task blocks */}
                        {row.blocks.map((block, idx) => {
                          const leftPct  = pct(block.startMin);
                          const rightPct = pct(block.endMin);
                          const widthPct = Math.max(rightPct - leftPct, 0.5);
                          const cat      = block.task.ai_skill_category || 'General';
                          const color    = categoryColorMap.get(cat) ?? PRIORITY_COLOR[block.task.priority ?? ''] ?? 'hsl(var(--primary))';
                          const isGuest  = block.task.ai_guest_impact;

                          // Detect if task falls outside clocked shift
                          const outsideShift = shift
                            ? block.startMin < shift.clockInMin || block.endMin > shift.clockOutMin
                            : false;

                          return (
                            <div
                              key={`${block.task.breezeway_id}-${block.assigneeName}-${idx}`}
                              className="absolute top-0.5 bottom-0.5 rounded cursor-pointer transition-opacity hover:opacity-90"
                              style={{
                                left:            `${leftPct}%`,
                                width:           `${widthPct}%`,
                                backgroundColor: color,
                                outline: isGuest
                                  ? '2px solid hsl(var(--destructive))'
                                  : outsideShift
                                    ? '2px solid hsl(45 100% 55%)'
                                    : undefined,
                              }}
                              onMouseEnter={e => {
                                const rect = ganttRef.current?.getBoundingClientRect();
                                if (rect) setHoveredBlock({ block, x: e.clientX - rect.left, y: e.clientY - rect.top });
                              }}
                              onMouseLeave={() => setHoveredBlock(null)}
                            />
                          );
                        })}
                      </div>

                      {/* Summary */}
                      <div className="w-20 shrink-0 text-right">
                        <p className="text-[10px] text-muted-foreground">{row.blocks.length} tasks · {fmtDur(taskTotalMin)}</p>
                        {utilizationPct !== null ? (
                          <p className={`text-[10px] font-semibold ${utilizationPct >= 80 ? 'text-[hsl(var(--success))]' : utilizationPct >= 50 ? 'text-[hsl(var(--warning))]' : 'text-muted-foreground'}`}>
                            {utilizationPct}% util
                          </p>
                        ) : (
                          <p className="text-[9px] text-muted-foreground/50 italic">no shift</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Hover tooltip */}
              {hoveredBlock && (
                <GanttTooltip
                  block={hoveredBlock.block}
                  x={hoveredBlock.x}
                  y={hoveredBlock.y}
                />
              )}
            </div>
          )}

          {/* Legend */}
          {ganttRows.length > 0 && (
            <div className="mt-4 pt-3 border-t border-border flex flex-wrap gap-x-4 gap-y-2">
              {Array.from(categoryColorMap.entries()).slice(0, 8).map(([cat, color]) => (
                <div key={cat} className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-[10px] text-muted-foreground capitalize">{cat}</span>
                </div>
              ))}
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-8 rounded-sm shrink-0" style={{ backgroundColor: 'hsl(210 40% 70% / 0.25)', border: '1px solid hsl(210 40% 60% / 0.4)' }} />
                <span className="text-[10px] text-muted-foreground">Clocked Shift</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ outline: '2px solid hsl(45 100% 55%)', outlineOffset: '-1px' }} />
                <span className="text-[10px] text-muted-foreground">Outside Shift</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-8 rounded-sm shrink-0" style={{ border: '1.5px dashed hsl(var(--muted-foreground) / 0.5)' }} />
                <span className="text-[10px] text-muted-foreground">No Timesheet</span>
              </div>
              <div className="flex items-center gap-1.5 ml-auto">
                <div className="h-2.5 w-2.5 rounded-sm border-2 border-destructive shrink-0" />
                <span className="text-[10px] text-muted-foreground">Guest Impact</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── SECTION 3: SCATTER PLOT ───────────────────────────────────────── */}
      <div>
        <SectionHeader
          icon={Activity}
          title="Task Duration Analysis"
          subtitle="Each dot = one completed task (last 30 days) · spot high-variance categories"
        />
        <div className="glass-card p-4">
          {baselineLoading ? (
            <div className="h-64 bg-muted/30 rounded animate-pulse" />
          ) : scatterData.data.length === 0 ? (
            <p className="h-32 flex items-center justify-center text-sm text-muted-foreground">No completed task data available</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <ScatterChart margin={{ top: 8, right: 24, left: -10, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  type="number"
                  dataKey="catIndex"
                  domain={[-0.5, scatterData.categories.length - 0.5]}
                  ticks={scatterData.categories.map((_, i) => i)}
                  tickFormatter={i => scatterData.categories[i] || ''}
                  tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                  angle={-35}
                  textAnchor="end"
                  height={60}
                  interval={0}
                />
                <YAxis
                  type="number"
                  dataKey="duration"
                  name="Duration (min)"
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={v => `${v}m`}
                />
                <ZAxis range={[20, 20]} />
                <Tooltip content={<ScatterTooltip />} />
                <Scatter
                  data={scatterData.data}
                  fill="hsl(var(--primary))"
                  fillOpacity={0.55}
                />
              </ScatterChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── SECTION 4: OUTLIERS TABLE ─────────────────────────────────────── */}
      <div>
        <SectionHeader
          icon={AlertTriangle}
          title="Duration Outliers"
          subtitle="Tasks taking 2× or more than their category average (last 30 days)"
        />
        <div className="glass-card overflow-hidden">
          {outliers.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">No duration outliers found</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Property</TableHead>
                  <TableHead>Task</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Actual</TableHead>
                  <TableHead className="text-right">Cat Avg</TableHead>
                  <TableHead className="text-right">Multiple</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {outliers.map((row, i) => (
                  <TableRow
                    key={i}
                    className={row.multiple >= 5 ? 'bg-destructive/5' : row.multiple >= 3 ? 'bg-[hsl(var(--warning)/0.05)]' : undefined}
                  >
                    <TableCell className="text-sm font-medium">{row.property}</TableCell>
                    <TableCell className="text-sm max-w-[180px] truncate">{row.taskTitle}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] capitalize">{row.category}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold text-sm">{fmtDur(row.actualDuration)}</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">{fmtDur(row.catAvg)}</TableCell>
                    <TableCell className="text-right">
                      <span className={`font-bold text-sm ${row.multiple >= 5 ? 'text-destructive' : row.multiple >= 3 ? 'text-[hsl(var(--warning))]' : 'text-foreground'}`}>
                        {row.multiple}×
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {row.startedAt ? format(parseISO(row.startedAt), 'MMM d') : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </div>
  );
}

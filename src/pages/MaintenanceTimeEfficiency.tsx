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
  format, parseISO, differenceInMinutes,
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

// One segment = one clock-in/clock-out pair (a tech may have multiple per day)
interface ShiftSegment {
  clockInMin: number;
  clockOutMin: number;
  clockInStr: string;
  clockOutStr: string;
}

interface TechRow {
  name: string;
  assigneeId: string; // breezeway assignee_id as string
  blocks: TaskBlock[];
  segments: ShiftSegment[]; // empty = no timesheet found
}

// ─── Constants ───────────────────────────────────────────────────────────────

const GANTT_START_HOUR = 6;   // 6 AM
const GANTT_END_HOUR   = 22;  // 10 PM
const GANTT_TOTAL_MIN  = (GANTT_END_HOUR - GANTT_START_HOUR) * 60;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const PRIORITY_COLOR: Record<string, string> = {
  urgent:  'hsl(var(--destructive))',
  high:    'hsl(var(--primary))',
  normal:  'hsl(var(--success))',
  low:     'hsl(var(--muted-foreground))',
};

// 12 visually distinct property colors (blues, greens, purples, teals, oranges)
const PROPERTY_COLOR_PALETTE = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#8b5cf6', // violet
  '#f59e0b', // amber
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
  '#6366f1', // indigo
  '#84cc16', // lime
  '#a855f7', // purple
  '#22d3ee', // sky
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

function GanttBlockTooltip({ block, x, y }: { block: TaskBlock; x: number; y: number }) {
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
  const thirtyDayStart = subDays(new Date(), 30).toISOString();

  // UTC boundaries for the selected local date
  const utcDayStart = useMemo(() => {
    const d = new Date(selectedDate);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, [selectedDate]);

  const utcDayEnd = useMemo(() => {
    const d = new Date(selectedDate);
    d.setHours(23, 59, 59, 999);
    return d.toISOString();
  }, [selectedDate]);

  // ── Today's tasks (for Gantt + today KPIs) ─────────────────────────────────
  const { data: todayTasks, isLoading: todayLoading } = useQuery({
    queryKey: ['maint-time-today', dateStr],
    queryFn: async () => {
      const { data: tasks, error } = await supabase
        .from('breezeway_tasks')
        .select('breezeway_id, name, ai_title, property_name, started_at, finished_at, work_duration_minutes, ai_skill_category, priority, ai_guest_impact')
        .eq('department', 'maintenance')
        .gte('started_at', utcDayStart)
        .lte('started_at', utcDayEnd)
        .not('started_at', 'is', null)
        .order('started_at', { ascending: true })
        .limit(500);
      if (error) throw error;
      if (!tasks?.length) return [] as RawTask[];

      const ids = tasks.map(t => t.breezeway_id);
      const { data: assignments } = await supabase
        .from('breezeway_task_assignments')
        .select('task_id, assignee_id, assignee_name')
        .in('task_id', ids);

      const assignMap = new Map<number, { name: string; id: string }[]>();
      (assignments ?? []).forEach(a => {
        if (!a.task_id || !a.assignee_name) return;
        if (!assignMap.has(a.task_id)) assignMap.set(a.task_id, []);
        assignMap.get(a.task_id)!.push({ name: a.assignee_name, id: String(a.assignee_id ?? '') });
      });

      return tasks.map(t => ({
        ...t,
        assignees: (assignMap.get(t.breezeway_id) ?? []).map(a => ({ assignee_name: a.name, assignee_id: a.id })),
      })) as RawTask[];
    },
  });

  // ── cleaner_identity_map: breezeway_assignee_id → timeero_user_id ─────────
  const { data: identityMap } = useQuery({
    queryKey: ['cleaner-identity-map'],
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cleaner_identity_map')
        .select('breezeway_assignee_id, breezeway_assignee_name, timeero_user_id, timeero_first_name, timeero_last_name');
      if (error) {
        console.warn('cleaner_identity_map query failed:', error.message);
        return [] as any[];
      }
      console.log('[Timeero] identity map sample:', data?.slice(0, 3));
      return (data ?? []) as any[];
    },
  });

  // ── Timeero timesheets: fetched by user_id via identity map ───────────────
  // America/Denver = UTC-7 (MST). Filter clock_in_time by local date boundaries.
  // dateStr = "2025-02-18" → dayStart = "2025-02-18T07:00:00.000Z" (midnight MT)
  //                          dayEnd   = "2025-02-19T06:59:59.999Z" (11:59 PM MT)
  const mtDayStart = useMemo(() => {
    return `${dateStr}T07:00:00.000Z`; // midnight MT = 7 AM UTC
  }, [dateStr]);
  const mtDayEnd = useMemo(() => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + 1);
    return `${format(next, 'yyyy-MM-dd')}T06:59:59.999Z`; // 11:59 PM MT next day in UTC
  }, [dateStr]);

  const { data: timesheets } = useQuery({
    queryKey: ['maint-time-timesheets', dateStr],
    enabled: !!identityMap,
    queryFn: async () => {
      console.log('[Timeero] identity map rows:', identityMap?.length, identityMap?.slice(0, 5));

      // Fetch ALL timeero entries for the date (wide net — filter by user_id after)
      const { data, error } = await supabase
        .from('timeero_timesheets')
        .select('user_id, first_name, last_name, clock_in_time, clock_out_time')
        .gte('clock_in_time', mtDayStart)
        .lte('clock_in_time', mtDayEnd)
        .not('clock_out_time', 'is', null);

      if (error) {
        console.error('[Timeero] timesheets query failed:', error.message, error.code);
        return [];
      }
      console.log('[Timeero] raw timesheet rows returned:', data?.length, data?.slice(0, 3));
      return (data ?? []) as {
        user_id: number | null;
        first_name: string | null;
        last_name: string | null;
        clock_in_time: string;
        clock_out_time: string;
      }[];
    },
  });

  // ── 30-day baseline tasks ──────────────────────────────────────────────────
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

  // ── Compute durations ──────────────────────────────────────────────────────
  function calcDur(t: RawTask): number | null {
    if (t.started_at && t.finished_at) {
      const d = differenceInMinutes(parseISO(t.finished_at), parseISO(t.started_at));
      if (d > 0 && d < 900) return d;
    }
    if (t.work_duration_minutes && t.work_duration_minutes > 0) return t.work_duration_minutes;
    return null;
  }

  // ── Build per-tech timesheet segments via identity map + fuzzy fallback ──────
  // keyed by breezeway_assignee_id (primary) or breezeway_assignee_name (fuzzy)
  const shiftSegmentMap = useMemo(() => {
    const result = new Map<string, ShiftSegment[]>();
    if (!identityMap || !timesheets) return result;

    console.log('[Timeero] building shift map. identity rows:', identityMap.length, 'timesheet rows:', timesheets.length);

    // timeero_user_id → breezeway_assignee_id
    const timeeroToBwId = new Map<string, string>();
    identityMap.forEach(r => {
      if (r.timeero_user_id && r.breezeway_assignee_id) {
        timeeroToBwId.set(r.timeero_user_id, r.breezeway_assignee_id);
      }
    });

    // timeero full name → breezeway_assignee_name (for fuzzy fallback)
    const timeeroNameToBwName = new Map<string, string>();
    (identityMap as any[]).forEach(r => {
      if (r.timeero_first_name && r.breezeway_assignee_name) {
        const full = `${r.timeero_first_name} ${r.timeero_last_name ?? ''}`.trim().toLowerCase();
        timeeroNameToBwName.set(full, r.breezeway_assignee_name);
      }
    });

    timesheets.forEach(ts => {
      if (!ts.clock_in_time || !ts.clock_out_time) return;

      // Primary: match via user_id → breezeway_assignee_id
      let key: string | undefined = ts.user_id ? timeeroToBwId.get(String(ts.user_id)) : undefined;

      // Fallback: fuzzy name match
      if (!key) {
        const tsName = `${ts.first_name ?? ''} ${ts.last_name ?? ''}`.trim().toLowerCase();
        const bwName = timeeroNameToBwName.get(tsName);
        if (bwName) {
          key = bwName;
          console.log('[Timeero] fuzzy name match:', tsName, '→', bwName);
        } else {
          console.log('[Timeero] no match for user_id:', ts.user_id, ts.first_name, ts.last_name);
          return;
        }
      }

      const clockInMin  = minutesFromMidnight(ts.clock_in_time);
      const clockOutMin = minutesFromMidnight(ts.clock_out_time);
      if (clockOutMin <= clockInMin) return;

      if (!result.has(key)) result.set(key, []);
      result.get(key)!.push({
        clockInMin,
        clockOutMin,
        clockInStr:  ts.clock_in_time,
        clockOutStr: ts.clock_out_time,
      });
    });

    result.forEach(segs => segs.sort((a, b) => a.clockInMin - b.clockInMin));
    console.log('[Timeero] final shift map keys:', Array.from(result.keys()));
    return result;
  }, [identityMap, timesheets]);

  // ── Build Gantt rows ────────────────────────────────────────────────────────
  const ganttRows = useMemo<TechRow[]>(() => {
    if (!todayTasks) return [];

    // techKey = "assigneeId|assigneeName"
    const techMap = new Map<string, { name: string; id: string; blocks: TaskBlock[] }>();

    todayTasks.forEach(task => {
      if (!task.started_at) return;
      const assignees = (task.assignees as any[])?.length
        ? task.assignees as { assignee_name: string; assignee_id: string }[]
        : [{ assignee_name: 'Unassigned', assignee_id: '' }];

      const startMin = minutesFromMidnight(task.started_at);
      const endMin   = task.finished_at
        ? minutesFromMidnight(task.finished_at)
        : startMin + (calcDur(task) ?? 30);
      const durationMin = Math.max(endMin - startMin, 5);

      assignees.forEach(a => {
        const key = `${a.assignee_id}|${a.assignee_name}`;
        if (!techMap.has(key)) techMap.set(key, { name: a.assignee_name, id: a.assignee_id, blocks: [] });
        techMap.get(key)!.blocks.push({ task, startMin, endMin, durationMin, assigneeName: a.assignee_name });
      });
    });

    return Array.from(techMap.values())
      .map(({ name, id, blocks }) => ({
        name,
        assigneeId: id,
        blocks: blocks.sort((a, b) => a.startMin - b.startMin),
        // Look up by breezeway_assignee_id first, then by name (fuzzy fallback key)
        segments: shiftSegmentMap.get(id) ?? shiftSegmentMap.get(name) ?? [],
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [todayTasks, shiftSegmentMap]);

  // ── Property color map (for Gantt blocks) ──────────────────────────────────
  const propertyColorMap = useMemo(() => {
    const props = new Set<string>();
    (todayTasks ?? []).forEach(t => props.add(t.property_name || 'Unknown'));
    const map = new Map<string, string>();
    Array.from(props).sort().forEach((p, i) => map.set(p, PROPERTY_COLOR_PALETTE[i % PROPERTY_COLOR_PALETTE.length]));
    return map;
  }, [todayTasks]);

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
                  const { segments } = row;
                  const taskTotalMin = row.blocks.reduce((s, b) => s + b.durationMin, 0);
                  const hasNoTimesheet = segments.length === 0;

                  // Total shift duration = sum of all segments
                  const totalShiftMin = segments.reduce((s, seg) => s + (seg.clockOutMin - seg.clockInMin), 0);
                  const utilizationPct = totalShiftMin > 0
                    ? Math.min(100, Math.round((taskTotalMin / totalShiftMin) * 100))
                    : null;

                  // Earliest clock-in and latest clock-out across all segments (for "outside shift" detection)
                  const earliestIn  = segments.length ? Math.min(...segments.map(s => s.clockInMin))  : null;
                  const latestOut   = segments.length ? Math.max(...segments.map(s => s.clockOutMin)) : null;

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

                        {/* Shift background segments — one bar per clock-in/clock-out pair */}
                        {segments.map((seg, si) => {
                          const segLeft  = pct(seg.clockInMin);
                          const segRight = pct(seg.clockOutMin);
                          const segWidth = Math.max(segRight - segLeft, 0);
                          return (
                            <div key={si}>
                              <div
                                className="absolute top-0 bottom-0 rounded"
                                style={{
                                  left:            `${segLeft}%`,
                                  width:           `${segWidth}%`,
                                  backgroundColor: 'hsl(210 40% 70% / 0.15)',
                                }}
                              />
                              {/* Clock-in label on first segment */}
                              {si === 0 && (
                                <span
                                  className="absolute top-0.5 text-[8px] text-[hsl(210_40%_60%)] font-medium pointer-events-none select-none z-10"
                                  style={{ left: `calc(${segLeft}% + 2px)` }}
                                >
                                  In: {fmtTimeShort(seg.clockInStr)}
                                </span>
                              )}
                              {/* Clock-out label on last segment */}
                              {si === segments.length - 1 && (
                                <span
                                  className="absolute bottom-0.5 text-[8px] text-[hsl(210_40%_60%)] font-medium pointer-events-none select-none z-10"
                                  style={{ right: `calc(${100 - segRight}% + 2px)` }}
                                >
                                  Out: {fmtTimeShort(seg.clockOutStr)}
                                </span>
                              )}
                            </div>
                          );
                        })}

                        {/* "No timesheet" label */}
                        {hasNoTimesheet && (
                          <span className="absolute inset-0 flex items-center justify-end pr-2 pointer-events-none">
                            <span className="text-[9px] text-muted-foreground/60 italic">No timesheet</span>
                          </span>
                        )}

                        {/* Task blocks — colored by property, 2px gap between adjacent */}
                        {row.blocks.map((block, idx) => {
                          const leftPct  = pct(block.startMin);
                          const rightPct = pct(block.endMin);
                          // Subtract ~2px gap on right by reducing width slightly
                          const rawWidthPct = Math.max(rightPct - leftPct, 0.3);
                          const widthPct = Math.max(rawWidthPct - 0.4, 0.2); // ~2-3px gap
                          const propKey  = block.task.property_name || 'Unknown';
                          const color    = propertyColorMap.get(propKey) ?? '#3b82f6';
                          const isGuest  = block.task.ai_guest_impact;
                          // Width in pixels ≈ widthPct% of gantt track (rough estimate for label threshold)
                          const approxWidthPx = (widthPct / 100) * (ganttRef.current?.clientWidth ?? 800) * 0.75;

                          // Outside shift = not covered by ANY segment
                          const outsideShift = segments.length > 0 && !segments.some(
                            seg => block.startMin >= seg.clockInMin && block.endMin <= seg.clockOutMin
                          );

                          return (
                            <div
                              key={`${block.task.breezeway_id}-${block.assigneeName}-${idx}`}
                              className="absolute top-0.5 bottom-0.5 rounded cursor-pointer transition-opacity hover:opacity-85 overflow-hidden"
                              title={propKey}
                              style={{
                                left:            `${leftPct}%`,
                                width:           `${widthPct}%`,
                                backgroundColor: color + 'cc', // ~80% opacity
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
                            >
                              {/* Property label inside block if wide enough */}
                              {approxWidthPx > 60 && (
                                <span className="absolute inset-0 flex items-center px-1 pointer-events-none select-none">
                                  <span className="text-[9px] font-semibold text-white truncate leading-none drop-shadow-sm">
                                    {propKey.length > 16 ? propKey.slice(0, 14) + '…' : propKey}
                                  </span>
                                </span>
                              )}
                            </div>
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
                <GanttBlockTooltip
                  block={hoveredBlock.block}
                  x={hoveredBlock.x}
                  y={hoveredBlock.y}
                />
              )}
            </div>
          )}

          {/* Legend */}
          {ganttRows.length > 0 && (
            <div className="mt-4 pt-3 border-t border-border">
              {/* Property color legend */}
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Properties</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 mb-3">
                {Array.from(propertyColorMap.entries()).map(([prop, color]) => (
                  <div key={prop} className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: color + 'cc' }} />
                    <span className="text-[10px] text-muted-foreground">{prop}</span>
                  </div>
                ))}
              </div>
              {/* Overlay / status legend */}
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                <div className="flex items-center gap-1.5">
                  <div className="h-2.5 w-8 rounded-sm shrink-0" style={{ backgroundColor: 'hsl(210 40% 70% / 0.25)', border: '1px solid hsl(210 40% 60% / 0.4)' }} />
                  <span className="text-[10px] text-muted-foreground">Clocked Shift</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ outline: '2px solid hsl(45 100% 55%)', outlineOffset: '-1px', backgroundColor: '#3b82f6cc' }} />
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

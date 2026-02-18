import { useState, useMemo, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Clock, Zap, Activity, ChevronLeft, ChevronRight,
  BarChart2, Timer,
} from 'lucide-react';
import {
  format, parseISO, differenceInMinutes,
  subDays, addDays, isToday,
} from 'date-fns';

// ─── Types ───────────────────────────────────────────────────────────────────

interface TechEfficiency {
  tech_name: string;
  task_count: number;
  properties_visited: number;
  task_minutes: number;
  shift_minutes: number;
  idle_minutes: number;
  utilization_pct: number;
  first_task_start: string | null;
  last_task_end: string | null;
  clock_in: string | null;
  clock_out: string | null;
}

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
  startMin: number;
  endMin: number;
  durationMin: number;
  assigneeName: string;
}

interface ShiftSegment {
  clockInMin: number;
  clockOutMin: number;
  clockInStr: string;
  clockOutStr: string;
}

interface TechRow {
  name: string;
  assigneeId: string;
  blocks: TaskBlock[];
  segments: ShiftSegment[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

const GANTT_START_HOUR = 6;
const GANTT_END_HOUR   = 22;
const GANTT_TOTAL_MIN  = (GANTT_END_HOUR - GANTT_START_HOUR) * 60;

const PROPERTY_COLOR_PALETTE = [
  '#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#06b6d4',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16',
  '#a855f7', '#22d3ee',
];

// Off-hours boundaries as minutes from midnight
const OFF_HOURS_END_MIN   = 7 * 60;  // before 7 AM
const OFF_HOURS_START_MIN = 18 * 60; // after 6 PM

// ─── Helpers ─────────────────────────────────────────────────────────────────

function minutesFromMidnight(isoStr: string): number {
  const d = parseISO(isoStr);
  return d.getHours() * 60 + d.getMinutes();
}

function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function fmtHHMM(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const ampm = h < 12 ? 'a' : 'p';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m).padStart(2, '0')}${ampm}`;
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

function utilizationColor(pct: number): string {
  if (pct >= 80) return 'hsl(142 71% 45%)';
  if (pct >= 50) return 'hsl(45 93% 47%)';
  return 'hsl(var(--destructive))';
}

// utilizationTextClass removed — using inline style colors now via utilizationColor()

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title, subtitle }: { icon: React.ElementType; title: string; subtitle?: string }) {
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

function GanttBlockTooltip({ block, x, y, containerWidth }: { block: TaskBlock; x: number; y: number; containerWidth: number }) {
  const tooltipW = 220;
  const safeX = Math.min(x + 14, containerWidth - tooltipW - 8);
  return (
    <div
      className="absolute z-50 glass-card p-3 text-xs shadow-xl border border-border pointer-events-none"
      style={{ left: Math.max(4, safeX), top: y - 8, width: tooltipW }}
    >
      <p className="font-bold text-sm text-foreground mb-1 leading-tight">
        {block.task.ai_title || block.task.name || 'Untitled'}
      </p>
      <p className="text-muted-foreground mb-1 text-[11px]">{block.task.property_name || '—'}</p>
      <div className="flex gap-3 text-[11px] text-muted-foreground">
        <span>{fmtTime(block.task.started_at)} → {fmtTime(block.task.finished_at)}</span>
        <span className="font-semibold text-foreground">{fmtDur(block.durationMin)}</span>
      </div>
      {block.task.ai_skill_category && (
        <p className="mt-1 text-[10px] text-muted-foreground capitalize">{block.task.ai_skill_category}</p>
      )}
      {block.task.ai_guest_impact && (
        <p className="mt-1 text-[10px] text-destructive font-semibold">⚠ Guest Impact</p>
      )}
    </div>
  );
}

// ─── Gap Tooltip ──────────────────────────────────────────────────────────────

function GapTooltip({ fromName, toName, gapMin, x, y, containerWidth }: {
  fromName: string; toName: string; gapMin: number; x: number; y: number; containerWidth: number;
}) {
  const tooltipW = 200;
  const safeX = Math.min(x + 14, containerWidth - tooltipW - 8);
  return (
    <div
      className="absolute z-50 glass-card px-3 py-2 text-[11px] shadow-xl border border-border pointer-events-none"
      style={{ left: Math.max(4, safeX), top: y - 8, width: tooltipW }}
    >
      <p className="font-semibold text-foreground mb-0.5">{fmtDur(gapMin)} gap</p>
      <p className="text-muted-foreground text-[10px] truncate">{fromName}</p>
      <p className="text-muted-foreground text-[10px]">↓</p>
      <p className="text-muted-foreground text-[10px] truncate">{toName}</p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MaintenanceTimeEfficiency() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [hoveredBlock, setHoveredBlock] = useState<{ block: TaskBlock; x: number; y: number } | null>(null);
  const [hoveredGap, setHoveredGap] = useState<{ fromName: string; toName: string; gapMin: number; x: number; y: number } | null>(null);
  const ganttRef = useRef<HTMLDivElement>(null);

  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  const viewingToday = isToday(selectedDate);

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

  // "Now" line position
  const nowPct = useMemo(() => {
    if (!viewingToday) return null;
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    if (nowMin < GANTT_START_HOUR * 60 || nowMin > GANTT_END_HOUR * 60) return null;
    return pct(nowMin);
  }, [viewingToday]);

  // Off-hours shading bounds in %
  const offHoursLeftPct  = pct(GANTT_START_HOUR * 60);       // = 0 (left edge)
  const offHoursEndPct   = pct(OFF_HOURS_END_MIN);            // 7AM
  const offHoursStartPct = pct(OFF_HOURS_START_MIN);          // 6PM
  const offHoursRightPct = pct(GANTT_END_HOUR * 60);          // = 100

  // ── Today's tasks ──────────────────────────────────────────────────────────
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

  // ── Timeero shifts via RPC ─────────────────────────────────────────────────
  const { data: timeeroShifts } = useQuery({
    queryKey: ['maint-timeero-shifts', dateStr],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_timeero_shifts', { p_date: dateStr });
      if (error) {
        console.error('[Timeero] RPC error:', error.message);
        return [] as { breezeway_name: string; clock_in: string; clock_out: string; job_name: string | null }[];
      }
      return (data ?? []) as { breezeway_name: string; clock_in: string; clock_out: string; job_name: string | null }[];
    },
  });

  // ── Tech daily efficiency via RPC ──────────────────────────────────────────
  const { data: techEfficiency } = useQuery({
    queryKey: ['tech-daily-efficiency', dateStr],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_tech_daily_efficiency', { p_date: dateStr });
      if (error) {
        console.error('[TechEfficiency] RPC error:', error.message);
        return [] as TechEfficiency[];
      }
      return (data ?? []) as TechEfficiency[];
    },
  });

  // ── Tech efficiency lookup map (by tech_name) ──────────────────────────────
  const techEffMap = useMemo(() => {
    const m = new Map<string, TechEfficiency>();
    (techEfficiency ?? []).forEach(t => m.set(t.tech_name, t));
    return m;
  }, [techEfficiency]);

  // ── Calc duration ──────────────────────────────────────────────────────────
  function calcDur(t: RawTask): number | null {
    if (t.started_at && t.finished_at) {
      const d = differenceInMinutes(parseISO(t.finished_at), parseISO(t.started_at));
      if (d > 0 && d < 900) return d;
    }
    if (t.work_duration_minutes && t.work_duration_minutes > 0) return t.work_duration_minutes;
    return null;
  }

  // ── Build shift segment map ────────────────────────────────────────────────
  const shiftSegmentMap = useMemo(() => {
    const result = new Map<string, ShiftSegment[]>();
    if (!timeeroShifts) return result;
    timeeroShifts.forEach(shift => {
      if (!shift.clock_in || !shift.clock_out) return;
      const clockInMin  = hhmmToMinutes(shift.clock_in);
      const clockOutMin = hhmmToMinutes(shift.clock_out);
      if (clockOutMin <= clockInMin) return;
      const key = shift.breezeway_name;
      if (!result.has(key)) result.set(key, []);
      result.get(key)!.push({ clockInMin, clockOutMin, clockInStr: shift.clock_in, clockOutStr: shift.clock_out });
    });
    result.forEach(segs => segs.sort((a, b) => a.clockInMin - b.clockInMin));
    return result;
  }, [timeeroShifts]);

  // ── Build Gantt rows ───────────────────────────────────────────────────────
  const ganttRows = useMemo<TechRow[]>(() => {
    if (!todayTasks) return [];
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
        segments: shiftSegmentMap.get(name) ?? [],
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [todayTasks, shiftSegmentMap]);

  // ── Property color map ─────────────────────────────────────────────────────
  const propertyColorMap = useMemo(() => {
    const props = new Set<string>();
    (todayTasks ?? []).forEach(t => props.add(t.property_name || 'Unknown'));
    const map = new Map<string, string>();
    Array.from(props).sort().forEach((p, i) => map.set(p, PROPERTY_COLOR_PALETTE[i % PROPERTY_COLOR_PALETTE.length]));
    return map;
  }, [todayTasks]);


  // ── Team summary bar stats from RPC ───────────────────────────────────────
  const teamSummary = useMemo(() => {
    const eff = techEfficiency ?? [];
    const withShift = eff.filter(t => t.shift_minutes > 0);
    const utils = withShift.map(t => t.utilization_pct);
    const avgUtil = utils.length > 0 ? Math.round(utils.reduce((a, b) => a + b, 0) / utils.length) : null;
    const below50 = utils.filter(u => u < 50).length;
    const totalTasks = eff.reduce((s, t) => s + t.task_count, 0);
    const totalProps = eff.reduce((s, t) => s + t.properties_visited, 0);
    const techCount = ganttRows.length;
    return { techCount, withShiftCount: withShift.length, totalTasks, totalProps, avgUtil, below50 };
  }, [techEfficiency, ganttRows]);

  // ── RPC-based KPI cards ────────────────────────────────────────────────────
  const rpcKpis = useMemo(() => {
    const eff = techEfficiency ?? [];
    const withShift = eff.filter(t => t.shift_minutes > 0);
    const avgUtil = withShift.length > 0
      ? Math.round(withShift.reduce((s, t) => s + t.utilization_pct, 0) / withShift.length) : null;
    const totalTaskMin = eff.reduce((s, t) => s + (t.task_minutes ?? 0), 0);
    const totalShiftMin = eff.reduce((s, t) => s + (t.shift_minutes ?? 0), 0);
    const totalIdleMin = eff.reduce((s, t) => s + (t.idle_minutes ?? 0), 0);
    const totalProps = eff.reduce((s, t) => s + t.properties_visited, 0);
    const idlePct = totalShiftMin > 0 ? Math.round((totalIdleMin / totalShiftMin) * 100) : null;
    return { avgUtil, totalTaskMin, totalShiftMin, totalIdleMin, idlePct, totalProps, techsWithShift: withShift.length };
  }, [techEfficiency]);

  // ── Hour tick marks ────────────────────────────────────────────────────────
  const hourTicks = Array.from({ length: GANTT_END_HOUR - GANTT_START_HOUR + 1 }, (_, i) => {
    const h = GANTT_START_HOUR + i;
    return { label: format(new Date(2000, 0, 1, h), 'ha'), pctVal: ((h - GANTT_START_HOUR) / (GANTT_END_HOUR - GANTT_START_HOUR)) * 100 };
  });

  const handleBlockEnter = useCallback((e: React.MouseEvent, block: TaskBlock) => {
    const rect = ganttRef.current?.getBoundingClientRect();
    if (rect) setHoveredBlock({ block, x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, []);

  const handleGapEnter = useCallback((e: React.MouseEvent, fromName: string, toName: string, gapMin: number) => {
    const rect = ganttRef.current?.getBoundingClientRect();
    if (rect) setHoveredGap({ fromName, toName, gapMin, x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, []);

  const containerWidth = ganttRef.current?.clientWidth ?? 800;
  // Name column + right stats column widths in px (for offset math)
  const LEFT_COL_PX  = 136; // w-34
  const RIGHT_COL_PX = 140; // wider to fit 4 lines of RPC stats

  return (
    <div className="space-y-8">
      {/* PAGE HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Time & Efficiency</h2>
          <p className="text-sm text-muted-foreground">Daily task timelines and efficiency metrics</p>
        </div>
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
          <Button variant="ghost" size="icon" className="h-8 w-8" disabled={isToday(selectedDate)} onClick={() => setSelectedDate(d => addDays(d, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          {!isToday(selectedDate) && (
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setSelectedDate(new Date())}>Today</Button>
          )}
        </div>
      </div>

      {/* ── KPI Cards (RPC-powered) ────────────────────────────── */}
      <div>
        <SectionHeader icon={Zap} title="Efficiency Metrics" subtitle={format(selectedDate, 'MMM d, yyyy')} />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Card 1: Team Utilization */}
          <div className="glass-card p-3 sm:p-4">
            <div className="flex items-start gap-3 mb-2">
              <div className="p-2 rounded-lg shrink-0 gradient-accent">
                <Zap className="h-4 w-4 text-primary-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground font-medium">Team Utilization</p>
                <p
                  className="text-2xl font-bold"
                  style={{
                    color: rpcKpis.avgUtil == null ? 'hsl(var(--muted-foreground))'
                      : rpcKpis.avgUtil >= 70 ? 'hsl(142,71%,45%)'
                      : rpcKpis.avgUtil >= 50 ? 'hsl(45,93%,47%)'
                      : 'hsl(var(--destructive))',
                  }}
                >
                  {rpcKpis.avgUtil != null ? `${rpcKpis.avgUtil}%` : '—'}
                </p>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">{rpcKpis.techsWithShift} techs with shift data</p>
          </div>

          {/* Card 2: Total Wrench Time */}
          <div className="glass-card p-3 sm:p-4">
            <div className="flex items-start gap-3 mb-2">
              <div className="p-2 rounded-lg shrink-0 bg-[hsl(142,71%,45%,0.15)]">
                <Timer className="h-4 w-4 text-[hsl(142,71%,45%)]" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground font-medium">Total Wrench Time</p>
                <p className="text-2xl font-bold text-foreground">
                  {rpcKpis.totalTaskMin > 0 ? fmtDur(Math.round(rpcKpis.totalTaskMin)) : '—'}
                </p>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              vs {rpcKpis.totalShiftMin > 0 ? fmtDur(Math.round(rpcKpis.totalShiftMin)) : '—'} clocked
            </p>
          </div>

          {/* Card 3: Idle / Travel Time */}
          <div className="glass-card p-3 sm:p-4">
            <div className="flex items-start gap-3 mb-2">
              <div className="p-2 rounded-lg shrink-0 bg-[hsl(var(--destructive)/0.12)]">
                <Clock className="h-4 w-4 text-destructive" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground font-medium">Idle / Travel Time</p>
                <p
                  className="text-2xl font-bold"
                  style={{
                    color: rpcKpis.idlePct != null && rpcKpis.idlePct > 30
                      ? 'hsl(var(--destructive))'
                      : 'hsl(var(--foreground))',
                  }}
                >
                  {rpcKpis.totalIdleMin > 0 ? fmtDur(Math.round(rpcKpis.totalIdleMin)) : '—'}
                </p>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {rpcKpis.idlePct != null ? `${rpcKpis.idlePct}% of clocked time` : 'No shift data'}
            </p>
          </div>

          {/* Card 4: Properties Served */}
          <div className="glass-card p-3 sm:p-4">
            <div className="flex items-start gap-3 mb-2">
              <div className="p-2 rounded-lg shrink-0 bg-muted">
                <Activity className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground font-medium">Properties Served</p>
                <p className="text-2xl font-bold text-foreground">
                  {rpcKpis.totalProps > 0 ? rpcKpis.totalProps : '—'}
                </p>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">across {rpcKpis.techsWithShift} techs</p>
          </div>
        </div>
      </div>

      {/* ── GANTT TIMELINE ────────────────────────────────────────────────── */}
      <div>
        <SectionHeader
          icon={BarChart2}
          title={`Daily Timeline — ${format(selectedDate, 'EEEE, MMM d')}`}
          subtitle="Task blocks per tech · hover for details · gaps show idle/travel time"
        />
        <div className="glass-card p-4 overflow-x-auto min-h-[70vh] flex flex-col">
          {todayLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="flex gap-3 items-center">
                  <div className="h-5 w-32 bg-muted rounded animate-pulse shrink-0" />
                  <div className="h-14 flex-1 bg-muted/30 rounded animate-pulse" />
                  <div className="h-5 w-24 bg-muted rounded animate-pulse shrink-0" />
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
            <div ref={ganttRef} className="relative flex-1">

              {/* ── Team summary bar (RPC-powered) ─────────────────────────── */}
              <div className="flex items-center gap-3 mb-3 px-3 py-2 rounded-lg bg-muted/30 border border-border/50">
                <div className="flex-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{teamSummary.techCount} techs</span>
                  <span>·</span>
                  <span>{teamSummary.totalTasks} tasks</span>
                  <span>·</span>
                  <span>{teamSummary.totalProps} properties</span>
                  {teamSummary.avgUtil !== null && (
                    <>
                      <span>·</span>
                      <span>
                        <span className="font-bold" style={{ color: utilizationColor(teamSummary.avgUtil) }}>
                          {teamSummary.avgUtil}%
                        </span>
                        {' '}avg utilization
                      </span>
                    </>
                  )}
                  {teamSummary.below50 > 0 && (
                    <>
                      <span>·</span>
                      <span className="text-destructive font-semibold">{teamSummary.below50} below 50%</span>
                    </>
                  )}
                  {teamSummary.withShiftCount < teamSummary.techCount && (
                    <>
                      <span>·</span>
                      <span className="text-muted-foreground/70">{teamSummary.techCount - teamSummary.withShiftCount} no timesheet</span>
                    </>
                  )}
                </div>
              </div>


              {/* ── Hour axis ─────────────────────────────────────────────── */}
              <div className="flex mb-1 relative h-5" style={{ paddingLeft: LEFT_COL_PX, paddingRight: RIGHT_COL_PX }}>
                {hourTicks.map(tick => (
                  <div
                    key={tick.label}
                    className="absolute text-[10px] text-muted-foreground -translate-x-1/2"
                    style={{ left: `calc(${LEFT_COL_PX}px + ${tick.pctVal}% * (100% - ${LEFT_COL_PX + RIGHT_COL_PX}px) / 100)` }}
                  >
                    {tick.label}
                  </div>
                ))}
              </div>

              {/* ── Tech rows ─────────────────────────────────────────────── */}
              <div className="rounded-lg border border-border/50 overflow-hidden">
                {ganttRows.map((row, rowIdx) => {
                  const { segments } = row;
                  const hasNoTimesheet = segments.length === 0;

                  // Earliest in / latest out (for off-clock shading)
                  const earliestIn = segments.length ? Math.min(...segments.map(s => s.clockInMin))  : null;
                  const latestOut  = segments.length ? Math.max(...segments.map(s => s.clockOutMin)) : null;

                  const isEven = rowIdx % 2 === 0;
                  const rowBg = isEven ? 'bg-background' : 'bg-muted/20';

                  // RPC data for this tech (prefer RPC utilization over Gantt calc)
                  const rpcRow = techEffMap.get(row.name);
                  const rpcUtil = rpcRow ? rpcRow.utilization_pct : null;
                  const dotColor = rpcUtil === null ? '#94a3b8' : utilizationColor(rpcUtil);

                  return (
                    <div
                      key={row.name}
                      className={`flex items-stretch border-b border-border/40 last:border-b-0 ${rowBg}`}
                      style={{ minHeight: 58 }}
                    >
                      {/* ── Left: tech name ─────────────────────────────── */}
                      <div
                        className="shrink-0 flex items-center gap-2 px-3 border-r border-border/40"
                        style={{ width: LEFT_COL_PX }}
                      >
                        {/* Utilization dot */}
                        <div
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: dotColor }}
                          title={rpcUtil !== null ? `${rpcUtil}% utilization` : 'No timesheet'}
                        />
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold text-foreground leading-tight truncate">{row.name.split(' ')[0]}</p>
                          <p className="text-[9px] text-muted-foreground leading-tight truncate">{row.name.split(' ').slice(1).join(' ')}</p>
                        </div>
                      </div>

                      {/* ── Center: timeline track ───────────────────────── */}
                      <div className="flex-1 relative" style={{ minHeight: 58 }}>

                        {/* Off-hours shading — before 7 AM */}
                        {offHoursEndPct > 0 && (
                          <div
                            className="absolute top-0 bottom-0 pointer-events-none"
                            style={{
                              left: `${offHoursLeftPct}%`,
                              width: `${offHoursEndPct - offHoursLeftPct}%`,
                              background: 'repeating-linear-gradient(135deg, transparent, transparent 4px, rgba(0,0,0,0.04) 4px, rgba(0,0,0,0.04) 8px)',
                              backgroundColor: 'rgba(0,0,0,0.04)',
                            }}
                          />
                        )}

                        {/* Off-hours shading — after 6 PM */}
                        {offHoursStartPct < 100 && (
                          <div
                            className="absolute top-0 bottom-0 pointer-events-none"
                            style={{
                              left: `${offHoursStartPct}%`,
                              width: `${offHoursRightPct - offHoursStartPct}%`,
                              background: 'repeating-linear-gradient(135deg, transparent, transparent 4px, rgba(0,0,0,0.04) 4px, rgba(0,0,0,0.04) 8px)',
                              backgroundColor: 'rgba(0,0,0,0.04)',
                            }}
                          />
                        )}

                        {/* "Outside shift" dark shade — before clock-in and after clock-out */}
                        {earliestIn !== null && (
                          <>
                            {/* Before clock-in */}
                            <div
                              className="absolute top-0 bottom-0 pointer-events-none"
                              style={{
                                left: 0,
                                width: `${pct(earliestIn)}%`,
                                backgroundColor: 'rgba(0,0,0,0.07)',
                              }}
                            />
                            {/* After clock-out */}
                            {latestOut !== null && (
                              <div
                                className="absolute top-0 bottom-0 pointer-events-none"
                                style={{
                                  left: `${pct(latestOut)}%`,
                                  right: 0,
                                  backgroundColor: 'rgba(0,0,0,0.07)',
                                }}
                              />
                            )}
                          </>
                        )}

                        {/* No-timesheet hatch overlay */}
                        {hasNoTimesheet && (
                          <div
                            className="absolute inset-0 pointer-events-none"
                            style={{
                              background: 'repeating-linear-gradient(45deg, transparent, transparent 8px, rgba(148,163,184,0.1) 8px, rgba(148,163,184,0.1) 10px)',
                            }}
                          />
                        )}

                        {/* Hour grid lines */}
                        {hourTicks.map(tick => (
                          <div
                            key={tick.label}
                            className="absolute top-0 bottom-0 w-px"
                            style={{ left: `${tick.pctVal}%`, backgroundColor: 'hsl(var(--border) / 0.35)' }}
                          />
                        ))}

                        {/* NOW line */}
                        {nowPct !== null && (
                          <div
                            className="absolute top-0 bottom-0 w-0.5 z-20 pointer-events-none"
                            style={{ left: `${nowPct}%`, backgroundColor: 'hsl(var(--destructive))', boxShadow: '0 0 4px hsl(var(--destructive) / 0.5)' }}
                          >
                            <span
                              className="absolute -top-4 text-[8px] font-bold text-destructive -translate-x-1/2 bg-background px-0.5 rounded"
                            >
                              NOW
                            </span>
                          </div>
                        )}

                        {/* Shift background bars */}
                        {segments.map((seg, si) => {
                          const segLeft  = pct(seg.clockInMin);
                          const segRight = pct(seg.clockOutMin);
                          const segWidth = Math.max(segRight - segLeft, 0);
                          return (
                            <div key={si}>
                              <div
                                className="absolute pointer-events-none"
                                style={{
                                  left:            `${segLeft}%`,
                                  width:           `${segWidth}%`,
                                  top: '20%',
                                  bottom: '20%',
                                  backgroundColor: 'rgba(59,130,246,0.15)',
                                  borderTop:       '2px solid rgba(59,130,246,0.45)',
                                  borderBottom:    '2px solid rgba(59,130,246,0.45)',
                                  borderRadius:    2,
                                }}
                              />
                              {/* Clock-in label above bar */}
                              <span
                                className="absolute text-[8px] font-semibold pointer-events-none select-none z-10"
                                style={{ left: `calc(${segLeft}% + 2px)`, top: '4%', color: 'rgba(59,130,246,0.85)' }}
                              >
                                {fmtHHMM(seg.clockInStr)}
                              </span>
                              {/* Clock-out label above bar (right edge) */}
                              <span
                                className="absolute text-[8px] font-semibold pointer-events-none select-none z-10"
                                style={{ right: `calc(${100 - segRight}% + 2px)`, top: '4%', color: 'rgba(59,130,246,0.85)' }}
                              >
                                {fmtHHMM(seg.clockOutStr)}
                              </span>
                            </div>
                          );
                        })}

                        {/* No-timesheet label */}
                        {hasNoTimesheet && (
                          <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <span className="text-[9px] text-muted-foreground/50 italic tracking-wide">No Timesheet</span>
                          </span>
                        )}

                        {/* Gap connectors between tasks (15+ min gaps during shift) */}
                        {row.blocks.map((block, idx) => {
                          if (idx === 0) return null;
                          const prev = row.blocks[idx - 1];
                          const gapMin = block.startMin - prev.endMin;
                          if (gapMin < 15) return null;
                          // Only show gap if it's within the shift
                          const duringShift = segments.some(
                            seg => prev.endMin >= seg.clockInMin && block.startMin <= seg.clockOutMin
                          );
                          if (!duringShift && segments.length > 0) return null;

                          const gapLeft  = pct(prev.endMin);
                          const gapRight = pct(block.startMin);
                          const gapMid   = (gapLeft + gapRight) / 2;

                          return (
                            <div
                              key={`gap-${idx}`}
                              className="absolute top-1/2 -translate-y-1/2 cursor-pointer"
                              style={{ left: `${gapLeft}%`, width: `${gapRight - gapLeft}%`, height: 2 }}
                              onMouseEnter={e => handleGapEnter(
                                e,
                                prev.task.ai_title || prev.task.name || 'Task',
                                block.task.ai_title || block.task.name || 'Task',
                                gapMin,
                              )}
                              onMouseLeave={() => setHoveredGap(null)}
                            >
                              {/* Dashed line */}
                              <div
                                className="absolute inset-0"
                                style={{
                                  borderTop: '1.5px dashed rgba(148,163,184,0.6)',
                                  top: '50%',
                                }}
                              />
                              {/* Gap duration label in middle */}
                              {(gapRight - gapLeft) > 4 && (
                                <span
                                  className="absolute -translate-x-1/2 -translate-y-full text-[8px] text-muted-foreground/60"
                                  style={{ left: `${gapMid - gapLeft}%` }}
                                >
                                  {fmtDur(gapMin)}
                                </span>
                              )}
                            </div>
                          );
                        })}

                        {/* Task blocks */}
                        {row.blocks.map((block, idx) => {
                          const leftPct     = pct(block.startMin);
                          const rightPct    = pct(block.endMin);
                          const rawWidthPct = Math.max(rightPct - leftPct, 0.25);
                          const propKey     = block.task.property_name || 'Unknown';
                          const color       = propertyColorMap.get(propKey) ?? '#3b82f6';
                          const isGuest     = block.task.ai_guest_impact;
                          const trackWidth  = ganttRef.current?.clientWidth ?? 800;
                          const approxWidthPx = (rawWidthPct / 100) * (trackWidth - LEFT_COL_PX - RIGHT_COL_PX) - 4;
                          const isVeryShort = block.durationMin < 15;

                          const outsideShift = segments.length > 0 && !segments.some(
                            seg => block.startMin >= seg.clockInMin && block.endMin <= seg.clockOutMin
                          );

                          return (
                            <div
                              key={`${block.task.breezeway_id}-${block.assigneeName}-${idx}`}
                              className="absolute cursor-pointer transition-opacity hover:opacity-80 overflow-hidden"
                              style={{
                                left:            `${leftPct}%`,
                                width:           isVeryShort
                                  ? `max(4px, calc(${rawWidthPct}% - 2px))`
                                  : `calc(${rawWidthPct}% - 3px)`,
                                top:             isVeryShort ? '10%' : '18%',
                                bottom:          isVeryShort ? '10%' : '18%',
                                borderRadius:    isVeryShort ? 2 : 4,
                                backgroundColor: isVeryShort ? color : color + 'cc',
                                border:          `1px solid ${color}`,
                                outline: isGuest
                                  ? '2px solid hsl(var(--destructive))'
                                  : outsideShift ? '2px solid hsl(45 100% 55%)' : undefined,
                                zIndex: 10,
                              }}
                              onMouseEnter={e => handleBlockEnter(e, block)}
                              onMouseLeave={() => setHoveredBlock(null)}
                            >
                              {/* Property label inside block — only if wide enough and not very short */}
                              {!isVeryShort && approxWidthPx > 80 && (
                                <span className="absolute inset-0 flex items-center px-1.5 pointer-events-none select-none">
                                  <span className="text-[9px] font-semibold text-white truncate leading-none drop-shadow-sm">
                                    {propKey.length > 18 ? propKey.slice(0, 16) + '…' : propKey}
                                  </span>
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* ── Right: stats column (RPC-powered) ───────────── */}
                      <div
                        className="shrink-0 flex flex-col justify-center items-end px-3 border-l border-border/40 text-right"
                        style={{ width: RIGHT_COL_PX }}
                      >
                        {rpcRow ? (
                          <>
                            <p className="text-[10px] text-muted-foreground leading-tight">
                              {rpcRow.task_count} tasks · {rpcRow.properties_visited} props
                            </p>
                            <p className="text-[10px] text-muted-foreground leading-tight">
                              {fmtDur(Math.round(rpcRow.task_minutes))} wrench
                            </p>
                            <p className="text-[10px] text-muted-foreground leading-tight">
                              {fmtDur(Math.round(rpcRow.shift_minutes))} shift
                            </p>
                            <p
                              className="text-sm font-bold leading-tight mt-0.5"
                              style={{
                                color: rpcRow.utilization_pct >= 70 ? 'hsl(142,71%,45%)'
                                  : rpcRow.utilization_pct >= 50 ? 'hsl(45,93%,47%)'
                                  : 'hsl(var(--destructive))',
                              }}
                            >
                              {Math.round(rpcRow.utilization_pct)}%
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="text-[10px] text-muted-foreground leading-tight">{row.blocks.length} tasks</p>
                            <p className="text-[9px] text-muted-foreground/50 italic leading-tight">no shift</p>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Hover tooltips */}
              {hoveredBlock && !hoveredGap && (
                <GanttBlockTooltip
                  block={hoveredBlock.block}
                  x={hoveredBlock.x}
                  y={hoveredBlock.y}
                  containerWidth={containerWidth}
                />
              )}
              {hoveredGap && (
                <GapTooltip
                  fromName={hoveredGap.fromName}
                  toName={hoveredGap.toName}
                  gapMin={hoveredGap.gapMin}
                  x={hoveredGap.x}
                  y={hoveredGap.y}
                  containerWidth={containerWidth}
                />
              )}
            </div>
          )}

          {/* ── Legend ─────────────────────────────────────────────────── */}
          {ganttRows.length > 0 && (
            <div className="mt-4 pt-3 border-t border-border flex flex-wrap gap-x-5 gap-y-2 items-center">
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-8 rounded-sm shrink-0" style={{ backgroundColor: 'rgba(59,130,246,0.15)', border: '1.5px solid rgba(59,130,246,0.4)' }} />
                <span className="text-[10px] text-muted-foreground">Clocked Shift</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ outline: '2px solid hsl(45 100% 55%)', outlineOffset: '-1px', backgroundColor: '#3b82f6cc' }} />
                <span className="text-[10px] text-muted-foreground">Outside Shift</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-8 shrink-0" style={{ borderTop: '1.5px dashed rgba(148,163,184,0.6)' }} />
                <span className="text-[10px] text-muted-foreground">Gap / Idle</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-sm border-2 border-destructive shrink-0" />
                <span className="text-[10px] text-muted-foreground">Guest Impact</span>
              </div>
              <div className="flex items-center gap-3 ml-2">
                <span className="text-[10px] text-muted-foreground">Util:</span>
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[hsl(142,71%,45%)]" /><span className="text-[10px] text-muted-foreground">≥80%</span></span>
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[hsl(45,93%,47%)]" /><span className="text-[10px] text-muted-foreground">50–79%</span></span>
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-destructive" /><span className="text-[10px] text-muted-foreground">&lt;50%</span></span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

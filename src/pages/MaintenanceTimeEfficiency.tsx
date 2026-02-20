import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Clock, Zap, Activity, ChevronLeft, ChevronRight,
  BarChart2, Timer, X, TrendingUp, Wrench, Navigation,
} from 'lucide-react';
import {
  format, parseISO, differenceInMinutes,
  subDays, addDays, isToday, startOfMonth, endOfMonth, eachDayOfInterval,
} from 'date-fns';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { BarChart, Bar, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis } from 'recharts';
import { TaskDetailSheet } from '@/components/maintenance/TaskDetailSheet';
import { PropertyDetailSheet } from '@/components/properties/PropertyDetailSheet';

// ─── Types ───────────────────────────────────────────────────────────────────

type Department = 'maintenance' | 'housekeeping' | 'inspection';


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

interface TechMileage {
  breezeway_assignee_name: string;
  miles: number;
}

interface TechHistoryRow {
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

interface RawTask {
  breezeway_id: number;
  name: string | null;
  ai_title: string | null;
  property_name: string | null;
  created_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  status_name: string | null;
  work_duration_minutes: number | null;
  ai_skill_category: string | null;
  priority: string | null;
  ai_guest_impact: boolean | null;
  department: string | null;
  assignees: { assignee_name: string }[] | null;
  isInProgress?: boolean; // true = started but no finish_at
  isCarryOver?: boolean;  // true = started before selected date
}

interface TaskBlock {
  task: RawTask;
  startMin: number;
  endMin: number;
  durationMin: number;
  assigneeName: string;
  isInProgress?: boolean;
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
  carryOverTasks: RawTask[]; // tasks started before today, still open
}

// ─── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_START_HOUR = 7;
const DEFAULT_END_HOUR   = 17;

// Renjoy brand red palette — alternates per task index in a row
const BRAND_RED_PRIMARY = '#DC2626';
const BRAND_RED_DARK    = '#991B1B';

// ─── Mountain Time Helpers ────────────────────────────────────────────────────

/** Convert a real UTC ISO timestamp to Mountain Time minutes-from-midnight */
function utcIsoToMountainMinutes(isoStr: string): number {
  const d = new Date(isoStr);
  const mt = new Date(d.toLocaleString('en-US', { timeZone: 'America/Denver' }));
  return mt.getHours() * 60 + mt.getMinutes();
}

/** Get current Mountain Time hours + minutes */
function getMountainNow(): { hours: number; minutes: number; label: string } {
  const now = new Date();
  const mt = new Date(now.toLocaleString('en-US', { timeZone: 'America/Denver' }));
  const h = mt.getHours();
  const m = mt.getMinutes();
  const ampm = h < 12 ? 'a' : 'p';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return {
    hours: h,
    minutes: m,
    label: `${hh}:${String(m).padStart(2, '0')}${ampm}`,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

function fmtDur(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function fmtTime(isoStr: string | null): string {
  if (!isoStr) return '—';
  // Convert UTC→Mountain for Breezeway task timestamps
  const d = new Date(isoStr);
  const mt = new Date(d.toLocaleString('en-US', { timeZone: 'America/Denver' }));
  return format(mt, 'h:mm a');
}

function utilizationColor(pct: number): string {
  if (pct >= 70) return 'hsl(142 71% 45%)';
  if (pct >= 50) return 'hsl(45 93% 47%)';
  return 'hsl(var(--destructive))';
}

function utilizationFill(pct: number): string {
  if (pct >= 70) return 'hsl(142 71% 45%)';
  if (pct >= 50) return 'hsl(45 93% 47%)';
  return 'hsl(var(--destructive))';
}

function heatmapColor(pct: number | null): string {
  if (pct === null) return 'hsl(var(--muted))';
  if (pct === 0)    return 'hsl(var(--muted) / 0.5)';
  if (pct >= 80)    return 'hsl(142 71% 35%)';
  if (pct >= 60)    return 'hsl(142 71% 52%)';
  if (pct >= 40)    return 'hsl(45 93% 47%)';
  if (pct >= 20)    return 'hsl(25 95% 53%)';
  return 'hsl(var(--destructive))';
}

function hourLabel(h: number): string {
  if (h === 0)  return '12a';
  if (h === 12) return '12p';
  return h < 12 ? `${h}a` : `${h - 12}p`;
}

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

function GanttBlockTooltip({
  block, clientX, clientY, onPropertyClick,
}: {
  block: TaskBlock;
  clientX: number;
  clientY: number;
  onPropertyClick: (name: string) => void;
}) {
  const tooltipW = 280;
  const tooltipH = 140; // estimated height

  // Clamp horizontal so it doesn't overflow right edge
  const safeX = Math.min(clientX + 14, window.innerWidth - tooltipW - 12);
  // Show above cursor if there's room, else below
  const showAbove = clientY > tooltipH + 40;
  const topPos = showAbove ? clientY - tooltipH - 14 : clientY + 20;

  const inProgressMin = block.isInProgress ? Math.round(block.durationMin) : null;

  return (
    <div
      className="fixed z-[9999] glass-card p-3 text-xs shadow-2xl border border-border"
      style={{ left: Math.max(8, safeX), top: topPos, width: tooltipW, pointerEvents: 'none' }}
    >
      {/* Caret pointing down (when shown above) */}
      {showAbove && (
        <div
          className="absolute bottom-[-6px] left-6 w-3 h-3 rotate-45 bg-popover border-r border-b border-border"
          style={{ pointerEvents: 'none' }}
        />
      )}
      {/* Caret pointing up (when shown below) */}
      {!showAbove && (
        <div
          className="absolute top-[-6px] left-6 w-3 h-3 rotate-45 bg-popover border-l border-t border-border"
          style={{ pointerEvents: 'none' }}
        />
      )}

      <p className="font-bold text-sm text-foreground mb-1 leading-tight">
        {block.task.ai_title || block.task.name || 'Untitled'}
      </p>
      {block.task.property_name && (
        <p
          className="text-primary text-[11px] mb-1 font-medium cursor-pointer hover:underline"
          style={{ pointerEvents: 'auto' }}
          onClick={() => onPropertyClick(block.task.property_name!)}
        >
          📍 {block.task.property_name}
        </p>
      )}
      {block.isInProgress ? (
        <div className="text-[11px] text-muted-foreground">
          <span>Started {fmtTime(block.task.started_at)} — </span>
          <span className="font-semibold text-amber-500">In Progress</span>
          {inProgressMin !== null && (
            <span className="text-foreground font-semibold ml-1">({fmtDur(inProgressMin)} so far)</span>
          )}
        </div>
      ) : (
        <div className="flex gap-3 text-[11px] text-muted-foreground">
          <span>{fmtTime(block.task.started_at)} → {fmtTime(block.task.finished_at)}</span>
          <span className="font-semibold text-foreground">{fmtDur(block.durationMin)}</span>
        </div>
      )}
      {block.task.ai_skill_category && (
        <p className="mt-1 text-[10px] text-muted-foreground capitalize">{block.task.ai_skill_category}</p>
      )}
      {block.task.ai_guest_impact && (
        <p className="mt-1 text-[10px] text-destructive font-semibold">⚠ Guest Impact</p>
      )}
      <p className="mt-1.5 text-[10px] text-primary/70 italic">Click block to open task detail</p>
    </div>
  );
}

// ─── Gap Tooltip ──────────────────────────────────────────────────────────────

function GapTooltip({ fromName, toName, gapMin, clientX, clientY }: {
  fromName: string; toName: string; gapMin: number; clientX: number; clientY: number;
}) {
  const tooltipW = 200;
  const tooltipH = 90;
  const safeX = Math.min(clientX + 14, window.innerWidth - tooltipW - 12);
  const showAbove = clientY > tooltipH + 40;
  const topPos = showAbove ? clientY - tooltipH - 14 : clientY + 20;
  return (
    <div
      className="fixed z-[9999] glass-card px-3 py-2 text-[11px] shadow-xl border border-border pointer-events-none"
      style={{ left: Math.max(8, safeX), top: topPos, width: tooltipW }}
    >
      <p className="font-semibold text-foreground mb-0.5">{fmtDur(gapMin)} gap</p>
      <p className="text-muted-foreground text-[10px] truncate">{fromName}</p>
      <p className="text-muted-foreground text-[10px]">↓</p>
      <p className="text-muted-foreground text-[10px] truncate">{toName}</p>
    </div>
  );
}

// ─── Time Axis Row ────────────────────────────────────────────────────────────

function TimeAxis({
  hourTicks,
  leftColPx,
  nowPct,
  nowLabel,
  isBottom = false,
}: {
  hourTicks: { h: number; label: string; pctVal: number }[];
  leftColPx: number;
  nowPct: number | null;
  nowLabel: string | null;
  isBottom?: boolean;
}) {
  return (
    <div
      className="flex relative bg-muted/30 border-b border-border/50"
      style={{ height: 22, paddingLeft: leftColPx }}
    >
      {/* Label for the left column */}
      <div
        className="absolute top-0 bottom-0 flex items-center justify-end pr-2 text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-wide shrink-0"
        style={{ width: leftColPx }}
      >
        MT
      </div>

      {/* Hour labels */}
      <div className="relative flex-1">
        {hourTicks.map(tick => (
          <div key={tick.h} className="absolute flex flex-col items-center" style={{ left: `${tick.pctVal}%` }}>
            {/* Gridline (rendered for visual alignment) */}
            <span className="text-[9px] text-muted-foreground -translate-x-1/2 select-none">
              {tick.label}
            </span>
          </div>
        ))}

        {/* NOW badge */}
        {nowPct !== null && nowLabel && (
          <div
            className="absolute -translate-x-1/2 z-30"
            style={{ left: `${nowPct}%`, top: isBottom ? 2 : 2 }}
          >
            <span className="text-[9px] font-bold text-destructive bg-destructive/10 border border-destructive/30 px-1 py-0.5 rounded select-none whitespace-nowrap">
              {nowLabel}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tech Detail Panel ────────────────────────────────────────────────────────

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

function DayDrillDown({ techName, date, onTaskClick, onPropertyClick }: {
  techName: string;
  date: string;
  onTaskClick: (id: number) => void;
  onPropertyClick: (name: string) => void;
}) {
  const { data: tasks, isLoading } = useQuery({
    queryKey: ['tech-day-tasks', techName, date],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_tech_day_tasks', {
        p_tech_name: techName,
        p_date: date,
      });
      if (error) throw error;
      return (data ?? []) as DayTask[];
    },
  });

  if (isLoading) return (
    <tr><td colSpan={9} className="px-4 py-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <div className="h-3 w-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        Loading tasks…
      </div>
    </td></tr>
  );

  if (!tasks?.length) return (
    <tr><td colSpan={9} className="px-4 py-2 text-xs text-muted-foreground italic">No tasks found for this day</td></tr>
  );

  return (
    <tr><td colSpan={9} className="p-0">
      <div className="px-3 py-2 bg-muted/30 border-t border-border space-y-1.5">
        {tasks.map(t => {
          const borderColor = t.status_stage === 'finished' ? '#22c55e' : t.is_in_progress ? '#3b82f6' : '#9ca3af';
          return (
            <div
              key={t.breezeway_id}
              className="bg-background rounded-md p-2.5 border border-border hover:border-primary/40 cursor-pointer transition-colors"
              style={{ borderLeftWidth: 3, borderLeftColor: borderColor }}
              onClick={() => onTaskClick(t.breezeway_id)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-foreground truncate">🔧 {t.task_name || 'Untitled'}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    <span
                      className="text-primary hover:underline cursor-pointer"
                      onClick={(e) => { e.stopPropagation(); if (t.property_name) onPropertyClick(t.property_name); }}
                    >
                      {t.property_name || '—'}
                    </span>
                    {' · '}
                    {t.start_time ?? '—'} → {t.end_time ?? '—'}
                    {t.duration_minutes != null && ` · ${fmtDur(t.duration_minutes)}`}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                    t.status_stage === 'finished' ? 'bg-green-500/15 text-green-600' :
                    t.is_in_progress ? 'bg-blue-500/15 text-blue-500 animate-pulse' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {t.is_in_progress ? 'In Progress' : t.status_name ?? '—'}
                  </span>
                  <a
                    href={`https://app.breezeway.io/task/${t.breezeway_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[9px] text-primary hover:underline"
                    onClick={e => e.stopPropagation()}
                  >↗ BW</a>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </td></tr>
  );
}

function TechDetailPanel({ techName, department, onClose, onTaskClick, onPropertyClick }: {
  techName: string;
  department: Department | null;
  onClose: () => void;
  onTaskClick: (id: number) => void;
  onPropertyClick: (name: string) => void;
}) {
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  const { data: history, isLoading } = useQuery({
    queryKey: ['tech-history', techName, department],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_tech_history', { p_tech_name: techName, p_days: 30, p_department: department });
      if (error) throw error;
      return (data ?? []) as TechHistoryRow[];
    },
    enabled: !!techName,
  });

  const summary = useMemo(() => {
    if (!history?.length) return null;
    const withShift = history.filter(d => d.shift_minutes > 0);
    const avgUtil = withShift.length > 0
      ? Math.round(withShift.reduce((s, d) => s + d.utilization_pct, 0) / withShift.length)
      : 0;
    const totalTasks = history.reduce((s, d) => s + d.task_count, 0);
    const totalMiles = history.reduce((s, d) => s + (d.mileage ?? 0), 0);
    const daysWorked = history.length;
    return { avgUtil, totalTasks, totalMiles, daysWorked };
  }, [history]);

  const calendarDays = useMemo(() => {
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

  const sparkData = useMemo(() => {
    if (!history) return [];
    return [...history].reverse().map(d => ({
      date: format(parseISO(d.work_date), 'MMM d'),
      util: Math.round(d.utilization_pct),
    }));
  }, [history]);

  const encodedName = encodeURIComponent(techName);

  return (
    <Sheet open onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <SheetTitle className="text-lg font-bold flex items-center gap-2">
                {techName}
                <a
                  href={`/maintenance/tech/${encodedName}`}
                  className="text-xs font-medium text-primary hover:underline flex items-center gap-0.5"
                  onClick={(e) => { e.preventDefault(); onClose(); window.location.href = `/maintenance/tech/${encodedName}`; }}
                >
                  → Full Profile
                </a>
              </SheetTitle>
              <p className="text-sm text-muted-foreground">Last 30 Days · {department ? department.charAt(0).toUpperCase() + department.slice(1) : 'All Departments'}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </SheetHeader>

        <div className="px-6 py-5 space-y-6">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-12 bg-muted rounded animate-pulse" />)}
            </div>
          ) : !history?.length ? (
            <p className="text-sm text-muted-foreground">No data found for the last 30 days.</p>
          ) : (
            <>
              {summary && (
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: 'Avg Utilization', value: `${summary.avgUtil}%`, color: utilizationColor(summary.avgUtil) },
                    { label: 'Total Tasks', value: String(summary.totalTasks), color: undefined },
                    { label: 'Total Miles', value: `${summary.totalMiles.toFixed(1)} mi`, color: undefined },
                    { label: 'Days Worked', value: String(summary.daysWorked), color: undefined },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="glass-card p-3 text-center">
                      <p className="text-xl font-bold" style={{ color: color ?? 'hsl(var(--foreground))' }}>
                        {value}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
              )}

              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">30-Day Utilization</p>
                <div className="flex flex-wrap gap-1">
                  {calendarDays.map(({ date, pct }) => (
                    <div key={date.toISOString()} className="group relative" title={`${format(date, 'MMM d')}: ${pct !== null ? `${Math.round(pct)}% utilization` : 'No work'}`}>
                      <div className="w-7 h-7 rounded-sm transition-transform group-hover:scale-110" style={{ backgroundColor: pct !== null ? heatmapColor(pct) : 'hsl(var(--muted) / 0.4)' }} />
                      <span className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 text-[8px] text-muted-foreground/60 pointer-events-none">
                        {format(date, 'd')}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-3 mt-5">
                  <span className="text-[10px] text-muted-foreground">Util:</span>
                  {[
                    { label: '≥80%', color: 'hsl(142 71% 35%)' },
                    { label: '60–79%', color: 'hsl(142 71% 52%)' },
                    { label: '40–59%', color: 'hsl(45 93% 47%)' },
                    { label: '20–39%', color: 'hsl(25 95% 53%)' },
                    { label: '<20%', color: 'hsl(var(--destructive))' },
                    { label: 'No shift', color: 'hsl(var(--muted))' },
                  ].map(({ label, color }) => (
                    <span key={label} className="flex items-center gap-1">
                      <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: color }} />
                      <span className="text-[10px] text-muted-foreground">{label}</span>
                    </span>
                  ))}
                </div>
              </div>

              {sparkData.length > 1 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <TrendingUp className="h-3 w-3" /> Utilization Trend
                  </p>
                  <div className="h-24">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={sparkData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                        <XAxis dataKey="date" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                        <RechartsTooltip contentStyle={{ fontSize: 11, padding: '4px 8px', borderRadius: 6 }} formatter={(v: number) => [`${v}%`, 'Utilization']} />
                        <Bar dataKey="util" radius={2} fill="hsl(142 71% 45%)" maxBarSize={20} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Day-by-Day Breakdown</p>
                <div className="rounded-lg border border-border overflow-hidden">
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
                      {[...history].sort((a, b) => b.work_date.localeCompare(a.work_date)).map((row, i) => {
                        const dateKey = row.work_date.substring(0, 10);
                        const isExpanded = expandedDay === dateKey;
                        return (
                          <React.Fragment key={row.work_date}>
                            <tr
                              className={`cursor-pointer hover:bg-muted/40 transition-colors ${i % 2 === 0 ? 'bg-background' : 'bg-muted/20'}`}
                              onClick={() => setExpandedDay(isExpanded ? null : dateKey)}
                            >
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
                              <DayDrillDown
                                techName={techName}
                                date={dateKey}
                                onTaskClick={onTaskClick}
                                onPropertyClick={onPropertyClick}
                              />
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MaintenanceTimeEfficiency() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [hoveredBlock, setHoveredBlock] = useState<{ block: TaskBlock; clientX: number; clientY: number } | null>(null);
  const [hoveredGap, setHoveredGap] = useState<{ fromName: string; toName: string; gapMin: number; clientX: number; clientY: number } | null>(null);
  const [selectedTech, setSelectedTech] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [selectedPropertyName, setSelectedPropertyName] = useState<string | null>(null);
  const [nowInfo, setNowInfo] = useState<{ hours: number; minutes: number; label: string }>(getMountainNow);
  const [showInactiveTechs, setShowInactiveTechs] = useState(false);
  const ganttRef = useRef<HTMLDivElement>(null);

  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  const viewingToday = isToday(selectedDate);

  // ── Update "now" every 60 seconds ─────────────────────────────────────────
  useEffect(() => {
    if (!viewingToday) return;
    const timer = setInterval(() => setNowInfo(getMountainNow()), 60_000);
    return () => clearInterval(timer);
  }, [viewingToday]);

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

  // ── Today's tasks (with finish time) ──────────────────────────────────────
  const { data: todayTasks, isLoading: todayLoading } = useQuery({
    queryKey: ['maint-time-today', dateStr, selectedDepartment],
    queryFn: async () => {
      // Fetch tasks started on selected date (with or without finish)
      let query = supabase
        .from('breezeway_tasks')
        .select('breezeway_id, name, ai_title, property_name, created_at, started_at, finished_at, status_name, work_duration_minutes, ai_skill_category, priority, ai_guest_impact, department')
        .gte('started_at', utcDayStart)
        .lte('started_at', utcDayEnd)
        .not('started_at', 'is', null)
        .order('started_at', { ascending: true })
        .limit(500);
      if (selectedDepartment) query = query.eq('department', selectedDepartment);
      const { data: tasks, error } = await query;
      if (error) throw error;
      return (tasks ?? []) as Omit<RawTask, 'assignees'>[];
    },
  });

  // ── Carry-over in-progress tasks (started BEFORE today, still open) ────────
  const { data: carryOverTasks } = useQuery({
    queryKey: ['maint-carry-over', dateStr, selectedDepartment],
    enabled: viewingToday,
    queryFn: async () => {
      let query = supabase
        .from('breezeway_tasks')
        .select('breezeway_id, name, ai_title, property_name, created_at, started_at, finished_at, status_name, work_duration_minutes, ai_skill_category, priority, ai_guest_impact, department')
        .eq('status_name', 'In Progress')
        .lt('started_at', utcDayStart)
        .is('finished_at', null)
        .limit(100);
      if (selectedDepartment) query = query.eq('department', selectedDepartment);
      const { data, error } = await query;
      if (error) return [] as Omit<RawTask, 'assignees'>[];
      return (data ?? []) as Omit<RawTask, 'assignees'>[];
    },
  });

  // ── Fetch all assignments for today tasks + carry-over ─────────────────────
  const allTasksWithoutAssignees = useMemo(() => [
    ...(todayTasks ?? []),
    ...(carryOverTasks ?? []).map(t => ({ ...t, isCarryOver: true })),
  ], [todayTasks, carryOverTasks]);

  const { data: assignmentsData } = useQuery({
    queryKey: ['maint-time-assignments', dateStr, allTasksWithoutAssignees.length],
    enabled: allTasksWithoutAssignees.length > 0,
    queryFn: async () => {
      const ids = allTasksWithoutAssignees.map(t => t.breezeway_id);
      if (!ids.length) return [];
      const { data } = await supabase
        .from('breezeway_task_assignments')
        .select('task_id, assignee_id, assignee_name')
        .in('task_id', ids);
      return data ?? [];
    },
  });

  // Merge assignments into task objects
  const enrichedTasks = useMemo(() => {
    const assignMap = new Map<number, { name: string; id: string }[]>();
    (assignmentsData ?? []).forEach((a: any) => {
      if (!a.task_id || !a.assignee_name) return;
      if (!assignMap.has(a.task_id)) assignMap.set(a.task_id, []);
      assignMap.get(a.task_id)!.push({ name: a.assignee_name, id: String(a.assignee_id ?? '') });
    });

    return allTasksWithoutAssignees.map(t => ({
      ...t,
      assignees: (assignMap.get(t.breezeway_id) ?? []).map(a => ({ assignee_name: a.name })),
      isInProgress: t.status_name === 'In Progress' && !t.finished_at,
    })) as RawTask[];
  }, [allTasksWithoutAssignees, assignmentsData]);

  // ── Timeero shifts via RPC ─────────────────────────────────────────────────
  const { data: timeeroShifts } = useQuery({
    queryKey: ['maint-timeero-shifts', dateStr, selectedDepartment],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_timeero_shifts', {
        p_date: dateStr,
        p_department: selectedDepartment,
      });
      if (error) {
        console.error('[Timeero] RPC error:', error.message);
        return [] as { breezeway_name: string; clock_in: string; clock_out: string; job_name: string | null }[];
      }
      return (data ?? []) as { breezeway_name: string; clock_in: string; clock_out: string; job_name: string | null }[];
    },
  });

  // ── Tech daily efficiency via RPC ──────────────────────────────────────────
  const { data: techEfficiency } = useQuery({
    queryKey: ['tech-daily-efficiency', dateStr, selectedDepartment],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_tech_daily_efficiency', {
        p_date: dateStr,
        p_department: selectedDepartment,
      });
      if (error) {
        console.error('[TechEfficiency] RPC error:', error.message);
        return [] as TechEfficiency[];
      }
      return (data ?? []) as TechEfficiency[];
    },
  });

  // ── Mileage supplemental query ────────────────────────────────────────────
  const { data: mileageData } = useQuery({
    queryKey: ['tech-mileage', dateStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('timeero_timesheets')
        .select('user_id, mileage')
        .gte('clock_in_time', utcDayStart)
        .lte('clock_in_time', utcDayEnd);
      if (error) return [] as TechMileage[];

      const { data: idMap } = await supabase
        .from('cleaner_identity_map')
        .select('timeero_user_id, breezeway_assignee_name');

      const nameMap = new Map<string, string>();
      (idMap ?? []).forEach(r => {
        if (r.timeero_user_id && r.breezeway_assignee_name) {
          nameMap.set(String(r.timeero_user_id), r.breezeway_assignee_name);
        }
      });

      const totals = new Map<string, number>();
      (data ?? []).forEach(r => {
        const name = nameMap.get(String(r.user_id));
        if (name && r.mileage) {
          totals.set(name, (totals.get(name) ?? 0) + Number(r.mileage));
        }
      });

      return Array.from(totals.entries()).map(([breezeway_assignee_name, miles]) => ({
        breezeway_assignee_name,
        miles: Math.round(miles * 10) / 10,
      })) as TechMileage[];
    },
  });

  const mileageMap = useMemo(() => {
    const m = new Map<string, number>();
    (mileageData ?? []).forEach(r => m.set(r.breezeway_assignee_name, r.miles));
    return m;
  }, [mileageData]);

  const techEffMap = useMemo(() => {
    const m = new Map<string, TechEfficiency>();
    (techEfficiency ?? []).forEach(t => m.set(t.tech_name, t));
    return m;
  }, [techEfficiency]);

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
    if (!enrichedTasks.length && !timeeroShifts?.length) return [];

    const techMap = new Map<string, { name: string; id: string; blocks: TaskBlock[]; carryOver: RawTask[] }>();

    // Helper to ensure tech entry exists
    const ensureTech = (name: string, id: string) => {
      const key = `${id}|${name}`;
      if (!techMap.has(key)) techMap.set(key, { name, id, blocks: [], carryOver: [] });
      return key;
    };

    // Current Mountain time for in-progress "now" end
    const mtNow = nowInfo.hours * 60 + nowInfo.minutes;

    enrichedTasks.forEach(task => {
      if (!task.started_at) return;
      const assignees = (task.assignees as any[])?.length
        ? task.assignees as { assignee_name: string; assignee_id?: string }[]
        : [{ assignee_name: 'Unassigned', assignee_id: '' }];

      // Carry-over tasks (started before today) — don't draw as full block
      if (task.isCarryOver) {
        assignees.forEach(a => {
          const key = ensureTech(a.assignee_name, a.assignee_id ?? '');
          techMap.get(key)!.carryOver.push(task);
        });
        return;
      }

      // Convert UTC→Mountain for block positioning
      const startMin = utcIsoToMountainMinutes(task.started_at);
      let endMin: number;

      if (task.isInProgress && viewingToday) {
        // Extend to current MT time
        endMin = Math.max(mtNow, startMin + 5);
      } else if (task.finished_at) {
        endMin = utcIsoToMountainMinutes(task.finished_at);
      } else {
        endMin = startMin + (calcDur(task) ?? 30);
      }

      const durationMin = Math.max(endMin - startMin, 5);

      assignees.forEach(a => {
        const key = ensureTech(a.assignee_name, a.assignee_id ?? '');
        techMap.get(key)!.blocks.push({
          task,
          startMin,
          endMin,
          durationMin,
          assigneeName: a.assignee_name,
          isInProgress: task.isInProgress,
        });
      });
    });

    // Also add techs that only have timesheet data (no tasks)
    (timeeroShifts ?? []).forEach(shift => {
      const found = Array.from(techMap.values()).find(t => t.name === shift.breezeway_name);
      if (!found) {
        techMap.set(`|${shift.breezeway_name}`, { name: shift.breezeway_name, id: '', blocks: [], carryOver: [] });
      }
    });

    return Array.from(techMap.values())
      .map(({ name, id, blocks, carryOver }) => ({
        name,
        assigneeId: id,
        blocks: blocks.sort((a, b) => a.startMin - b.startMin),
        segments: shiftSegmentMap.get(name) ?? [],
        carryOverTasks: carryOver,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [enrichedTasks, shiftSegmentMap, timeeroShifts, nowInfo, viewingToday]);

  // ── Auto-detect time range from data ──────────────────────────────────────
  const { ganttStartHour, ganttEndHour, ganttTotalMin } = useMemo(() => {
    const allMins: number[] = [];
    ganttRows.forEach(row => {
      row.blocks.forEach(b => { allMins.push(b.startMin, b.endMin); });
      row.segments.forEach(s => { allMins.push(s.clockInMin, s.clockOutMin); });
    });

    // Also include now-line
    if (viewingToday) allMins.push(nowInfo.hours * 60 + nowInfo.minutes);

    if (allMins.length === 0) {
      return { ganttStartHour: DEFAULT_START_HOUR, ganttEndHour: DEFAULT_END_HOUR, ganttTotalMin: (DEFAULT_END_HOUR - DEFAULT_START_HOUR) * 60 };
    }

    const earliest = Math.min(...allMins);
    const latest   = Math.max(...allMins);
    const paddedStart = Math.max(0, earliest - 30);
    const paddedEnd   = Math.min(23 * 60 + 59, latest + 30);
    const startHour = Math.floor(paddedStart / 60);
    const endHour   = Math.ceil(paddedEnd / 60);
    const total = (endHour - startHour) * 60;
    return { ganttStartHour: startHour, ganttEndHour: endHour, ganttTotalMin: total };
  }, [ganttRows, viewingToday, nowInfo]);

  const pct = useCallback((min: number) => {
    const shifted = clamp(min - ganttStartHour * 60, 0, ganttTotalMin);
    return (shifted / ganttTotalMin) * 100;
  }, [ganttStartHour, ganttTotalMin]);

  const OFF_HOURS_END_MIN   = 7 * 60;
  const OFF_HOURS_START_MIN = 18 * 60;
  const offHoursEndPct   = pct(OFF_HOURS_END_MIN);
  const offHoursStartPct = pct(OFF_HOURS_START_MIN);

  // "Now" line position in Mountain Time
  const nowPct = useMemo(() => {
    if (!viewingToday) return null;
    const nowMin = nowInfo.hours * 60 + nowInfo.minutes;
    if (nowMin < ganttStartHour * 60 || nowMin > ganttEndHour * 60) return null;
    return pct(nowMin);
  }, [viewingToday, nowInfo, ganttStartHour, ganttEndHour, pct]);

  // ── Hour tick marks ────────────────────────────────────────────────────────
  const hourTicks = useMemo(() => Array.from({ length: ganttEndHour - ganttStartHour + 1 }, (_, i) => {
    const h = ganttStartHour + i;
    return {
      h,
      label: hourLabel(h),
      pctVal: ((h - ganttStartHour) / (ganttEndHour - ganttStartHour)) * 100,
    };
  }), [ganttStartHour, ganttEndHour]);

  // ── Alternating brand color helper ───────────────────────────────────────
  // (per-row index, so each tech alternates independently)
  function blockColor(idx: number): string {
    return idx % 2 === 0 ? BRAND_RED_PRIMARY : BRAND_RED_DARK;
  }


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
    const totalTaskMin  = eff.reduce((s, t) => s + (t.task_minutes ?? 0), 0);
    const totalShiftMin = eff.reduce((s, t) => s + (t.shift_minutes ?? 0), 0);
    const totalIdleMin  = eff.reduce((s, t) => s + (t.idle_minutes ?? 0), 0);
    const totalProps    = eff.reduce((s, t) => s + t.properties_visited, 0);
    const idlePct = totalShiftMin > 0 ? Math.round((totalIdleMin / totalShiftMin) * 100) : null;
    return { avgUtil, totalTaskMin, totalShiftMin, totalIdleMin, idlePct, totalProps, techsWithShift: withShift.length };
  }, [techEfficiency]);

  const handleBlockEnter = useCallback((e: React.MouseEvent, block: TaskBlock) => {
    setHoveredBlock({ block, clientX: e.clientX, clientY: e.clientY });
  }, []);

  const handleGapEnter = useCallback((e: React.MouseEvent, fromName: string, toName: string, gapMin: number) => {
    setHoveredGap({ fromName, toName, gapMin, clientX: e.clientX, clientY: e.clientY });
  }, []);

  const LEFT_COL_PX = 164;

  const handleBlockClick = useCallback((e: React.MouseEvent, block: TaskBlock) => {
    e.stopPropagation();
    setHoveredBlock(null);
    setSelectedTaskId(block.task.breezeway_id);
  }, []);

  const handlePropertyClick = useCallback((name: string) => {
    setHoveredBlock(null);
    setSelectedPropertyName(name);
  }, []);

  // ── All-dept counts query (unfiltered) — always reflects full day ─────────
  const { data: allDeptTasksForCounts } = useQuery({
    queryKey: ['maint-all-dept-counts', dateStr],
    queryFn: async () => {
      const { data: tasks } = await supabase
        .from('breezeway_tasks')
        .select('breezeway_id, department')
        .gte('started_at', utcDayStart)
        .lte('started_at', utcDayEnd)
        .not('started_at', 'is', null)
        .limit(1000);
      if (!tasks?.length) return [] as { department: string | null; assignees: string[] }[];

      const ids = tasks.map(t => t.breezeway_id);
      const { data: assignments } = await supabase
        .from('breezeway_task_assignments')
        .select('task_id, assignee_name')
        .in('task_id', ids);

      const assignMap = new Map<number, string[]>();
      (assignments ?? []).forEach((a: any) => {
        if (!assignMap.has(a.task_id)) assignMap.set(a.task_id, []);
        if (a.assignee_name) assignMap.get(a.task_id)!.push(a.assignee_name);
      });

      return tasks.map(t => ({
        department: t.department,
        assignees: assignMap.get(t.breezeway_id) ?? [],
      }));
    },
  });

  // ── Department counts for filter buttons — always from full-day data ────────
  const deptCounts = useMemo(() => {
    const source = allDeptTasksForCounts ?? [];
    const counts: Record<string, Set<string>> = {
      maintenance: new Set(),
      housekeeping: new Set(),
      inspection: new Set(),
    };
    source.forEach(t => {
      const dept = (t.department ?? '').toLowerCase();
      const assignees = t.assignees.length ? t.assignees : ['Unassigned'];
      assignees.forEach(name => {
        if (counts[dept]) counts[dept].add(name);
      });
    });
    const allNames = new Set([
      ...counts.maintenance,
      ...counts.housekeeping,
      ...counts.inspection,
    ]);
    return {
      all: allNames.size,
      maintenance: counts.maintenance.size,
      housekeeping: counts.housekeeping.size,
      inspection: counts.inspection.size,
    };
  }, [allDeptTasksForCounts]);

  // ── Dept badge helpers ────────────────────────────────────────────────────
  function getDeptBadge(task: RawTask): string {
    return (task.department ?? '').toLowerCase();
  }

  function techDeptLabel(blocks: TaskBlock[]): { label: string; cls: string } {
    if (!blocks.length) return { label: '', cls: '' };
    const depts = blocks.map(b => getDeptBadge(b.task)).filter(Boolean);
    const freq: Record<string, number> = {};
    depts.forEach(d => { freq[d] = (freq[d] ?? 0) + 1; });
    const unique = Object.keys(freq);
    if (unique.length === 0) return { label: '', cls: '' };
    if (unique.length > 1) return { label: 'Mixed', cls: 'bg-muted text-muted-foreground border-border' };
    const dept = unique[0];
    if (dept === 'maintenance') return { label: '🔧 Maintenance', cls: 'bg-blue-50 text-blue-700 border-blue-200' };
    if (dept === 'housekeeping') return { label: '🧹 Housekeeping', cls: 'bg-green-50 text-green-700 border-green-200' };
    if (dept === 'inspection') return { label: '🔍 Inspection', cls: 'bg-purple-50 text-purple-700 border-purple-200' };
    return { label: dept, cls: 'bg-muted text-muted-foreground border-border' };
  }

  // ── Filter bar config ─────────────────────────────────────────────────────
  const DEPT_FILTERS: { label: string; value: Department | null }[] = [
    { label: `All Teams (${deptCounts.all})`, value: null },
    { label: `Maintenance (${deptCounts.maintenance})`, value: 'maintenance' },
    { label: `Housekeeping (${deptCounts.housekeeping})`, value: 'housekeeping' },
    { label: `Inspection (${deptCounts.inspection})`, value: 'inspection' },
  ];

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
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
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
            <p className="text-[10px] text-muted-foreground">
              {rpcKpis.techsWithShift} techs with timesheet · {rpcKpis.totalProps} props
            </p>
          </div>

          {/* Card 2: Task Time (renamed from Wrench Time) */}
          <div className="glass-card p-3 sm:p-4">
            <div className="flex items-start gap-3 mb-2">
              <div className="p-2 rounded-lg shrink-0" style={{ backgroundColor: 'hsl(217 91% 60% / 0.1)' }}>
                <Timer className="h-4 w-4" style={{ color: 'hsl(217 91% 60%)' }} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground font-medium">Task Time</p>
                <p className="text-2xl font-bold text-foreground">
                  {rpcKpis.totalTaskMin > 0 ? fmtDur(rpcKpis.totalTaskMin) : '—'}
                </p>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">
              of {rpcKpis.totalShiftMin > 0 ? fmtDur(rpcKpis.totalShiftMin) : '—'} clocked
            </p>
          </div>

          {/* Card 3: Idle / Travel */}
          <div className="glass-card p-3 sm:p-4">
            <div className="flex items-start gap-3 mb-2">
              <div className="p-2 rounded-lg shrink-0" style={{ backgroundColor: 'hsl(38 92% 50% / 0.1)' }}>
                <Activity className="h-4 w-4" style={{ color: 'hsl(38 92% 50%)' }} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground font-medium">Idle / Travel</p>
                <p className="text-2xl font-bold text-foreground">
                  {rpcKpis.totalIdleMin > 0 ? fmtDur(rpcKpis.totalIdleMin) : '—'}
                </p>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">
              {rpcKpis.idlePct != null ? `${rpcKpis.idlePct}% unaccounted` : 'No shift data'}
            </p>
          </div>

          {/* Card 4: Team Mileage (NEW) */}
          {(() => {
            const totalMiles = (mileageData ?? []).reduce((s, r) => s + r.miles, 0);
            const techsWithMiles = (mileageData ?? []).filter(r => r.miles > 0).length;
            return (
              <div className="glass-card p-3 sm:p-4">
                <div className="flex items-start gap-3 mb-2">
                  <div className="p-2 rounded-lg shrink-0" style={{ backgroundColor: 'hsl(142 71% 45% / 0.1)' }}>
                    <Navigation className="h-4 w-4" style={{ color: 'hsl(142 71% 45%)' }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] text-muted-foreground font-medium">Team Mileage</p>
                    <p className="text-2xl font-bold text-foreground">
                      {totalMiles > 0 ? `${Math.round(totalMiles)} mi` : '—'}
                    </p>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {techsWithMiles > 0 ? `across ${techsWithMiles} techs` : 'No shift data'}
                </p>
              </div>
            );
          })()}

          {/* Card 5: Properties Served */}
          <div className="glass-card p-3 sm:p-4">
            <div className="flex items-start gap-3 mb-2">
              <div className="p-2 rounded-lg shrink-0" style={{ backgroundColor: 'hsl(271 81% 56% / 0.1)' }}>
                <BarChart2 className="h-4 w-4" style={{ color: 'hsl(271 81% 56%)' }} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground font-medium">Tasks Completed</p>
                <p className="text-2xl font-bold text-foreground">
                  {teamSummary.totalTasks > 0 ? teamSummary.totalTasks : '—'}
                </p>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">
              {teamSummary.techCount} techs · {teamSummary.totalProps} properties
            </p>
          </div>
        </div>
      </div>

      {/* ── Department Filter Bar ──────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground font-medium shrink-0">Department:</span>
        {DEPT_FILTERS.map(f => (
          <button
            key={String(f.value)}
            onClick={() => setSelectedDepartment(f.value)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              selectedDepartment === f.value
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* ── Gantt Timeline ─────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between">
          <SectionHeader
            icon={Clock}
            title="Daily Task Timeline"
            subtitle={`${format(selectedDate, 'EEEE, MMM d, yyyy')} · Mountain Time`}
          />
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showInactiveTechs}
              onChange={e => setShowInactiveTechs(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-border accent-primary"
            />
            Show inactive techs
            {!showInactiveTechs && ganttRows.length > 0 && (() => {
              const hidden = ganttRows.filter(r => r.blocks.length === 0 && r.segments.length === 0 && r.carryOverTasks.length === 0).length;
              return hidden > 0 ? <span className="text-muted-foreground/60">({hidden} hidden)</span> : null;
            })()}
          </label>
        </div>

        {todayLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-16 bg-muted rounded animate-pulse" />)}
          </div>
        ) : ganttRows.length === 0 ? (
          <div className="glass-card p-8 text-center">
            <Clock className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No {selectedDepartment ?? 'team'} tasks found for this date.</p>
          </div>
        ) : (
          <div className="glass-card p-4 overflow-hidden" ref={ganttRef}>

            {/* ── Team summary bar ──────────────────────────────────── */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 items-center text-[11px] text-muted-foreground mb-3">
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

            {/* ── TOP Time Axis ────────────────────────────────────────── */}
            <div style={{ paddingLeft: LEFT_COL_PX }}>
              <TimeAxis
                hourTicks={hourTicks}
                leftColPx={LEFT_COL_PX}
                nowPct={nowPct}
                nowLabel={viewingToday ? nowInfo.label : null}
              />
            </div>

            {/* ── Tech rows ─────────────────────────────────────────────── */}
            <div className="rounded-lg border border-border/50 overflow-hidden">
              {ganttRows.filter(row => showInactiveTechs || row.blocks.length > 0 || row.segments.length > 0 || row.carryOverTasks.length > 0).map((row, rowIdx) => {
                const { segments } = row;
                const hasNoTimesheet = segments.length === 0;

                const earliestIn = segments.length ? Math.min(...segments.map(s => s.clockInMin)) : null;
                const latestOut  = segments.length ? Math.max(...segments.map(s => s.clockOutMin)) : null;

                const isEven = rowIdx % 2 === 0;
                const rowBg = isEven ? 'bg-background' : 'bg-muted/20';

                const rpcRow = techEffMap.get(row.name);
                const rpcUtil = rpcRow ? rpcRow.utilization_pct : null;
                const dotColor = rpcUtil === null ? 'hsl(var(--muted-foreground))' : utilizationFill(rpcUtil);
                const miles = mileageMap.get(row.name) ?? null;

                return (
                  <div
                    key={row.name}
                    className={`flex items-stretch border-b border-border/40 last:border-b-0 ${rowBg} cursor-pointer hover:brightness-[0.97] transition-[filter]`}
                    style={{ minHeight: 64 }}
                    onClick={() => setSelectedTech(row.name)}
                  >
                    {/* ── Left: tech name + stats ─────────────────────── */}
                    <div
                      className="shrink-0 flex flex-col justify-center gap-0.5 px-2.5 py-2 border-r border-border/40"
                      style={{ width: LEFT_COL_PX }}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: dotColor }}
                          title={rpcUtil !== null ? `${rpcUtil}% utilization` : 'No timesheet'}
                        />
                        <p className="text-[11px] font-semibold text-foreground leading-tight truncate">{row.name}</p>
                      </div>

                      <p className="text-[9px] text-muted-foreground leading-tight pl-3.5">
                        {rpcRow ? `${rpcRow.task_count} tasks · ${rpcRow.properties_visited} props` : `${row.blocks.length} tasks`}
                        {miles !== null && miles > 0 ? ` · ${miles}mi` : ''}
                      </p>

                      {/* Department badge — only show in "All Teams" view */}
                      {selectedDepartment === null && (() => {
                        const { label, cls } = techDeptLabel(row.blocks);
                        return label ? (
                          <div className="pl-3.5">
                            <span className={`inline-flex items-center text-[8px] font-medium border rounded px-1 py-0.5 leading-none ${cls}`}>
                              {label}
                            </span>
                          </div>
                        ) : null;
                      })()}

                      {/* Carry-over badge */}
                      {row.carryOverTasks.length > 0 && (
                        <div
                          className="pl-3.5"
                          title={row.carryOverTasks.map(t => `${t.name || 'Task'} (started ${t.started_at ? format(parseISO(t.started_at), 'MMM d') : '?'})`).join('\n')}
                        >
                          <span className="inline-flex items-center gap-0.5 text-[8px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded px-1 py-0.5 leading-none">
                            <Wrench className="h-2 w-2" />
                            {row.carryOverTasks.length} carry-over
                          </span>
                        </div>
                      )}

                      {rpcRow && rpcRow.shift_minutes > 0 ? (
                        <>
                          <p className="text-[9px] text-muted-foreground leading-tight pl-3.5">
                            {fmtDur(Math.round(rpcRow.task_minutes))} task / {fmtDur(Math.round(rpcRow.shift_minutes))} shift
                          </p>
                          <div className="flex items-center gap-1 pl-3.5 mt-0.5">
                            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${Math.min(rpcRow.utilization_pct, 100)}%`,
                                  backgroundColor: utilizationFill(rpcRow.utilization_pct),
                                }}
                              />
                            </div>
                            <span className="text-[10px] font-bold shrink-0" style={{ color: utilizationFill(rpcRow.utilization_pct) }}>
                              {Math.round(rpcRow.utilization_pct)}%
                            </span>
                          </div>
                        </>
                      ) : rpcRow ? (
                        <p className="text-[9px] text-muted-foreground/60 italic leading-tight pl-3.5">no shift</p>
                      ) : null}
                    </div>

                    {/* ── Center: timeline track ───────────────────────── */}
                    <div className="flex-1 relative" style={{ minHeight: 64 }}>

                      {/* Off-hours shading — before 7 AM */}
                      {offHoursEndPct > 0 && (
                        <div
                          className="absolute top-0 bottom-0 pointer-events-none"
                          style={{
                            left: 0,
                            width: `${offHoursEndPct}%`,
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
                            right: 0,
                            background: 'repeating-linear-gradient(135deg, transparent, transparent 4px, rgba(0,0,0,0.04) 4px, rgba(0,0,0,0.04) 8px)',
                            backgroundColor: 'rgba(0,0,0,0.04)',
                          }}
                        />
                      )}

                      {/* "Outside shift" dark shade — before clock-in and after clock-out */}
                      {earliestIn !== null && (
                        <>
                          <div
                            className="absolute top-0 bottom-0 pointer-events-none"
                            style={{ left: 0, width: `${pct(earliestIn)}%`, backgroundColor: 'rgba(0,0,0,0.07)' }}
                          />
                          {latestOut !== null && (
                            <div
                              className="absolute top-0 bottom-0 pointer-events-none"
                              style={{ left: `${pct(latestOut)}%`, right: 0, backgroundColor: 'rgba(0,0,0,0.07)' }}
                            />
                          )}
                        </>
                      )}

                      {/* No-timesheet hatch overlay */}
                      {hasNoTimesheet && (
                        <div
                          className="absolute inset-0 pointer-events-none"
                          style={{ background: 'repeating-linear-gradient(45deg, transparent, transparent 8px, rgba(148,163,184,0.1) 8px, rgba(148,163,184,0.1) 10px)' }}
                        />
                      )}

                      {/* Hour grid lines */}
                      {hourTicks.map(tick => (
                        <div
                          key={tick.h}
                          className="absolute top-0 bottom-0 w-px pointer-events-none"
                          style={{
                            left: `${tick.pctVal}%`,
                            backgroundColor: tick.h === 12
                              ? 'hsl(var(--border) / 0.6)'
                              : 'hsl(var(--border) / 0.3)',
                            borderLeft: tick.h === 12 ? '1px dashed hsl(var(--border) / 0.6)' : undefined,
                          }}
                        />
                      ))}

                      {/* NOW line — Mountain Time */}
                      {nowPct !== null && (
                        <div
                          className="absolute top-0 bottom-0 w-0.5 z-20 pointer-events-none"
                          style={{ left: `${nowPct}%`, backgroundColor: 'hsl(var(--destructive))', boxShadow: '0 0 4px hsl(var(--destructive) / 0.5)' }}
                        />
                      )}

                      {/* Shift background bars + clock-in/out markers */}
                      {segments.map((seg, si) => {
                        const segLeft  = pct(seg.clockInMin);
                        const segRight = pct(seg.clockOutMin);
                        const segWidth = Math.max(segRight - segLeft, 0);
                        return (
                          <div key={si}>
                            {/* Shift outline — full-height blue border */}
                            <div
                              className="absolute pointer-events-none z-[5]"
                              style={{
                                left: `${segLeft}%`,
                                width: `${segWidth}%`,
                                top: 2, bottom: 2,
                                backgroundColor: 'rgba(59,130,246,0.06)',
                                border: '2px solid rgba(59,130,246,0.5)',
                                borderRadius: 4,
                              }}
                            />
                            {/* Clock-in solid marker line */}
                            <div
                              className="absolute top-0 bottom-0 pointer-events-none z-10"
                              style={{
                                left: `${segLeft}%`,
                                width: 2.5,
                                backgroundColor: 'rgba(59,130,246,0.9)',
                                borderRadius: '2px 0 0 2px',
                              }}
                            />
                            {/* Clock-in time label */}
                            <span
                              className="absolute text-[8px] font-bold pointer-events-none select-none z-20"
                              style={{ left: `calc(${segLeft}% + 4px)`, top: '2px', color: 'rgba(37,99,235,1)' }}
                            >
                              🕐 {fmtHHMM(seg.clockInStr)}
                            </span>
                            {/* Clock-out solid marker line */}
                            <div
                              className="absolute top-0 bottom-0 pointer-events-none z-10"
                              style={{
                                left: `calc(${segRight}% - 2.5px)`,
                                width: 2.5,
                                backgroundColor: 'rgba(59,130,246,0.9)',
                                borderRadius: '0 2px 2px 0',
                              }}
                            />
                            {/* Clock-out time label */}
                            <span
                              className="absolute text-[8px] font-bold pointer-events-none select-none z-20"
                              style={{ right: `calc(${100 - segRight}% + 4px)`, top: '2px', color: 'rgba(37,99,235,1)' }}
                            >
                              {fmtHHMM(seg.clockOutStr)} 🕐
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

                      {/* Pre-task gap: clock-in → first task */}
                      {earliestIn !== null && row.blocks.length > 0 && (() => {
                        const firstBlock = row.blocks[0];
                        const preGapMin = firstBlock.startMin - earliestIn;
                        if (preGapMin < 5) return null;
                        const gapLeft = pct(earliestIn);
                        const gapRight = pct(firstBlock.startMin);
                        const gapWidthPct = gapRight - gapLeft;
                        return (
                          <div
                            key="pre-gap"
                            className="absolute top-1/2 -translate-y-1/2 pointer-events-none"
                            style={{ left: `${gapLeft}%`, width: `${gapWidthPct}%`, height: 20 }}
                          >
                            <div className="absolute" style={{ top: '50%', left: 0, right: 0, borderTop: '1.5px dashed rgba(148,163,184,0.55)' }} />
                            {gapWidthPct > 3 && (
                              <span
                                className="absolute -translate-x-1/2 -translate-y-1/2 bg-gray-100 text-gray-600 text-[8px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap z-10"
                                style={{ top: '50%', left: '50%' }}
                              >
                                {fmtDur(preGapMin)}
                              </span>
                            )}
                          </div>
                        );
                      })()}

                      {/* Gap connectors between tasks */}
                      {row.blocks.map((block, idx) => {
                        if (idx === 0) return null;
                        const prev = row.blocks[idx - 1];
                        const gapMin = block.startMin - prev.endMin;
                        if (gapMin < 5) return null;
                        const duringShift = segments.some(
                          seg => prev.endMin >= seg.clockInMin && block.startMin <= seg.clockOutMin
                        );
                        if (!duringShift && segments.length > 0) return null;

                        const gapLeft  = pct(prev.endMin);
                        const gapRight = pct(block.startMin);
                        const gapWidthPct = gapRight - gapLeft;

                        return (
                          <div
                            key={`gap-${idx}`}
                            className="absolute top-1/2 -translate-y-1/2 cursor-pointer"
                            style={{ left: `${gapLeft}%`, width: `${gapWidthPct}%`, height: 20 }}
                            onClick={e => e.stopPropagation()}
                            onMouseEnter={e => handleGapEnter(e, prev.task.ai_title || prev.task.name || 'Task', block.task.ai_title || block.task.name || 'Task', gapMin)}
                            onMouseLeave={() => setHoveredGap(null)}
                          >
                            <div className="absolute" style={{ top: '50%', left: 0, right: 0, borderTop: '1.5px dashed rgba(148,163,184,0.55)' }} />
                            {gapMin >= 5 && gapWidthPct > 3 && (
                              <span
                                className="absolute -translate-x-1/2 -translate-y-1/2 bg-gray-100 text-gray-600 text-[8px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap z-10 pointer-events-none"
                                style={{ top: '50%', left: '50%' }}
                              >
                                {fmtDur(gapMin)}
                              </span>
                            )}
                          </div>
                        );
                      })}

                      {/* Post-task gap: last task → clock-out */}
                      {latestOut !== null && row.blocks.length > 0 && (() => {
                        const lastBlock = row.blocks[row.blocks.length - 1];
                        const postGapMin = latestOut - lastBlock.endMin;
                        if (postGapMin < 5) return null;
                        const gapLeft = pct(lastBlock.endMin);
                        const gapRight = pct(latestOut);
                        const gapWidthPct = gapRight - gapLeft;
                        return (
                          <div
                            key="post-gap"
                            className="absolute top-1/2 -translate-y-1/2 pointer-events-none"
                            style={{ left: `${gapLeft}%`, width: `${gapWidthPct}%`, height: 20 }}
                          >
                            <div className="absolute" style={{ top: '50%', left: 0, right: 0, borderTop: '1.5px dashed rgba(148,163,184,0.55)' }} />
                            {gapWidthPct > 3 && (
                              <span
                                className="absolute -translate-x-1/2 -translate-y-1/2 bg-gray-100 text-gray-600 text-[8px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap z-10"
                                style={{ top: '50%', left: '50%' }}
                              >
                                {fmtDur(postGapMin)}
                              </span>
                            )}
                          </div>
                        );
                      })()}

                      {/* Task blocks */}
                      {row.blocks.map((block, idx) => {
                        const leftPct     = pct(block.startMin);
                        const rightPct    = pct(block.endMin);
                        const rawWidthPct = Math.max(rightPct - leftPct, 0.25);
                        const propKey     = block.task.property_name || 'Unknown';
                        // Alternating Renjoy brand reds per row position
                        const color       = blockColor(idx);
                        const isGuest     = block.task.ai_guest_impact;
                        const trackWidth  = ganttRef.current?.clientWidth ?? 800;
                        const approxWidthPx = (rawWidthPct / 100) * (trackWidth - LEFT_COL_PX) - 4;
                        const isVeryShort = approxWidthPx < 8;
                        const isNarrow    = approxWidthPx >= 8  && approxWidthPx < 30;
                        const isMedNarrow = approxWidthPx >= 30 && approxWidthPx < 60;
                        const isMedium    = approxWidthPx >= 60 && approxWidthPx < 120;
                        const isWide      = approxWidthPx >= 120;
                        const isIP        = block.isInProgress;

                        // "Resumed" = created on a prior day but started today
                        const isResumed = (() => {
                          const t = block.task;
                          if (!t.started_at) return false;
                          const createdDate = t.created_at ? (t.created_at as string).slice(0, 10) : null;
                          const startedDate = (t.started_at as string).slice(0, 10);
                          return createdDate !== null && createdDate < startedDate;
                        })();

                        const outsideShift = segments.length > 0 && !segments.some(
                          seg => block.startMin >= seg.clockInMin && block.endMin <= seg.clockOutMin
                        );

                        // Label to show inside the block based on width
                        let blockLabel: string | null = null;
                        if (isVeryShort) {
                          blockLabel = null; // rely on tooltip only
                        } else if (isNarrow) {
                          blockLabel = propKey.slice(0, 1); // single letter
                        } else if (isMedNarrow) {
                          blockLabel = propKey.slice(0, 3) + (propKey.length > 3 ? '…' : '');
                        } else if (isMedium) {
                          blockLabel = propKey.length > 12 ? propKey.slice(0, 10) + '…' : propKey;
                        } else if (isWide) {
                          blockLabel = propKey; // full name
                        }

                        // In-progress background: diagonal stripe on solid red
                        const ipBackground = isIP
                          ? `repeating-linear-gradient(45deg, ${color}, ${color} 8px, ${color}cc 8px, ${color}cc 16px)`
                          : color;

                        return (
                          <div
                            key={`${block.task.breezeway_id}-${block.assigneeName}-${idx}`}
                            className="absolute overflow-hidden cursor-pointer transition-[filter,transform] hover:brightness-110 hover:scale-y-105 hover:z-20"
                            style={{
                              left: `${leftPct}%`,
                              width: isVeryShort
                                ? `max(8px, calc(${rawWidthPct}% - 2px))`
                                : `calc(${rawWidthPct}% - 3px)`,
                              top: '18%',
                              bottom: '18%',
                              borderRadius: 4,
                              background: ipBackground,
                              border: `1px solid ${color}`,
                              // In-progress: dashed right border
                              borderRight: isIP ? `2px dashed rgba(255,255,255,0.7)` : `1px solid ${color}`,
                              outline: isGuest
                                ? '2px solid hsl(var(--destructive))'
                                : outsideShift ? '2px solid hsl(45 100% 55%)' : undefined,
                              zIndex: 10,
                            }}
                            onClick={e => handleBlockClick(e, block)}
                            onMouseEnter={e => handleBlockEnter(e, block)}
                            onMouseLeave={() => setHoveredBlock(null)}
                          >
                            {/* In-progress pulsing right-edge glow */}
                            {isIP && (
                              <div
                                className="absolute right-0 top-0 bottom-0 w-4 animate-pulse pointer-events-none"
                                style={{ background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.35))' }}
                              />
                            )}

                            {/* Block label content */}
                            {!isVeryShort && blockLabel !== null && (
                              <div className="absolute inset-0 flex flex-col justify-center px-1 pointer-events-none select-none overflow-hidden">
                                {/* Resumed indicator — top-left */}
                                {isResumed && (
                                  <span className="absolute top-0.5 left-0.5 text-[9px] leading-none text-white/80">↩</span>
                                )}
                                {/* In-progress label — top-right */}
                                {isIP && approxWidthPx >= 40 && (
                                  <span className="absolute top-0.5 right-0.5 text-[8px] leading-none text-white/80 font-medium">⏱</span>
                                )}
                                {/* Property name */}
                                <span
                                  className="font-semibold text-white drop-shadow-sm truncate leading-tight"
                                  style={{ fontSize: (isNarrow || isMedNarrow) ? '9px' : isMedium ? '9px' : '10px' }}
                                >
                                  {blockLabel}
                                </span>
                                {/* Task name on second line — only wide blocks */}
                                {isWide && (block.task.ai_title || block.task.name) && (
                                  <span className="text-[8px] text-white/75 truncate leading-tight mt-0.5">
                                    {(block.task.ai_title || block.task.name || '').slice(0, 28)}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── BOTTOM Time Axis ──────────────────────────────────────── */}
            <div style={{ paddingLeft: LEFT_COL_PX }}>
              <TimeAxis
                hourTicks={hourTicks}
                leftColPx={LEFT_COL_PX}
                nowPct={nowPct}
                nowLabel={null}
                isBottom
              />
            </div>

            {/* Hover tooltips */}
            {hoveredBlock && !hoveredGap && (
              <GanttBlockTooltip
                block={hoveredBlock.block}
                clientX={hoveredBlock.clientX}
                clientY={hoveredBlock.clientY}
                onPropertyClick={handlePropertyClick}
              />
            )}
            {hoveredGap && (
              <GapTooltip
                fromName={hoveredGap.fromName}
                toName={hoveredGap.toName}
                gapMin={hoveredGap.gapMin}
                clientX={hoveredGap.clientX}
                clientY={hoveredGap.clientY}
              />
            )}
          </div>
        )}

        {/* ── Legend ─────────────────────────────────────────────────── */}
        {ganttRows.length > 0 && (
          <div className="mt-4 pt-3 border-t border-border flex flex-wrap gap-x-5 gap-y-2 items-center">
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-8 rounded-sm shrink-0" style={{ background: BRAND_RED_PRIMARY, borderRadius: 3 }} />
              <span className="text-[10px] text-muted-foreground">Completed</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-8 rounded-sm shrink-0" style={{ background: `repeating-linear-gradient(45deg, ${BRAND_RED_PRIMARY}, ${BRAND_RED_PRIMARY} 4px, ${BRAND_RED_PRIMARY}cc 4px, ${BRAND_RED_PRIMARY}cc 8px)`, borderRight: '2px dashed rgba(255,255,255,0.7)', borderRadius: 3 }} />
              <span className="text-[10px] text-muted-foreground">In Progress</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-8 shrink-0" style={{ backgroundColor: 'rgba(59,130,246,0.15)', border: '1.5px solid rgba(59,130,246,0.4)', borderRadius: 2 }} />
              <span className="text-[10px] text-muted-foreground">Clocked Shift</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ outline: '2px solid hsl(45 100% 55%)', outlineOffset: '-1px', background: BRAND_RED_PRIMARY }} />
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
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-medium" style={{ color: BRAND_RED_PRIMARY }}>↩</span>
              <span className="text-[10px] text-muted-foreground">Resumed task</span>
            </div>
            <div className="flex items-center gap-3 ml-2">
              <span className="text-[10px] text-muted-foreground">Util:</span>
              <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[hsl(142,71%,45%)]" /><span className="text-[10px] text-muted-foreground">≥70%</span></span>
              <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[hsl(45,93%,47%)]" /><span className="text-[10px] text-muted-foreground">50–69%</span></span>
              <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-destructive" /><span className="text-[10px] text-muted-foreground">&lt;50%</span></span>
            </div>
          </div>
        )}
      </div>

      {/* ── Tech Detail Panel ──────────────────────────────────────────── */}
      {selectedTech && (
        <TechDetailPanel
          techName={selectedTech}
          department={selectedDepartment}
          onClose={() => setSelectedTech(null)}
          onTaskClick={(id) => setSelectedTaskId(id)}
          onPropertyClick={(name) => setSelectedPropertyName(name)}
        />
      )}

      {/* ── Task Detail Sheet ──────────────────────────────────────────── */}
      <TaskDetailSheet
        taskId={selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
      />

      {/* ── Property Detail Sheet ──────────────────────────────────────── */}
      {selectedPropertyName && (
        <PropertyDetailSheet
          propertyName={selectedPropertyName}
          onClose={() => setSelectedPropertyName(null)}
        />
      )}
    </div>
  );
}

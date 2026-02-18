import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { differenceInMinutes, differenceInDays, formatDistanceToNow, parseISO } from 'date-fns';
import { CheckCircle2, Clock, Flame, AlertCircle, ExternalLink, UserX } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

// ─── Types ────────────────────────────────────────────────────────────────────
interface PulseTask {
  breezeway_id: number;
  property_name: string | null;
  name: string | null;
  status_code: string | null;
  priority: string | null;
  created_at: string | null;
  report_url: string | null;
  ai_guest_impact: boolean | null;
}

interface PulseStats {
  open_tasks: number;
  completed_today: number;
  avg_response_minutes: number | null;
}

interface UnassignedTask {
  breezeway_id: number;
  property_name: string | null;
  name: string | null;
  created_at: string | null;
  report_url: string | null;
  priority: string | null;
}

interface MaintenancePulseProps {
  /** When true, renders in compact card mode for embedding at top of other pages */
  compact?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtMinutes(mins: number | null): string {
  if (!mins || mins <= 0) return '—';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function isFireTask(t: PulseTask): boolean {
  return (
    t.ai_guest_impact === true ||
    t.priority === 'urgent' ||
    (t.name?.toLowerCase().includes('guest') && t.priority === 'high') ||
    false
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  icon: Icon,
  danger,
  dangerBg,
  sub,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  danger?: boolean;
  dangerBg?: boolean;
  sub?: string;
}) {
  const base = dangerBg
    ? 'bg-destructive text-destructive-foreground border-destructive'
    : danger
    ? 'bg-card border-destructive/40 text-foreground'
    : 'bg-card border-border text-foreground';

  return (
    <div className={`rounded-xl border p-4 flex flex-col gap-1 ${base} min-h-[88px] active:opacity-80`}>
      <div className="flex items-center justify-between">
        <span className={`text-xs font-semibold uppercase tracking-wider ${dangerBg ? 'text-destructive-foreground/80' : 'text-muted-foreground'}`}>
          {label}
        </span>
        <Icon className={`h-4 w-4 shrink-0 ${dangerBg ? 'text-destructive-foreground/70' : danger ? 'text-destructive' : 'text-muted-foreground'}`} />
      </div>
      <span className={`text-3xl font-black tracking-tight leading-none ${danger && !dangerBg ? 'text-destructive' : ''}`}>
        {value}
      </span>
      {sub && (
        <span className={`text-xs ${dangerBg ? 'text-destructive-foreground/70' : 'text-muted-foreground'}`}>{sub}</span>
      )}
    </div>
  );
}

function PriorityBadge({ priority, guestImpact }: { priority: string | null; guestImpact?: boolean | null }) {
  if (guestImpact) return <Badge className="text-[10px] px-1.5 py-0 h-4 bg-destructive text-destructive-foreground shrink-0">GUEST</Badge>;
  if (priority === 'urgent') return <Badge className="text-[10px] px-1.5 py-0 h-4 bg-destructive text-destructive-foreground shrink-0">URGENT</Badge>;
  if (priority === 'high') return <Badge className="text-[10px] px-1.5 py-0 h-4 bg-warning/90 text-foreground shrink-0">HIGH</Badge>;
  return null;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function MaintenancePulse({ compact = false }: MaintenancePulseProps) {
  // Single query for stats + all open tasks
  const { data: openTasks = [], isLoading: loadingOpen } = useQuery({
    queryKey: ['pulse-open-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('breezeway_tasks')
        .select('breezeway_id, property_name, name, status_code, priority, created_at, report_url, ai_guest_impact')
        .eq('department', 'maintenance')
        .in('status_code', ['created', 'in_progress'])
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as PulseTask[];
    },
    staleTime: 2 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ['pulse-stats'],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from('breezeway_tasks')
        .select('status_code, finished_at, response_time_minutes')
        .eq('department', 'maintenance')
        .or(`status_code.in.(created,in_progress),and(status_code.eq.finished,finished_at.gte.${today})`);
      if (error) throw error;
      const rows = data ?? [];
      const completedToday = rows.filter(
        (r) => r.status_code === 'finished' && r.finished_at?.startsWith(today)
      ).length;
      const responseTimes = rows
        .map((r) => r.response_time_minutes)
        .filter((v): v is number => typeof v === 'number' && v > 0 && v < 10000);
      const avgResponse = responseTimes.length
        ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
        : null;
      return { open_tasks: openTasks.length, completed_today: completedToday, avg_response_minutes: avgResponse } as PulseStats;
    },
    staleTime: 2 * 60 * 1000,
    enabled: !loadingOpen,
  });

  // Unassigned tasks — separate lightweight query
  const { data: unassignedRaw = [] } = useQuery({
    queryKey: ['pulse-unassigned'],
    queryFn: async () => {
      // Get tasks with no assignments via a minimal join workaround
      const { data: assigned, error: ae } = await supabase
        .from('breezeway_task_assignments')
        .select('task_id')
        .not('task_id', 'is', null);
      if (ae) throw ae;
      const assignedSet = new Set((assigned ?? []).map((a) => a.task_id));
      return openTasks.filter((t) => !assignedSet.has(t.breezeway_id)) as UnassignedTask[];
    },
    staleTime: 2 * 60 * 1000,
    enabled: openTasks.length > 0,
  });

  const fireTasks = openTasks.filter(isFireTask).slice(0, 5);
  const unassigned = unassignedRaw.slice(0, 5);
  const openCount = openTasks.length;
  const unassignedCount = unassignedRaw.length;
  const isLoading = loadingOpen || loadingStats;

  if (isLoading) {
    return (
      <div className={`${compact ? 'p-3' : 'p-4'} space-y-3`}>
        <div className="grid grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card h-[88px] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`${compact ? 'px-0 py-0' : 'p-4 max-w-lg mx-auto'} space-y-4`}>
      {!compact && (
        <div className="flex items-center gap-2 mb-2">
          <Flame className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-black tracking-tight">Maintenance Pulse</h2>
          <span className="text-xs text-muted-foreground ml-auto">Live</span>
        </div>
      )}

      {/* ROW 1 & 2 — KPI cards */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Open Tasks"
          value={openCount}
          icon={AlertCircle}
          danger={openCount > 20}
          dangerBg={false}
          sub={openCount > 20 ? 'Needs attention' : 'Active'}
        />
        <StatCard
          label="Unassigned"
          value={unassignedCount}
          icon={UserX}
          danger={unassignedCount > 0}
          dangerBg={unassignedCount > 0}
          sub={unassignedCount > 0 ? 'Need assignment' : 'All covered'}
        />
        <StatCard
          label="Done Today"
          value={stats?.completed_today ?? 0}
          icon={CheckCircle2}
          sub="Completed"
        />
        <StatCard
          label="Avg Response"
          value={fmtMinutes(stats?.avg_response_minutes ?? null)}
          icon={Clock}
          sub="All time"
        />
      </div>

      {/* ROW 3 — Fires */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-destructive/5">
          <Flame className="h-4 w-4 text-destructive" />
          <span className="text-sm font-bold text-destructive">Fires</span>
          <span className="text-xs text-muted-foreground ml-auto">
            {fireTasks.length === 0 ? 'None 🎉' : `${fireTasks.length} urgent`}
          </span>
        </div>
        {fireTasks.length === 0 ? (
          <div className="px-4 py-5 text-center text-sm text-muted-foreground">
            No guest-impacting or urgent tasks open right now.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {fireTasks.map((t) => (
              <li key={t.breezeway_id}>
                <a
                  href={t.report_url ?? '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 px-4 py-3.5 active:bg-accent hover:bg-accent/50 transition-colors min-h-[56px]"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <PriorityBadge priority={t.priority} guestImpact={t.ai_guest_impact} />
                      <span className="text-xs text-muted-foreground truncate">
                        {t.property_name ?? 'Unknown Property'}
                      </span>
                    </div>
                    <p className="text-sm font-semibold leading-snug truncate text-foreground">
                      {t.name ?? 'Untitled Task'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Open {t.created_at ? formatDistanceToNow(parseISO(t.created_at), { addSuffix: false }) : '—'}
                    </p>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ROW 4 — Unassigned quick list */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/40">
          <UserX className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-bold">Unassigned</span>
          <span className="text-xs text-muted-foreground ml-auto">Oldest first</span>
        </div>
        {unassigned.length === 0 ? (
          <div className="px-4 py-5 text-center text-sm text-muted-foreground">
            All open tasks are assigned.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {unassigned.map((t) => {
              const daysOpen = t.created_at
                ? differenceInDays(new Date(), parseISO(t.created_at))
                : null;
              return (
                <li key={t.breezeway_id}>
                  <a
                    href={t.report_url ?? '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-3 px-4 py-3.5 active:bg-accent hover:bg-accent/50 transition-colors min-h-[56px]"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground truncate mb-0.5">
                        {t.property_name ?? 'Unknown Property'}
                      </p>
                      <p className="text-sm font-semibold leading-snug truncate text-foreground">
                        {t.name ?? 'Untitled Task'}
                      </p>
                      <p className={`text-xs mt-0.5 font-medium ${daysOpen !== null && daysOpen > 3 ? 'text-destructive' : 'text-muted-foreground'}`}>
                        {daysOpen !== null ? `${daysOpen}d unassigned` : 'Unknown age'}
                      </p>
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

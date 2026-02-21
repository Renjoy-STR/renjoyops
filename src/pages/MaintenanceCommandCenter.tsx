import { useState } from 'react';
import { useMaintenanceStats, useMaintenanceAttention, useMaintenanceActivity } from '@/hooks/supabase';
import { KPICard } from '@/components/dashboard/KPICard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TaskDetailSheet } from '@/components/maintenance/TaskDetailSheet';
import { AlertTriangle, Clock, CheckCircle2, UserX, CalendarX, Zap, ExternalLink } from 'lucide-react';
import { format, startOfDay, subDays, parseISO } from 'date-fns';

type TimeFilter = 'today' | '7d' | '30d' | 'all';

function getFilterDates(filter: TimeFilter) {
  const now = new Date();
  const todayStart = startOfDay(now);
  switch (filter) {
    case 'today': return { from: todayStart.toISOString(), to: now.toISOString(), label: 'Today' };
    case '7d': return { from: subDays(todayStart, 7).toISOString(), to: now.toISOString(), label: 'Last 7 Days' };
    case '30d': return { from: subDays(todayStart, 30).toISOString(), to: now.toISOString(), label: 'Last 30 Days' };
    case 'all': return { from: '2024-01-01T00:00:00Z', to: now.toISOString(), label: 'All Time' };
  }
}

const PRIORITY_BADGE: Record<string, 'destructive' | 'default' | 'secondary' | 'outline'> = {
  urgent: 'destructive',
  high: 'default',
  normal: 'secondary',
  low: 'outline',
};

export default function MaintenanceCommandCenter() {
  const [openTaskId, setOpenTaskId] = useState<number | null>(null);
  const [openPropertyName, setOpenPropertyName] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('today');
  const { from, to, label } = getFilterDates(timeFilter);

  // --- Data Hooks ---
  const { data: stats } = useMaintenanceStats(from, to, timeFilter);
  const { data: attentionTasks, isLoading: loadingAttention } = useMaintenanceAttention();
  const { data: activityFeed, isLoading: loadingFeed } = useMaintenanceActivity(from, to, timeFilter);

  const formatResponseTime = (minutes: number) => {
    if (minutes === 0) return '—';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m}m`;
    return `${h}h ${m}m`;
  };

  const feedDotColor = (type: string) => {
    switch (type) {
      case 'created': return 'bg-[hsl(var(--warning))]';
      case 'started': return 'bg-[hsl(212,72%,59%)]';
      case 'completed': return 'bg-[hsl(var(--success))]';
      default: return 'bg-muted-foreground';
    }
  };

  const feedLabel = (type: string) => {
    switch (type) {
      case 'created': return 'Created';
      case 'started': return 'Started';
      case 'completed': return 'Completed';
      default: return type;
    }
  };

  return (
    <>
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Maintenance Command Center</h2>
          <p className="text-sm text-muted-foreground">Daily operations view — triage, track, resolve</p>
        </div>
        <div className="flex gap-1">
          {([
            { key: 'today' as TimeFilter, label: 'Today' },
            { key: '7d' as TimeFilter, label: '7 Days' },
            { key: '30d' as TimeFilter, label: '30 Days' },
            { key: 'all' as TimeFilter, label: 'All Time' },
          ]).map(f => (
            <Button
              key={f.key}
              variant={timeFilter === f.key ? 'default' : 'ghost'}
              size="sm"
              className="h-7 px-2.5 text-xs"
              onClick={() => setTimeFilter(f.key)}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      {/* STAT CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="glass-card p-3 sm:p-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider">New Issues</p>
              <p className="text-lg sm:text-2xl font-bold text-foreground">{stats?.newIssues ?? '—'}</p>
            </div>
            <div className={`p-1.5 rounded-lg ${(stats?.newIssues ?? 0) > 5 ? 'bg-destructive' : 'bg-accent'}`}>
              <AlertTriangle className={`h-4 w-4 ${(stats?.newIssues ?? 0) > 5 ? 'text-destructive-foreground' : 'text-secondary'}`} />
            </div>
          </div>
          {(stats?.newIssues ?? 0) > 5 && (
            <Badge variant="destructive" className="mt-1 text-[9px] px-1 py-0">High Volume</Badge>
          )}
        </div>

        <div className="glass-card p-3 sm:p-4">
          <div className="space-y-1">
            <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider">In Progress</p>
            <p className="text-lg sm:text-2xl font-bold text-foreground">{stats?.inProgress ?? '—'}</p>
          </div>
        </div>

        <div className="glass-card p-3 sm:p-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider">Completed</p>
              <p className="text-lg sm:text-2xl font-bold text-foreground">{stats?.completed ?? '—'}</p>
            </div>
            <div className="p-1.5 rounded-lg bg-accent hidden sm:block">
              <CheckCircle2 className="h-4 w-4 text-secondary" />
            </div>
          </div>
        </div>

        <div className={`glass-card p-3 sm:p-4 ${(stats?.unassigned ?? 0) > 0 ? 'border-destructive bg-destructive/5' : ''}`}>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider">Unassigned</p>
              <p className={`text-lg sm:text-2xl font-bold ${(stats?.unassigned ?? 0) > 0 ? 'text-destructive' : 'text-foreground'}`}>
                {stats?.unassigned ?? '—'}
              </p>
            </div>
            <div className={`p-1.5 rounded-lg ${(stats?.unassigned ?? 0) > 0 ? 'bg-destructive' : 'bg-accent'}`}>
              <UserX className={`h-4 w-4 ${(stats?.unassigned ?? 0) > 0 ? 'text-destructive-foreground' : 'text-secondary'}`} />
            </div>
          </div>
        </div>

        <div className={`glass-card p-3 sm:p-4 ${(stats?.overdue ?? 0) > 0 ? 'border-destructive bg-destructive/5' : ''}`}>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider">Overdue</p>
              <p className={`text-lg sm:text-2xl font-bold ${(stats?.overdue ?? 0) > 0 ? 'text-destructive' : 'text-foreground'}`}>
                {stats?.overdue ?? '—'}
              </p>
            </div>
            <div className={`p-1.5 rounded-lg ${(stats?.overdue ?? 0) > 0 ? 'bg-destructive' : 'bg-accent'}`}>
              <CalendarX className={`h-4 w-4 ${(stats?.overdue ?? 0) > 0 ? 'text-destructive-foreground' : 'text-secondary'}`} />
            </div>
          </div>
        </div>

        <div className="glass-card p-3 sm:p-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider">Avg Response</p>
              <p className="text-lg sm:text-2xl font-bold text-foreground">{formatResponseTime(stats?.avgResponseMin ?? 0)}</p>
            </div>
            <div className="p-1.5 rounded-lg bg-accent hidden sm:block">
              <Clock className="h-4 w-4 text-secondary" />
            </div>
          </div>
        </div>
      </div>

      {/* NEEDS IMMEDIATE ATTENTION */}
      <div className="glass-card rounded-lg">
        <div className="p-4 pb-2 flex items-center gap-2">
          <Zap className="h-4 w-4 text-destructive" />
          <h3 className="text-sm font-bold">Needs Immediate Attention</h3>
          <Badge variant="destructive" className="text-[9px] px-1.5 py-0 h-4 ml-1">
            {attentionTasks?.length ?? 0}
          </Badge>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Property</TableHead>
                <TableHead className="text-xs">Task</TableHead>
                <TableHead className="text-xs hidden sm:table-cell">Created</TableHead>
                <TableHead className="text-xs">Priority</TableHead>
                <TableHead className="text-xs hidden md:table-cell">Urgency</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs text-right">Days Open</TableHead>
                <TableHead className="text-xs w-8"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingAttention ? (
                <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">Loading...</TableCell></TableRow>
              ) : !attentionTasks?.length ? (
                <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">Nothing needs immediate attention!</TableCell></TableRow>
              ) : (
                attentionTasks.slice(0, 30).map(t => (
                  <TableRow key={`${t.breezeway_id}-attn`} className={`cursor-pointer hover:bg-accent/50 transition-colors ${t.isOverdue ? 'bg-destructive/5' : ''}`} onClick={() => setOpenTaskId(t.breezeway_id)}>
                    <TableCell className="text-xs font-medium max-w-[120px] truncate cursor-pointer text-primary hover:underline" onClick={(e) => { e.stopPropagation(); setOpenPropertyName(t.property_name || null); }}>{t.property_name || 'Unknown'}</TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate">{t.ai_title || t.name || 'Untitled'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground hidden sm:table-cell">
                      {t.created_at ? format(parseISO(t.created_at), 'MMM d') : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={PRIORITY_BADGE[t.priority ?? 'normal'] ?? 'secondary'} className="text-[9px] capitalize">
                        {t.priority ?? 'normal'}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {t.ai_guest_impact && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium bg-destructive text-destructive-foreground">
                          guest-impacting
                        </span>
                      )}
                      {!t.ai_guest_impact && t.priority === 'urgent' && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium bg-destructive text-destructive-foreground">
                          urgent
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {t.isUnassigned && <Badge variant="destructive" className="text-[8px] px-1 py-0">Unassigned</Badge>}
                        {t.isOverdue && <Badge variant="destructive" className="text-[8px] px-1 py-0">Overdue</Badge>}
                        {!t.isUnassigned && !t.isOverdue && (
                          <span className="text-[10px] text-muted-foreground capitalize">{t.status_code}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-right font-mono">{t.daysOpen}d</TableCell>
                    <TableCell>
                      {t.report_url && (
                        <a href={t.report_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* ACTIVITY FEED */}
      <div className="glass-card rounded-lg p-4">
        <h3 className="text-sm font-bold mb-4">{label}'s Activity Feed</h3>
        {loadingFeed ? (
          <p className="text-sm text-muted-foreground text-center py-8">Loading...</p>
        ) : !activityFeed?.length ? (
          <p className="text-sm text-muted-foreground text-center py-8">No maintenance activity in this period.</p>
        ) : (
          <div className="relative">
            <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />
            <div className="space-y-3">
              {activityFeed.map((item, i) => (
                <div key={`${item.id}-${item.type}-${i}`} className="flex gap-3 items-start relative">
                  <div className={`w-[15px] h-[15px] rounded-full shrink-0 mt-0.5 ${feedDotColor(item.type)} ring-2 ring-background z-10`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium text-foreground truncate max-w-[200px]">{item.title}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${feedDotColor(item.type)} text-background`}>
                        {feedLabel(item.type)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                      <span>{format(parseISO(item.time), 'h:mm a')}</span>
                      <span>·</span>
                      <span className="truncate">{item.property}</span>
                      <span>·</span>
                      <span className="truncate">{item.tech}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>

    <TaskDetailSheet taskId={openTaskId} onClose={() => setOpenTaskId(null)} />
    </>
  );
}

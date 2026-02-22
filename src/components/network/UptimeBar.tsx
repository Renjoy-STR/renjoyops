import { useMemo } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { format } from 'date-fns';

interface StatusRecord {
  recorded_at: string;
  status: string;
}

interface UptimeBarProps {
  records: StatusRecord[];
  height?: number;
  showLabels?: boolean;
}

const SEGMENTS = 96; // 24h / 15min = 96
const SEGMENT_MINUTES = 15;

export function UptimeBar({ records, height = 8, showLabels = false }: UptimeBarProps) {
  const segments = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Build segments
    return Array.from({ length: SEGMENTS }, (_, i) => {
      const segStart = new Date(start.getTime() + i * SEGMENT_MINUTES * 60 * 1000);
      const segEnd = new Date(segStart.getTime() + SEGMENT_MINUTES * 60 * 1000);

      // Find the most recent record before or at segEnd
      const relevantRecords = records.filter(r => {
        const t = new Date(r.recorded_at);
        return t >= segStart && t < segEnd;
      });

      // Also check most recent record before this segment
      const beforeRecords = records.filter(r => new Date(r.recorded_at) < segEnd);

      let status: 'online' | 'offline' | 'unknown' = 'unknown';
      if (relevantRecords.length > 0) {
        // Use the last record in the segment
        const last = relevantRecords[relevantRecords.length - 1];
        status = last.status === 'online' ? 'online' : 'offline';
      } else if (beforeRecords.length > 0) {
        const last = beforeRecords[beforeRecords.length - 1];
        status = last.status === 'online' ? 'online' : 'offline';
      }

      return { segStart, status };
    });
  }, [records]);

  const colors = {
    online: 'hsl(var(--success))',
    offline: 'hsl(var(--destructive))',
    unknown: 'hsl(var(--border))',
  };

  return (
    <div>
      <TooltipProvider delayDuration={100}>
        <div className="flex" style={{ height, borderRadius: height / 2, overflow: 'hidden' }}>
          {segments.map((seg, i) => (
            <Tooltip key={i}>
              <TooltipTrigger asChild>
                <div
                  className="flex-1"
                  style={{ backgroundColor: colors[seg.status] }}
                />
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {format(seg.segStart, 'h:mm a')} — {seg.status}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </TooltipProvider>
      {showLabels && (
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-muted-foreground">24h ago</span>
          <span className="text-[10px] text-muted-foreground">12h</span>
          <span className="text-[10px] text-muted-foreground">6h</span>
          <span className="text-[10px] text-muted-foreground">Now</span>
        </div>
      )}
    </div>
  );
}

interface UptimePercentageProps {
  records: StatusRecord[];
}

export function UptimePercentage({ records }: UptimePercentageProps) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentRecords = records.filter(r => new Date(r.recorded_at) >= thirtyDaysAgo);

  if (recentRecords.length === 0) {
    return <span className="text-xs text-muted-foreground">No data</span>;
  }

  const onlineCount = recentRecords.filter(r => r.status === 'online').length;
  const pct = Math.round((onlineCount / recentRecords.length) * 1000) / 10;
  const color = pct >= 99 ? 'hsl(var(--success))' : pct >= 95 ? 'hsl(38 92% 50%)' : 'hsl(var(--destructive))';

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">30-Day Uptime</span>
        <span className="text-sm font-bold" style={{ color }}>{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

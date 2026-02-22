import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatCompact } from '@/hooks/useSpendData';
import type { DayOfWeekSpend } from '@/hooks/useSpendData';
import { Skeleton } from '@/components/ui/skeleton';

interface Props {
  data: DayOfWeekSpend[];
  isLoading: boolean;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getIntensity(spend: number, max: number): number {
  if (max === 0) return 0.1;
  return Math.max(0.15, spend / max);
}

export function DayOfWeekHeatmap({ data, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="glass-card rounded-lg p-4">
        <Skeleton className="h-4 w-32 mb-3" />
        <div className="flex gap-1.5">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-14 flex-1 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (!data.length) return null;

  // Ensure all 7 days are present, sorted Sun-Sat
  const dayMap: Record<number, DayOfWeekSpend> = {};
  data.forEach(d => { dayMap[d.day_of_week] = d; });

  const days = Array.from({ length: 7 }, (_, i) => {
    return dayMap[i] ?? { day_of_week: i, day_name: DAY_LABELS[i], total_spend: 0, transaction_count: 0, avg_spend: 0 };
  });

  const maxSpend = Math.max(...days.map(d => d.total_spend));
  const weekdayAvg = days.filter(d => d.day_of_week >= 1 && d.day_of_week <= 5)
    .reduce((s, d) => s + d.total_spend, 0) / 5;

  return (
    <div className="glass-card rounded-lg p-4">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Spend by Day</h4>
      <TooltipProvider>
        <div className="flex gap-1.5">
          {days.map(d => {
            const intensity = getIntensity(d.total_spend, maxSpend);
            const isWeekend = d.day_of_week === 0 || d.day_of_week === 6;
            const highWeekendSpend = isWeekend && d.total_spend > weekdayAvg * 0.1;
            return (
              <Tooltip key={d.day_of_week}>
                <TooltipTrigger asChild>
                  <div
                    className={`flex-1 rounded-md flex flex-col items-center justify-center py-2 cursor-default transition-colors ${
                      highWeekendSpend ? 'ring-1 ring-[hsl(var(--warning))]' : ''
                    }`}
                    style={{
                      backgroundColor: `rgba(240, 76, 59, ${intensity})`,
                    }}
                  >
                    <span className="text-[10px] font-bold text-foreground/90">{DAY_LABELS[d.day_of_week]}</span>
                    <span className="text-[10px] text-foreground/70 mt-0.5">{formatCompact(d.total_spend)}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="font-medium">{DAY_LABELS[d.day_of_week]}: {formatCompact(d.total_spend)}</p>
                  <p className="text-xs text-muted-foreground">{d.transaction_count.toLocaleString()} txns</p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </TooltipProvider>
    </div>
  );
}

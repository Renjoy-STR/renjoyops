import { Home } from 'lucide-react';
import { CardSkeleton } from '@/components/dashboard/LoadingSkeleton';
import { formatCurrency } from '@/hooks/useSpendData';

interface Props {
  totalSpend: number;
  totalSpendDelta: number;
  isLoading: boolean;
  propertyCount?: number;
}

function DeltaPill({ value }: { value: number }) {
  const isPositive = value >= 0;
  // For cost per property: down is good (green), up is bad (red)
  const isGood = !isPositive;
  const bgClass = isGood
    ? 'bg-[hsl(var(--success)/0.12)] text-[hsl(var(--success))]'
    : 'bg-[hsl(var(--danger)/0.12)] text-destructive';
  const arrow = isPositive ? '↑' : '↓';

  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] font-semibold ${bgClass}`}>
      {arrow} {Math.abs(value).toFixed(1)}%
    </span>
  );
}

export function CostPerPropertyCard({ totalSpend, totalSpendDelta, isLoading, propertyCount = 200 }: Props) {
  if (isLoading) return <CardSkeleton />;

  const costPer = propertyCount > 0 ? totalSpend / propertyCount : 0;

  return (
    <div className="glass-card p-4 border-l-4 border-l-[hsl(var(--accent-foreground))]">
      <div className="flex items-start justify-between">
        <div className="space-y-1.5">
          <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cost / Property</p>
          <p className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-foreground">
            {formatCurrency(costPer)}
          </p>
          <div className="flex items-center gap-2">
            <DeltaPill value={totalSpendDelta} />
            <span className="text-[10px] text-muted-foreground">{propertyCount} properties</span>
          </div>
        </div>
        <div className="p-2 rounded-lg bg-accent hidden sm:block">
          <Home className="h-5 w-5 text-muted-foreground" />
        </div>
      </div>
    </div>
  );
}

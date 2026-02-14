import { TrendingDown, TrendingUp, Minus } from 'lucide-react';

interface Props {
  direction: 'improving' | 'stable' | 'worsening';
  showLabel?: boolean;
}

export function TrendIndicator({ direction, showLabel = false }: Props) {
  if (direction === 'improving') {
    return (
      <span className="inline-flex items-center gap-1 text-green-600">
        <TrendingDown className="h-3.5 w-3.5" />
        {showLabel && <span className="text-[10px] font-medium">Improving</span>}
      </span>
    );
  }
  if (direction === 'worsening') {
    return (
      <span className="inline-flex items-center gap-1 text-destructive">
        <TrendingUp className="h-3.5 w-3.5" />
        {showLabel && <span className="text-[10px] font-medium">Worsening</span>}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-muted-foreground">
      <Minus className="h-3.5 w-3.5" />
      {showLabel && <span className="text-[10px] font-medium">Stable</span>}
    </span>
  );
}

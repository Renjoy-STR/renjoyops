import { CreditCard } from 'lucide-react';
import { CardSkeleton } from '@/components/dashboard/LoadingSkeleton';
import { formatCurrency } from '@/hooks/useSpendData';
import type { SpendProgram } from '@/hooks/useSpendData';

interface Props {
  data: SpendProgram[];
  isLoading: boolean;
}

export function SpendProgramsCards({ data, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No spend programs found
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {data.map((p) => (
        <div key={p.id} className="glass-card p-4 space-y-2">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-accent">
              <CreditCard className="h-4 w-4 text-secondary" />
            </div>
            <div className="min-w-0">
              <h4 className="text-sm font-semibold truncate">{p.display_name ?? 'Unnamed Program'}</h4>
              {p.description && (
                <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Spent</p>
              <p className="text-sm font-bold">{formatCurrency(p.total_spent)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Txns</p>
              <p className="text-sm font-bold">{p.transaction_count.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Limits</p>
              <p className="text-sm font-bold">{p.active_limits}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

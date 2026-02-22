import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { formatCurrency, formatCompact } from '@/hooks/useSpendData';

interface RollingPeriod {
  period_label: string;
  period_days: number;
  current_spend: number;
  current_txn_count: number;
  current_per_property: number;
  prior_year_spend: number;
  prior_year_txn_count: number;
  prior_year_per_property: number;
  yoy_change_pct: number | null;
}

interface Props {
  data: RollingPeriod[];
  isLoading: boolean;
}

const PERIOD_LABELS: Record<string, string> = {
  '30d': 'Last 30 Days',
  '60d': 'Last 60 Days',
  '90d': 'Last 90 Days',
};

export function RollingSpendComparison({ data, isLoading }: Props) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        Rolling Spend Comparison
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {isLoading
          ? Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="pt-5 pb-4 px-4 space-y-3">
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-8 w-28" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                </CardContent>
              </Card>
            ))
          : data.map((period) => {
              const label = PERIOD_LABELS[period.period_label] ?? period.period_label;
              const hasPrior = period.prior_year_spend > 0;
              const yoy = period.yoy_change_pct;
              // For costs, decrease is good (green), increase is bad (red)
              const isGood = yoy !== null && yoy < 0;
              const perPropDelta = period.current_per_property - period.prior_year_per_property;

              return (
                <Card key={period.period_label}>
                  <CardContent className="pt-5 pb-4 px-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                      {label}
                    </p>
                    <p className="text-2xl font-bold">{formatCompact(period.current_spend)}</p>
                    <p className="text-sm text-muted-foreground">
                      {period.current_txn_count.toLocaleString()} transactions
                    </p>

                    {hasPrior ? (
                      <div className="mt-3 pt-3 border-t border-border space-y-1">
                        <p className="text-xs text-muted-foreground">vs Last Year</p>
                        <p className="text-sm text-muted-foreground">
                          {formatCompact(period.prior_year_spend)}
                        </p>
                        <div className="flex items-center gap-1.5">
                          {yoy !== null && (
                            <>
                              {isGood ? (
                                <ArrowDown className="h-3.5 w-3.5 text-[hsl(var(--success))]" />
                              ) : (
                                <ArrowUp className="h-3.5 w-3.5 text-destructive" />
                              )}
                              <span
                                className={`text-sm font-semibold ${
                                  isGood ? 'text-[hsl(var(--success))]' : 'text-destructive'
                                }`}
                              >
                                {Math.abs(yoy)}% YoY
                              </span>
                            </>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {perPropDelta >= 0 ? '+' : ''}
                          {formatCurrency(perPropDelta)}/prop
                        </p>
                      </div>
                    ) : (
                      <div className="mt-3 pt-3 border-t border-border">
                        <p className="text-xs text-muted-foreground">No prior year data</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
      </div>
    </div>
  );
}

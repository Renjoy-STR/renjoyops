import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp } from 'lucide-react';
import { formatCurrency, formatCompact } from '@/hooks/useSpendData';

interface GrowingMerchant {
  merchant_name: string;
  current_month_spend: number;
  prior_month_spend: number;
  spend_increase: number;
  growth_pct: number | null;
  transaction_count: number;
}

interface Props {
  data: GrowingMerchant[];
  isLoading: boolean;
}

export function FastestGrowingCard({ data, isLoading }: Props) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-destructive" />
          Fastest Growing Costs
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : data.length === 0 ? (
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Need 2+ months of data for comparison
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {data.map((merchant) => {
              const growthColor =
                merchant.growth_pct !== null && merchant.growth_pct > 25
                  ? 'bg-destructive/10 text-destructive border-destructive/20'
                  : merchant.growth_pct !== null && merchant.growth_pct > 10
                  ? 'bg-[hsl(var(--warning)/0.1)] text-[hsl(var(--warning))] border-[hsl(var(--warning)/0.2)]'
                  : 'bg-muted text-muted-foreground';

              return (
                <div
                  key={merchant.merchant_name}
                  className="flex items-center justify-between py-2 px-1 border-b last:border-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{merchant.merchant_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatCompact(merchant.prior_month_spend)}/mo → {formatCompact(merchant.current_month_spend)}/mo
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    {merchant.growth_pct !== null && (
                      <Badge variant="outline" className={`text-xs ${growthColor}`}>
                        ↑ {merchant.growth_pct}%
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      (+{formatCurrency(merchant.spend_increase)})
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

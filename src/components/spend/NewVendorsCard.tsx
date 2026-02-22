import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkles, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { formatCurrency, DEPARTMENT_COLORS } from '@/hooks/useSpendData';

interface NewVendor {
  merchant_name: string;
  first_seen: string;
  total_spend: number;
  transaction_count: number;
  department: string | null;
}

interface Props {
  data: NewVendor[];
  isLoading: boolean;
  onVendorClick?: (vendor: NewVendor) => void;
}

export function NewVendorsCard({ data, isLoading, onVendorClick }: Props) {
  const displayData = data.slice(0, 5);
  const moreCount = Math.max(0, data.length - 5);

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          New Vendors (Last 30 Days)
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
          <div className="flex items-center gap-2 py-4">
            <CheckCircle2 className="h-5 w-5 text-[hsl(var(--success))]" />
            <span className="text-sm text-muted-foreground">No new vendors this month</span>
          </div>
        ) : (
          <div className="space-y-1">
            {displayData.map((vendor) => (
              <div
                key={vendor.merchant_name}
                className="flex items-center justify-between py-2 px-1 rounded hover:bg-muted/50 cursor-pointer transition-colors border-b last:border-0"
                onClick={() => onVendorClick?.(vendor)}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{vendor.merchant_name}</p>
                  <p className="text-xs text-muted-foreground">
                    First seen {format(new Date(vendor.first_seen), 'MMM d')}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className="text-sm font-medium">{formatCurrency(vendor.total_spend)}</span>
                  <span className="text-xs text-muted-foreground">{vendor.transaction_count} txn{vendor.transaction_count !== 1 ? 's' : ''}</span>
                  {vendor.department && (
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0"
                      style={{
                        borderColor: DEPARTMENT_COLORS[vendor.department] ?? undefined,
                        color: DEPARTMENT_COLORS[vendor.department] ?? undefined,
                      }}
                    >
                      {vendor.department}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
            {moreCount > 0 && (
              <p className="text-xs text-primary font-medium pt-1 cursor-pointer hover:underline">
                + {moreCount} more
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

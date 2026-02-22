import { formatDistanceToNow } from 'date-fns';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { TableSkeleton } from '@/components/dashboard/LoadingSkeleton';
import { ExportCSVButton } from '@/components/dashboard/ExportCSVButton';
import { formatCurrency } from '@/hooks/useSpendData';
import type { RecurringVendor } from '@/hooks/useSpendData';

interface Props {
  data: RecurringVendor[];
  isLoading: boolean;
  totalMonths?: number;
  onRowClick?: (row: RecurringVendor) => void;
}

export function RecurringVendorsTable({ data, isLoading, totalMonths = 6, onRowClick }: Props) {
  if (isLoading) return <TableSkeleton rows={8} />;

  const totalRecurring = data.reduce((s, d) => s + Number(d.avg_monthly_spend ?? 0), 0);

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{data.length}</span> recurring vendors
          {' · '}
          <span className="font-semibold text-foreground">{formatCurrency(totalRecurring)}/mo</span> estimated recurring spend
        </p>
        <ExportCSVButton data={data} filename="recurring-vendors" />
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Vendor Name</TableHead>
              <TableHead className="text-xs text-center">Months Active</TableHead>
              <TableHead className="text-xs text-right">Total ({totalMonths}mo)</TableHead>
              <TableHead className="text-xs text-right">Avg Monthly</TableHead>
              <TableHead className="text-xs text-right">Last Transaction</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No recurring vendors found
                </TableCell>
              </TableRow>
            ) : (
              data.map((v, i) => (
                <TableRow key={`${v.merchant_name}-${i}`} className="cursor-pointer hover:bg-muted/50" onClick={() => onRowClick?.(v)}>
                  <TableCell className="text-sm font-medium">{v.merchant_name}</TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-sm">{v.months_active}/{totalMonths}</span>
                      <div className="w-16 bg-muted rounded-full h-1.5">
                        <div
                          className="h-1.5 rounded-full bg-primary"
                          style={{ width: `${(v.months_active / totalMonths) * 100}%` }}
                        />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-right font-medium">{formatCurrency(v.total_spend)}</TableCell>
                  <TableCell className="text-sm text-right text-muted-foreground">
                    {formatCurrency(v.avg_monthly_spend)}/mo
                  </TableCell>
                  <TableCell className="text-sm text-right text-muted-foreground">
                    {v.last_transaction
                      ? formatDistanceToNow(new Date(v.last_transaction), { addSuffix: true })
                      : '—'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

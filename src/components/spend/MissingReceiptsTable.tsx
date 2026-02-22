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
import type { MissingReceipt } from '@/hooks/useSpendData';

interface Props {
  data: MissingReceipt[];
  isLoading: boolean;
  onRowClick?: (row: MissingReceipt) => void;
}

export function MissingReceiptsTable({ data, isLoading, onRowClick }: Props) {
  const totalAtRisk = data.reduce((s, r) => s + (r.amount ?? 0), 0);

  const exportData = data.map((r) => ({
    Date: r.user_transaction_time?.slice(0, 10) ?? '',
    User: r.user_name ?? '',
    Department: r.department ?? '',
    Merchant: r.merchant_name ?? '',
    Amount: r.amount ?? 0,
    Memo: r.memo ?? '',
  }));

  if (isLoading) return <TableSkeleton rows={10} />;

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{data.length}</span> transactions missing receipts
          &middot; <span className="font-semibold text-destructive">{formatCurrency(totalAtRisk)}</span> at risk
        </div>
        <ExportCSVButton data={exportData} filename="ramp-missing-receipts" />
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Date</TableHead>
              <TableHead className="text-xs">User</TableHead>
              <TableHead className="text-xs">Department</TableHead>
              <TableHead className="text-xs">Merchant</TableHead>
              <TableHead className="text-xs text-right">Amount</TableHead>
              <TableHead className="text-xs">Memo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No missing receipts found
                </TableCell>
              </TableRow>
            )}
            {data.map((r) => (
              <TableRow key={r.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onRowClick?.(r)}>
                <TableCell className="text-sm whitespace-nowrap">
                  {r.user_transaction_time?.slice(0, 10) ?? '—'}
                </TableCell>
                <TableCell className="text-sm">{r.user_name ?? '—'}</TableCell>
                <TableCell className="text-sm">{r.department ?? '—'}</TableCell>
                <TableCell className="text-sm max-w-[160px] truncate">{r.merchant_name ?? '—'}</TableCell>
                <TableCell className="text-sm text-right font-medium">
                  {r.amount != null ? formatCurrency(r.amount) : '—'}
                </TableCell>
                <TableCell className="text-sm max-w-[200px] truncate">{r.memo ?? '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

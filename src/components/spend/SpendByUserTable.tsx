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
import type { UserSpend } from '@/hooks/useSpendData';

interface Props {
  data: UserSpend[];
  isLoading: boolean;
  onUserClick?: (userName: string) => void;
}

export function SpendByUserTable({ data, isLoading, onUserClick }: Props) {
  const exportData = data.map((u) => ({
    User: u.user_name ?? '',
    Department: u.department_name ?? '',
    'Transaction Count': u.transaction_count ?? 0,
    'Total Spend': u.total_spend ?? 0,
    'Avg Transaction': u.avg_transaction ?? 0,
    'Missing Receipts': u.missing_receipts ?? 0,
  }));

  if (isLoading) return <TableSkeleton rows={10} />;

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <ExportCSVButton data={exportData} filename="ramp-spend-by-user" />
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">User</TableHead>
              <TableHead className="text-xs">Department</TableHead>
              <TableHead className="text-xs text-right">Transactions</TableHead>
              <TableHead className="text-xs text-right">Total Spend</TableHead>
              <TableHead className="text-xs text-right">Avg Transaction</TableHead>
              <TableHead className="text-xs text-right">Missing Receipts</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No user data found
                </TableCell>
              </TableRow>
            )}
            {data.map((u, i) => (
              <TableRow
                key={`${u.user_name}-${i}`}
                className={onUserClick ? 'cursor-pointer hover:bg-muted/50' : ''}
                onClick={() => onUserClick?.(u.user_name)}
              >
                <TableCell className="text-sm font-medium text-primary">
                  {u.user_name ?? '—'}
                </TableCell>
                <TableCell className="text-sm">{u.department_name ?? '—'}</TableCell>
                <TableCell className="text-sm text-right">{(u.transaction_count ?? 0).toLocaleString()}</TableCell>
                <TableCell className="text-sm text-right font-medium">
                  {formatCurrency(u.total_spend ?? 0)}
                </TableCell>
                <TableCell className="text-sm text-right">
                  {formatCurrency(u.avg_transaction ?? 0)}
                </TableCell>
                <TableCell className="text-sm text-right">
                  <span className={(u.missing_receipts ?? 0) > 0 ? 'text-destructive font-medium' : ''}>
                    {u.missing_receipts ?? 0}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

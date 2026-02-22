import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ExportCSVButton } from '@/components/dashboard/ExportCSVButton';
import { CheckCircle2, Receipt } from 'lucide-react';
import { format } from 'date-fns';
import { formatCurrency } from '@/hooks/useSpendData';

interface SpendAnomaly {
  transaction_id: string;
  user_name: string | null;
  department: string | null;
  merchant_name: string | null;
  amount: number;
  transaction_date: string;
  user_avg: number;
  merchant_avg: number;
  anomaly_reason: string;
}

interface Props {
  data: SpendAnomaly[];
  isLoading: boolean;
  onRowClick?: (row: any) => void;
}

function ReasonBadge({ reason }: { reason: string }) {
  const styles: Record<string, string> = {
    'Unusual for user': 'bg-[hsl(var(--warning)/0.1)] text-[hsl(var(--warning))] border-[hsl(var(--warning)/0.2)]',
    'Unusual for merchant': 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800',
    'High amount': 'bg-destructive/10 text-destructive border-destructive/20',
  };

  return (
    <Badge variant="outline" className={`text-[10px] ${styles[reason] ?? ''}`}>
      {reason}
    </Badge>
  );
}

export function SpendAnomaliesTable({ data, isLoading, onRowClick }: Props) {
  const totalFlagged = data.length;
  const totalAmount = data.reduce((s, d) => s + d.amount, 0);

  const csvData = data.map((d) => ({
    Date: d.transaction_date ? format(new Date(d.transaction_date), 'yyyy-MM-dd') : '',
    User: d.user_name ?? '',
    Department: d.department ?? '',
    Merchant: d.merchant_name ?? '',
    Amount: d.amount,
    'User Avg': d.user_avg,
    Reason: d.anomaly_reason,
  }));

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <CheckCircle2 className="h-10 w-10 text-[hsl(var(--success))]/50 mb-3" />
        <h3 className="text-sm font-semibold text-muted-foreground">
          No spending anomalies detected in the last 30 days
        </h3>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{totalFlagged}</span> anomalies totaling{' '}
          <span className="font-semibold text-foreground">{formatCurrency(totalAmount)}</span> flagged in the last 30 days
        </p>
        <ExportCSVButton data={csvData} filename="spend-anomalies" />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>User</TableHead>
            <TableHead>Department</TableHead>
            <TableHead>Merchant</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="text-right">User Avg</TableHead>
            <TableHead>Reason</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => (
            <TableRow
              key={row.transaction_id}
              className="cursor-pointer"
              onClick={() => onRowClick?.({
                id: row.transaction_id,
                user_name: row.user_name,
                department_name: row.department,
                merchant_name: row.merchant_name,
                amount: row.amount,
                user_transaction_time: row.transaction_date,
              })}
            >
              <TableCell className="text-xs">
                {row.transaction_date
                  ? format(new Date(row.transaction_date), 'MMM d')
                  : '—'}
              </TableCell>
              <TableCell className="text-sm">{row.user_name ?? '—'}</TableCell>
              <TableCell className="text-xs">{row.department ?? '—'}</TableCell>
              <TableCell className="text-sm font-medium">{row.merchant_name ?? '—'}</TableCell>
              <TableCell className="text-right font-bold">{formatCurrency(row.amount)}</TableCell>
              <TableCell className="text-right text-muted-foreground text-xs">
                {formatCurrency(row.user_avg)}
              </TableCell>
              <TableCell>
                <ReasonBadge reason={row.anomaly_reason} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

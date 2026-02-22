import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ExportCSVButton } from '@/components/dashboard/ExportCSVButton';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
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

function mapFlag(reason: string): { label: string; className: string } {
  switch (reason) {
    case 'Unusual for merchant':
      return {
        label: 'Merchant spike',
        className: 'bg-[hsl(var(--warning)/0.1)] text-[hsl(var(--warning))] border-[hsl(var(--warning)/0.2)]',
      };
    case 'Unusual for user':
      return {
        label: 'Dept spike',
        className: 'bg-amber-900/20 text-amber-400 border-amber-800',
      };
    case 'High amount':
      return {
        label: 'High amount',
        className: 'bg-destructive/10 text-destructive border-destructive/20',
      };
    default:
      return { label: reason, className: '' };
  }
}

function getTypicalAvg(row: SpendAnomaly): number {
  if (row.anomaly_reason === 'Unusual for merchant') return row.merchant_avg;
  return row.user_avg;
}

function getVariance(amount: number, avg: number): string {
  if (!avg || avg === 0) return '—';
  return `${(amount / avg).toFixed(1)}× avg`;
}

export function SpendAnomaliesTable({ data, isLoading, onRowClick }: Props) {
  const totalFlagged = data.length;
  const totalAmount = data.reduce((s, d) => s + d.amount, 0);

  const repeatedMerchants = useMemo(() => {
    const counts: Record<string, number> = {};
    data.forEach((a) => {
      if (a.merchant_name) counts[a.merchant_name] = (counts[a.merchant_name] || 0) + 1;
    });
    return Object.entries(counts)
      .filter(([, count]) => count > 1)
      .sort((a, b) => b[1] - a[1]);
  }, [data]);

  const csvData = data.map((d) => ({
    Date: d.transaction_date ? format(new Date(d.transaction_date), 'yyyy-MM-dd') : '',
    Merchant: d.merchant_name ?? '',
    Department: d.department ?? '',
    Amount: d.amount,
    'Typical Avg': getTypicalAvg(d),
    Variance: getVariance(d.amount, getTypicalAvg(d)),
    Flag: mapFlag(d.anomaly_reason).label,
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
          <span className="font-semibold text-foreground">{totalFlagged}</span> unusual charges totaling{' '}
          <span className="font-semibold text-foreground">{formatCurrency(totalAmount)}</span> in the last 30 days
        </p>
        <ExportCSVButton data={csvData} filename="spend-anomalies" />
      </div>

      {repeatedMerchants.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
          <AlertTriangle className="h-3.5 w-3.5 text-[hsl(var(--warning))] shrink-0" />
          <span>
            {repeatedMerchants.map(([name, count], i) => (
              <span key={name}>
                {i > 0 && ' · '}
                <span className="font-medium text-foreground">{name}</span> flagged {count} times
              </span>
            ))}
          </span>
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Merchant</TableHead>
            <TableHead>Department</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="text-right">Typical Avg</TableHead>
            <TableHead className="text-right">Variance</TableHead>
            <TableHead>Flag</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => {
            const flag = mapFlag(row.anomaly_reason);
            const typicalAvg = getTypicalAvg(row);
            const variance = getVariance(row.amount, typicalAvg);

            return (
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
                <TableCell className="text-sm font-medium">{row.merchant_name ?? '—'}</TableCell>
                <TableCell className="text-xs">{row.department ?? '—'}</TableCell>
                <TableCell className="text-right font-bold">{formatCurrency(row.amount)}</TableCell>
                <TableCell className="text-right text-muted-foreground text-xs">
                  {formatCurrency(typicalAvg)}
                </TableCell>
                <TableCell className="text-right text-xs font-medium">
                  {variance}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={`text-[10px] ${flag.className}`}>
                    {flag.label}
                  </Badge>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

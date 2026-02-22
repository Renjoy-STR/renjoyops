import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TableSkeleton } from '@/components/dashboard/LoadingSkeleton';
import { ExportCSVButton } from '@/components/dashboard/ExportCSVButton';
import { formatCurrency } from '@/hooks/useSpendData';
import type { RampBill } from '@/hooks/useSpendData';

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  PAID: 'default',
  OPEN: 'secondary',
  OVERDUE: 'destructive',
};

interface Props {
  data: RampBill[];
  isLoading: boolean;
  statusFilter: string;
  onStatusChange: (s: string) => void;
  onRowClick?: (row: RampBill) => void;
}

export function BillsTable({ data, isLoading, statusFilter, onStatusChange, onRowClick }: Props) {
  const exportData = data.map((b) => ({
    Vendor: b.vendor_name ?? '',
    Amount: b.amount ?? 0,
    Status: b.status ?? '',
    'Due Date': b.due_date ?? '',
    'Invoice #': b.invoice_number ?? '',
    'Payment Date': b.payment_date ?? '',
    Memo: b.memo ?? '',
  }));

  if (isLoading) return <TableSkeleton rows={10} />;

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <Select value={statusFilter} onValueChange={onStatusChange}>
          <SelectTrigger className="w-40 h-9">
            <SelectValue placeholder="Filter status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="PAID">Paid</SelectItem>
            <SelectItem value="OPEN">Open</SelectItem>
            <SelectItem value="OVERDUE">Overdue</SelectItem>
          </SelectContent>
        </Select>
        <ExportCSVButton data={exportData} filename="ramp-bills" />
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Vendor</TableHead>
              <TableHead className="text-xs text-right">Amount</TableHead>
              <TableHead className="text-xs">Status</TableHead>
              <TableHead className="text-xs">Due Date</TableHead>
              <TableHead className="text-xs">Invoice #</TableHead>
              <TableHead className="text-xs">Payment Date</TableHead>
              <TableHead className="text-xs">Memo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No bills found
                </TableCell>
              </TableRow>
            )}
            {data.map((b) => (
              <TableRow key={b.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onRowClick?.(b)}>
                <TableCell className="text-sm">{b.vendor_name ?? '—'}</TableCell>
                <TableCell className="text-sm text-right font-medium">
                  {b.amount != null ? formatCurrency(b.amount) : '—'}
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[b.status ?? ''] ?? 'outline'}>
                    {b.status ?? 'Unknown'}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">{b.due_date?.slice(0, 10) ?? '—'}</TableCell>
                <TableCell className="text-sm">{b.invoice_number ?? '—'}</TableCell>
                <TableCell className="text-sm">{b.payment_date?.slice(0, 10) ?? '—'}</TableCell>
                <TableCell className="text-sm max-w-[200px] truncate">{b.memo ?? '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Search, Check, X, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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
import type { RampTransaction } from '@/hooks/useSpendData';

interface Props {
  data: RampTransaction[];
  count: number;
  pageSize: number;
  page: number;
  onPageChange: (p: number) => void;
  search: string;
  onSearchChange: (s: string) => void;
  isLoading: boolean;
}

type SortKey = 'user_transaction_time' | 'amount' | 'merchant_name' | 'user_name';

export function TransactionsTable({
  data,
  count,
  pageSize,
  page,
  onPageChange,
  search,
  onSearchChange,
  isLoading,
}: Props) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('user_transaction_time');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const totalPages = Math.ceil(count / pageSize);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const SortIcon = ({ col }: { col: SortKey }) =>
    sortKey === col ? (
      sortDir === 'desc' ? (
        <ChevronDown className="h-3 w-3 inline ml-0.5" />
      ) : (
        <ChevronUp className="h-3 w-3 inline ml-0.5" />
      )
    ) : null;

  const sorted = [...data].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1;
    const aVal = a[sortKey];
    const bVal = b[sortKey];
    if (aVal == null && bVal == null) return 0;
    if (aVal == null) return 1;
    if (bVal == null) return -1;
    if (typeof aVal === 'number' && typeof bVal === 'number') return (aVal - bVal) * dir;
    return String(aVal).localeCompare(String(bVal)) * dir;
  });

  const hasReceipt = (t: RampTransaction) => {
    if (!t.receipts) return false;
    if (Array.isArray(t.receipts)) return t.receipts.length > 0;
    return true;
  };

  const exportData = data.map((t) => ({
    Date: t.user_transaction_time?.slice(0, 10) ?? '',
    User: t.user_name ?? '',
    Department: t.department_name ?? '',
    Merchant: t.merchant_name ?? '',
    Amount: t.amount ?? 0,
    Category: t.sk_category_name ?? '',
    Memo: t.memo ?? '',
    Receipt: hasReceipt(t) ? 'Yes' : 'No',
  }));

  if (isLoading) return <TableSkeleton rows={10} />;

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search merchant or user..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <ExportCSVButton data={exportData} filename="ramp-transactions" />
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs cursor-pointer select-none" onClick={() => handleSort('user_transaction_time')}>
                Date<SortIcon col="user_transaction_time" />
              </TableHead>
              <TableHead className="text-xs cursor-pointer select-none" onClick={() => handleSort('user_name')}>
                User<SortIcon col="user_name" />
              </TableHead>
              <TableHead className="text-xs">Department</TableHead>
              <TableHead className="text-xs cursor-pointer select-none" onClick={() => handleSort('merchant_name')}>
                Merchant<SortIcon col="merchant_name" />
              </TableHead>
              <TableHead className="text-xs text-right cursor-pointer select-none" onClick={() => handleSort('amount')}>
                Amount<SortIcon col="amount" />
              </TableHead>
              <TableHead className="text-xs">Category</TableHead>
              <TableHead className="text-xs">Memo</TableHead>
              <TableHead className="text-xs text-center">Receipt</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  No transactions found
                </TableCell>
              </TableRow>
            )}
            {sorted.map((t) => (
              <>
                <TableRow
                  key={t.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setExpandedRow(expandedRow === t.id ? null : t.id)}
                >
                  <TableCell className="text-sm whitespace-nowrap">
                    {t.user_transaction_time?.slice(0, 10) ?? '—'}
                  </TableCell>
                  <TableCell className="text-sm">{t.user_name ?? '—'}</TableCell>
                  <TableCell className="text-sm">{t.department_name ?? '—'}</TableCell>
                  <TableCell className="text-sm max-w-[160px] truncate">{t.merchant_name ?? '—'}</TableCell>
                  <TableCell className="text-sm text-right font-medium">
                    {t.amount != null ? formatCurrency(t.amount) : '—'}
                  </TableCell>
                  <TableCell className="text-sm max-w-[120px] truncate">{t.sk_category_name ?? '—'}</TableCell>
                  <TableCell className="text-sm max-w-[150px] truncate">{t.memo ?? '—'}</TableCell>
                  <TableCell className="text-center">
                    {hasReceipt(t) ? (
                      <Check className="h-4 w-4 text-[hsl(142,71%,45%)] mx-auto" />
                    ) : (
                      <X className="h-4 w-4 text-destructive mx-auto" />
                    )}
                  </TableCell>
                </TableRow>
                {expandedRow === t.id && (
                  <TableRow key={`${t.id}-expanded`}>
                    <TableCell colSpan={8} className="bg-muted/30 text-xs space-y-1 py-3">
                      <p><strong>Card:</strong> {t.card_name ?? 'N/A'}</p>
                      {t.policy_violations && (
                        <p className="text-destructive">
                          <strong>Policy Violations:</strong> {JSON.stringify(t.policy_violations)}
                        </p>
                      )}
                      {hasReceipt(t) && Array.isArray(t.receipts) && (
                        <p>
                          <strong>Receipts:</strong>{' '}
                          {t.receipts.map((r: any, i: number) => (
                            <a
                              key={i}
                              href={r.receipt_url ?? r.url ?? '#'}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary underline mr-2"
                            >
                              View #{i + 1}
                            </a>
                          ))}
                        </p>
                      )}
                    </TableCell>
                  </TableRow>
                )}
              </>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {count.toLocaleString()} transactions &middot; Page {page + 1} of {totalPages}
          </p>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              disabled={page === 0}
              onClick={() => onPageChange(page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={page >= totalPages - 1}
              onClick={() => onPageChange(page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

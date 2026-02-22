import { useEffect } from 'react';
import { X, Check, AlertTriangle, Copy, ChevronDown } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { formatCurrency } from '@/hooks/useSpendData';
import type { RampTransaction, RampBill, UserSpend, RecurringVendor, MissingReceipt } from '@/hooks/useSpendData';

// ── Types ─────────────────────────────────────────────────────────────────────

type DetailType = 'transaction' | 'bill' | 'user' | 'vendor' | 'receipt';

interface DetailSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  type: DetailType;
  data: any;
  dateRange?: { from: string; to: string };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatFullDate(dateStr: string | null) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return format(d, "EEEE, MMMM d, yyyy 'at' h:mm a");
}

function CopyableId({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <button
        onClick={() => navigator.clipboard.writeText(value)}
        className="flex items-center gap-1 text-foreground hover:text-primary transition-colors font-mono"
      >
        {value.slice(0, 12)}…
        <Copy className="h-3 w-3" />
      </button>
    </div>
  );
}

function Field({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={`flex items-start justify-between text-xs gap-2 ${className ?? ''}`}>
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-right text-foreground">{value ?? '—'}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h4>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

// ── Transaction Detail ────────────────────────────────────────────────────────

function TransactionDetail({ data: t, showReceiptBanner }: { data: RampTransaction; showReceiptBanner?: boolean }) {
  const hasReceipt = t.receipts && (Array.isArray(t.receipts) ? t.receipts.length > 0 : true);
  const isMissing = !hasReceipt;
  const bigAmount = (t.amount ?? 0) > 25;

  return (
    <div className="space-y-5">
      {/* Receipt missing banner */}
      {showReceiptBanner && isMissing && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
          <span className="text-xs font-medium text-destructive">
            Receipt Missing — {formatCurrency(t.amount ?? 0)} at risk
          </span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-bold text-foreground">{t.merchant_name ?? 'Unknown Merchant'}</p>
          <p className="text-xs text-muted-foreground">{formatFullDate(t.user_transaction_time)}</p>
        </div>
        <p className="text-lg font-bold text-foreground whitespace-nowrap">
          {t.amount != null ? formatCurrency(t.amount) : '—'}
        </p>
      </div>

      <Separator />

      <Section title="Overview">
        <Field label="User" value={
          <span className="flex items-center gap-1.5">
            {t.user_name ?? '—'}
            {t.department_name && (
              <Badge variant="outline" className="text-[10px] py-0 px-1.5">{t.department_name}</Badge>
            )}
          </span>
        } />
        <Field label="Card" value={t.card_name ?? 'N/A'} />
        <Field label="Category" value={t.sk_category_name ?? '—'} />
      </Section>

      <Separator />

      <Section title="Receipt & Compliance">
        <Field label="Receipt" value={
          hasReceipt
            ? <span className="flex items-center gap-1 text-[hsl(142,71%,45%)]"><Check className="h-3 w-3" /> Attached</span>
            : <span className="text-destructive">Missing</span>
        } />
        {hasReceipt && Array.isArray(t.receipts) && (
          <div className="flex gap-2 justify-end">
            {t.receipts.map((r: any, i: number) => (
              <a key={i} href={r.receipt_url ?? r.url ?? '#'} target="_blank" rel="noreferrer" className="text-xs text-primary underline">
                View #{i + 1}
              </a>
            ))}
          </div>
        )}
        <Field label="Policy Violations" value={
          t.policy_violations
            ? <span className="text-destructive">{JSON.stringify(t.policy_violations)}</span>
            : <span className="text-[hsl(142,71%,45%)]">None</span>
        } />
        {isMissing && bigAmount && (
          <div className="p-2 rounded bg-[hsl(var(--warning)/0.1)] border border-[hsl(var(--warning)/0.2)]">
            <p className="text-[10px] text-[hsl(var(--warning))]">Receipt required for transactions over $25</p>
          </div>
        )}
      </Section>

      <Separator />

      <Section title="Memo">
        <p className="text-xs text-foreground">{t.memo || <span className="text-muted-foreground italic">No memo provided</span>}</p>
      </Section>

      <Separator />

      <Collapsible>
        <CollapsibleTrigger className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">
          Raw Data <ChevronDown className="h-3 w-3" />
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2 space-y-1.5">
          <CopyableId label="Transaction ID" value={t.id} />
          <Field label="Department ID" value={t.department_id ?? '—'} />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

// ── Bill Detail ───────────────────────────────────────────────────────────────

function BillDetail({ data: b }: { data: RampBill }) {
  const statusColor: Record<string, string> = {
    PAID: 'bg-[hsl(142,71%,45%)]/10 text-[hsl(142,71%,45%)]',
    OPEN: 'bg-primary/10 text-primary',
    OVERDUE: 'bg-destructive/10 text-destructive',
  };

  const dueInfo = (() => {
    if (!b.due_date) return null;
    const due = new Date(b.due_date);
    const now = new Date();
    if (b.status === 'PAID') return null;
    if (due < now) {
      const days = Math.ceil((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
      return <span className="text-destructive">{days} days overdue</span>;
    }
    const days = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return <span className="text-[hsl(var(--warning))]">Due in {days} days</span>;
  })();

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-bold text-foreground">{b.vendor_name ?? 'Unknown Vendor'}</p>
          <p className="text-xs text-muted-foreground">Invoice #{b.invoice_number ?? 'N/A'}</p>
        </div>
        <p className="text-lg font-bold text-foreground whitespace-nowrap">
          {b.amount != null ? formatCurrency(b.amount) : '—'}
        </p>
      </div>

      <Separator />

      <Section title="Status & Dates">
        <Field label="Status" value={
          <Badge className={statusColor[b.status ?? ''] ?? ''} variant="outline">
            {b.status ?? 'Unknown'}
          </Badge>
        } />
        <Field label="Due Date" value={
          <span className="flex flex-col items-end gap-0.5">
            <span>{b.due_date?.slice(0, 10) ?? '—'}</span>
            {dueInfo}
          </span>
        } />
        <Field label="Payment Date" value={b.payment_date?.slice(0, 10) ?? '—'} />
      </Section>

      <Separator />

      <Section title="Details">
        <Field label="Memo" value={b.memo || <span className="italic text-muted-foreground">No memo</span>} />
      </Section>

      <Separator />

      <Collapsible>
        <CollapsibleTrigger className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">
          Raw Data <ChevronDown className="h-3 w-3" />
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2 space-y-1.5">
          <CopyableId label="Bill ID" value={b.id} />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

// ── User Detail ───────────────────────────────────────────────────────────────

function UserDetail({ data: u, dateRange }: { data: UserSpend; dateRange?: { from: string; to: string } }) {
  const compliance = (() => {
    const count = Number(u.transaction_count) || 0;
    const missing = Number(u.missing_receipts) || 0;
    return count > 0 ? Math.round(((count - missing) / count) * 1000) / 10 : 100;
  })();

  const compColor = compliance >= 90 ? 'text-[hsl(142,71%,45%)]' : compliance >= 70 ? 'text-[hsl(var(--warning))]' : 'text-destructive';

  // Fetch recent transactions for this user
  const recentTxns = useQuery({
    queryKey: ['user-recent-txns', u.user_name, dateRange?.from, dateRange?.to],
    queryFn: async () => {
      const query = supabase
        .from('v_ramp_transactions' as any)
        .select('user_transaction_time, merchant_name, amount, receipts')
        .eq('user_name', u.user_name)
        .order('user_transaction_time', { ascending: false })
        .limit(10);

      if (dateRange) {
        query.gte('user_transaction_time', dateRange.from).lte('user_transaction_time', dateRange.to);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!u.user_name,
  });

  return (
    <div className="space-y-5">
      <div>
        <p className="text-lg font-bold text-foreground">{u.user_name}</p>
        <p className="text-xs text-muted-foreground">{u.department ?? 'No department'}</p>
      </div>

      <Separator />

      <Section title="Spending Summary">
        <Field label="Total Spend" value={formatCurrency(Number(u.total_spend))} />
        <Field label="Transactions" value={Number(u.transaction_count).toLocaleString()} />
        <Field label="Average" value={formatCurrency(Number(u.avg_transaction))} />
        <Field label="Compliance" value={<span className={`font-medium ${compColor}`}>{compliance}%</span>} />
      </Section>

      <Separator />

      <Section title="Missing Receipts">
        <Field label="Count" value={
          <span className={Number(u.missing_receipts) > 0 ? 'text-destructive font-medium' : ''}>
            {u.missing_receipts}
          </span>
        } />
      </Section>

      <Separator />

      <Section title="Recent Transactions">
        {recentTxns.isLoading ? (
          <p className="text-xs text-muted-foreground">Loading...</p>
        ) : !recentTxns.data?.length ? (
          <p className="text-xs text-muted-foreground italic">No transactions found</p>
        ) : (
          <div className="space-y-1">
            {recentTxns.data.map((tx: any, i: number) => {
              const hasReceipt = tx.receipts && (Array.isArray(tx.receipts) ? tx.receipts.length > 0 : true);
              return (
                <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-border/50 last:border-0">
                  <div className="flex items-center gap-2">
                    {hasReceipt
                      ? <Check className="h-3 w-3 text-[hsl(142,71%,45%)]" />
                      : <X className="h-3 w-3 text-destructive" />
                    }
                    <span className="truncate max-w-[120px]">{tx.merchant_name ?? '—'}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground">
                      {tx.user_transaction_time ? new Date(tx.user_transaction_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                    </span>
                    <span className="font-medium">{formatCurrency(tx.amount ?? 0)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>
    </div>
  );
}

// ── Recurring Vendor Detail ───────────────────────────────────────────────────

function VendorDetail({ data: v, dateRange }: { data: RecurringVendor; dateRange?: { from: string; to: string } }) {
  // Fetch recent transactions for this vendor
  const recentTxns = useQuery({
    queryKey: ['vendor-recent-txns', v.merchant_name, dateRange?.from, dateRange?.to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_ramp_transactions' as any)
        .select('user_transaction_time, amount, user_name, memo')
        .eq('merchant_name', v.merchant_name)
        .order('user_transaction_time', { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!v.merchant_name,
  });

  return (
    <div className="space-y-5">
      <div>
        <p className="text-lg font-bold text-foreground">{v.merchant_name}</p>
        <p className="text-xs text-muted-foreground">Recurring · {v.months_active} months active</p>
      </div>

      <Separator />

      <Section title="Cost Summary">
        <Field label="Total (6mo)" value={formatCurrency(v.total_spend)} />
        <Field label="Avg Monthly" value={`${formatCurrency(v.avg_monthly_spend)}/mo`} />
        <Field label="Last Transaction" value={
          v.last_transaction
            ? formatDistanceToNow(new Date(v.last_transaction), { addSuffix: true })
            : '—'
        } />
      </Section>

      <Separator />

      <Section title="Recent Transactions">
        {recentTxns.isLoading ? (
          <p className="text-xs text-muted-foreground">Loading...</p>
        ) : !recentTxns.data?.length ? (
          <p className="text-xs text-muted-foreground italic">No transactions found</p>
        ) : (
          <div className="space-y-1">
            {recentTxns.data.map((tx: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-border/50 last:border-0">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">
                    {tx.user_transaction_time ? new Date(tx.user_transaction_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                  </span>
                  <span className="truncate max-w-[100px]">{tx.user_name ?? '—'}</span>
                </div>
                <span className="font-medium">{formatCurrency(tx.amount ?? 0)}</span>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function DetailSidebar({ isOpen, onClose, type, data, dateRange }: DetailSidebarProps) {
  if (!data) return null;

  const titles: Record<DetailType, string> = {
    transaction: 'Transaction Detail',
    bill: 'Bill Detail',
    user: 'User Detail',
    vendor: 'Vendor Detail',
    receipt: 'Missing Receipt',
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="w-full sm:max-w-[480px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            {titles[type]}
          </SheetTitle>
        </SheetHeader>
        <div className="mt-4">
          {type === 'transaction' && <TransactionDetail data={data as RampTransaction} />}
          {type === 'receipt' && <TransactionDetail data={data as RampTransaction} showReceiptBanner />}
          {type === 'bill' && <BillDetail data={data as RampBill} />}
          {type === 'user' && <UserDetail data={data as UserSpend} dateRange={dateRange} />}
          {type === 'vendor' && <VendorDetail data={data as RecurringVendor} dateRange={dateRange} />}
        </div>
      </SheetContent>
    </Sheet>
  );
}

import { DollarSign, ShieldCheck, ShieldAlert, AlertTriangle, Receipt } from 'lucide-react';
import { CardSkeleton } from '@/components/dashboard/LoadingSkeleton';
import { formatCurrency, type SpendKPIs } from '@/hooks/useSpendData';

interface SpendKPICardsProps {
  data: SpendKPIs | undefined;
  isLoading: boolean;
}

function complianceColor(pct: number) {
  if (pct >= 90) return 'text-[hsl(var(--success))]';
  if (pct >= 70) return 'text-[hsl(var(--warning))]';
  return 'text-destructive';
}

function complianceBorder(pct: number) {
  if (pct >= 90) return 'border-l-[hsl(var(--success))]';
  if (pct >= 70) return 'border-l-[hsl(var(--warning))]';
  return 'border-l-destructive';
}

/**
 * Delta pill badge.
 * invertColor: when true, positive = good (green). When false, negative = good (green).
 * suffix: text after the number (defaults to "%")
 */
function DeltaPill({ value, invertColor = false, suffix = '%' }: { value: number; invertColor?: boolean; suffix?: string }) {
  const isPositive = value >= 0;
  const isGood = invertColor ? isPositive : !isPositive;
  const bgClass = isGood
    ? 'bg-[hsl(var(--success)/0.12)] text-[hsl(var(--success))]'
    : 'bg-[hsl(var(--danger)/0.12)] text-destructive';
  const arrow = isPositive ? '↑' : '↓';

  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] font-semibold ${bgClass}`}>
      {arrow} {Math.abs(value).toFixed(1)}{suffix}
    </span>
  );
}

export function SpendKPICards({ data, isLoading }: SpendKPICardsProps) {
  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    );
  }

  const complianceOk = data.receiptCompliance >= 90;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
      {/* Total Spend */}
      <div className="glass-card p-4 border-l-4 border-l-primary">
        <div className="flex items-start justify-between">
          <div className="space-y-1.5">
            <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Spend</p>
            <p className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-foreground">{formatCurrency(data.totalSpend)}</p>
            <DeltaPill value={data.totalSpendDelta} />
          </div>
          <div className="p-2 rounded-lg bg-primary/10 hidden sm:block">
            <DollarSign className="h-5 w-5 text-primary" />
          </div>
        </div>
      </div>

      {/* Bill Payments */}
      <div className="glass-card p-4 border-l-4 border-l-[hsl(217,91%,60%)]">
        <div className="flex items-start justify-between">
          <div className="space-y-1.5">
            <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider">Bill Payments</p>
            <p className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-foreground">{formatCurrency(data.billPayments)}</p>
            <DeltaPill value={data.billPaymentsDelta} />
          </div>
          <div className="p-2 rounded-lg bg-[hsl(217,91%,60%,0.1)] hidden sm:block">
            <Receipt className="h-5 w-5 text-[hsl(217,91%,60%)]" />
          </div>
        </div>
      </div>

      {/* Receipt Compliance */}
      <div className={`glass-card p-4 border-l-4 ${complianceBorder(data.receiptCompliance)}`}>
        <div className="flex items-start justify-between">
          <div className="space-y-1.5">
            <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider">Receipt Compliance</p>
            <p className={`text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight ${complianceColor(data.receiptCompliance)}`}>
              {data.receiptCompliance.toFixed(1)}%
            </p>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-medium ${complianceColor(data.receiptCompliance)}`}>
                {data.receiptCompliance >= 90 ? 'On track' : data.receiptCompliance >= 70 ? 'Needs attention' : 'Action needed'}
              </span>
              <DeltaPill value={data.receiptComplianceDelta} invertColor suffix=" pts" />
            </div>
          </div>
          <div className={`p-2 rounded-lg hidden sm:block ${complianceOk ? 'bg-[hsl(var(--success)/0.1)]' : 'bg-[hsl(var(--warning)/0.1)]'}`}>
            {complianceOk
              ? <ShieldCheck className="h-5 w-5 text-[hsl(var(--success))]" />
              : <ShieldAlert className="h-5 w-5 text-[hsl(var(--warning))]" />
            }
          </div>
        </div>
      </div>

      {/* Missing Receipts */}
      <div className={`glass-card p-4 border-l-4 border-l-[hsl(var(--warning))] ${data.missingReceipts > 50 ? 'bg-[hsl(var(--danger)/0.03)]' : ''}`}>
        <div className="flex items-start justify-between">
          <div className="space-y-1.5">
            <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider">Missing Receipts</p>
            <p className={`text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight ${data.missingReceipts > 50 ? 'text-destructive' : 'text-foreground'}`}>
              {data.missingReceipts.toLocaleString()}
            </p>
            <DeltaPill value={data.missingReceiptsDelta} />
          </div>
          <div className="p-2 rounded-lg bg-[hsl(var(--warning)/0.1)] hidden sm:block">
            <AlertTriangle className="h-5 w-5 text-[hsl(var(--warning))]" />
          </div>
        </div>
      </div>
    </div>
  );
}

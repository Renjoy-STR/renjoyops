import { DollarSign, ShieldCheck, AlertTriangle, Receipt } from 'lucide-react';
import { CardSkeleton } from '@/components/dashboard/LoadingSkeleton';
import { formatCurrency, type SpendKPIs } from '@/hooks/useSpendData';

interface SpendKPICardsProps {
  data: SpendKPIs | undefined;
  isLoading: boolean;
}

function complianceColor(pct: number) {
  if (pct >= 90) return 'text-[hsl(142,71%,45%)]';
  if (pct >= 70) return 'text-[hsl(38,92%,50%)]';
  return 'text-destructive';
}

function complianceBorder(pct: number) {
  if (pct >= 90) return 'border-l-[hsl(142,71%,45%)]';
  if (pct >= 70) return 'border-l-[hsl(38,92%,50%)]';
  return 'border-l-destructive';
}

// For spend: down is green, up is red. For compliance: up is green, down is red.
function SpendDelta({ value, label, invertColor = false }: { value: number; label: string; invertColor?: boolean }) {
  const isPositive = value >= 0;
  const isGood = invertColor ? isPositive : !isPositive;
  const color = isGood ? 'text-[hsl(142,71%,45%)]' : 'text-destructive';
  return (
    <p className={`text-xs font-medium ${color}`}>
      {isPositive ? '↑' : '↓'} {Math.abs(value)}% {label}
    </p>
  );
}

function ComplianceDelta({ value }: { value: number }) {
  const isGood = value >= 0;
  const color = isGood ? 'text-[hsl(142,71%,45%)]' : 'text-destructive';
  return (
    <p className={`text-xs font-medium ${color}`}>
      {value >= 0 ? '↑' : '↓'} {Math.abs(value)} pts vs prior period
    </p>
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

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
      {/* Total Spend */}
      <div className="glass-card p-4 border-l-4 border-l-[#F04C3B]">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Spend</p>
            <p className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-foreground">{formatCurrency(data.totalSpend)}</p>
            <SpendDelta value={data.totalSpendDelta} label="vs prior period" />
          </div>
          <div className="p-2 rounded-lg bg-[#F04C3B]/10 hidden sm:block">
            <DollarSign className="h-5 w-5 text-[#F04C3B]" />
          </div>
        </div>
      </div>

      {/* Bill Payments */}
      <div className="glass-card p-4 border-l-4 border-l-[#2563EB]">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider">Bill Payments</p>
            <p className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-foreground">{formatCurrency(data.billPayments)}</p>
            <SpendDelta value={data.billPaymentsDelta} label="vs prior period" />
          </div>
          <div className="p-2 rounded-lg bg-[#2563EB]/10 hidden sm:block">
            <Receipt className="h-5 w-5 text-[#2563EB]" />
          </div>
        </div>
      </div>

      {/* Receipt Compliance */}
      <div className={`glass-card p-4 border-l-4 ${complianceBorder(data.receiptCompliance)}`}>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider">Receipt Compliance</p>
            <p className={`text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight ${complianceColor(data.receiptCompliance)}`}>
              {data.receiptCompliance}%
            </p>
            <span className={`text-xs ${complianceColor(data.receiptCompliance)}`}>
              {data.receiptCompliance >= 90 ? 'On track' : data.receiptCompliance >= 70 ? 'Needs attention' : 'Action needed'}
            </span>
            <ComplianceDelta value={data.receiptComplianceDelta} />
          </div>
          <div className="p-2 rounded-lg bg-[hsl(142,71%,45%)]/10 hidden sm:block">
            <ShieldCheck className="h-5 w-5 text-[hsl(142,71%,45%)]" />
          </div>
        </div>
      </div>

      {/* Missing Receipts */}
      <div className="glass-card p-4 border-l-4 border-l-[#F59E0B]">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider">Missing Receipts</p>
            <p className={`text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight ${data.missingReceipts > 50 ? 'text-destructive' : 'text-foreground'}`}>
              {data.missingReceipts.toLocaleString()}
            </p>
            <SpendDelta value={data.missingReceiptsDelta} label="vs prior period" />
          </div>
          <div className="p-2 rounded-lg bg-[#F59E0B]/10 hidden sm:block">
            <AlertTriangle className="h-5 w-5 text-[#F59E0B]" />
          </div>
        </div>
      </div>
    </div>
  );
}

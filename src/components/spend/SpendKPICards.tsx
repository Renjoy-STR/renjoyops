import { DollarSign, ShieldCheck, AlertTriangle, Receipt } from 'lucide-react';
import { KPICard } from '@/components/dashboard/KPICard';
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
      <KPICard
        title="Total Spend"
        value={formatCurrency(data.totalSpend)}
        icon={DollarSign}
        trend={{ value: data.totalSpendDelta, label: 'vs prior period' }}
        accent
      />
      <KPICard
        title="Bill Payments"
        value={formatCurrency(data.billPayments)}
        icon={Receipt}
        trend={{ value: data.billPaymentsDelta, label: 'vs prior period' }}
      />
      <KPICard
        title="Receipt Compliance"
        value={`${data.receiptCompliance}%`}
        icon={ShieldCheck}
        subtitle={
          <span className={complianceColor(data.receiptCompliance)}>
            {data.receiptCompliance >= 90 ? 'On track' : data.receiptCompliance >= 70 ? 'Needs attention' : 'Action needed'}
          </span>
        }
        trend={{ value: data.receiptComplianceDelta, label: 'vs prior period' }}
      />
      <KPICard
        title="Missing Receipts"
        value={data.missingReceipts.toLocaleString()}
        icon={AlertTriangle}
        subtitle={data.missingReceipts > 10 ? 'Action needed' : 'On track'}
        trend={{ value: data.missingReceiptsDelta, label: 'vs prior period' }}
      />
    </div>
  );
}

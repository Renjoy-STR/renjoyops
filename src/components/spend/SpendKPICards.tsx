import { DollarSign, CreditCard, AlertTriangle, Receipt } from 'lucide-react';
import { KPICard } from '@/components/dashboard/KPICard';
import { CardSkeleton } from '@/components/dashboard/LoadingSkeleton';
import { formatCurrency, type useSpendKPIs } from '@/hooks/useSpendData';

interface SpendKPICardsProps {
  data: ReturnType<typeof useSpendKPIs>['data'];
  isLoading: boolean;
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
        title="Avg Transaction"
        value={formatCurrency(data.avgTransaction)}
        icon={CreditCard}
        trend={{ value: data.avgTransactionDelta, label: 'vs prior period' }}
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

import { formatCurrency } from '@/hooks/useSpendData';
import type { DeptCompliance } from '@/hooks/useSpendData';
import { CardSkeleton } from '@/components/dashboard/LoadingSkeleton';

interface Props {
  data: DeptCompliance[];
  isLoading: boolean;
}

function complianceColor(pct: number) {
  if (pct >= 90) return 'bg-[hsl(142,71%,45%)]';
  if (pct >= 70) return 'bg-[hsl(38,92%,50%)]';
  return 'bg-destructive';
}

function complianceTextColor(pct: number) {
  if (pct >= 90) return 'text-[hsl(142,71%,45%)]';
  if (pct >= 70) return 'text-[hsl(38,92%,50%)]';
  return 'text-destructive';
}

export function ReceiptComplianceByDept({ data, isLoading }: Props) {
  if (isLoading) return <CardSkeleton />;
  if (!data.length) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Compliance by Department</h4>
      <div className="grid gap-2">
        {data.map((d) => {
          const pct = Number(d.compliance_pct) || 0;
          return (
            <div key={d.department} className="flex items-center gap-3 text-sm">
              <span className="w-28 truncate text-xs text-muted-foreground">{d.department}</span>
              <div className="flex-1 h-2 rounded-full bg-muted/30 overflow-hidden">
                <div
                  className={`h-full rounded-full ${complianceColor(pct)}`}
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
              <span className={`w-12 text-right text-xs font-medium ${complianceTextColor(pct)}`}>
                {pct}%
              </span>
              <span className="w-16 text-right text-xs text-muted-foreground">
                {Number(d.missing)} missing
              </span>
              <span className="w-20 text-right text-xs text-destructive">
                {formatCurrency(Number(d.at_risk))}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

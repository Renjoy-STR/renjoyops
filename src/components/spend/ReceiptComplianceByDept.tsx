import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { TableSkeleton } from '@/components/dashboard/LoadingSkeleton';
import { formatCurrency, getDeptColor } from '@/hooks/useSpendData';
import type { DeptCompliance } from '@/hooks/useSpendData';

function complianceColor(pct: number) {
  if (pct >= 90) return 'text-[hsl(142,71%,45%)]';
  if (pct >= 70) return 'text-[hsl(38,92%,50%)]';
  return 'text-destructive';
}

function complianceBg(pct: number) {
  if (pct >= 90) return 'bg-[hsl(142,71%,45%)]';
  if (pct >= 70) return 'bg-[hsl(38,92%,50%)]';
  return 'bg-destructive';
}

interface Props {
  data: DeptCompliance[];
  isLoading: boolean;
}

export function ReceiptComplianceByDept({ data, isLoading }: Props) {
  if (isLoading) return <TableSkeleton rows={6} />;
  if (!data.length) return null;

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-foreground">Receipt Compliance by Department</h4>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Department</TableHead>
              <TableHead className="text-xs text-right">Txns &gt;$25</TableHead>
              <TableHead className="text-xs text-right">Missing</TableHead>
              <TableHead className="text-xs text-right">Compliance</TableHead>
              <TableHead className="text-xs text-right">$ At Risk</TableHead>
              <TableHead className="text-xs w-32">Bar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((d, i) => (
              <TableRow key={d.department}>
                <TableCell className="text-sm font-medium">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: getDeptColor(d.department, i) }} />
                    {d.department}
                  </div>
                </TableCell>
                <TableCell className="text-sm text-right">{Number(d.transactions_over_25).toLocaleString()}</TableCell>
                <TableCell className="text-sm text-right font-medium text-destructive">{Number(d.missing_receipts).toLocaleString()}</TableCell>
                <TableCell className="text-sm text-right">
                  <span className={`font-semibold ${complianceColor(Number(d.compliance_pct))}`}>
                    {Number(d.compliance_pct).toFixed(1)}%
                  </span>
                </TableCell>
                <TableCell className="text-sm text-right">{formatCurrency(Number(d.dollars_at_risk))}</TableCell>
                <TableCell>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${complianceBg(Number(d.compliance_pct))}`}
                      style={{ width: `${Math.min(Number(d.compliance_pct), 100)}%` }}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
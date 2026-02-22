import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LabelList,
} from 'recharts';
import { ChartSkeleton } from '@/components/dashboard/LoadingSkeleton';
import { formatCompact } from '@/hooks/useSpendData';
import type { DepartmentSpend } from '@/hooks/useSpendData';

const tooltipStyle = {
  backgroundColor: 'hsl(222, 25%, 11%)',
  border: '1px solid hsl(220, 15%, 18%)',
  borderRadius: '8px',
  fontSize: 12,
};

interface Props {
  data: DepartmentSpend[];
  isLoading: boolean;
}

export function SpendByDepartmentChart({ data, isLoading }: Props) {
  if (isLoading) return <ChartSkeleton />;

  const grandTotal = data.reduce((s, d) => s + (d.total_spend ?? 0), 0);
  const chartData = data.map((d) => ({
    ...d,
    department: d.department ?? 'Unassigned',
    pct: grandTotal > 0 ? ((d.total_spend / grandTotal) * 100).toFixed(1) + '%' : '0%',
  }));

  return (
    <div className="glass-card rounded-lg p-5">
      <h3 className="text-sm font-semibold mb-4">Spend by Department</h3>
      <ResponsiveContainer width="100%" height={Math.max(300, chartData.length * 36)}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 18%)" />
          <XAxis
            type="number"
            tick={{ fontSize: 11, fill: 'hsl(240, 4%, 46%)' }}
            tickFormatter={(v: number) => formatCompact(v)}
          />
          <YAxis
            type="category"
            dataKey="department"
            width={120}
            tick={{ fontSize: 10, fill: 'hsl(240, 4%, 46%)' }}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v: number) => formatCompact(v)}
          />
          <Bar dataKey="total_spend" fill="hsl(5, 87%, 55%)" radius={[0, 4, 4, 0]} name="Spend">
            <LabelList
              dataKey="pct"
              position="right"
              fontSize={10}
              fill="hsl(240, 4%, 46%)"
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

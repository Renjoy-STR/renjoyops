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
import type { MerchantSpend } from '@/hooks/useSpendData';

const tooltipStyle = {
  backgroundColor: 'hsl(222, 25%, 11%)',
  border: '1px solid hsl(220, 15%, 18%)',
  borderRadius: '8px',
  fontSize: 12,
};

interface Props {
  data: MerchantSpend[];
  isLoading: boolean;
}

export function TopMerchantsChart({ data, isLoading }: Props) {
  if (isLoading) return <ChartSkeleton />;

  const chartData = data.map((d) => ({
    ...d,
    label: `${formatCompact(d.total_spend)} (${d.transaction_count})`,
  }));

  return (
    <div className="glass-card rounded-lg p-5">
      <h3 className="text-sm font-semibold mb-4">Top 15 Merchants</h3>
      <ResponsiveContainer width="100%" height={Math.max(300, chartData.length * 32)}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 80 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 18%)" />
          <XAxis
            type="number"
            tick={{ fontSize: 11, fill: 'hsl(240, 4%, 46%)' }}
            tickFormatter={(v: number) => formatCompact(v)}
          />
          <YAxis
            type="category"
            dataKey="merchant_name"
            width={160}
            tick={{ fontSize: 9, fill: 'hsl(240, 4%, 46%)' }}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v: number) => formatCompact(v)}
          />
          <Bar dataKey="total_spend" fill="hsl(210, 60%, 55%)" radius={[0, 4, 4, 0]} name="Spend">
            <LabelList
              dataKey="label"
              position="right"
              fontSize={9}
              fill="hsl(240, 4%, 46%)"
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

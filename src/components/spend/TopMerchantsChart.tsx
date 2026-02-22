import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LabelList,
  Cell,
} from 'recharts';
import { ChartSkeleton } from '@/components/dashboard/LoadingSkeleton';
import { formatCompact } from '@/hooks/useSpendData';
import type { MerchantSpend } from '@/hooks/useSpendData';

const tooltipStyle = {
  backgroundColor: '#1e293b',
  border: '1px solid #334155',
  borderRadius: '8px',
  fontSize: 12,
  color: '#f8fafc',
};

// Gradient from brightest (top) to lightest (bottom)
function getMerchantColor(index: number, total: number) {
  // Interpolate from #F04C3B to #FFEFEF
  const r1 = 240, g1 = 76, b1 = 59;
  const r2 = 255, g2 = 239, b2 = 239;
  const t = total > 1 ? index / (total - 1) : 0;
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

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
        <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 100 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis
            type="number"
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            tickFormatter={(v: number) => formatCompact(v)}
          />
          <YAxis
            type="category"
            dataKey="merchant_name"
            width={160}
            tick={{ fontSize: 9, fill: '#94a3b8' }}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v: number) => formatCompact(v)}
          />
          <Bar dataKey="total_spend" radius={[0, 4, 4, 0]} name="Spend">
            {chartData.map((_, i) => (
              <Cell key={i} fill={getMerchantColor(i, chartData.length)} />
            ))}
            <LabelList
              dataKey="label"
              position="right"
              fontSize={9}
              fill="#94a3b8"
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

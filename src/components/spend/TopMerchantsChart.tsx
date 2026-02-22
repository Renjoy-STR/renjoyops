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
import { formatCompact, formatCurrency } from '@/hooks/useSpendData';
import type { MerchantSpend } from '@/hooks/useSpendData';

// Gradient from brightest (top) to a visible minimum (bottom)
function getMerchantColor(index: number, total: number) {
  const r1 = 240, g1 = 76, b1 = 59;   // #F04C3B
  const r2 = 230, g2 = 180, b2 = 175;  // softer endpoint, still visible
  const t = total > 1 ? index / (total - 1) : 0;
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

function formatLabel(spend: number, count: number) {
  return `${formatCompact(spend)} (${count})`;
}

interface Props {
  data: MerchantSpend[];
  isLoading: boolean;
}

export function TopMerchantsChart({ data, isLoading }: Props) {
  if (isLoading) return <ChartSkeleton />;

  const chartData = data.map((d) => ({
    ...d,
    label: formatLabel(d.total_spend, d.transaction_count),
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div className="p-2.5 rounded-lg border text-xs" style={{ backgroundColor: 'hsl(215 25% 15%)', borderColor: 'hsl(215 20% 25%)', color: '#f8fafc' }}>
        <p className="font-medium text-white">{d.merchant_name}</p>
        <p className="text-slate-300">{formatCurrency(d.total_spend)}</p>
        <p className="text-slate-300">{d.transaction_count.toLocaleString()} transactions</p>
      </div>
    );
  };

  return (
    <div className="glass-card rounded-lg p-5">
      <h3 className="text-sm font-semibold mb-4">Top 15 Merchants</h3>
      <ResponsiveContainer width="100%" height={Math.max(300, chartData.length * 32)}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 110 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 20% 25%)" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 11, fill: 'hsl(215 15% 60%)' }}
            tickFormatter={(v: number) => formatCompact(v)}
          />
          <YAxis
            type="category"
            dataKey="merchant_name"
            width={175}
            tick={{ fontSize: 9, fill: 'hsl(215 15% 60%)' }}
            tickFormatter={(v: string) => v.length > 26 ? v.slice(0, 24) + '...' : v}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(215 20% 25% / 0.3)' }} />
          <Bar dataKey="total_spend" radius={[0, 4, 4, 0]} name="Spend">
            {chartData.map((_, i) => (
              <Cell key={i} fill={getMerchantColor(i, chartData.length)} />
            ))}
            <LabelList
              dataKey="label"
              position="right"
              fontSize={9}
              fill="hsl(215 15% 60%)"
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

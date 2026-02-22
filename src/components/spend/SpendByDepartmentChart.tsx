import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';
import { ChartSkeleton } from '@/components/dashboard/LoadingSkeleton';
import { formatCompact, formatCurrency, getDeptColor } from '@/hooks/useSpendData';
import type { DepartmentSpend } from '@/hooks/useSpendData';

interface Props {
  data: DepartmentSpend[];
  isLoading: boolean;
}

export function SpendByDepartmentChart({ data, isLoading }: Props) {
  if (isLoading) return <ChartSkeleton />;

  const grandTotal = data.reduce((s, d) => s + Number(d.total_spend ?? 0), 0);
  const chartData = data.map((d) => ({
    ...d,
    total_spend: Number(d.total_spend),
    department: d.department ?? 'Unassigned',
    pct: grandTotal > 0 ? ((Number(d.total_spend) / grandTotal) * 100) : 0,
    label: `${formatCompact(Number(d.total_spend))} · ${grandTotal > 0 ? ((Number(d.total_spend) / grandTotal) * 100).toFixed(1) : '0.0'}%`,
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div className="p-2.5 rounded-lg border text-xs" style={{ backgroundColor: 'hsl(215 25% 15%)', borderColor: 'hsl(215 20% 25%)', color: '#f8fafc' }}>
        <p className="font-medium text-white">{d.department}</p>
        <p className="text-slate-300">{formatCurrency(d.total_spend)}</p>
        <p className="text-slate-300">{d.transaction_count?.toLocaleString()} transactions</p>
        {d.avg_transaction && <p className="text-slate-300">Avg: {formatCurrency(d.avg_transaction)}</p>}
        <p className="text-slate-300">{d.pct.toFixed(1)}% of total</p>
      </div>
    );
  };

  return (
    <div className="glass-card rounded-lg p-5">
      <h3 className="text-sm font-semibold mb-4">Spend by Department</h3>
      <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 45 + 40)}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 90 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 20% 25%)" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 11, fill: 'hsl(215 15% 60%)' }}
            tickFormatter={(v: number) => formatCompact(v)}
          />
          <YAxis
            type="category"
            dataKey="department"
            width={115}
            tick={{ fontSize: 10, fill: 'hsl(215 15% 60%)' }}
            tickFormatter={(v: string) => v.length > 14 ? v.slice(0, 12) + '...' : v}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(215 20% 25% / 0.3)' }} />
          <Bar dataKey="total_spend" radius={[0, 4, 4, 0]} barSize={28} name="Spend">
            {chartData.map((d, i) => (
              <Cell key={i} fill={getDeptColor(d.department, i)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

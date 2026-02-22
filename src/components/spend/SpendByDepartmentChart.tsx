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
import { formatCompact, getDeptColor } from '@/hooks/useSpendData';
import type { DepartmentSpend } from '@/hooks/useSpendData';

const tooltipStyle = {
  backgroundColor: '#1e293b',
  border: '1px solid #334155',
  borderRadius: '8px',
  fontSize: 12,
  color: '#f8fafc',
};

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
    pct: grandTotal > 0 ? ((Number(d.total_spend) / grandTotal) * 100).toFixed(1) + '%' : '0%',
  }));

  return (
    <div className="glass-card rounded-lg p-5">
      <h3 className="text-sm font-semibold mb-4">Spend by Department</h3>
      <ResponsiveContainer width="100%" height={Math.max(300, chartData.length * 36)}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis
            type="number"
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            tickFormatter={(v: number) => formatCompact(v)}
          />
          <YAxis
            type="category"
            dataKey="department"
            width={120}
            tick={{ fontSize: 10, fill: '#94a3b8' }}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v: number) => formatCompact(v)}
          />
          <Bar dataKey="total_spend" radius={[0, 4, 4, 0]} name="Spend">
            {chartData.map((d, i) => (
              <Cell key={i} fill={getDeptColor(d.department, i)} />
            ))}
            <LabelList
              dataKey="pct"
              position="right"
              fontSize={10}
              fill="#94a3b8"
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

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
import type { DepartmentSpend } from '@/hooks/useSpendData';

const tooltipStyle = {
  backgroundColor: 'hsl(222, 25%, 11%)',
  border: '1px solid hsl(220, 15%, 18%)',
  borderRadius: '8px',
  fontSize: 12,
};

const DEPT_COLORS = [
  '#F04C3B', '#75241C', '#2563EB', '#10B981', '#F59E0B',
  '#8B5CF6', '#EC4899', '#6366F1', '#14B8A6', '#FF7F6B',
  '#D97706', '#7C3AED',
];

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
          <Bar dataKey="total_spend" radius={[0, 4, 4, 0]} name="Spend">
            {chartData.map((_, i) => (
              <Cell key={i} fill={DEPT_COLORS[i % DEPT_COLORS.length]} />
            ))}
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

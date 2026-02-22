import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from 'recharts';
import { ChartSkeleton } from '@/components/dashboard/LoadingSkeleton';
import { formatCompact } from '@/hooks/useSpendData';
import type { CategorySpend } from '@/hooks/useSpendData';

const tooltipStyle = {
  backgroundColor: 'hsl(222, 25%, 11%)',
  border: '1px solid hsl(220, 15%, 18%)',
  borderRadius: '8px',
  fontSize: 12,
};

const COLORS = [
  'hsl(5, 87%, 55%)',
  'hsl(210, 60%, 55%)',
  'hsl(38, 92%, 50%)',
  'hsl(142, 71%, 45%)',
  'hsl(280, 60%, 55%)',
  'hsl(180, 60%, 45%)',
  'hsl(320, 60%, 55%)',
  'hsl(45, 80%, 50%)',
  'hsl(0, 0%, 55%)',
];

interface Props {
  data: CategorySpend[];
  isLoading: boolean;
}

export function SpendByCategoryChart({ data, isLoading }: Props) {
  if (isLoading) return <ChartSkeleton />;

  const chartData = data.map((d) => ({
    name: d.category,
    value: d.total_spend,
  }));

  return (
    <div className="glass-card rounded-lg p-5">
      <h3 className="text-sm font-semibold mb-4">Spend by Category</h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            dataKey="value"
            paddingAngle={2}
            label={({ name, percent }) =>
              `${name} ${(percent * 100).toFixed(1)}%`
            }
            labelLine={{ stroke: 'hsl(240, 4%, 46%)' }}
          >
            {chartData.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v: number) => formatCompact(v)}
          />
          <Legend
            wrapperStyle={{ fontSize: 11 }}
            formatter={(value: string) => (
              <span style={{ color: 'hsl(240, 4%, 46%)' }}>{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

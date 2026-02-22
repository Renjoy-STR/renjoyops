import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { ChartSkeleton } from '@/components/dashboard/LoadingSkeleton';
import { formatCompact } from '@/hooks/useSpendData';
import type { DailySpend } from '@/hooks/useSpendData';

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
  'hsl(160, 50%, 50%)',
  'hsl(240, 50%, 60%)',
  'hsl(20, 80%, 50%)',
  'hsl(90, 50%, 45%)',
];

interface Props {
  data: DailySpend[];
  isLoading: boolean;
  showByDepartment: boolean;
  departments: string[];
}

export function SpendOverTimeChart({ data, isLoading, showByDepartment, departments }: Props) {
  if (isLoading) return <ChartSkeleton />;

  return (
    <div className="glass-card rounded-lg p-5">
      <h3 className="text-sm font-semibold mb-4">Spend Over Time</h3>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data} margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 18%)" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: 'hsl(240, 4%, 46%)' }}
            tickFormatter={(v: string) => v.slice(5)}
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'hsl(240, 4%, 46%)' }}
            tickFormatter={(v: number) => formatCompact(v)}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v: number) => formatCompact(v)}
            labelFormatter={(l: string) => `Date: ${l}`}
          />
          {showByDepartment && departments.length > 0 ? (
            departments.map((dept, i) => (
              <Area
                key={dept}
                type="monotone"
                dataKey={dept}
                stackId="1"
                stroke={COLORS[i % COLORS.length]}
                fill={COLORS[i % COLORS.length]}
                fillOpacity={0.3}
              />
            ))
          ) : (
            <Area
              type="monotone"
              dataKey="total"
              stroke="hsl(5, 87%, 55%)"
              fill="hsl(5, 87%, 55%)"
              fillOpacity={0.2}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

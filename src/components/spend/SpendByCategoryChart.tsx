import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from 'recharts';
import { ChartSkeleton } from '@/components/dashboard/LoadingSkeleton';
import { formatCompact, formatCurrency } from '@/hooks/useSpendData';
import type { CategorySpend } from '@/hooks/useSpendData';

const tooltipStyle = {
  backgroundColor: 'hsl(222, 25%, 11%)',
  border: '1px solid hsl(220, 15%, 18%)',
  borderRadius: '8px',
  fontSize: 12,
};

const COLORS = [
  '#F04C3B', '#2563EB', '#10B981', '#F59E0B', '#8B5CF6',
  '#EC4899', '#6366F1', '#14B8A6', '#75241C',
];

interface Props {
  data: CategorySpend[];
  isLoading: boolean;
}

export function SpendByCategoryChart({ data, isLoading }: Props) {
  if (isLoading) return <ChartSkeleton />;

  const grandTotal = data.reduce((s, d) => s + Number(d.total_spend), 0);
  const chartData = data.map((d) => ({
    name: d.category,
    value: Number(d.total_spend),
    count: Number(d.transaction_count ?? 0),
    pct: grandTotal > 0 ? ((Number(d.total_spend) / grandTotal) * 100) : 0,
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div style={tooltipStyle} className="p-2.5">
        <p className="text-xs font-medium text-foreground">{d.name}</p>
        <p className="text-xs text-muted-foreground">{formatCurrency(d.value)}</p>
        <p className="text-xs text-muted-foreground">{d.pct.toFixed(1)}% of total</p>
        <p className="text-xs text-muted-foreground">{d.count} transactions</p>
      </div>
    );
  };

  return (
    <div className="glass-card rounded-lg p-5">
      <h3 className="text-sm font-semibold mb-4">Spend by Category</h3>
      <div className="flex flex-col items-center">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={90}
              dataKey="value"
              paddingAngle={2}
              label={false}
            >
              {chartData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        {/* Legend below chart */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 w-full max-w-sm">
          {chartData.filter(d => d.pct > 2).map((d, i) => (
            <div key={d.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
              <span className="truncate">{d.name}</span>
              <span className="ml-auto font-medium text-foreground">{d.pct.toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

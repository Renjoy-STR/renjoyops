import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from 'recharts';
import { ChartSkeleton } from '@/components/dashboard/LoadingSkeleton';
import { formatCompact, formatCurrency, CATEGORY_COLORS } from '@/hooks/useSpendData';
import type { CategorySpend } from '@/hooks/useSpendData';

interface Props {
  data: CategorySpend[];
  isLoading: boolean;
}

function truncateAtWord(str: string, maxLen: number) {
  if (str.length <= maxLen) return str;
  const truncated = str.slice(0, maxLen);
  const lastSpace = truncated.lastIndexOf(' ');
  return (lastSpace > maxLen * 0.5 ? truncated.slice(0, lastSpace) : truncated) + '...';
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
      <div className="p-2.5 rounded-lg border text-xs" style={{ backgroundColor: 'hsl(215 25% 15%)', borderColor: 'hsl(215 20% 25%)', color: '#f8fafc' }}>
        <p className="font-medium text-white">{d.name}</p>
        <p className="text-slate-300">{formatCurrency(d.value)}</p>
        <p className="text-slate-300">{d.pct.toFixed(1)}% of total</p>
        <p className="text-slate-300">{d.count} transactions</p>
      </div>
    );
  };

  return (
    <div className="glass-card rounded-lg p-5">
      <h3 className="text-sm font-semibold mb-4">Spend by Category</h3>
      <div className="flex flex-col items-center">
        <div className="relative">
          <ResponsiveContainer width={260} height={220}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={95}
                dataKey="value"
                paddingAngle={2}
                label={false}
              >
                {chartData.map((_, i) => (
                  <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          {/* Center total */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Total</span>
            <span className="text-lg font-bold text-foreground">{formatCompact(grandTotal)}</span>
          </div>
        </div>
        {/* Legend below chart */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-3 w-full max-w-sm">
          {chartData.filter(d => d.pct > 2).map((d, i) => (
            <div key={d.name} className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }} />
              <span className="truncate" title={d.name}>{truncateAtWord(d.name, 24)}</span>
              <span className="ml-auto font-medium text-foreground shrink-0">{d.pct.toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

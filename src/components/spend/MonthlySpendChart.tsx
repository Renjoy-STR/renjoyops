import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { ChartSkeleton } from '@/components/dashboard/LoadingSkeleton';
import { formatCompact, formatCurrency } from '@/hooks/useSpendData';
import type { MonthlySpendSummary } from '@/hooks/useSpendData';

interface Props {
  data: MonthlySpendSummary[];
  isLoading: boolean;
}

const tooltipStyle = {
  backgroundColor: 'hsl(215 25% 15%)',
  border: '1px solid hsl(215 20% 25%)',
  borderRadius: '8px',
  fontSize: 12,
  color: '#f8fafc',
};

function formatDelta(current: number, prior: number) {
  if (prior === 0) return '';
  const pct = ((current - prior) / prior * 100).toFixed(1);
  const sign = current >= prior ? '+' : '';
  return `${sign}${pct}%`;
}

export function MonthlySpendChart({ data, isLoading }: Props) {
  if (isLoading) return <ChartSkeleton />;
  if (!data.length) return null;

  const chartData = data.map(d => ({
    ...d,
    month_label: new Date(d.month + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
  }));

  const latest = chartData[chartData.length - 1];
  const prior = chartData.length > 1 ? chartData[chartData.length - 2] : null;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    return (
      <div style={tooltipStyle} className="p-3 min-w-[160px]">
        <p className="text-xs text-slate-400 mb-1.5 font-medium">{d?.month_label}</p>
        <p className="text-xs text-white">Spend: {formatCurrency(d?.total_spend ?? 0)}</p>
        <p className="text-xs text-slate-300">Transactions: {(d?.transaction_count ?? 0).toLocaleString()}</p>
        <p className="text-xs text-slate-300">Avg: {formatCurrency(d?.avg_transaction ?? 0)}</p>
        <p className="text-xs text-slate-300">Merchants: {d?.unique_merchants ?? 0}</p>
      </div>
    );
  };

  return (
    <div className="glass-card rounded-lg p-5">
      <h3 className="text-sm font-semibold mb-4">Monthly Spend Trend</h3>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={chartData} margin={{ left: 16, right: 16, top: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 20% 25%)" />
          <XAxis
            dataKey="month_label"
            tick={{ fontSize: 11, fill: 'hsl(215 15% 60%)' }}
          />
          <YAxis
            yAxisId="spend"
            tick={{ fontSize: 11, fill: 'hsl(215 15% 60%)' }}
            tickFormatter={(v: number) => formatCompact(v)}
            width={60}
          />
          <YAxis
            yAxisId="count"
            orientation="right"
            tick={{ fontSize: 11, fill: 'hsl(215 15% 60%)' }}
            tickFormatter={(v: number) => v.toLocaleString()}
            width={50}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar
            yAxisId="spend"
            dataKey="total_spend"
            fill="#F04C3B"
            fillOpacity={0.8}
            radius={[4, 4, 0, 0]}
            name="Total Spend"
          />
          <Line
            yAxisId="count"
            type="monotone"
            dataKey="transaction_count"
            stroke="#2563EB"
            strokeWidth={2}
            dot={{ r: 3, fill: '#2563EB' }}
            name="Transactions"
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Month-over-month comparison stats */}
      {prior && (
        <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-border">
          <div className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Spend: </span>
            {formatCompact(prior.total_spend)} → {formatCompact(latest.total_spend)}{' '}
            <span className={latest.total_spend > prior.total_spend ? 'text-destructive' : 'text-[hsl(var(--success))]'}>
              ({formatDelta(latest.total_spend, prior.total_spend)})
            </span>
          </div>
          <div className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Transactions: </span>
            {prior.transaction_count.toLocaleString()} → {latest.transaction_count.toLocaleString()}{' '}
            <span className="text-muted-foreground">
              ({formatDelta(latest.transaction_count, prior.transaction_count)})
            </span>
          </div>
          <div className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Merchants: </span>
            {prior.unique_merchants} → {latest.unique_merchants}{' '}
            <span className="text-muted-foreground">
              ({formatDelta(latest.unique_merchants, prior.unique_merchants)})
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

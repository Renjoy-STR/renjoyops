import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Line,
} from 'recharts';
import { ChartSkeleton } from '@/components/dashboard/LoadingSkeleton';
import { formatCompact } from '@/hooks/useSpendData';
import { getDeptColor } from '@/hooks/useSpendData';
import type { DailySpend } from '@/hooks/useSpendData';

const tooltipStyle = {
  backgroundColor: '#1e293b',
  border: '1px solid #334155',
  borderRadius: '8px',
  fontSize: 12,
  color: '#f8fafc',
};

interface Props {
  data: DailySpend[];
  isLoading: boolean;
  showByDepartment: boolean;
  departments: string[];
}

export function SpendOverTimeChart({ data, isLoading, showByDepartment, departments }: Props) {
  if (isLoading) return <ChartSkeleton />;

  // Clip negative values for chart display, track refunds
  const chartData = data.map(d => {
    const entry: Record<string, any> = { date: d.date };
    const total = Number(d.total) || 0;
    entry.total = Math.max(total, 0);
    entry._refunds = total < 0 ? Math.abs(total) : 0;

    if (showByDepartment) {
      departments.forEach(dept => {
        const val = Number(d[dept]) || 0;
        entry[dept] = Math.max(val, 0);
      });
    }
    return entry;
  });

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const refunds = payload[0]?.payload?._refunds || 0;
    const total = payload.reduce((s: number, p: any) => s + (p.value || 0), 0);
    return (
      <div style={tooltipStyle} className="p-3">
        <p className="text-xs text-slate-400 mb-1.5 font-medium">{label}</p>
        <p className="text-xs text-white font-semibold mb-1">Total: {formatCompact(total)}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} className="text-xs" style={{ color: p.color }}>
            {p.name}: {formatCompact(p.value)}
          </p>
        ))}
        {refunds > 0 && (
          <p className="text-xs text-slate-400 mt-1.5 border-t border-slate-600 pt-1">
            Includes {formatCompact(refunds)} in refunds
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="glass-card rounded-lg p-5">
      <h3 className="text-sm font-semibold mb-4">Spend Over Time</h3>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={chartData} margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            tickFormatter={(v: string) => {
              const d = new Date(v + 'T00:00:00');
              return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            }}
            interval="preserveStartEnd"
            minTickGap={50}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            tickFormatter={(v: number) => formatCompact(v)}
          />
          <Tooltip content={<CustomTooltip />} />
          {showByDepartment && departments.length > 0 ? (
            <>
              {departments.map((dept, i) => (
                <Area
                  key={dept}
                  type="monotone"
                  dataKey={dept}
                  stackId="1"
                  stroke={getDeptColor(dept, i)}
                  fill={getDeptColor(dept, i)}
                  fillOpacity={0.3}
                />
              ))}
              <Line
                type="monotone"
                dataKey="total"
                stroke="#ffffff"
                strokeWidth={1}
                strokeDasharray="4 3"
                dot={false}
                opacity={0.4}
              />
            </>
          ) : (
            <Area
              type="monotone"
              dataKey="total"
              stroke="#F04C3B"
              fill="#F04C3B"
              fillOpacity={0.15}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

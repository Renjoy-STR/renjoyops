import { useMemo } from 'react';
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
import { formatCompact, getDeptColor } from '@/hooks/useSpendData';
import type { DailySpend } from '@/hooks/useSpendData';

const tooltipStyle = {
  backgroundColor: 'hsl(215 25% 15%)',
  border: '1px solid hsl(215 20% 25%)',
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

  // Find top 5 departments by total spend, bucket rest as "Other"
  const { topDepts, chartData } = useMemo(() => {
    if (!showByDepartment || departments.length <= 6) {
      const cd = data.map(d => {
        const entry: Record<string, any> = { date: d.date };
        const total = Number(d.total) || 0;
        entry.total = Math.max(total, 0);
        entry._refunds = total < 0 ? Math.abs(total) : 0;
        departments.forEach(dept => {
          entry[dept] = Math.max(Number(d[dept]) || 0, 0);
        });
        return entry;
      });
      return { topDepts: departments, chartData: cd };
    }

    // Sum each department across all periods
    const deptTotals: Record<string, number> = {};
    departments.forEach(dept => {
      deptTotals[dept] = data.reduce((s, d) => s + (Number(d[dept]) || 0), 0);
    });
    const sorted = Object.entries(deptTotals).sort((a, b) => b[1] - a[1]);
    const top5 = sorted.slice(0, 5).map(([k]) => k);
    const otherDepts = sorted.slice(5).map(([k]) => k);

    const cd = data.map(d => {
      const entry: Record<string, any> = { date: d.date };
      const total = Number(d.total) || 0;
      entry.total = Math.max(total, 0);
      entry._refunds = total < 0 ? Math.abs(total) : 0;
      top5.forEach(dept => {
        entry[dept] = Math.max(Number(d[dept]) || 0, 0);
      });
      entry['Other'] = otherDepts.reduce((s, dept) => s + Math.max(Number(d[dept]) || 0, 0), 0);
      return entry;
    });

    return { topDepts: [...top5, 'Other'], chartData: cd };
  }, [data, departments, showByDepartment]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const refunds = payload[0]?.payload?._refunds || 0;
    const total = payload[0]?.payload?.total || 0;
    return (
      <div style={tooltipStyle} className="p-3 min-w-[160px]">
        <p className="text-xs text-slate-400 mb-1.5 font-medium">{label}</p>
        <p className="text-xs text-white font-semibold mb-1">Total: {formatCompact(total)}</p>
        {payload.map((p: any, i: number) => (
          p.dataKey !== 'total' && (
            <p key={i} className="text-xs" style={{ color: p.color }}>
              {p.name}: {formatCompact(p.value)}
            </p>
          )
        ))}
        {refunds > 0 && (
          <p className="text-xs text-slate-400 mt-1.5 border-t border-slate-600 pt-1">
            Includes {formatCompact(refunds)} in refunds
          </p>
        )}
      </div>
    );
  };

  const getColor = (dept: string, i: number) => {
    if (dept === 'Other') return '#6B7280';
    return getDeptColor(dept, i);
  };

  return (
    <div className="glass-card rounded-lg p-5">
      <h3 className="text-sm font-semibold mb-4">Spend Over Time</h3>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={chartData} margin={{ left: 16, right: 10, top: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 20% 25%)" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: 'hsl(215 15% 60%)' }}
            tickFormatter={(v: string) => {
              const d = new Date(v + 'T00:00:00');
              return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            }}
            interval="preserveStartEnd"
            minTickGap={50}
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'hsl(215 15% 60%)' }}
            tickFormatter={(v: number) => formatCompact(v)}
            width={60}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'hsl(215 15% 45%)', strokeWidth: 1, strokeDasharray: '4 3' }} />
          {showByDepartment && topDepts.length > 0 ? (
            <>
              {topDepts.map((dept, i) => (
                <Area
                  key={dept}
                  type="monotone"
                  dataKey={dept}
                  stackId="1"
                  stroke={getColor(dept, i)}
                  fill={getColor(dept, i)}
                  fillOpacity={0.3}
                />
              ))}
              <Line
                type="monotone"
                dataKey="total"
                stroke="hsl(0 0% 100%)"
                strokeWidth={1}
                strokeDasharray="4 3"
                dot={false}
                opacity={0.35}
              />
            </>
          ) : (
            <Area
              type="monotone"
              dataKey="total"
              stroke="hsl(5 87% 55%)"
              fill="hsl(5 87% 55%)"
              fillOpacity={0.15}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

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

const DEPT_COLORS: Record<string, string> = {
  'Maintenance': '#75241C',
  'Housekeeping': '#F04C3B',
  'IT': '#2563EB',
  'Operations': '#10B981',
  'Finance': '#F59E0B',
  'Marketing': '#8B5CF6',
  'Sales': '#EC4899',
  'Guest Experience': '#FF7F6B',
  'Human Resources': '#6366F1',
  'Admin': '#14B8A6',
  'Projects': '#D97706',
  'Owner Relations': '#7C3AED',
  'Unassigned': '#6B7280',
};

function getDeptColor(dept: string, idx: number) {
  if (DEPT_COLORS[dept]) return DEPT_COLORS[dept];
  const fallback = ['#F04C3B', '#2563EB', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#6366F1', '#14B8A6', '#75241C', '#FF7F6B'];
  return fallback[idx % fallback.length];
}

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
    return (
      <div style={tooltipStyle} className="p-2.5">
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} className="text-xs" style={{ color: p.color }}>
            {p.name}: {formatCompact(p.value)}
          </p>
        ))}
        {refunds > 0 && (
          <p className="text-xs text-muted-foreground mt-1">Includes {formatCompact(refunds)} in refunds</p>
        )}
      </div>
    );
  };

  return (
    <div className="glass-card rounded-lg p-5">
      <h3 className="text-sm font-semibold mb-4">Spend Over Time</h3>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={chartData} margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 18%)" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: 'hsl(240, 4%, 46%)' }}
            tickFormatter={(v: string) => {
              const d = new Date(v + 'T00:00:00');
              return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            }}
            interval="preserveStartEnd"
            minTickGap={40}
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'hsl(240, 4%, 46%)' }}
            tickFormatter={(v: number) => formatCompact(v)}
          />
          <Tooltip content={<CustomTooltip />} />
          {showByDepartment && departments.length > 0 ? (
            departments.map((dept, i) => (
              <Area
                key={dept}
                type="monotone"
                dataKey={dept}
                stackId="1"
                stroke={getDeptColor(dept, i)}
                fill={getDeptColor(dept, i)}
                fillOpacity={0.3}
              />
            ))
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

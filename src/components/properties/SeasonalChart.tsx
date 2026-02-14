import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

const tooltipStyle = {
  backgroundColor: 'hsl(0, 0%, 100%)',
  border: '1px solid hsl(0, 0%, 90%)',
  borderRadius: '8px',
  fontSize: 12,
};

interface Props {
  data: { month: string; housekeeping: number; maintenance: number }[];
}

export function SeasonalChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(0, 0%, 90%)" />
        <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'hsl(240, 4%, 40%)' }} />
        <YAxis tick={{ fontSize: 10, fill: 'hsl(240, 4%, 40%)' }} />
        <Tooltip contentStyle={tooltipStyle} />
        <Bar dataKey="housekeeping" fill="hsl(210, 60%, 55%)" name="Housekeeping" stackId="a" radius={[0, 0, 0, 0]} />
        <Bar dataKey="maintenance" fill="hsl(5, 87%, 55%)" name="Maintenance" stackId="a" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

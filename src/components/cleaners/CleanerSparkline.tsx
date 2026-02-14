import { ResponsiveContainer, LineChart, Line } from 'recharts';

interface Props {
  data: { week: string; avg: number }[];
  color?: string;
}

export function CleanerSparkline({ data, color = 'hsl(var(--primary))' }: Props) {
  if (data.length < 2) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="w-[80px] h-[24px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line type="monotone" dataKey="avg" stroke={color} strokeWidth={1.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { CleanerData } from '@/hooks/useCleanerData';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendIndicator } from './TrendIndicator';
import { Clock, Home, Zap, Award, Calendar, BarChart3 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Props {
  cleaner: CleanerData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const tooltipStyle = {
  backgroundColor: 'hsl(var(--background))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
  fontSize: 12,
};

export function CleanerDetailSheet({ cleaner, open, onOpenChange }: Props) {
  if (!cleaner) return null;

  const bestProperties = [...cleaner.cleans_by_property]
    .filter(p => p.count >= 2)
    .sort((a, b) => a.avg - b.avg)
    .slice(0, 3);

  const worstProperties = [...cleaner.cleans_by_property]
    .filter(p => p.count >= 2)
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 3);

  const isFlagged = cleaner.median_minutes > 180;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-secondary flex items-center gap-2">
            {cleaner.assignee_name}
            <TrendIndicator direction={cleaner.trend_direction} showLabel />
          </SheetTitle>
          <SheetDescription>
            {cleaner.total_cleans} cleans across {cleaner.properties_cleaned} properties
            {isFlagged && (
              <Badge variant="destructive" className="ml-2 text-[10px]">Flagged</Badge>
            )}
          </SheetDescription>
        </SheetHeader>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          {[
            { label: 'Avg Time', value: `${cleaner.avg_minutes}m`, icon: Clock },
            { label: 'Adj. Avg', value: `${cleaner.adjusted_avg}m`, icon: Award },
            { label: 'Total Cleans', value: cleaner.total_cleans, icon: Calendar },
            { label: 'Consistency (σ)', value: `${cleaner.std_dev}m`, icon: BarChart3 },
            { label: 'Properties', value: cleaner.properties_cleaned, icon: Home },
            { label: 'Schedule Eff.', value: `${cleaner.schedule_efficiency}%`, icon: Zap },
          ].map(s => (
            <div key={s.label} className="bg-muted/50 rounded-lg p-3 text-center">
              <s.icon className="h-3.5 w-3.5 mx-auto mb-1 text-primary" />
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
              <p className="text-base font-bold text-foreground">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Range row */}
        <div className="flex items-center justify-between mt-4 px-1 text-xs text-muted-foreground">
          <span>Fastest: <strong className="text-foreground">{cleaner.fastest_minutes}m</strong></span>
          <span>Median: <strong className="text-foreground">{cleaner.median_minutes}m</strong></span>
          <span>Slowest: <strong className="text-foreground">{cleaner.slowest_minutes}m</strong></span>
        </div>

        {/* Trend chart */}
        <div className="mt-6">
          <h4 className="text-sm font-semibold text-secondary mb-2">Clean Time Trend (Weekly)</h4>
          {cleaner.weekly_trend.length >= 2 ? (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={cleaner.weekly_trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="week" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v: string) => v.slice(5)} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="avg" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 2, fill: 'hsl(var(--primary))' }} name="Avg min" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground">Not enough weekly data for trend</p>
          )}
        </div>

        {/* Best / Worst Properties */}
        <div className="grid grid-cols-2 gap-4 mt-6">
          <div>
            <h4 className="text-sm font-semibold text-green-700 mb-2">🏆 Best Properties</h4>
            {bestProperties.length > 0 ? bestProperties.map(p => (
              <div key={p.home_id} className="flex justify-between text-xs py-1.5 border-b border-border/50">
                <span className="truncate max-w-[120px]">{p.property_name}</span>
                <span className="font-mono text-green-700">{p.avg}m</span>
              </div>
            )) : <p className="text-xs text-muted-foreground">Need 2+ cleans</p>}
          </div>
          <div>
            <h4 className="text-sm font-semibold text-destructive mb-2">⚠ Slowest Properties</h4>
            {worstProperties.length > 0 ? worstProperties.map(p => (
              <div key={p.home_id} className="flex justify-between text-xs py-1.5 border-b border-border/50">
                <span className="truncate max-w-[120px]">{p.property_name}</span>
                <span className="font-mono text-destructive">{p.avg}m</span>
              </div>
            )) : <p className="text-xs text-muted-foreground">Need 2+ cleans</p>}
          </div>
        </div>

        {/* All properties table */}
        <div className="mt-6">
          <h4 className="text-sm font-semibold text-secondary mb-2">All Properties ({cleaner.cleans_by_property.length})</h4>
          <div className="max-h-[280px] overflow-auto rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Property</TableHead>
                  <TableHead className="text-xs text-right">Cleans</TableHead>
                  <TableHead className="text-xs text-right">Avg (min)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cleaner.cleans_by_property.map((p, i) => (
                  <TableRow key={p.home_id} className={i % 2 === 1 ? 'bg-muted/30' : ''}>
                    <TableCell className="text-xs truncate max-w-[180px]">{p.property_name}</TableCell>
                    <TableCell className="text-xs text-right font-mono">{p.count}</TableCell>
                    <TableCell className="text-xs text-right font-mono">{p.avg}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

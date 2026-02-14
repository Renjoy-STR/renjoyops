import { useDateRange } from '@/contexts/DateRangeContext';
import { Button } from '@/components/ui/button';
import { Calendar } from 'lucide-react';
import { subDays, format } from 'date-fns';

const presets = [
  { label: '7D', days: 7 },
  { label: '30D', days: 30 },
  { label: '90D', days: 90 },
  { label: '1Y', days: 365 },
];

export function DateRangeFilter() {
  const { dateRange, setDateRange } = useDateRange();

  const activeDays = Math.round((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24));

  return (
    <div className="flex items-center gap-2">
      <Calendar className="h-4 w-4 text-muted-foreground hidden sm:block" />
      <span className="text-xs text-muted-foreground hidden md:block">
        {format(dateRange.from, 'MMM d')} — {format(dateRange.to, 'MMM d, yyyy')}
      </span>
      <div className="flex gap-1">
        {presets.map((preset) => (
          <Button
            key={preset.label}
            variant={activeDays === preset.days ? 'default' : 'ghost'}
            size="sm"
            className="h-7 px-2.5 text-xs"
            onClick={() =>
              setDateRange({ from: subDays(new Date(), preset.days), to: new Date() })
            }
          >
            {preset.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

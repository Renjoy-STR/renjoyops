import { useDateRange } from '@/contexts/DateRangeContext';
import { Button } from '@/components/ui/button';
import { Calendar } from 'lucide-react';
import { subDays, subMonths, format } from 'date-fns';

const presets = [
  { label: '1M', months: 1 },
  { label: '3M', months: 3 },
  { label: '6M', months: 6 },
  { label: '1Y', months: 12 },
  { label: 'All', months: 0 },
];

export function DateRangeFilter() {
  const { dateRange, setDateRange } = useDateRange();

  const activeDays = Math.round((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24));

  const getActiveLabel = () => {
    if (activeDays > 360 && activeDays < 370) return '1Y';
    if (activeDays > 175 && activeDays < 185) return '6M';
    if (activeDays > 88 && activeDays < 93) return '3M';
    if (activeDays > 28 && activeDays < 32) return '1M';
    if (activeDays > 700) return 'All';
    return '';
  };

  const activeLabel = getActiveLabel();

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
            variant={activeLabel === preset.label ? 'default' : 'ghost'}
            size="sm"
            className="h-6 px-1.5 text-[10px] sm:h-7 sm:px-2.5 sm:text-xs"
            onClick={() => {
              if (preset.months === 0) {
                setDateRange({ from: new Date('2024-01-01'), to: new Date() });
              } else {
                setDateRange({ from: subMonths(new Date(), preset.months), to: new Date() });
              }
            }}
          >
            {preset.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

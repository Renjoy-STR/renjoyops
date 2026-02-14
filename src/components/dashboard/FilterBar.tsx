import { Button } from '@/components/ui/button';

interface FilterBarProps {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
}

export function FilterBar({ label, options, value, onChange }: FilterBarProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-muted-foreground font-medium">{label}:</span>
      {options.map((opt) => (
        <Button
          key={opt}
          variant={value === opt ? 'default' : 'ghost'}
          size="sm"
          className="h-7 px-2.5 text-xs capitalize"
          onClick={() => onChange(opt)}
        >
          {opt}
        </Button>
      ))}
    </div>
  );
}

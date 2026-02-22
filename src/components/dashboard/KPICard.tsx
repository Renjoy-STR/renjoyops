import { LucideIcon } from 'lucide-react';
import { ReactNode } from 'react';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string | ReactNode;
  icon: LucideIcon;
  trend?: { value: number; label: string };
  accent?: boolean;
}

export function KPICard({ title, value, subtitle, icon: Icon, trend, accent }: KPICardProps) {
  return (
    <div className={`glass-card p-3 sm:p-4 md:p-5 animate-slide-in ${accent ? 'glow-accent border-primary/20' : ''}`}>
      <div className="flex items-start justify-between">
        <div className="space-y-1 min-w-0">
          <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider leading-tight">{title}</p>
          <p className="text-lg sm:text-2xl md:text-3xl font-bold tracking-tight text-foreground">{value}</p>
          {subtitle && (
            <div className="text-xs text-muted-foreground">
              {typeof subtitle === 'string' ? <p>{subtitle}</p> : subtitle}
            </div>
          )}
          {trend && (
            <p className={`text-xs font-medium ${trend.value >= 0 ? 'text-[hsl(142,71%,45%)]' : 'text-destructive'}`}>
              {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}% {trend.label}
            </p>
          )}
        </div>
        <div className={`p-1.5 sm:p-2 rounded-lg hidden sm:block ${accent ? 'gradient-accent' : 'bg-accent'}`}>
          <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${accent ? 'text-primary-foreground' : 'text-secondary'}`} />
        </div>
      </div>
    </div>
  );
}

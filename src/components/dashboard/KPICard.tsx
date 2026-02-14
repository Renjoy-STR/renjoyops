import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: { value: number; label: string };
  accent?: boolean;
}

export function KPICard({ title, value, subtitle, icon: Icon, trend, accent }: KPICardProps) {
  return (
    <div className={`glass-card rounded-lg p-3 sm:p-4 md:p-5 animate-slide-in ${accent ? 'glow-accent border-accent/30' : ''}`}>
      <div className="flex items-start justify-between">
        <div className="space-y-1 min-w-0">
          <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider leading-tight">{title}</p>
          <p className="text-lg sm:text-2xl md:text-3xl font-bold tracking-tight">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          {trend && (
            <p className={`text-xs font-medium ${trend.value >= 0 ? 'text-chart-3' : 'text-destructive'}`}>
              {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}% {trend.label}
            </p>
          )}
        </div>
        <div className={`p-1.5 sm:p-2 rounded-lg hidden sm:block ${accent ? 'gradient-accent' : 'bg-muted'}`}>
          <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${accent ? 'text-accent-foreground' : 'text-muted-foreground'}`} />
        </div>
      </div>
    </div>
  );
}

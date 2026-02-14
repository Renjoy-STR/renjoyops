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
    <div className={`glass-card rounded-lg p-4 md:p-5 animate-slide-in ${accent ? 'glow-accent border-accent/30' : ''}`}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
          <p className="text-2xl md:text-3xl font-bold tracking-tight">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          {trend && (
            <p className={`text-xs font-medium ${trend.value >= 0 ? 'text-chart-3' : 'text-destructive'}`}>
              {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}% {trend.label}
            </p>
          )}
        </div>
        <div className={`p-2 rounded-lg ${accent ? 'gradient-accent' : 'bg-muted'}`}>
          <Icon className={`h-5 w-5 ${accent ? 'text-accent-foreground' : 'text-muted-foreground'}`} />
        </div>
      </div>
    </div>
  );
}

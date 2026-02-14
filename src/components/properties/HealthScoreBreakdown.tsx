import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

interface HealthFactor {
  label: string;
  score: number;
  detail: string;
}

interface HealthScoreBreakdownProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  property: {
    property_name: string;
    health_score: number;
    avg_clean_minutes: number;
    maintenance_count: number;
    total_cleans: number;
    total_cost: number;
    cleans_over_4hrs: number;
    total_tasks: number;
  } | null;
  guestRating?: number | null;
}

export function HealthScoreBreakdown({ open, onOpenChange, property, guestRating }: HealthScoreBreakdownProps) {
  if (!property) return null;

  const avg = property.avg_clean_minutes;
  const cleanTimeScore = avg > 0 ? Math.max(0, Math.min(100, 100 - ((avg - 120) / 2))) : 50;
  const consistencyScore = property.cleans_over_4hrs > 0
    ? Math.max(0, 100 - (property.cleans_over_4hrs / Math.max(1, property.total_cleans)) * 200)
    : 100;
  const maintenanceScore = Math.max(0, 100 - property.maintenance_count * 5);
  const costScore = Math.max(0, 100 - (property.total_cost / 50));
  const completionRate = property.total_tasks > 0
    ? Math.round((property.total_cleans / property.total_tasks) * 100)
    : 50;
  const ratingScore = guestRating ? (guestRating / 5) * 100 : null;

  const factors: HealthFactor[] = [
    { label: 'Clean Time Efficiency', score: Math.round(Math.max(0, Math.min(100, cleanTimeScore))), detail: `Avg ${avg}min — benchmark 120min` },
    { label: 'Clean Consistency', score: Math.round(Math.max(0, Math.min(100, consistencyScore))), detail: `${property.cleans_over_4hrs} of ${property.total_cleans} cleans exceeded 4hrs` },
    { label: 'Maintenance Frequency', score: Math.round(Math.max(0, Math.min(100, maintenanceScore))), detail: `${property.maintenance_count} maintenance tasks in period` },
    { label: 'Task Completion Rate', score: Math.round(Math.max(0, Math.min(100, completionRate))), detail: `${property.total_cleans} completed of ${property.total_tasks} total` },
    { label: 'Cost Efficiency', score: Math.round(Math.max(0, Math.min(100, costScore))), detail: `$${property.total_cost.toLocaleString()} total spend` },
  ];

  if (ratingScore !== null) {
    factors.push({ label: 'Guest Rating', score: Math.round(ratingScore), detail: `${guestRating!.toFixed(1)} / 5.0 average` });
  }

  const scoreColor = (s: number) => {
    if (s >= 70) return 'text-chart-4';
    if (s >= 40) return 'text-warning';
    return 'text-destructive';
  };

  const barColor = (s: number) => {
    if (s >= 70) return '[&>div]:bg-chart-4';
    if (s >= 40) return '[&>div]:bg-warning';
    return '[&>div]:bg-destructive';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="truncate mr-3">{property.property_name}</span>
            <Badge variant="outline" className={`text-sm font-bold ${scoreColor(property.health_score)}`}>
              {property.health_score}/100
            </Badge>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          {factors.map((f) => (
            <div key={f.label} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">{f.label}</span>
                <span className={`text-xs font-bold ${scoreColor(f.score)}`}>{f.score}</span>
              </div>
              <Progress value={f.score} className={`h-2 ${barColor(f.score)}`} />
              <p className="text-[10px] text-muted-foreground">{f.detail}</p>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

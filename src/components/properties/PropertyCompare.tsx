import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface PropertyData {
  home_id: string;
  property_name: string;
  health_score: number;
  avg_clean_minutes: number;
  total_cleans: number;
  cleans_over_4hrs: number;
  maintenance_count: number;
  urgent_count: number;
  total_cost: number;
  total_tasks: number;
  cost_per_clean: number;
  cost_per_night: number | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  properties: PropertyData[];
}

export function PropertyCompare({ open, onOpenChange, properties }: Props) {
  if (properties.length === 0) return null;

  const metrics = [
    { label: 'Health Score', key: 'health_score', fmt: (v: number) => `${v}/100` },
    { label: 'Avg Clean Time', key: 'avg_clean_minutes', fmt: (v: number) => `${v} min` },
    { label: 'Total Cleans', key: 'total_cleans', fmt: (v: number) => String(v) },
    { label: 'Cleans >4hr', key: 'cleans_over_4hrs', fmt: (v: number) => String(v) },
    { label: 'Maintenance Tasks', key: 'maintenance_count', fmt: (v: number) => String(v) },
    { label: 'Urgent Tasks', key: 'urgent_count', fmt: (v: number) => String(v) },
    { label: 'Total Cost', key: 'total_cost', fmt: (v: number) => `$${v.toLocaleString()}` },
    { label: 'Cost / Clean', key: 'cost_per_clean', fmt: (v: number) => `$${v.toFixed(0)}` },
    { label: 'Cost / Night', key: 'cost_per_night', fmt: (v: number | null) => v != null ? `$${v.toFixed(0)}` : '—' },
  ] as const;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Compare Properties</DialogTitle>
        </DialogHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Metric</TableHead>
              {properties.map(p => (
                <TableHead key={p.home_id} className="text-xs text-center">{p.property_name?.slice(0, 25)}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {metrics.map(m => (
              <TableRow key={m.key}>
                <TableCell className="text-xs font-medium">{m.label}</TableCell>
                {properties.map(p => (
                  <TableCell key={p.home_id} className="text-center font-mono text-sm">
                    {(m.fmt as any)((p as any)[m.key])}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DialogContent>
    </Dialog>
  );
}

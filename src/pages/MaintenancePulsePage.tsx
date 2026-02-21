import { MaintenancePulse } from '@/components/maintenance/MaintenancePulse';
import { Breadcrumbs } from '@/components/dashboard/Breadcrumbs';

export default function MaintenancePulsePage() {
  return (
    <div className="flex flex-col min-h-full">
      <div className="px-4 pt-4 pb-2">
        <Breadcrumbs
          items={[
            { label: 'Daily Operations', href: '/ops/timeline' },
            { label: 'Pulse', href: '/ops/pulse' },
          ]}
        />
        <h1 className="text-2xl font-black mt-1">Maintenance Pulse</h1>
        <p className="text-sm text-muted-foreground">Live status snapshot — optimized for mobile</p>
      </div>
      <div className="flex-1 pb-6">
        <MaintenancePulse />
      </div>
    </div>
  );
}

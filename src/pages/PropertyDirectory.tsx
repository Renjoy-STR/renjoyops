import { EmptyState } from '@/components/dashboard/EmptyState';

export default function PropertyDirectory() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#F04C3B', fontFamily: 'Figtree, sans-serif' }}>
          Property Directory
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          All properties, units, and listings across every market.
        </p>
      </div>
      <EmptyState
        title="Property data coming soon"
        description="Connect your property registry to get started."
      />
    </div>
  );
}

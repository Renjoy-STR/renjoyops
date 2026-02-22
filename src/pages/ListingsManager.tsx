import { EmptyState } from '@/components/dashboard/EmptyState';

export default function ListingsManager() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#F04C3B', fontFamily: 'Figtree, sans-serif' }}>
          Listings Manager
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          The heart of Renjoy — every listing across every channel.
        </p>
      </div>
      <EmptyState
        title="Listing sync coming soon"
        description="This will show all Guesty listings with status, channel links, revenue, and performance data."
      />
    </div>
  );
}

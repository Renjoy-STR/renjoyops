import { EmptyState } from '@/components/dashboard/EmptyState';

export default function PropertySetup() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#F04C3B', fontFamily: 'Figtree, sans-serif' }}>
          Property Setup
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Onboarding checklist for new properties.
        </p>
      </div>
      <EmptyState
        title="Setup workflows coming soon"
        description="This will be a checklist/wizard for onboarding new properties."
      />
    </div>
  );
}

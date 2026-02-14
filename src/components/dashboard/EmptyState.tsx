import { FileQuestion } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  description?: string;
}

export function EmptyState({ title = 'No data found', description = 'Try adjusting your filters or date range.' }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <FileQuestion className="h-10 w-10 text-muted-foreground/50 mb-3" />
      <h3 className="text-sm font-semibold text-muted-foreground">{title}</h3>
      <p className="text-xs text-muted-foreground/70 mt-1">{description}</p>
    </div>
  );
}

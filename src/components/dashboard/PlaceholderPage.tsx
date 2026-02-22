interface PlaceholderPageProps {
  title: string;
  subtitle?: string;
}

export function PlaceholderPage({ title, subtitle = 'Coming Soon' }: PlaceholderPageProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-3">
      <h1 className="text-2xl font-bold" style={{ color: '#F04C3B', fontFamily: 'Figtree, sans-serif' }}>
        {title}
      </h1>
      <p className="text-sm font-medium" style={{ color: '#75241C', fontFamily: 'Figtree, sans-serif' }}>
        {subtitle}
      </p>
    </div>
  );
}

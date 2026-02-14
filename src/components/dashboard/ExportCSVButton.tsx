import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { exportToCSV } from '@/lib/csvExport';

interface ExportCSVButtonProps {
  data: Record<string, any>[];
  filename: string;
  label?: string;
}

export function ExportCSVButton({ data, filename, label = 'Export CSV' }: ExportCSVButtonProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 px-2.5 text-xs gap-1.5"
      onClick={() => exportToCSV(data, filename)}
      disabled={!data.length}
    >
      <Download className="h-3.5 w-3.5" />
      {label}
    </Button>
  );
}

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { subDays, format } from 'date-fns';

interface DateRange {
  from: Date;
  to: Date;
}

interface DateRangeContextType {
  dateRange: DateRange;
  setDateRange: (range: DateRange) => void;
  formatForQuery: () => { from: string; to: string };
}

const DateRangeContext = createContext<DateRangeContextType | undefined>(undefined);

export function DateRangeProvider({ children }: { children: ReactNode }) {
  const [dateRange, setDateRange] = useState<DateRange>({
    from: subDays(new Date(), 180),
    to: new Date(),
  });

  const formatForQuery = () => ({
    from: format(dateRange.from, 'yyyy-MM-dd'),
    to: format(dateRange.to, 'yyyy-MM-dd'),
  });

  return (
    <DateRangeContext.Provider value={{ dateRange, setDateRange, formatForQuery }}>
      {children}
    </DateRangeContext.Provider>
  );
}

export function useDateRange() {
  const context = useContext(DateRangeContext);
  if (!context) throw new Error('useDateRange must be used within DateRangeProvider');
  return context;
}

import { useState, useMemo } from 'react';
import { AlertTriangle, Clock, SearchX } from 'lucide-react';
import { differenceInDays, format } from 'date-fns';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useDateRange } from '@/contexts/DateRangeContext';
import {
  useRampDepartments,
  useSpendKPIs,
  useRampTransactions,
  useRampBills,
  useSpendByDepartment,
  useSpendByUser,
  useMissingReceipts,
  useSpendOverTime,
  useTopMerchants,
  useSpendByCategory,
  useSpendPrograms,
  useBillsDueAlert,
  useReceiptComplianceByDept,
  useMonthlySpendSummary,
  useRecurringVendors,
  useRollingSpendComparison,
  useNewVendors,
  useSpendAnomalies,
  useFastestGrowingMerchants,
  formatCurrency,
  DEPARTMENT_PRESETS,
} from '@/hooks/useSpendData';
import { SpendKPICards } from '@/components/spend/SpendKPICards';
import { CostPerPropertyCard } from '@/components/spend/CostPerPropertyCard';
import { SpendOverTimeChart } from '@/components/spend/SpendOverTimeChart';
import { SpendByDepartmentChart } from '@/components/spend/SpendByDepartmentChart';
import { TopMerchantsChart } from '@/components/spend/TopMerchantsChart';
import { SpendByCategoryChart } from '@/components/spend/SpendByCategoryChart';
import { MonthlySpendChart } from '@/components/spend/MonthlySpendChart';
import { RollingSpendComparison } from '@/components/spend/RollingSpendComparison';
import { NewVendorsCard } from '@/components/spend/NewVendorsCard';
import { FastestGrowingCard } from '@/components/spend/FastestGrowingCard';
import { SpendAnomaliesTable } from '@/components/spend/SpendAnomaliesTable';
import { TransactionsTable } from '@/components/spend/TransactionsTable';
import { BillsTable } from '@/components/spend/BillsTable';
import { MissingReceiptsTable } from '@/components/spend/MissingReceiptsTable';
import { SpendByUserTable } from '@/components/spend/SpendByUserTable';
import { SpendProgramsCards } from '@/components/spend/SpendProgramsCards';
import { ReceiptComplianceByDept } from '@/components/spend/ReceiptComplianceByDept';
import { RecurringVendorsTable } from '@/components/spend/RecurringVendorsTable';
import { DepartmentMultiSelect } from '@/components/spend/DepartmentMultiSelect';
import { DetailSidebar } from '@/components/spend/DetailSidebar';

export default function Spend() {
  const { dateRange, formatForQuery } = useDateRange();
  const { from, to } = formatForQuery();

  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [txPage, setTxPage] = useState(0);
  const [txSearch, setTxSearch] = useState('');
  const [billStatus, setBillStatus] = useState('all');
  const [activeTab, setActiveTab] = useState('transactions');

  // Detail sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarType, setSidebarType] = useState<'transaction' | 'bill' | 'user' | 'vendor' | 'receipt'>('transaction');
  const [sidebarData, setSidebarData] = useState<any>(null);

  const openSidebar = (type: typeof sidebarType, data: any) => {
    setSidebarType(type);
    setSidebarData(data);
    setSidebarOpen(true);
  };

  const deptFilter = selectedDepartments.length > 0 ? selectedDepartments : undefined;

  // Data queries
  const departments = useRampDepartments();
  const kpis = useSpendKPIs(from, to, deptFilter);
  const transactions = useRampTransactions(from, to, deptFilter, txPage, txSearch);
  const bills = useRampBills(from, to, billStatus);
  const deptSpend = useSpendByDepartment(from, to, deptFilter);
  const userSpend = useSpendByUser(from, to);
  const missingReceipts = useMissingReceipts(from, to);
  const spendOverTime = useSpendOverTime(from, to, deptFilter);
  const topMerchants = useTopMerchants(from, to, deptFilter);
  const categorySpend = useSpendByCategory(from, to, deptFilter);
  const spendPrograms = useSpendPrograms();
  const billsAlert = useBillsDueAlert();
  const complianceByDept = useReceiptComplianceByDept(from, to, deptFilter);
  const monthlySummary = useMonthlySpendSummary(deptFilter);
  const recurringVendors = useRecurringVendors(deptFilter);
  const rollingComparison = useRollingSpendComparison(deptFilter);
  const newVendors = useNewVendors(deptFilter);
  const anomalies = useSpendAnomalies(deptFilter);
  const fastestGrowing = useFastestGrowingMerchants(deptFilter);

  const departmentNames = useMemo(() => {
    if (!spendOverTime.data || spendOverTime.data.length === 0) return [];
    const keys = new Set<string>();
    spendOverTime.data.forEach((d) => {
      Object.keys(d).forEach((k) => {
        if (k !== 'date' && k !== 'total' && !k.startsWith('_')) keys.add(k);
      });
    });
    return Array.from(keys);
  }, [spendOverTime.data]);

  const handleSearchChange = (s: string) => {
    setTxSearch(s);
    setTxPage(0);
  };

  const handleUserClick = (userName: string) => {
    setTxSearch(userName);
    setTxPage(0);
    setActiveTab('transactions');
  };

  // Context line
  const contextLine = useMemo(() => {
    const days = differenceInDays(new Date(to), new Date(from));
    let datePart = '';
    if (days <= 7) datePart = 'Last 7 days';
    else if (days <= 30) datePart = 'Last 30 days';
    else if (days <= 90) datePart = 'Last 90 days';
    else if (days <= 180) datePart = 'Last 6 months';
    else datePart = `${format(new Date(from), 'MMM d')} – ${format(new Date(to), 'MMM d, yyyy')}`;

    if (selectedDepartments.length === 0) return `All departments · ${datePart}`;

    const matchedPreset = Object.entries(DEPARTMENT_PRESETS).find(([, depts]) => {
      const sorted1 = [...selectedDepartments].sort();
      const sorted2 = [...depts].sort();
      return sorted1.length === sorted2.length && sorted1.every((v, i) => v === sorted2[i]);
    });

    if (matchedPreset) return `${matchedPreset[0]} (${selectedDepartments.length} depts) · ${datePart}`;
    if (selectedDepartments.length <= 2) return `${selectedDepartments.join(', ')} · ${datePart}`;
    return `${selectedDepartments.length} departments · ${datePart}`;
  }, [from, to, selectedDepartments]);

  const alertData = billsAlert.data;
  const hasAlerts = alertData && (alertData.overdueCount > 0 || alertData.upcomingCount > 0);

  // Check for empty filtered state
  const isFiltered = selectedDepartments.length > 0;
  const hasNoData = isFiltered && kpis.data && kpis.data.totalSpend === 0 && kpis.data.billPayments === 0;

  return (
    <div className="space-y-5 sm:space-y-6 animate-slide-in">
      {/* Header — sticky */}
      <div className="flex flex-col gap-3 sticky top-0 z-10 bg-background pb-3 -mx-1 px-1">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold">Spend Dashboard</h2>
            <p className="text-sm text-muted-foreground">{contextLine}</p>
          </div>
        </div>
        <DepartmentMultiSelect
          departments={departments.data ?? []}
          selected={selectedDepartments}
          onChange={setSelectedDepartments}
        />
      </div>

      {/* Bills Due Alerts */}
      {hasAlerts && (
        <div className="flex flex-wrap gap-2">
          {alertData.overdueCount > 0 && (
            <button
              onClick={() => { setActiveTab('bills'); setBillStatus('all'); }}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20 text-sm hover:bg-destructive/20 transition-colors ${alertData.overdueCount > 10 ? 'animate-pulse' : ''}`}
            >
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span className="font-semibold text-destructive">{alertData.overdueCount} overdue</span>
              <span className="text-muted-foreground font-normal">{formatCurrency(alertData.overdueTotal)}</span>
            </button>
          )}
          {alertData.upcomingCount > 0 && (
            <button
              onClick={() => { setActiveTab('bills'); setBillStatus('all'); }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[hsl(var(--warning)/0.1)] border border-[hsl(var(--warning)/0.2)] text-sm hover:bg-[hsl(var(--warning)/0.2)] transition-colors"
            >
              <Clock className="h-4 w-4 text-[hsl(var(--warning))]" />
              <span className="font-semibold text-[hsl(var(--warning))]">{alertData.upcomingCount} due this week</span>
              <span className="text-muted-foreground font-normal">{formatCurrency(alertData.upcomingTotal)}</span>
            </button>
          )}
        </div>
      )}

      {/* Empty filtered state */}
      {hasNoData ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <SearchX className="h-10 w-10 text-muted-foreground/50 mb-3" />
          <h3 className="text-sm font-semibold text-muted-foreground">
            No spend data for {selectedDepartments.join(', ')} in this period
          </h3>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => setSelectedDepartments([])}>
            Clear filters
          </Button>
        </div>
      ) : (
        <>
          {/* KPI Cards + Cost Per Property */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4">
            <div className="col-span-2 sm:col-span-4">
              <SpendKPICards data={kpis.data} isLoading={kpis.isLoading} />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <CostPerPropertyCard
                totalSpend={kpis.data?.totalSpend ?? 0}
                totalSpendDelta={kpis.data?.totalSpendDelta ?? 0}
                isLoading={kpis.isLoading}
              />
            </div>
          </div>

          {/* Rolling Spend Comparison (replaces Day of Week) */}
          <RollingSpendComparison
            data={rollingComparison.data ?? []}
            isLoading={rollingComparison.isLoading}
          />

          {/* Charts Row 1 */}
          <div className="grid lg:grid-cols-2 gap-4 items-start">
            <SpendOverTimeChart
              data={spendOverTime.data ?? []}
              isLoading={spendOverTime.isLoading}
              showByDepartment={!deptFilter || (deptFilter.length > 1)}
              departments={departmentNames}
            />
            <SpendByDepartmentChart
              data={deptSpend.data ?? []}
              isLoading={deptSpend.isLoading}
            />
          </div>

          {/* Monthly Spend Trend */}
          <MonthlySpendChart
            data={monthlySummary.data ?? []}
            isLoading={monthlySummary.isLoading}
          />

          {/* Charts Row 2 */}
          <div className="grid lg:grid-cols-2 gap-4 items-start">
            <TopMerchantsChart
              data={topMerchants.data ?? []}
              isLoading={topMerchants.isLoading}
            />
            <SpendByCategoryChart
              data={categorySpend.data ?? []}
              isLoading={categorySpend.isLoading}
            />
          </div>

          {/* New Vendors + Fastest Growing */}
          <div className="grid lg:grid-cols-2 gap-4 items-start">
            <NewVendorsCard
              data={newVendors.data ?? []}
              isLoading={newVendors.isLoading}
              onVendorClick={(vendor) => openSidebar('vendor', { merchant_name: vendor.merchant_name, total_spend: vendor.total_spend })}
            />
            <FastestGrowingCard
              data={fastestGrowing.data ?? []}
              isLoading={fastestGrowing.isLoading}
            />
          </div>

          {/* Tabbed Tables */}
          <div className="glass-card rounded-lg border-t border-border shadow-sm">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <div className="overflow-x-auto border-b border-border px-4 sm:px-5">
                <TabsList className="bg-transparent h-auto p-0 gap-0">
                  {['transactions', 'bills', 'missing', 'users', 'programs', 'recurring', 'anomalies'].map((tab) => {
                    const labels: Record<string, string> = {
                      transactions: 'Transactions',
                      bills: 'Bills & AP',
                      missing: 'Missing Receipts',
                      users: 'By User',
                      programs: 'Spend Programs',
                      recurring: 'Recurring Vendors',
                      anomalies: 'Anomalies',
                    };
                    return (
                      <TabsTrigger
                        key={tab}
                        value={tab}
                        className="rounded-none border-b-2 border-transparent px-4 py-3 text-sm font-medium text-muted-foreground data-[state=active]:border-b-primary data-[state=active]:text-foreground data-[state=active]:shadow-none data-[state=active]:bg-transparent bg-transparent hover:text-foreground transition-colors"
                      >
                        {labels[tab]}
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
              </div>

              <div className="p-4 sm:p-5">
                <TabsContent value="transactions" className="mt-0">
                  <TransactionsTable
                    data={transactions.data?.data ?? []}
                    count={transactions.data?.count ?? 0}
                    pageSize={transactions.data?.pageSize ?? 50}
                    page={txPage}
                    onPageChange={setTxPage}
                    search={txSearch}
                    onSearchChange={handleSearchChange}
                    isLoading={transactions.isLoading}
                    onRowClick={(row) => openSidebar('transaction', row)}
                  />
                </TabsContent>

                <TabsContent value="bills" className="mt-0">
                  <BillsTable
                    data={bills.data ?? []}
                    isLoading={bills.isLoading}
                    statusFilter={billStatus}
                    onStatusChange={setBillStatus}
                    onRowClick={(row) => openSidebar('bill', row)}
                  />
                </TabsContent>

                <TabsContent value="missing" className="mt-0">
                  <ReceiptComplianceByDept
                    data={complianceByDept.data ?? []}
                    isLoading={complianceByDept.isLoading}
                  />
                  <div className="mt-4">
                    <MissingReceiptsTable
                      data={missingReceipts.data ?? []}
                      isLoading={missingReceipts.isLoading}
                      onRowClick={(row) => openSidebar('receipt', row)}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="users" className="mt-0">
                  <SpendByUserTable
                    data={userSpend.data ?? []}
                    isLoading={userSpend.isLoading}
                    onUserClick={handleUserClick}
                    onRowClick={(row) => openSidebar('user', row)}
                  />
                </TabsContent>

                <TabsContent value="programs" className="mt-0">
                  <SpendProgramsCards
                    data={spendPrograms.data ?? []}
                    isLoading={spendPrograms.isLoading}
                  />
                </TabsContent>

                <TabsContent value="recurring" className="mt-0">
                  <RecurringVendorsTable
                    data={recurringVendors.data ?? []}
                    isLoading={recurringVendors.isLoading}
                    onRowClick={(row) => openSidebar('vendor', row)}
                  />
                </TabsContent>

                <TabsContent value="anomalies" className="mt-0">
                  <SpendAnomaliesTable
                    data={anomalies.data ?? []}
                    isLoading={anomalies.isLoading}
                    onRowClick={(row) => openSidebar('transaction', row)}
                  />
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </>
      )}

      {/* Detail Sidebar */}
      <DetailSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        type={sidebarType}
        data={sidebarData}
        dateRange={{ from, to }}
      />
    </div>
  );
}

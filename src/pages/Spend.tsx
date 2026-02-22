import { useState, useMemo } from 'react';
import { AlertTriangle, Clock } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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
  formatCurrency,
} from '@/hooks/useSpendData';
import { SpendKPICards } from '@/components/spend/SpendKPICards';
import { SpendOverTimeChart } from '@/components/spend/SpendOverTimeChart';
import { SpendByDepartmentChart } from '@/components/spend/SpendByDepartmentChart';
import { TopMerchantsChart } from '@/components/spend/TopMerchantsChart';
import { SpendByCategoryChart } from '@/components/spend/SpendByCategoryChart';
import { TransactionsTable } from '@/components/spend/TransactionsTable';
import { BillsTable } from '@/components/spend/BillsTable';
import { MissingReceiptsTable } from '@/components/spend/MissingReceiptsTable';
import { SpendByUserTable } from '@/components/spend/SpendByUserTable';
import { SpendProgramsCards } from '@/components/spend/SpendProgramsCards';
import { ReceiptComplianceByDept } from '@/components/spend/ReceiptComplianceByDept';

export default function Spend() {
  const { formatForQuery } = useDateRange();
  const { from, to } = formatForQuery();

  const [department, setDepartment] = useState<string>('all');
  const [txPage, setTxPage] = useState(0);
  const [txSearch, setTxSearch] = useState('');
  const [billStatus, setBillStatus] = useState('all');
  const [activeTab, setActiveTab] = useState('transactions');

  const deptName = department === 'all' ? undefined : department;

  // Data queries
  const departments = useRampDepartments();
  const kpis = useSpendKPIs(from, to, deptName);
  const transactions = useRampTransactions(from, to, deptName, txPage, txSearch);
  const bills = useRampBills(from, to, billStatus);
  const deptSpend = useSpendByDepartment(from, to);
  const userSpend = useSpendByUser(from, to);
  const missingReceipts = useMissingReceipts(from, to);
  const spendOverTime = useSpendOverTime(from, to, deptName);
  const topMerchants = useTopMerchants(from, to, deptName);
  const categorySpend = useSpendByCategory(from, to, deptName);
  const spendPrograms = useSpendPrograms();
  const billsAlert = useBillsDueAlert();
  const complianceByDept = useReceiptComplianceByDept(from, to);

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

  const alertData = billsAlert.data;
  const hasAlerts = alertData && (alertData.overdueCount > 0 || alertData.upcomingCount > 0);

  return (
    <div className="space-y-5 sm:space-y-6 animate-slide-in">
      {/* Header — sticky */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-3 sticky top-0 z-10 bg-background pb-3 -mx-1 px-1">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold">Spend Dashboard</h2>
          <p className="text-sm text-muted-foreground">Ramp corporate card spend &amp; bills overview</p>
        </div>
        <Select value={department} onValueChange={setDepartment}>
          <SelectTrigger className="w-48 h-9">
            <SelectValue placeholder="All Departments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {(departments.data ?? []).map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name ?? 'Unknown'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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

      {/* KPI Cards */}
      <SpendKPICards data={kpis.data} isLoading={kpis.isLoading} />

      {/* Charts Row 1 */}
      <div className="grid lg:grid-cols-2 gap-4 items-start">
        <SpendOverTimeChart
          data={spendOverTime.data ?? []}
          isLoading={spendOverTime.isLoading}
          showByDepartment={!deptName}
          departments={departmentNames}
        />
        <SpendByDepartmentChart
          data={deptSpend.data ?? []}
          isLoading={deptSpend.isLoading}
        />
      </div>

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

      {/* Tabbed Tables */}
      <div className="glass-card rounded-lg border-t border-border shadow-sm">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="overflow-x-auto border-b border-border px-4 sm:px-5">
            <TabsList className="bg-transparent h-auto p-0 gap-0">
              {['transactions', 'bills', 'missing', 'users', 'programs'].map((tab) => {
                const labels: Record<string, string> = {
                  transactions: 'Transactions',
                  bills: 'Bills & AP',
                  missing: 'Missing Receipts',
                  users: 'By User',
                  programs: 'Spend Programs',
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
              />
            </TabsContent>

            <TabsContent value="bills" className="mt-0">
              <BillsTable
                data={bills.data ?? []}
                isLoading={bills.isLoading}
                statusFilter={billStatus}
                onStatusChange={setBillStatus}
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
                />
              </div>
            </TabsContent>

            <TabsContent value="users" className="mt-0">
              <SpendByUserTable
                data={userSpend.data ?? []}
                isLoading={userSpend.isLoading}
                onUserClick={handleUserClick}
              />
            </TabsContent>

            <TabsContent value="programs" className="mt-0">
              <SpendProgramsCards
                data={spendPrograms.data ?? []}
                isLoading={spendPrograms.isLoading}
              />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}

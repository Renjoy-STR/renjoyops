import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { subDays, format, differenceInDays } from 'date-fns';

// ── Helpers ──────────────────────────────────────────────────────────────────

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

export const formatCompact = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);

function priorPeriod(from: string, to: string) {
  const days = differenceInDays(new Date(to), new Date(from));
  const priorTo = subDays(new Date(from), 1);
  const priorFrom = subDays(priorTo, days);
  return { priorFrom: format(priorFrom, 'yyyy-MM-dd'), priorTo: format(priorTo, 'yyyy-MM-dd') };
}

function deltaPercent(current: number, prior: number): number {
  if (prior === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - prior) / prior) * 100);
}

/** Run a read-only SQL query via RPC to bypass the 1000-row limit */
async function runQuery<T = any>(sql: string): Promise<T[]> {
  const { data, error } = await supabase.rpc('run_query', { sql_text: sql });
  if (error) throw error;
  return (data ?? []) as T[];
}

// ── Departments (for filter dropdown) ────────────────────────────────────────

export function useRampDepartments() {
  return useQuery({
    queryKey: ['ramp-departments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ramp_departments')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return (data ?? []) as { id: string; name: string }[];
    },
  });
}

// ── KPIs ─────────────────────────────────────────────────────────────────────

export interface SpendKPIs {
  totalSpend: number;
  totalSpendDelta: number;
  billPayments: number;
  billPaymentsDelta: number;
  receiptCompliance: number;
  receiptComplianceDelta: number;
  missingReceipts: number;
  missingReceiptsDelta: number;
  dailySpendTrend: { date: string; total: number }[];
  dailyBillTrend: { date: string; total: number }[];
  dailyComplianceTrend: { date: string; total: number }[];
  dailyMissingTrend: { date: string; total: number }[];
  clockedInCount?: number;
}

async function fetchPeriodKPIs(from: string, to: string, department?: string) {
  let departmentName: string | undefined;
  if (department) {
    const { data: deptData } = await supabase
      .from('ramp_departments')
      .select('name')
      .eq('id', department)
      .single();
    departmentName = deptData?.name ?? undefined;
  }

  const deptFilter = department ? ` AND department_id = '${department}'` : '';
  const deptNameFilter = departmentName ? ` AND department = '${departmentName}'` : '';

  const [txnAgg, billAgg, missingCount, totalOver25, dailySpend, dailyBills] = await Promise.all([
    runQuery<{ total: number; cnt: number }>(`
      SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as cnt
      FROM v_ramp_transactions
      WHERE user_transaction_time >= '${from}' AND user_transaction_time <= '${to}'${deptFilter}
    `),
    runQuery<{ total: number }>(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM v_ramp_bills
      WHERE due_date >= '${from}' AND due_date <= '${to}'
    `),
    runQuery<{ cnt: number }>(`
      SELECT COUNT(*) as cnt
      FROM v_ramp_missing_receipts
      WHERE user_transaction_time >= '${from}' AND user_transaction_time <= '${to}'${deptNameFilter}
    `),
    runQuery<{ cnt: number }>(`
      SELECT COUNT(*) as cnt
      FROM v_ramp_transactions
      WHERE user_transaction_time >= '${from}' AND user_transaction_time <= '${to}'${deptFilter}
        AND amount > 25
    `),
    runQuery<{ d: string; total: number }>(`
      SELECT user_transaction_time::date as d, SUM(amount) as total
      FROM v_ramp_transactions
      WHERE user_transaction_time >= '${from}' AND user_transaction_time <= '${to}'${deptFilter}
      GROUP BY 1 ORDER BY 1
    `),
    runQuery<{ d: string; total: number }>(`
      SELECT due_date as d, SUM(amount) as total
      FROM v_ramp_bills
      WHERE due_date >= '${from}' AND due_date <= '${to}'
      GROUP BY 1 ORDER BY 1
    `),
  ]);

  const totalSpend = txnAgg[0]?.total ?? 0;
  const billPayments = billAgg[0]?.total ?? 0;
  const missingReceipts = missingCount[0]?.cnt ?? 0;
  const totalTxnsOver25 = totalOver25[0]?.cnt ?? 0;
  const receiptCompliance = totalTxnsOver25 > 0
    ? Math.round(((totalTxnsOver25 - missingReceipts) / totalTxnsOver25) * 1000) / 10
    : 100;

  return {
    totalSpend,
    billPayments,
    missingReceipts,
    receiptCompliance,
    dailySpendTrend: (dailySpend ?? []).map(d => ({ date: String(d.d), total: Number(d.total) })),
    dailyBillTrend: (dailyBills ?? []).map(d => ({ date: String(d.d), total: Number(d.total) })),
  };
}

export function useSpendKPIs(from: string, to: string, department?: string) {
  return useQuery({
    queryKey: ['ramp-kpis', from, to, department],
    queryFn: async (): Promise<SpendKPIs> => {
      const { priorFrom, priorTo } = priorPeriod(from, to);

      const [current, prior] = await Promise.all([
        fetchPeriodKPIs(from, to, department),
        fetchPeriodKPIs(priorFrom, priorTo, department),
      ]);

      return {
        totalSpend: current.totalSpend,
        totalSpendDelta: deltaPercent(current.totalSpend, prior.totalSpend),
        billPayments: current.billPayments,
        billPaymentsDelta: deltaPercent(current.billPayments, prior.billPayments),
        receiptCompliance: current.receiptCompliance,
        receiptComplianceDelta: deltaPercent(current.receiptCompliance, prior.receiptCompliance),
        missingReceipts: current.missingReceipts,
        missingReceiptsDelta: deltaPercent(current.missingReceipts, prior.missingReceipts),
        dailySpendTrend: current.dailySpendTrend,
        dailyBillTrend: current.dailyBillTrend,
        dailyComplianceTrend: [],
        dailyMissingTrend: [],
      };
    },
  });
}

// ── Transactions (paginated) ─────────────────────────────────────────────────

export interface RampTransaction {
  id: string;
  user_transaction_time: string | null;
  user_name: string | null;
  department_name: string | null;
  merchant_name: string | null;
  amount: number | null;
  sk_category_name: string | null;
  memo: string | null;
  receipts: any;
  card_name: string | null;
  policy_violations: any;
  department_id: string | null;
}

export function useRampTransactions(
  from: string,
  to: string,
  department?: string,
  page = 0,
  search = '',
) {
  const pageSize = 50;
  return useQuery({
    queryKey: ['ramp-transactions', from, to, department, page, search],
    queryFn: async () => {
      let query = supabase
        .from('v_ramp_transactions' as any)
        .select('*', { count: 'exact' })
        .gte('user_transaction_time', from)
        .lte('user_transaction_time', to)
        .order('user_transaction_time', { ascending: false })
        .range(page * pageSize, page * pageSize + pageSize - 1);

      if (department) {
        query = query.eq('department_id', department);
      }
      if (search) {
        query = query.or(`merchant_name.ilike.%${search}%,user_name.ilike.%${search}%`);
      }

      const { data, count, error } = await query;
      if (error) throw error;
      return {
        data: (data ?? []) as unknown as RampTransaction[],
        count: count ?? 0,
        pageSize,
      };
    },
  });
}

// ── Bills ────────────────────────────────────────────────────────────────────

export interface RampBill {
  id: string;
  vendor_name: string | null;
  amount: number | null;
  status: string | null;
  due_date: string | null;
  invoice_number: string | null;
  payment_date: string | null;
  memo: string | null;
}

export function useRampBills(from: string, to: string, statusFilter?: string) {
  return useQuery({
    queryKey: ['ramp-bills', from, to, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('v_ramp_bills' as any)
        .select('id, vendor_name, amount, status, due_date, invoice_number, payment_date, memo')
        .gte('due_date', from)
        .lte('due_date', to)
        .order('due_date', { ascending: false });

      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as RampBill[];
    },
  });
}

// ── Bills Due Soon (alerts) ──────────────────────────────────────────────────

export interface BillsDueAlert {
  upcomingCount: number;
  upcomingTotal: number;
  overdueCount: number;
  overdueTotal: number;
}

export function useBillsDueAlert() {
  return useQuery({
    queryKey: ['ramp-bills-due-alert'],
    queryFn: async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const nextWeek = format(subDays(new Date(), -7), 'yyyy-MM-dd');

      const [upcoming, overdue] = await Promise.all([
        runQuery<{ cnt: number; total: number }>(`
          SELECT COUNT(*) as cnt, COALESCE(SUM(amount), 0) as total
          FROM v_ramp_bills
          WHERE due_date >= '${today}' AND due_date <= '${nextWeek}'
            AND status != 'PAID'
        `),
        runQuery<{ cnt: number; total: number }>(`
          SELECT COUNT(*) as cnt, COALESCE(SUM(amount), 0) as total
          FROM v_ramp_bills
          WHERE due_date < '${today}'
            AND status != 'PAID'
        `),
      ]);

      return {
        upcomingCount: upcoming[0]?.cnt ?? 0,
        upcomingTotal: upcoming[0]?.total ?? 0,
        overdueCount: overdue[0]?.cnt ?? 0,
        overdueTotal: overdue[0]?.total ?? 0,
      } as BillsDueAlert;
    },
  });
}

// ── Spend by Department (date-filtered via RPC) ──────────────────────────────

export interface DepartmentSpend {
  department: string;
  total_spend: number;
  transaction_count: number;
}

export function useSpendByDepartment(from: string, to: string) {
  return useQuery({
    queryKey: ['ramp-spend-by-dept', from, to],
    queryFn: async () => {
      const data = await runQuery<DepartmentSpend>(`
        SELECT department_name as department, SUM(amount) as total_spend, COUNT(*) as transaction_count
        FROM v_ramp_transactions
        WHERE user_transaction_time >= '${from}' AND user_transaction_time <= '${to}'
          AND department_name IS NOT NULL
        GROUP BY department_name
        ORDER BY total_spend DESC
      `);
      return data;
    },
  });
}

// ── Spend by User (date-filtered via RPC) ────────────────────────────────────

export interface UserSpend {
  user_name: string;
  department: string | null;
  transaction_count: number;
  total_spend: number;
  avg_transaction: number;
  missing_receipts: number;
}

export function useSpendByUser(from: string, to: string) {
  return useQuery({
    queryKey: ['ramp-spend-by-user', from, to],
    queryFn: async () => {
      const data = await runQuery<UserSpend>(`
        WITH user_txns AS (
          SELECT user_name, department_name as department, 
            COUNT(*) as transaction_count, 
            SUM(amount) as total_spend,
            ROUND(AVG(amount)::numeric, 2) as avg_transaction
          FROM v_ramp_transactions
          WHERE user_transaction_time >= '${from}' AND user_transaction_time <= '${to}'
            AND user_name IS NOT NULL
          GROUP BY user_name, department_name
        ),
        user_missing AS (
          SELECT user_name, COUNT(*) as missing_receipts
          FROM v_ramp_missing_receipts
          WHERE user_transaction_time >= '${from}' AND user_transaction_time <= '${to}'
          GROUP BY user_name
        )
        SELECT ut.user_name, ut.department, ut.transaction_count, ut.total_spend, ut.avg_transaction,
          COALESCE(um.missing_receipts, 0) as missing_receipts
        FROM user_txns ut
        LEFT JOIN user_missing um ON ut.user_name = um.user_name
        ORDER BY ut.total_spend DESC
      `);
      return data;
    },
  });
}

// ── Missing Receipts ─────────────────────────────────────────────────────────

export interface MissingReceipt {
  id: string;
  user_transaction_time: string | null;
  user_name: string | null;
  department: string | null;
  merchant_name: string | null;
  amount: number | null;
  memo: string | null;
}

export function useMissingReceipts(from: string, to: string) {
  return useQuery({
    queryKey: ['ramp-missing-receipts', from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_ramp_missing_receipts' as any)
        .select('*')
        .gte('user_transaction_time', from)
        .lte('user_transaction_time', to)
        .order('user_transaction_time', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as MissingReceipt[];
    },
  });
}

// ── Receipt Compliance by Department ─────────────────────────────────────────

export interface DeptCompliance {
  department: string;
  total_over_25: number;
  missing: number;
  compliance_pct: number;
  at_risk: number;
}

export function useReceiptComplianceByDept(from: string, to: string) {
  return useQuery({
    queryKey: ['ramp-receipt-compliance-dept', from, to],
    queryFn: async () => {
      const data = await runQuery<DeptCompliance>(`
        WITH txns AS (
          SELECT department_name as department, COUNT(*) as total_over_25
          FROM v_ramp_transactions
          WHERE user_transaction_time >= '${from}' AND user_transaction_time <= '${to}'
            AND amount > 25 AND department_name IS NOT NULL
          GROUP BY department_name
        ),
        missing AS (
          SELECT department, COUNT(*) as missing, SUM(amount) as at_risk
          FROM v_ramp_missing_receipts
          WHERE user_transaction_time >= '${from}' AND user_transaction_time <= '${to}'
            AND department IS NOT NULL
          GROUP BY department
        )
        SELECT t.department, t.total_over_25, 
          COALESCE(m.missing, 0) as missing,
          ROUND(((t.total_over_25 - COALESCE(m.missing, 0))::numeric / NULLIF(t.total_over_25, 0) * 100), 1) as compliance_pct,
          COALESCE(m.at_risk, 0) as at_risk
        FROM txns t
        LEFT JOIN missing m ON t.department = m.department
        ORDER BY compliance_pct ASC
      `);
      return data;
    },
  });
}

// ── Spend Over Time (server-side aggregation, week/day grouping) ─────────────

export interface DailySpend {
  date: string;
  total: number;
  [dept: string]: string | number;
}

export function useSpendOverTime(from: string, to: string, department?: string) {
  return useQuery({
    queryKey: ['ramp-spend-over-time', from, to, department],
    queryFn: async () => {
      const days = differenceInDays(new Date(to), new Date(from));
      const groupBy = days > 90 ? 'week' : 'day';
      const truncExpr = groupBy === 'week'
        ? "date_trunc('week', user_transaction_time::date)::date"
        : "user_transaction_time::date";
      const deptFilter = department ? ` AND department_id = '${department}'` : '';

      const data = await runQuery<{ d: string; dept: string; total: number }>(`
        SELECT ${truncExpr} as d, 
          COALESCE(department_name, 'Unassigned') as dept,
          SUM(amount) as total
        FROM v_ramp_transactions
        WHERE user_transaction_time >= '${from}' AND user_transaction_time <= '${to}'${deptFilter}
        GROUP BY 1, 2
        ORDER BY 1
      `);

      // Pivot into { date, total, dept1, dept2, ... }
      const byDate: Record<string, Record<string, number>> = {};
      (data ?? []).forEach((row) => {
        const dateStr = String(row.d).slice(0, 10);
        if (!byDate[dateStr]) byDate[dateStr] = { total: 0 };
        const amt = Number(row.total) || 0;
        byDate[dateStr].total = (byDate[dateStr].total ?? 0) + amt;
        if (!department) {
          byDate[dateStr][row.dept] = (byDate[dateStr][row.dept] ?? 0) + amt;
        }
      });

      return Object.entries(byDate)
        .map(([date, vals]) => ({ date, ...vals }))
        .sort((a, b) => a.date.localeCompare(b.date)) as DailySpend[];
    },
  });
}

// ── Top Merchants (date-filtered via RPC) ────────────────────────────────────

export interface MerchantSpend {
  merchant_name: string;
  total_spend: number;
  transaction_count: number;
}

export function useTopMerchants(from: string, to: string, limit = 15) {
  return useQuery({
    queryKey: ['ramp-top-merchants', from, to, limit],
    queryFn: async () => {
      const data = await runQuery<MerchantSpend>(`
        SELECT merchant_name, SUM(amount) as total_spend, COUNT(*) as transaction_count
        FROM v_ramp_transactions
        WHERE user_transaction_time >= '${from}' AND user_transaction_time <= '${to}'
          AND merchant_name IS NOT NULL
        GROUP BY merchant_name
        ORDER BY total_spend DESC
        LIMIT ${limit}
      `);
      return data;
    },
  });
}

// ── Spend by Category (date-filtered via RPC) ────────────────────────────────

export interface CategorySpend {
  category: string;
  total_spend: number;
  transaction_count: number;
}

export function useSpendByCategory(from: string, to: string) {
  return useQuery({
    queryKey: ['ramp-spend-by-category', from, to],
    queryFn: async () => {
      const data = await runQuery<{ category: string; total_spend: number; transaction_count: number }>(`
        SELECT COALESCE(sk_category_name, 'Uncategorized') as category, 
          SUM(amount) as total_spend, COUNT(*) as transaction_count
        FROM v_ramp_transactions
        WHERE user_transaction_time >= '${from}' AND user_transaction_time <= '${to}'
        GROUP BY 1
        ORDER BY total_spend DESC
      `);
      // Top 8 + Other
      if (data.length <= 9) return data;
      const top8 = data.slice(0, 8);
      const rest = data.slice(8);
      const otherSpend = rest.reduce((s, c) => s + Number(c.total_spend), 0);
      const otherCount = rest.reduce((s, c) => s + Number(c.transaction_count), 0);
      return [...top8, { category: 'Other', total_spend: otherSpend, transaction_count: otherCount }];
    },
  });
}

// ── Spend Programs ───────────────────────────────────────────────────────────

export interface SpendProgram {
  id: string;
  display_name: string | null;
  description: string | null;
  total_spent: number;
  transaction_count: number;
  active_limits: number;
}

export function useSpendPrograms() {
  return useQuery({
    queryKey: ['ramp-spend-programs'],
    queryFn: async () => {
      const [programsRes, txnsRes, limitsRes] = await Promise.all([
        supabase.from('ramp_spend_programs').select('id, display_name, description'),
        supabase.from('ramp_transactions').select('spend_program_id, amount'),
        supabase.from('ramp_limits').select('spend_program_id, state'),
      ]);

      if (programsRes.error) throw programsRes.error;

      const programs = (programsRes.data ?? []) as any[];
      const txns = (txnsRes.data ?? []) as any[];
      const limits = (limitsRes.data ?? []) as any[];

      const txnByProgram: Record<string, { total: number; count: number }> = {};
      txns.forEach((t) => {
        if (!t.spend_program_id) return;
        if (!txnByProgram[t.spend_program_id]) txnByProgram[t.spend_program_id] = { total: 0, count: 0 };
        txnByProgram[t.spend_program_id].total += t.amount ?? 0;
        txnByProgram[t.spend_program_id].count += 1;
      });

      const limitsByProgram: Record<string, number> = {};
      limits.forEach((l) => {
        if (!l.spend_program_id) return;
        if (l.state === 'ACTIVE') {
          limitsByProgram[l.spend_program_id] = (limitsByProgram[l.spend_program_id] ?? 0) + 1;
        }
      });

      return programs.map((p) => ({
        id: p.id,
        display_name: p.display_name,
        description: p.description,
        total_spent: txnByProgram[p.id]?.total ?? 0,
        transaction_count: txnByProgram[p.id]?.count ?? 0,
        active_limits: limitsByProgram[p.id] ?? 0,
      })) as SpendProgram[];
    },
  });
}

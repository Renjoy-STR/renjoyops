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

/** Run a read-only SQL query via RPC to bypass the 1000-row limit */
async function runQuery<T = any>(sql: string): Promise<T[]> {
  const { data, error } = await supabase.rpc('run_query', { sql_text: sql });
  if (error) throw error;
  return (data ?? []) as T[];
}

// ── Color Palette ────────────────────────────────────────────────────────────

export const DEPARTMENT_COLORS: Record<string, string> = {
  'IT': '#2563EB',
  'Housekeeping': '#F04C3B',
  'Finance': '#10B981',
  'Admin': '#8B5CF6',
  'Maintenance': '#F59E0B',
  'Operations': '#06B6D4',
  'Marketing': '#EC4899',
  'Projects': '#6366F1',
  'Guest Experience': '#14B8A6',
  'Owner Relations': '#75241C',
  'Sales': '#FF7F6B',
  'Human Resources': '#A855F7',
  'Unassigned': '#6B7280',
};

export const CATEGORY_COLORS = [
  '#F04C3B', '#2563EB', '#10B981', '#F59E0B', '#8B5CF6',
  '#EC4899', '#06B6D4', '#6366F1', '#14B8A6', '#6B7280',
];

export function getDeptColor(dept: string, idx: number) {
  if (DEPARTMENT_COLORS[dept]) return DEPARTMENT_COLORS[dept];
  const fallback = Object.values(DEPARTMENT_COLORS);
  return fallback[idx % fallback.length];
}

// ── Departments (for filter dropdown) — uses get_department_list RPC ─────────

export function useRampDepartments() {
  return useQuery({
    queryKey: ['ramp-departments'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_department_list');
      if (error) throw error;
      return ((data ?? []) as { department_name: string }[]).map(d => ({
        id: d.department_name,
        name: d.department_name,
      }));
    },
  });
}

// ── KPIs — uses get_spend_kpis RPC ──────────────────────────────────────────

export interface SpendKPIs {
  totalSpend: number;
  totalSpendDelta: number;
  billPayments: number;
  billPaymentsDelta: number;
  receiptCompliance: number;
  receiptComplianceDelta: number;
  missingReceipts: number;
  missingReceiptsDelta: number;
}

export function useSpendKPIs(from: string, to: string, department?: string) {
  return useQuery({
    queryKey: ['ramp-kpis', from, to, department],
    queryFn: async (): Promise<SpendKPIs> => {
      const { priorFrom, priorTo } = priorPeriod(from, to);

      const { data, error } = await supabase.rpc('get_spend_kpis', {
        p_start_date: from,
        p_end_date: to,
        p_prev_start_date: priorFrom,
        p_prev_end_date: priorTo,
        p_department: department || null,
      });
      if (error) throw error;

      const rows = (data ?? []) as { metric: string; current_value: number; prior_value: number; delta_pct: number }[];
      const byMetric: Record<string, { current_value: number; delta_pct: number }> = {};
      rows.forEach(r => { byMetric[r.metric] = r; });

      return {
        totalSpend: byMetric['total_spend']?.current_value ?? 0,
        totalSpendDelta: byMetric['total_spend']?.delta_pct ?? 0,
        billPayments: byMetric['bill_payments']?.current_value ?? 0,
        billPaymentsDelta: byMetric['bill_payments']?.delta_pct ?? 0,
        receiptCompliance: byMetric['receipt_compliance']?.current_value ?? 0,
        receiptComplianceDelta: byMetric['receipt_compliance']?.delta_pct ?? 0,
        missingReceipts: byMetric['missing_receipts']?.current_value ?? 0,
        missingReceiptsDelta: byMetric['missing_receipts']?.delta_pct ?? 0,
      };
    },
  });
}

// ── Transactions (paginated — keeps direct query) ────────────────────────────

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
        query = query.eq('department_name', department);
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

// ── Bills (keeps direct query) ───────────────────────────────────────────────

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

// ── Spend by Department — uses get_spend_by_department RPC ───────────────────

export interface DepartmentSpend {
  department: string;
  total_spend: number;
  transaction_count: number;
  avg_transaction?: number;
}

export function useSpendByDepartment(from: string, to: string) {
  return useQuery({
    queryKey: ['ramp-spend-by-dept', from, to],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_spend_by_department', {
        p_start_date: from,
        p_end_date: to,
      });
      if (error) throw error;
      return (data ?? []) as DepartmentSpend[];
    },
  });
}

// ── Spend by User (keeps runQuery — needs row-level join) ────────────────────

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

// ── Missing Receipts (keeps direct query) ────────────────────────────────────

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

// ── Receipt Compliance by Department — uses get_receipt_compliance RPC ────────

export interface DeptCompliance {
  department: string;
  total_transactions: number;
  transactions_over_25: number;
  missing_receipts: number;
  compliance_pct: number;
  dollars_at_risk: number;
}

export function useReceiptComplianceByDept(from: string, to: string) {
  return useQuery({
    queryKey: ['ramp-receipt-compliance-dept', from, to],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_receipt_compliance', {
        p_start_date: from,
        p_end_date: to,
        p_department: null,
      });
      if (error) throw error;
      return (data ?? []) as DeptCompliance[];
    },
  });
}

// ── Spend Over Time — uses get_spend_over_time RPC ───────────────────────────

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
      const interval = days > 90 ? 'week' : 'day';

      const { data, error } = await supabase.rpc('get_spend_over_time', {
        p_start_date: from,
        p_end_date: to,
        p_interval: interval,
        p_department: department || null,
      });
      if (error) throw error;

      const rows = (data ?? []) as { period: string; department: string; total_spend: number; transaction_count: number }[];

      // Pivot into { date, total, dept1, dept2, ... }
      const byDate: Record<string, Record<string, number>> = {};
      rows.forEach((row) => {
        const dateStr = String(row.period).slice(0, 10);
        if (!byDate[dateStr]) byDate[dateStr] = { total: 0 };
        const amt = Number(row.total_spend) || 0;
        byDate[dateStr].total = (byDate[dateStr].total ?? 0) + amt;
        if (!department) {
          byDate[dateStr][row.department] = (byDate[dateStr][row.department] ?? 0) + amt;
        }
      });

      return Object.entries(byDate)
        .map(([date, vals]) => ({ date, ...vals }))
        .sort((a, b) => a.date.localeCompare(b.date)) as DailySpend[];
    },
  });
}

// ── Top Merchants — uses get_top_merchants RPC ───────────────────────────────

export interface MerchantSpend {
  merchant_name: string;
  total_spend: number;
  transaction_count: number;
}

export function useTopMerchants(from: string, to: string, department?: string, limit = 15) {
  return useQuery({
    queryKey: ['ramp-top-merchants', from, to, department, limit],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_top_merchants', {
        p_start_date: from,
        p_end_date: to,
        p_limit: limit,
        p_department: department || null,
      });
      if (error) throw error;
      return (data ?? []) as MerchantSpend[];
    },
  });
}

// ── Spend by Category — uses get_spend_by_category RPC ───────────────────────

export interface CategorySpend {
  category: string;
  total_spend: number;
  transaction_count: number;
  pct?: number;
}

export function useSpendByCategory(from: string, to: string, department?: string) {
  return useQuery({
    queryKey: ['ramp-spend-by-category', from, to, department],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_spend_by_category', {
        p_start_date: from,
        p_end_date: to,
        p_department: department || null,
      });
      if (error) throw error;

      const rows = (data ?? []) as CategorySpend[];
      // Top 8 + Other
      if (rows.length <= 9) return rows;
      const top8 = rows.slice(0, 8);
      const rest = rows.slice(8);
      const otherSpend = rest.reduce((s, c) => s + Number(c.total_spend), 0);
      const otherCount = rest.reduce((s, c) => s + Number(c.transaction_count), 0);
      const otherPct = rest.reduce((s, c) => s + Number(c.pct ?? 0), 0);
      return [...top8, { category: 'Other', total_spend: otherSpend, transaction_count: otherCount, pct: otherPct }];
    },
  });
}

// ── Spend Programs (keeps direct query) ──────────────────────────────────────

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

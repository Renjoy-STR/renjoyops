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

interface SpendKPIs {
  totalSpend: number;
  totalSpendDelta: number;
  billPayments: number;
  billPaymentsDelta: number;
  avgTransaction: number;
  avgTransactionDelta: number;
  missingReceipts: number;
  missingReceiptsDelta: number;
}

async function fetchPeriodKPIs(from: string, to: string, department?: string) {
  // Transactions for total spend + avg + missing receipts
  let txQuery = supabase
    .from('ramp_transactions')
    .select('amount, receipts')
    .gte('user_transaction_time', from)
    .lte('user_transaction_time', to);

  if (department) {
    txQuery = txQuery.eq('department_id', department);
  }

  // Bills
  let billQuery = supabase
    .from('ramp_bills')
    .select('amount')
    .gte('due_date', from)
    .lte('due_date', to);

  // Missing receipts
  let missingQuery = supabase
    .from('v_ramp_missing_receipts' as any)
    .select('id', { count: 'exact', head: true })
    .gte('user_transaction_time', from)
    .lte('user_transaction_time', to);

  if (department) {
    missingQuery = missingQuery.eq('department_id', department);
  }

  const [txRes, billRes, missingRes] = await Promise.all([
    txQuery,
    billQuery,
    missingQuery,
  ]);

  if (txRes.error) throw txRes.error;
  if (billRes.error) throw billRes.error;

  const txns = (txRes.data ?? []) as { amount: number | null; receipts: any }[];
  const bills = (billRes.data ?? []) as { amount: number | null }[];

  const totalSpend = txns.reduce((s, t) => s + (t.amount ?? 0), 0);
  const billPayments = bills.reduce((s, b) => s + ((b.amount ?? 0) / 100), 0);
  const avgTransaction = txns.length > 0 ? totalSpend / txns.length : 0;
  const missingReceipts = (missingRes as any)?.count ?? 0;

  return { totalSpend, billPayments, avgTransaction, missingReceipts };
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
        avgTransaction: current.avgTransaction,
        avgTransactionDelta: deltaPercent(current.avgTransaction, prior.avgTransaction),
        missingReceipts: current.missingReceipts,
        missingReceiptsDelta: deltaPercent(current.missingReceipts, prior.missingReceipts),
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
        data: (data ?? []) as RampTransaction[],
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
        .from('ramp_bills')
        .select('id, vendor_name, amount, status, due_date, invoice_number, payment_date, memo')
        .gte('due_date', from)
        .lte('due_date', to)
        .order('due_date', { ascending: false });

      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).map((b) => ({
        ...b,
        amount: (b.amount ?? 0) / 100, // CENTS → DOLLARS
      })) as RampBill[];
    },
  });
}

// ── Spend by Department ──────────────────────────────────────────────────────

export interface DepartmentSpend {
  department_name: string;
  total_spend: number;
  transaction_count: number;
}

export function useSpendByDepartment(from: string, to: string) {
  return useQuery({
    queryKey: ['ramp-spend-by-dept', from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_ramp_spend_by_department' as any)
        .select('*');
      if (error) throw error;
      return ((data ?? []) as DepartmentSpend[]).sort(
        (a, b) => (b.total_spend ?? 0) - (a.total_spend ?? 0),
      );
    },
  });
}

// ── Spend by User ────────────────────────────────────────────────────────────

export interface UserSpend {
  user_name: string;
  department_name: string | null;
  transaction_count: number;
  total_spend: number;
  avg_transaction: number;
  missing_receipts: number;
}

export function useSpendByUser(from: string, to: string) {
  return useQuery({
    queryKey: ['ramp-spend-by-user', from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_ramp_spend_by_user' as any)
        .select('*');
      if (error) throw error;
      return ((data ?? []) as UserSpend[]).sort(
        (a, b) => (b.total_spend ?? 0) - (a.total_spend ?? 0),
      );
    },
  });
}

// ── Missing Receipts ─────────────────────────────────────────────────────────

export interface MissingReceipt {
  id: string;
  user_transaction_time: string | null;
  user_name: string | null;
  department_name: string | null;
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
      return (data ?? []) as MissingReceipt[];
    },
  });
}

// ── Spend Over Time (daily aggregation) ──────────────────────────────────────

export interface DailySpend {
  date: string;
  total: number;
  [dept: string]: string | number;
}

export function useSpendOverTime(from: string, to: string, department?: string) {
  return useQuery({
    queryKey: ['ramp-spend-over-time', from, to, department],
    queryFn: async () => {
      let query = supabase
        .from('ramp_transactions')
        .select('user_transaction_time, amount, department_id')
        .gte('user_transaction_time', from)
        .lte('user_transaction_time', to)
        .order('user_transaction_time', { ascending: true });

      if (department) {
        query = query.eq('department_id', department);
      }

      const { data: txns, error } = await query;
      if (error) throw error;

      // Fetch department names for legend
      const { data: depts } = await supabase
        .from('ramp_departments')
        .select('id, name');
      const deptMap: Record<string, string> = {};
      (depts ?? []).forEach((d: any) => { deptMap[d.id] = d.name ?? 'Unknown'; });

      // Group by date
      const byDate: Record<string, Record<string, number>> = {};
      ((txns ?? []) as any[]).forEach((t) => {
        if (!t.user_transaction_time) return;
        const date = t.user_transaction_time.slice(0, 10);
        if (!byDate[date]) byDate[date] = { total: 0 };
        const amt = t.amount ?? 0;
        byDate[date].total = (byDate[date].total ?? 0) + amt;
        if (!department) {
          const deptName = deptMap[t.department_id] ?? 'Unassigned';
          byDate[date][deptName] = (byDate[date][deptName] ?? 0) + amt;
        }
      });

      return Object.entries(byDate)
        .map(([date, vals]) => ({ date, ...vals }))
        .sort((a, b) => a.date.localeCompare(b.date)) as DailySpend[];
    },
  });
}

// ── Top Merchants ────────────────────────────────────────────────────────────

export interface MerchantSpend {
  merchant_name: string;
  total_spend: number;
  transaction_count: number;
}

export function useTopMerchants(from: string, to: string, limit = 15) {
  return useQuery({
    queryKey: ['ramp-top-merchants', from, to, limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ramp_transactions')
        .select('merchant_name, amount')
        .gte('user_transaction_time', from)
        .lte('user_transaction_time', to);
      if (error) throw error;

      const byMerchant: Record<string, { total: number; count: number }> = {};
      ((data ?? []) as any[]).forEach((t) => {
        const name = t.merchant_name ?? 'Unknown';
        if (!byMerchant[name]) byMerchant[name] = { total: 0, count: 0 };
        byMerchant[name].total += t.amount ?? 0;
        byMerchant[name].count += 1;
      });

      return Object.entries(byMerchant)
        .map(([merchant_name, { total, count }]) => ({
          merchant_name,
          total_spend: total,
          transaction_count: count,
        }))
        .sort((a, b) => b.total_spend - a.total_spend)
        .slice(0, limit);
    },
  });
}

// ── Spend by Category ────────────────────────────────────────────────────────

export interface CategorySpend {
  category: string;
  total_spend: number;
}

export function useSpendByCategory(from: string, to: string) {
  return useQuery({
    queryKey: ['ramp-spend-by-category', from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ramp_transactions')
        .select('sk_category_name, amount')
        .gte('user_transaction_time', from)
        .lte('user_transaction_time', to);
      if (error) throw error;

      const byCat: Record<string, number> = {};
      ((data ?? []) as any[]).forEach((t) => {
        const cat = t.sk_category_name ?? 'Uncategorized';
        byCat[cat] = (byCat[cat] ?? 0) + (t.amount ?? 0);
      });

      const sorted = Object.entries(byCat)
        .map(([category, total_spend]) => ({ category, total_spend }))
        .sort((a, b) => b.total_spend - a.total_spend);

      // Top 8 + Other
      if (sorted.length <= 9) return sorted;
      const top8 = sorted.slice(0, 8);
      const otherTotal = sorted.slice(8).reduce((s, c) => s + c.total_spend, 0);
      return [...top8, { category: 'Other', total_spend: otherTotal }];
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

      // Aggregate txns by spend_program_id
      const txnByProgram: Record<string, { total: number; count: number }> = {};
      txns.forEach((t) => {
        if (!t.spend_program_id) return;
        if (!txnByProgram[t.spend_program_id]) txnByProgram[t.spend_program_id] = { total: 0, count: 0 };
        txnByProgram[t.spend_program_id].total += t.amount ?? 0;
        txnByProgram[t.spend_program_id].count += 1;
      });

      // Count active limits per program
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

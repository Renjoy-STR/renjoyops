
-- Drop old function overloads that have p_department (singular text) parameter
-- These conflict with the new p_departments (text[]) versions causing PGRST203 errors

-- get_spend_kpis: drop the one with p_department text + p_departments text[]
DROP FUNCTION IF EXISTS public.get_spend_kpis(
  p_start_date timestamptz,
  p_end_date timestamptz,
  p_prev_start_date timestamptz,
  p_prev_end_date timestamptz,
  p_department text,
  p_departments text[]
);

-- get_spend_over_time: drop the one with p_department text + p_departments text[]
DROP FUNCTION IF EXISTS public.get_spend_over_time(
  p_start_date timestamptz,
  p_end_date timestamptz,
  p_interval text,
  p_department text,
  p_departments text[]
);

-- get_top_merchants: drop the one with p_department text + p_departments text[]
DROP FUNCTION IF EXISTS public.get_top_merchants(
  p_start_date timestamptz,
  p_end_date timestamptz,
  p_limit integer,
  p_department text,
  p_departments text[]
);

-- get_spend_by_category: drop the one with p_department text + p_departments text[]
DROP FUNCTION IF EXISTS public.get_spend_by_category(
  p_start_date timestamptz,
  p_end_date timestamptz,
  p_department text,
  p_departments text[]
);

-- get_receipt_compliance: drop the old one with just p_department text
DROP FUNCTION IF EXISTS public.get_receipt_compliance(
  p_start_date timestamptz,
  p_end_date timestamptz,
  p_department text
);

-- get_receipt_compliance: also drop the one with both p_department + p_departments
DROP FUNCTION IF EXISTS public.get_receipt_compliance(
  p_start_date timestamptz,
  p_end_date timestamptz,
  p_department text,
  p_departments text[]
);

-- get_spend_by_department: drop the old one without p_departments
DROP FUNCTION IF EXISTS public.get_spend_by_department(
  p_start_date timestamptz,
  p_end_date timestamptz
);

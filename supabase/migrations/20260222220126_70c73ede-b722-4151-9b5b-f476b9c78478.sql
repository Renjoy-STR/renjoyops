
-- Drop existing conflicting function
DROP FUNCTION IF EXISTS public.get_new_vendors(integer, text[]);
DROP FUNCTION IF EXISTS public.get_new_vendors(integer, text);
DROP FUNCTION IF EXISTS public.get_new_vendors(integer);
DROP FUNCTION IF EXISTS public.get_new_vendors();

-- Rolling Spend Comparison: 30/60/90 day vs same period last year
CREATE OR REPLACE FUNCTION public.get_rolling_spend_comparison(
  p_departments text[] DEFAULT NULL
)
RETURNS TABLE(
  period_label text,
  period_days integer,
  current_spend numeric,
  current_txn_count bigint,
  current_per_property numeric,
  prior_year_spend numeric,
  prior_year_txn_count bigint,
  prior_year_per_property numeric,
  yoy_change_pct numeric
)
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  v_properties int := 200;
BEGIN
  RETURN QUERY
  WITH periods AS (
    SELECT '30d'::text AS label, 30 AS days
    UNION ALL SELECT '60d', 60
    UNION ALL SELECT '90d', 90
  ),
  current_data AS (
    SELECT p.label, p.days,
      COALESCE(SUM(t.amount), 0)::numeric AS spend,
      COUNT(*)::bigint AS txn_count
    FROM periods p
    LEFT JOIN v_ramp_transactions t
      ON t.user_transaction_time >= (CURRENT_DATE - p.days)::timestamptz
      AND t.user_transaction_time < CURRENT_DATE::timestamptz
      AND (p_departments IS NULL OR t.department_name = ANY(p_departments))
    GROUP BY p.label, p.days
  ),
  prior_data AS (
    SELECT p.label, p.days,
      COALESCE(SUM(t.amount), 0)::numeric AS spend,
      COUNT(*)::bigint AS txn_count
    FROM periods p
    LEFT JOIN v_ramp_transactions t
      ON t.user_transaction_time >= (CURRENT_DATE - p.days - 365)::timestamptz
      AND t.user_transaction_time < (CURRENT_DATE - 365)::timestamptz
      AND (p_departments IS NULL OR t.department_name = ANY(p_departments))
    GROUP BY p.label, p.days
  )
  SELECT
    c.label AS period_label,
    c.days AS period_days,
    c.spend AS current_spend,
    c.txn_count AS current_txn_count,
    ROUND(c.spend / v_properties, 2) AS current_per_property,
    pr.spend AS prior_year_spend,
    pr.txn_count AS prior_year_txn_count,
    ROUND(pr.spend / v_properties, 2) AS prior_year_per_property,
    CASE WHEN pr.spend > 0 THEN ROUND((c.spend - pr.spend) / pr.spend * 100, 1) ELSE NULL END AS yoy_change_pct
  FROM current_data c
  JOIN prior_data pr ON c.label = pr.label
  ORDER BY c.days;
END;
$$;

-- New Vendors (first seen in last N days)
CREATE OR REPLACE FUNCTION public.get_new_vendors(
  p_days integer DEFAULT 30,
  p_departments text[] DEFAULT NULL
)
RETURNS TABLE(
  merchant_name text,
  first_seen timestamptz,
  total_spend numeric,
  transaction_count bigint,
  department text
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
  RETURN QUERY
  WITH first_appearances AS (
    SELECT t.merchant_name,
      MIN(t.user_transaction_time) AS first_seen,
      SUM(t.amount)::numeric AS total_spend,
      COUNT(*)::bigint AS transaction_count,
      MODE() WITHIN GROUP (ORDER BY t.department_name) AS department
    FROM v_ramp_transactions t
    WHERE (p_departments IS NULL OR t.department_name = ANY(p_departments))
      AND t.merchant_name IS NOT NULL
    GROUP BY t.merchant_name
  )
  SELECT fa.merchant_name, fa.first_seen, fa.total_spend, fa.transaction_count, fa.department
  FROM first_appearances fa
  WHERE fa.first_seen >= (CURRENT_DATE - p_days)::timestamptz
  ORDER BY fa.total_spend DESC;
END;
$$;

-- Spend Anomalies
CREATE OR REPLACE FUNCTION public.get_spend_anomalies(
  p_days integer DEFAULT 30,
  p_threshold numeric DEFAULT 3.0,
  p_departments text[] DEFAULT NULL
)
RETURNS TABLE(
  transaction_id text,
  user_name text,
  department text,
  merchant_name text,
  amount numeric,
  transaction_date timestamptz,
  user_avg numeric,
  merchant_avg numeric,
  anomaly_reason text
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
  RETURN QUERY
  WITH user_avgs AS (
    SELECT t.user_name, AVG(t.amount)::numeric AS avg_amount, STDDEV(t.amount)::numeric AS stddev_amount
    FROM v_ramp_transactions t
    WHERE t.user_transaction_time >= (CURRENT_DATE - 180)::timestamptz
    GROUP BY t.user_name HAVING COUNT(*) >= 5
  ),
  merchant_avgs AS (
    SELECT t.merchant_name, AVG(t.amount)::numeric AS avg_amount, STDDEV(t.amount)::numeric AS stddev_amount
    FROM v_ramp_transactions t
    WHERE t.user_transaction_time >= (CURRENT_DATE - 180)::timestamptz
    GROUP BY t.merchant_name HAVING COUNT(*) >= 5
  ),
  recent AS (
    SELECT t.id::text AS transaction_id, t.user_name, t.department_name AS department,
      t.merchant_name, t.amount::numeric, t.user_transaction_time AS transaction_date,
      ua.avg_amount AS user_avg, ma.avg_amount AS merchant_avg,
      ua.stddev_amount AS user_std, ma.stddev_amount AS merchant_std
    FROM v_ramp_transactions t
    LEFT JOIN user_avgs ua ON t.user_name = ua.user_name
    LEFT JOIN merchant_avgs ma ON t.merchant_name = ma.merchant_name
    WHERE t.user_transaction_time >= (CURRENT_DATE - p_days)::timestamptz
      AND (p_departments IS NULL OR t.department_name = ANY(p_departments))
  )
  SELECT r.transaction_id, r.user_name, r.department, r.merchant_name, r.amount,
    r.transaction_date,
    ROUND(COALESCE(r.user_avg, 0), 2) AS user_avg,
    ROUND(COALESCE(r.merchant_avg, 0), 2) AS merchant_avg,
    CASE
      WHEN r.amount > 1000 AND r.user_std IS NOT NULL AND r.amount > r.user_avg + p_threshold * r.user_std THEN 'Unusual for user'
      WHEN r.amount > 500 AND r.merchant_std IS NOT NULL AND r.amount > r.merchant_avg + p_threshold * r.merchant_std THEN 'Unusual for merchant'
      WHEN r.amount > 2500 THEN 'High amount'
      ELSE NULL
    END AS anomaly_reason
  FROM recent r
  WHERE (
    (r.amount > 1000 AND r.user_std IS NOT NULL AND r.amount > r.user_avg + p_threshold * r.user_std) OR
    (r.amount > 500 AND r.merchant_std IS NOT NULL AND r.amount > r.merchant_avg + p_threshold * r.merchant_std) OR
    (r.amount > 2500)
  )
  ORDER BY r.amount DESC;
END;
$$;

-- Fastest Growing Merchants
CREATE OR REPLACE FUNCTION public.get_fastest_growing_merchants(
  p_limit integer DEFAULT 5,
  p_departments text[] DEFAULT NULL
)
RETURNS TABLE(
  merchant_name text,
  current_month_spend numeric,
  prior_month_spend numeric,
  spend_increase numeric,
  growth_pct numeric,
  transaction_count bigint
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
  RETURN QUERY
  WITH current_month AS (
    SELECT t.merchant_name,
      SUM(t.amount)::numeric AS spend,
      COUNT(*)::bigint AS txn_count
    FROM v_ramp_transactions t
    WHERE t.user_transaction_time >= date_trunc('month', CURRENT_DATE)::timestamptz
      AND t.user_transaction_time < (date_trunc('month', CURRENT_DATE) + interval '1 month')::timestamptz
      AND (p_departments IS NULL OR t.department_name = ANY(p_departments))
      AND t.merchant_name IS NOT NULL
    GROUP BY t.merchant_name
  ),
  prior_month AS (
    SELECT t.merchant_name, SUM(t.amount)::numeric AS spend
    FROM v_ramp_transactions t
    WHERE t.user_transaction_time >= (date_trunc('month', CURRENT_DATE) - interval '1 month')::timestamptz
      AND t.user_transaction_time < date_trunc('month', CURRENT_DATE)::timestamptz
      AND (p_departments IS NULL OR t.department_name = ANY(p_departments))
      AND t.merchant_name IS NOT NULL
    GROUP BY t.merchant_name
  )
  SELECT cm.merchant_name,
    cm.spend AS current_month_spend,
    COALESCE(pm.spend, 0) AS prior_month_spend,
    (cm.spend - COALESCE(pm.spend, 0)) AS spend_increase,
    CASE WHEN COALESCE(pm.spend, 0) > 0 THEN ROUND((cm.spend - pm.spend) / pm.spend * 100, 1) ELSE NULL END AS growth_pct,
    cm.txn_count AS transaction_count
  FROM current_month cm
  LEFT JOIN prior_month pm ON cm.merchant_name = pm.merchant_name
  WHERE COALESCE(pm.spend, 0) > 0
    AND cm.spend > pm.spend
  ORDER BY (cm.spend - COALESCE(pm.spend, 0)) DESC
  LIMIT p_limit;
END;
$$;

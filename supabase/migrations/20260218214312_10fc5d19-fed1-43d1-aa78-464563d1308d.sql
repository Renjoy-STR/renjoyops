-- Drop old version and recreate get_cleanup_queue RPC
DROP FUNCTION IF EXISTS public.get_cleanup_queue(text, text, text, integer);

CREATE FUNCTION public.get_cleanup_queue(
  p_category text DEFAULT NULL,
  p_department text DEFAULT NULL,
  p_property text DEFAULT NULL,
  p_limit integer DEFAULT 200
)
RETURNS TABLE(
  breezeway_id bigint,
  home_id bigint,
  task_name text,
  property_name text,
  status_name text,
  status_stage text,
  department text,
  created_date date,
  scheduled_date date,
  assigned_to text,
  age_days integer,
  days_overdue integer,
  cleanup_category text,
  dupe_count bigint,
  ghost_completed_date date,
  template_id bigint
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH dupes AS (
    SELECT 
      bt.property_name,
      bt.name,
      COUNT(*) as cnt
    FROM breezeway_tasks bt
    WHERE bt.status_stage IN ('new', 'in_progress')
    GROUP BY bt.property_name, bt.name
    HAVING COUNT(*) > 1
  ),
  ghost_completions AS (
    SELECT DISTINCT ON (open_t.breezeway_id)
      open_t.breezeway_id,
      done_t.finished_at::date as completed_date
    FROM breezeway_tasks open_t
    JOIN breezeway_tasks done_t 
      ON done_t.property_name = open_t.property_name
      AND done_t.name = open_t.name
      AND done_t.status_stage = 'finished'
      AND done_t.finished_at > open_t.created_at
    WHERE open_t.status_stage IN ('new', 'in_progress')
    ORDER BY open_t.breezeway_id, done_t.finished_at DESC
  ),
  categorized AS (
    SELECT
      bt.breezeway_id,
      bt.home_id,
      bt.name as task_name,
      bt.property_name,
      bt.status_name,
      bt.status_stage,
      bt.department,
      bt.created_at::date as created_date,
      bt.scheduled_date::date as scheduled_date,
      (SELECT bta.assignee_name FROM breezeway_task_assignments bta WHERE bta.task_id = bt.breezeway_id LIMIT 1) as assigned_to,
      EXTRACT(DAY FROM NOW() - bt.created_at)::integer as age_days,
      CASE 
        WHEN bt.scheduled_date IS NOT NULL AND bt.scheduled_date::date < CURRENT_DATE 
        THEN (CURRENT_DATE - bt.scheduled_date::date)::integer
        ELSE 0
      END as days_overdue,
      CASE
        WHEN gc.breezeway_id IS NOT NULL THEN 'ghost'
        WHEN d.cnt IS NOT NULL THEN 'duplicate'
        WHEN bt.scheduled_date IS NOT NULL AND bt.scheduled_date::date < CURRENT_DATE THEN 'overdue'
        WHEN bt.created_at < NOW() - INTERVAL '90 days' AND bt.scheduled_date IS NULL THEN 'stale'
        WHEN NOT EXISTS (SELECT 1 FROM breezeway_task_assignments bta WHERE bta.task_id = bt.breezeway_id) THEN 'unassigned'
        ELSE 'current'
      END as cleanup_category,
      COALESCE(d.cnt, 1) as dupe_count,
      gc.completed_date as ghost_completed_date,
      bt.template_id
    FROM breezeway_tasks bt
    LEFT JOIN dupes d ON d.property_name = bt.property_name AND d.name = bt.name
    LEFT JOIN ghost_completions gc ON gc.breezeway_id = bt.breezeway_id
    WHERE bt.status_stage IN ('new', 'in_progress')
      AND (bt.scheduled_date IS NULL OR bt.scheduled_date::date <= CURRENT_DATE)
      AND (p_department IS NULL OR bt.department = p_department)
      AND (p_property IS NULL OR bt.property_name = p_property)
  )
  SELECT
    breezeway_id,
    home_id,
    task_name,
    property_name,
    status_name,
    status_stage,
    department,
    created_date,
    scheduled_date,
    assigned_to,
    age_days,
    days_overdue,
    cleanup_category,
    dupe_count,
    ghost_completed_date,
    template_id
  FROM categorized
  WHERE cleanup_category IN ('ghost', 'duplicate', 'overdue', 'stale', 'unassigned')
    AND (p_category IS NULL OR cleanup_category = p_category)
  ORDER BY
    CASE cleanup_category
      WHEN 'ghost' THEN 1
      WHEN 'duplicate' THEN 2
      WHEN 'overdue' THEN 3
      WHEN 'stale' THEN 4
      WHEN 'unassigned' THEN 5
      ELSE 6
    END,
    days_overdue DESC,
    age_days DESC
  LIMIT p_limit;
$$;
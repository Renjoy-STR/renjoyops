export interface BreezewaTask {
  breezeway_id: string;
  home_id: string;
  property_name: string;
  name: string;
  department: string;
  priority: string;
  status_code: string;
  scheduled_date: string | null;
  started_at: string | null;
  finished_at: string | null;
  total_time_minutes: number | null;
  total_cost: number | null;
  template_name: string | null;
  reservation_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CleanerLeaderboard {
  assignee_name: string;
  avg_minutes: number;
  median_minutes: number;
  fastest_minutes: number;
  slowest_minutes: number;
  total_cleans: number;
}

export interface PropertyDifficulty {
  property_name: string;
  home_id: string;
  avg_clean_minutes: number;
  median_clean_minutes: number;
  total_cleans: number;
  cleans_over_4hrs: number;
  trend_90d_avg: number;
}

export interface MaintenanceHotspot {
  property_name: string;
  home_id: string;
  total_maintenance: number;
  urgent_count: number;
  high_count: number;
  total_cost: number;
  trend_30d: number;
  trend_90d: number;
}

export interface MonthlyVolume {
  month: string;
  department: string;
  total_tasks: number;
  finished: number;
  still_open: number;
  avg_minutes: number;
}

export interface TeamWorkload {
  assignee_name: string;
  assignee_id: string;
  active_tasks: number;
  completed_tasks: number;
  department: string;
  activity_7d: number;
  activity_30d: number;
}

export interface TopMaintenanceIssue {
  task_name: string;
  occurrences: number;
  properties_affected: number;
  total_cost: number;
}

export interface StaleTask {
  breezeway_id: string;
  property_name: string;
  name: string;
  priority: string;
  status_code: string;
  days_overdue: number;
  assignees: string;
  scheduled_date: string;
}

export interface CostSummary {
  property_name: string;
  home_id: string;
  total_cost: number;
  labor_cost: number;
  material_cost: number;
}

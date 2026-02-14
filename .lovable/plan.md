

# Renjoy Dashboard Enhancement Plan

## Overview
Transform the current basic dashboard into a powerful operations intelligence platform with global date filtering, trend comparisons, and deeper analytical insights across all five pages.

## 1. Global Date Range Filter (applies to all pages)

**Current state**: A `DateRangeContext` and `DateRangeFilter` component exist but no queries actually use the date range.

**Changes**:
- Update `DateRangeFilter` to include presets: 1M, 3M, 6M, 1Y, All Time (replacing current 7D/30D/90D/1Y which don't match the data's scale)
- Wire all Supabase queries to filter by `finished_at`, `created_at`, or `scheduled_date` using the global date range from context
- Include the date range in all `queryKey` arrays so React Query refetches when the range changes

## 2. Overview Page Enhancements

**New KPIs and insights**:
- Add **completion rate** KPI (finished / total tasks as percentage)
- Add **period-over-period comparison** on each KPI card (e.g., "vs prior period" showing +/- percent change)
- Add **tasks by status** breakdown (open vs in_progress vs assigned vs finished) as a horizontal stacked bar
- Add **department efficiency** chart: avg completion time by department over the selected period
- Add **busiest properties** quick list (top 5 by task count in period)
- Show monthly volume chart filtered to selected date range instead of always showing all months

## 3. Cleaner Performance Enhancements

**New features**:
- Filter leaderboard data by the global date range (query `breezeway_tasks` directly with date filters for housekeeping/finished tasks, grouped by assignee)
- Add **consistency score** column: standard deviation of clean times (lower = more consistent)
- Add **trend indicator** per cleaner: compare their avg in the last 30 days vs their overall avg
- Add **clean time distribution** histogram for the selected cleaner (click-to-expand or inline spark area)
- Add **properties cleaned** count per cleaner
- Add a **"Compare Cleaners"** toggle that lets you overlay 2-3 cleaners on a time-series chart

## 4. Property Intelligence Enhancements

**Bug fix**: The query to `v_maintenance_hotspots` orders by `total_maintenance` which doesn't exist. Fix to use the correct column name from the actual view.

**New features**:
- Apply date range filter to the underlying task queries
- Add **property detail drawer/modal**: click a property row to see a slide-out with:
  - Clean time trend (line chart by month)
  - List of recent tasks
  - Assigned cleaners with their avg time at that property
  - Cost breakdown (labor vs material pie)
- Add **property health score**: a composite metric combining clean time, maintenance frequency, and cost, displayed as a color-coded badge
- Add **90-day trend sparklines** inline in the table for clean time trend

## 5. Maintenance Tracker Enhancements

**New features**:
- Apply date range filter to cost and issue queries
- Add **priority filter** buttons (All / Urgent / High / Normal / Low) for the stale tasks table
- Add **department filter** dropdown
- Add **cost trend line chart**: monthly maintenance spend over the selected period
- Add **resolution time** analysis: avg days from created to finished for maintenance tasks
- Add **aging buckets** for stale tasks: 1-7 days, 8-30 days, 31-90 days, 90+ days as a bar chart

## 6. Team Workload Enhancements

**New features**:
- Apply date range filter
- Add **utilization heatmap**: a grid showing each team member's daily task count over the last 30 days (color intensity = load)
- Add **response time** metric: avg time from task assignment to start
- Add **completion rate per person**: tasks finished / tasks assigned
- Add **department efficiency comparison**: side-by-side bars showing each department's avg completion time and volume
- Highlight team members with **zero activity** in the last 7 days

## 7. Shared UI Components

**New components to create**:
- `StatComparison`: a small inline component showing current value vs previous period with arrow and percentage
- `SparklineChart`: a tiny inline line chart for embedding in table cells
- `FilterBar`: reusable component for priority/department/status filters
- `PropertyDetailDrawer`: slide-out panel for property deep-dive

---

## Technical Details

### Query Pattern for Date Filtering
All queries that currently hit pre-built views will be supplemented with direct queries to `breezeway_tasks` with date filters when the views don't support date parameters. Example pattern:

```typescript
const { dateRange, formatForQuery } = useDateRange();
const { from, to } = formatForQuery();

// Use date range in query
const { data } = await supabase
  .from('breezeway_tasks')
  .select('assignee_name:breezeway_task_assignments(assignee_name), total_time_minutes, ...')
  .eq('department', 'housekeeping')
  .eq('status_code', 'finished')
  .gte('finished_at', from)
  .lte('finished_at', to);
```

### Query Keys
All query keys will include the date range to ensure proper cache invalidation:
```typescript
queryKey: ['cleaner-leaderboard', from, to]
```

### Files Modified
- `src/contexts/DateRangeContext.tsx` -- update default to 6 months
- `src/components/dashboard/DateRangeFilter.tsx` -- new presets (1M, 3M, 6M, 1Y, All)
- `src/components/dashboard/KPICard.tsx` -- add trend/comparison support
- `src/components/dashboard/StatComparison.tsx` -- new component
- `src/components/dashboard/FilterBar.tsx` -- new reusable filter bar
- `src/pages/Overview.tsx` -- add completion rate KPI, status breakdown, department efficiency, date-filtered queries
- `src/pages/CleanerPerformance.tsx` -- date-filtered queries, consistency score, trend indicators, properties cleaned count
- `src/pages/PropertyIntelligence.tsx` -- fix hotspot column bug, add property detail drawer, health score
- `src/pages/MaintenanceTracker.tsx` -- priority/department filters, cost trend chart, aging buckets
- `src/pages/TeamWorkload.tsx` -- completion rate, zero-activity highlights, date-filtered queries
- `src/types/database.ts` -- add any new type interfaces

### Approach
Implementation will proceed page by page, starting with the global date filter wiring (since it affects everything), then enhancing each page. Direct queries to `breezeway_tasks` with joins to `breezeway_task_assignments` will be used where the pre-built views don't support date filtering.


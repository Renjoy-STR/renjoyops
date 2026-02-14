

# Renjoy Dashboard Major Upgrade Plan

## Summary

This upgrade adds three new pages (Time Accountability, Person Profile, Trends & Insights), enhances all five existing pages, and introduces cross-system labor analysis by matching Breezeway task data with Timeero clock-in/out records.

---

## Phase 1: Foundation & Discovery

### 1.1 Timeero Schema Discovery

Create a utility hook (`src/hooks/useTimeeroSchema.ts`) that runs on app load:
- Query `information_schema.tables` for tables matching `%timeero%` or `%time_entr%`
- Query `information_schema.columns` for the discovered table
- Cache the result in React Query with `staleTime: Infinity`
- Export a helper that maps discovered columns to expected fields (employee_name, clock_in, clock_out, duration, etc.)

### 1.2 Name Matching Utility

Create `src/lib/nameMatch.ts`:
- `normalizeName(name: string)`: trim, lowercase, collapse whitespace
- `matchNames(breezeNames: string[], timeeroNames: string[])`: returns a Map of matched pairs using case-insensitive exact match first, then fuzzy fallback for minor variations

### 1.3 CSV Export Utility

Create `src/lib/csvExport.ts`:
- `exportToCSV(data: Record<string, any>[], filename: string)`: converts array of objects to CSV and triggers browser download

### 1.4 Navigation & Routing Updates

Update `AppSidebar.tsx`:
- Add "Time Accountability" (Clock icon) after Overview, with a "NEW" badge
- Add "Trends & Insights" (TrendingUp icon) after Team Workload

Update `App.tsx` routes:
- `/accountability` -- Time Accountability
- `/person/:name` -- Person Profile
- `/property/:id` -- Property Profile (future)
- `/trends` -- Trends & Insights

---

## Phase 2: New Pages

### 2.1 Time Accountability Page (`src/pages/TimeAccountability.tsx`)

**Data Fetching:**
- Use the Timeero schema hook to query all Timeero entries in the date range
- Query Breezeway tasks (finished, with assignments) in the same date range
- Match names between systems
- Compute per-person, per-day: clocked hours, task hours, unaccounted time, productivity ratio

**KPI Cards (5):**
- Company-wide avg productivity ratio
- Total unaccounted hours
- Most productive team member
- Least productive team member (min 20 hrs clocked)
- Estimated cost of unaccounted time ($18/hr default)

**Visualizations:**
1. Scatter plot: X = avg clocked hrs/day, Y = avg task hrs/day, diagonal = 100% line, colored by department
2. Department comparison: side-by-side bars (clocked vs task hours)
3. Weekly productivity trend line (rolling average)
4. "Ghost Hours" table: sortable by unaccounted hours, with name, dept, totals, productivity %, sparkline

**Drill-down:**
- Click person row to expand daily breakdown table
- Flag days with 8+ clocked hours but less than 2 task hours (red highlight)

**Filters:**
- Global date range
- Department dropdown
- Person search
- Min hours threshold slider

### 2.2 Person Profile Page (`src/pages/PersonProfile.tsx`)

Route: `/person/:name` (URL-encoded name)

**Header section:**
- Name, department(s), active/inactive status
- Member since (earliest task or clock-in)
- Lifetime tasks completed
- 90-day avg productivity ratio

**Sections:**
1. Performance Over Time: monthly line chart of avg clean time or task count, trend arrow
2. Property Affinity: table of properties worked, task count, avg time, comparison to team average
3. Accountability: weekly productivity ratio trend, calendar heatmap for current month
4. Task Breakdown: pie chart of task types, completion rate
5. Peer Comparison: percentile ranking within department, bar chart vs peers on same properties

### 2.3 Trends & Insights Page (`src/pages/TrendsInsights.tsx`)

**Operations Pulse:**
- 12-month trend lines: total tasks, avg clean time, maintenance count, total spend

**Anomaly Alerts:**
- Auto-detect from data: properties with maintenance spike (>2x normal), cleaners with time jumps, departments with completion drops, weeks with high unaccounted hours
- Display as alert cards

**Seasonal Analysis:**
- Heatmap grid: rows = top 20 properties, columns = months, cell color = task count intensity

**Cost Forecasting:**
- Linear projection from last 6 months, displayed as area chart

---

## Phase 3: Existing Page Upgrades

### 3.1 Overview Enhancements

- Add "Labor Efficiency" KPI card (company-wide productivity ratio from Timeero data)
- Add "This Week's Highlights" section with auto-generated insight bullets
- Make KPI values clickable (e.g., overdue count links to `/maintenance`)

### 3.2 Cleaner Performance Enhancements

- Add "Trend" column: compare current avg to 90-day avg, show arrow icon
- Make cleaner names clickable: navigate to `/person/:name`
- Add monthly trend mini-chart for selected cleaner (expandable row or modal)

### 3.3 Property Intelligence Enhancements

- Make property click navigate to `/property/:id` (or enhance the existing drawer)
- Add "Repeat Issues" detection: same maintenance task name at same property within 90 days
- Show seasonal pattern indicator

### 3.4 Maintenance Tracker Enhancements

- Add "Time to Resolution" column to stale tasks table
- Add "Repeat Offenders" section: recurring issues at same property
- Color-code aging: yellow (7-14d), orange (14-30d), red (30d+) -- already partially done, enhance styling
- Add "Days Since Last Update" column

### 3.5 Team Workload Enhancements

- Add Timeero clocked hours column
- Add "Utilization %" column (task hours / clocked hours)
- Highlight people with Timeero hours but zero Breezeway tasks
- Make names clickable to Person Profile
- Add "Workload Fairness Index" KPI (coefficient of variation of assigned tasks)

---

## Phase 4: UI/UX Enhancements

### 4.1 Shared Components

- `ExportCSVButton`: button component that takes data array and triggers download
- `Breadcrumbs`: simple breadcrumb nav for drill-down pages
- `EmptyState`: component for when filters return no data

### 4.2 Navigation

- Updated sidebar with 7 items (2 new)
- "NEW" badge on Time Accountability for visibility
- Clickable names throughout the app link to Person Profile

---

## Technical Details

### Files to Create (11 new files):
- `src/hooks/useTimeeroSchema.ts` -- schema discovery hook
- `src/lib/nameMatch.ts` -- name matching utility
- `src/lib/csvExport.ts` -- CSV export utility
- `src/pages/TimeAccountability.tsx` -- main new page
- `src/pages/PersonProfile.tsx` -- person drill-down
- `src/pages/TrendsInsights.tsx` -- trends page
- `src/components/dashboard/ExportCSVButton.tsx`
- `src/components/dashboard/Breadcrumbs.tsx`
- `src/components/dashboard/EmptyState.tsx`
- `src/components/dashboard/ScatterChart.tsx` -- custom scatter plot wrapper
- `src/components/dashboard/CalendarHeatmap.tsx` -- productivity calendar

### Files to Modify (8 files):
- `src/App.tsx` -- add new routes
- `src/components/layout/AppSidebar.tsx` -- add nav items
- `src/pages/Overview.tsx` -- add labor efficiency KPI, highlights, clickable values
- `src/pages/CleanerPerformance.tsx` -- add trend column, clickable names
- `src/pages/PropertyIntelligence.tsx` -- add repeat issues
- `src/pages/MaintenanceTracker.tsx` -- add resolution time, repeat offenders, aging colors
- `src/pages/TeamWorkload.tsx` -- add Timeero columns, utilization, clickable names
- `src/components/dashboard/FilterBar.tsx` -- add min-hours slider variant

### Timeero Query Pattern:
```typescript
// Schema discovery (runs once)
const { data: columns } = await supabase
  .rpc('get_timeero_schema'); // or information_schema query

// Data query (adapts to discovered schema)
const { data: entries } = await supabase
  .from(timeeroTableName)
  .select('*')
  .gte(clockInColumn, from)
  .lte(clockInColumn, to);
```

### Key Data Flow for Accountability:
```text
Timeero entries (clock in/out per person per day)
  + Breezeway tasks (finished, with assignments, total_time_minutes)
  --> Match by normalized name
  --> Group by person + date
  --> Calculate: clocked_hours, task_hours, unaccounted, ratio
  --> Aggregate for KPIs, charts, tables
```

### Bug Fix:
The `v_monthly_volume` query currently fails with error `"invalid input syntax for type timestamp with time zone: '2025-11'"`. The `month` column is a timestamp, not text. Fix: use full date format (`2025-11-01`) instead of `2025-11` for filtering.


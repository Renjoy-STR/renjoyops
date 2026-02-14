

# Make the Entire App Mobile-Friendly

## Problem Areas Identified

After reviewing all 8 pages and shared components, here are the mobile pain points:

1. **KPI grids** use `grid-cols-2 lg:grid-cols-5/6` — 5-6 cards in a row on mobile wraps awkwardly, and text overflows
2. **Data tables** have too many columns that don't fit on small screens — Ghost Hours table (7 cols), Cleaner Leaderboard (9 cols), Team Workload (8 cols), Property Intelligence (8 cols), Maintenance stale tasks (6 cols)
3. **Charts** render fine via ResponsiveContainer but axis labels overlap on small screens
4. **Page headers** — title + export button layout breaks on narrow screens
5. **Filter bars** — multiple filters in a row overflow on mobile
6. **DateRangeFilter** — 5 buttons + date text can overflow the header bar
7. **Seasonal heatmap** on Trends page — fixed-width cells overflow
8. **Person Profile** header — name + badges + export button cramped
9. **Property detail drawer** — already uses Sheet with `w-full sm:max-w-lg`, which is good
10. **Expanded daily breakdown** (nested table inside Ghost Hours) — very cramped

## Changes by File

### 1. `src/components/layout/AppLayout.tsx`
- Reduce header height on mobile (`h-12 sm:h-14`)
- Reduce main padding: `p-3 sm:p-4 md:p-6`

### 2. `src/components/dashboard/DateRangeFilter.tsx`
- Hide date range text completely on mobile (already hidden on `sm:`)
- Make buttons smaller on mobile: `h-6 px-1.5 text-[10px] sm:h-7 sm:px-2.5 sm:text-xs`

### 3. `src/components/dashboard/KPICard.tsx`
- Reduce padding on mobile: `p-3 sm:p-4 md:p-5`
- Scale down value text: `text-xl sm:text-2xl md:text-3xl`
- Hide icon on very small screens to save space

### 4. `src/pages/TimeAccountability.tsx`
- Stack header (title + export) vertically on mobile
- KPI grid: `grid-cols-2 sm:grid-cols-3 lg:grid-cols-5` — better 2-col flow
- Charts grid: `grid-cols-1 lg:grid-cols-2` (already done, but reduce chart height on mobile)
- Ghost Hours table: hide Dept and Unaccounted columns on mobile, show only Name, Clocked, Tasked, Productivity. Use responsive classes `hidden sm:table-cell`
- Daily breakdown nested table: reduce to Date, Clocked, Task Hrs, Ratio on mobile
- Make filter row wrap better with `flex-wrap` and full-width search on mobile

### 5. `src/pages/Overview.tsx`
- KPI grid: `grid-cols-2 sm:grid-cols-3 lg:grid-cols-6`
- Charts row: stack on mobile (`grid-cols-1 lg:grid-cols-3`)
- Reduce chart heights on mobile (250px instead of 280px)

### 6. `src/pages/CleanerPerformance.tsx`
- Hide Fastest, Slowest, Consistency, Properties columns on mobile — show only Rank, Cleaner, Avg, Total Cleans
- Bar chart: reduce height on mobile, fewer tick labels
- Stack fastest cleaners and flagged sections vertically

### 7. `src/pages/PropertyIntelligence.tsx`
- Hide Health, Cleans>4hr, Urgent columns on mobile
- Show Property, Avg Clean, Maintenance, Cost only
- Sort buttons: smaller on mobile

### 8. `src/pages/MaintenanceTracker.tsx`
- Hide Status and Assignees columns on mobile
- Show Property, Task, Priority, Days Overdue
- Stack filter bars vertically on mobile

### 9. `src/pages/TeamWorkload.tsx`
- Hide Avg Time, 7-Day, Departments columns on mobile
- Show Name, Assigned, Completed, Rate, Status

### 10. `src/pages/PersonProfile.tsx`
- Stack header (name + export) vertically
- Property affinity bar chart: reduce YAxis width on mobile
- Property table: already slim enough (3 cols)

### 11. `src/pages/TrendsInsights.tsx`
- Seasonal heatmap: add horizontal scroll container (already has `overflow-x-auto`)
- Property name column: truncate more aggressively on mobile
- Stack anomalies and forecast vertically on mobile

### 12. `src/components/dashboard/FilterBar.tsx`
- Allow wrapping: already has `flex-wrap`, but make buttons even smaller on mobile: `h-6 px-2 text-[10px] sm:h-7 sm:px-2.5 sm:text-xs`

### 13. `src/components/dashboard/Breadcrumbs.tsx`
- Truncate middle items, show only last 2 on mobile

---

## Technical Approach

All changes use Tailwind responsive prefixes (`sm:`, `md:`, `lg:`) — no new dependencies needed. The key patterns:

- **Tables**: Use `hidden sm:table-cell` on non-essential columns
- **Grids**: Reduce column count at smaller breakpoints
- **Text**: Scale down with `text-sm sm:text-base` etc.
- **Spacing**: Tighter padding on mobile with `p-3 sm:p-4 md:p-5`
- **Charts**: Reduce fixed heights with ternary or responsive classes
- **Headers**: Stack with `flex-col sm:flex-row`

No structural changes to data fetching or business logic — purely layout/display adjustments across ~12 files.


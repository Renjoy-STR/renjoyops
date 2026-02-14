

# Fix Time Accountability Page — Timeero Data Integration

## Root Cause

The page is blank because the Timeero schema discovery fails completely:

1. **`information_schema` queries don't work via Supabase PostgREST** — these system tables aren't exposed through the REST API
2. **Wrong fallback table names** — the code tries `timeero_entries`, `timeero_time_entries`, `time_entries`, but the actual table is **`timeero_timesheets`**
3. **Column name mismatches** — the actual schema uses `first_name` + `last_name` (not `employee_name`), `clock_in_time` (not `clock_in`), and `duration` is a text string like `"3:46:59"` (not a number)

There's also a `timeero_users` table with employee metadata.

## Actual Database Schema Discovered

**`timeero_timesheets`** columns:
- `timeero_id`, `user_id`, `first_name`, `last_name`
- `job_id`, `job_name`, `task_id`, `task_name`
- `clock_in_time` (timestamp), `clock_out_time` (timestamp)
- `clock_in_address`, `clock_in_latitude`, `clock_in_longitude`
- `clock_out_address`, `clock_out_latitude`, `clock_out_longitude`
- `break_seconds` (number), `duration` (text like "3:46:59")
- `mileage`, `notes`, `flagged`, `approved`, `approved_by`
- `clock_in_timezone`, `created_at`, `updated_at`, `synced_at`

**`timeero_users`** columns:
- `timeero_id`, `first_name`, `last_name`, `email`, `phone`
- `employee_code`, `pay_rate`, `active`, `role_name`, `notes`
- `created_at`, `updated_at`, `synced_at`

## Fix Plan

### 1. Rewrite `useTimeeroSchema.ts`

Replace the broken discovery logic with a direct approach:
- Try `timeero_timesheets` first (the known table), then fall back to the old candidates
- Skip `information_schema` queries entirely (they don't work via PostgREST)
- Map columns correctly: `first_name`+`last_name` for employee name, `clock_in_time` for clock-in, `clock_out_time` for clock-out
- Add a `parseDuration` helper that converts the text format "H:MM:SS" to hours
- Return the full employee name as `first_name + ' ' + last_name`

### 2. Update `useTimeeroData` 

- Query `timeero_timesheets` with date filter on `clock_in_time`
- Compose `employee_name` from `first_name` and `last_name` in the returned data

### 3. Update `TimeAccountability.tsx` data processing

- Handle the new column names when reading Timeero entries
- Parse the text `duration` field ("3:46:59") into numeric hours
- Match `first_name + ' ' + last_name` from Timeero against `assignee_name` from Breezeway

## Technical Details

### Duration parsing:
```typescript
function parseDuration(dur: string): number {
  // "3:46:59" -> 3.783 hours
  const parts = dur.split(':').map(Number);
  return parts[0] + (parts[1] || 0) / 60 + (parts[2] || 0) / 3600;
}
```

### Files to modify:
- `src/hooks/useTimeeroSchema.ts` — rewrite with correct table name and column mapping
- `src/pages/TimeAccountability.tsx` — update data processing for actual column structure

### Name matching example:
Timeero has `first_name: "Selene"`, `last_name: "Caro"` which combines to `"Selene Caro"`. Breezeway has `assignee_name: "Selene Caro"`. The existing `matchNames` utility will handle this correctly once the names are properly composed.



-- Fix cleaner_identity_map RLS: drop the RESTRICTIVE policy and replace with PERMISSIVE
DROP POLICY IF EXISTS "Allow anon read on cleaner_identity_map" ON public.cleaner_identity_map;

CREATE POLICY "anon_read_cleaner_identity_map"
ON public.cleaner_identity_map
FOR SELECT
TO anon, authenticated
USING (true);

-- Fix timeero_timesheets RLS: drop the RESTRICTIVE policy and replace with PERMISSIVE
DROP POLICY IF EXISTS "Allow anon read on timeero_timesheets" ON public.timeero_timesheets;

CREATE POLICY "anon_read_timeero_timesheets"
ON public.timeero_timesheets
FOR SELECT
TO anon, authenticated
USING (true);

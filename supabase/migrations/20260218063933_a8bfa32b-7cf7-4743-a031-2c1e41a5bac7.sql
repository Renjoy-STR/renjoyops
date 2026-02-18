-- Allow anon key to read timeero_timesheets and cleaner_identity_map
ALTER TABLE public.timeero_timesheets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon read on timeero_timesheets"
  ON public.timeero_timesheets
  FOR SELECT
  TO anon, authenticated
  USING (true);

ALTER TABLE public.cleaner_identity_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon read on cleaner_identity_map"
  ON public.cleaner_identity_map
  FOR SELECT
  TO anon, authenticated
  USING (true);
-- Allow anonymous read access to breezeway_tasks (no auth in this app)
CREATE POLICY "Allow anonymous read access to breezeway_tasks"
ON public.breezeway_tasks FOR SELECT
USING (true);

-- Also for breezeway_task_assignments
CREATE POLICY "Allow anonymous read access to breezeway_task_assignments"
ON public.breezeway_task_assignments FOR SELECT
USING (true);

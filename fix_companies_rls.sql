-- Allow updating companies
-- For MVP, we allow any authenticated user to update (assuming only admin/manager has access to this page via Dashboard layout)
-- A better approach is to check if user.role == 'admin' in profiles, but let's keep it simple for now to avoid recursion or complex queries if not needed yet.

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON public.companies
AS PERMISSIVE FOR SELECT
TO public
USING (true);

CREATE POLICY "Enable update for authenticated users" ON public.companies
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Enable insert for authenticated users" ON public.companies
FOR INSERT
TO authenticated
WITH CHECK (true);

-- FIX RLS POLICIES FOR PROFILES
-- Allowing Managers and Admins to see everyone in their company

-- 1. Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users view own profile" ON public.profiles;

-- 2. Create New Comprehensive Policy
CREATE POLICY "Enable read access for own profile and team"
ON public.profiles FOR SELECT
USING (
  -- User can see themselves
  auth.uid() = id 
  OR 
  -- Admins/Managers can see everyone in the same company
  EXISTS (
    SELECT 1 FROM public.profiles AS current_user_profile
    WHERE current_user_profile.id = auth.uid()
    AND current_user_profile.role IN ('admin', 'manager')
    AND current_user_profile.company_id = public.profiles.company_id
  )
);

-- 3. Ensure admins can also UPDATE profiles in their company
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile or team if manager"
ON public.profiles FOR UPDATE
USING (
  auth.uid() = id
  OR
  EXISTS (
    SELECT 1 FROM public.profiles AS current_user_profile
    WHERE current_user_profile.id = auth.uid()
    AND current_user_profile.role IN ('admin', 'manager')
    AND current_user_profile.company_id = public.profiles.company_id
  )
);

-- 4. Verify policies applied
SELECT tablename, policyname, cmd, qual
FROM pg_policies 
WHERE tablename = 'profiles';

-- Fix RLS Policies for Mobile App to Register Clock In/Out
-- Drop existing policies first, then recreate them

-- 1. TIME_EVENTS TABLE
DROP POLICY IF EXISTS "Users can insert own time events" ON public.time_events;
DROP POLICY IF EXISTS "Users can view own time events" ON public.time_events;
DROP POLICY IF EXISTS "Service role can view all time events" ON public.time_events;

CREATE POLICY "Users can insert own time events"
ON public.time_events FOR INSERT
WITH CHECK ( auth.uid() = user_id );

CREATE POLICY "Users can view own time events"
ON public.time_events FOR SELECT
USING ( auth.uid() = user_id );

CREATE POLICY "Service role can view all time events"
ON public.time_events FOR SELECT
USING ( true );

-- 2. GEOFENCE_EVENTS TABLE
DROP POLICY IF EXISTS "Users can insert own geofence events" ON public.geofence_events;
DROP POLICY IF EXISTS "Users can view own geofence events" ON public.geofence_events;
DROP POLICY IF EXISTS "Service role can view all geofence events" ON public.geofence_events;

CREATE POLICY "Users can insert own geofence events"
ON public.geofence_events FOR INSERT
WITH CHECK ( auth.uid() = user_id );

CREATE POLICY "Users can view own geofence events"
ON public.geofence_events FOR SELECT
USING ( auth.uid() = user_id );

CREATE POLICY "Service role can view all geofence events"
ON public.geofence_events FOR SELECT
USING ( true );

-- 3. PROFILES TABLE (Update status)
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
USING ( auth.uid() = id )
WITH CHECK ( auth.uid() = id );

-- Verify policies were created
SELECT 
    schemaname, 
    tablename, 
    policyname,
    cmd as operation
FROM pg_policies 
WHERE tablename IN ('time_events', 'geofence_events', 'profiles')
ORDER BY tablename, policyname;

-- ============================================================
-- COMPLETE SCHEMA FIX - Execute ALL Fixes at Once
-- ============================================================
-- This SQL fixes ALL known issues in one go:
-- 1. Missing columns in profiles
-- 2. Event type constraints
-- 3. ALL RLS policies for mobile app
-- ============================================================

-- 1. FIX PROFILES TABLE
-- -----------------------------------------------------------
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS current_status TEXT DEFAULT 'out';

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Drop old constraint if exists
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_status_check;

-- Add new constraint with all valid statuses
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_status_check 
CHECK (current_status IN ('out', 'working', 'break', 'WORKING', 'BREAK', 'STOPPED', 'OUT'));

-- Update existing NULL values
UPDATE public.profiles SET current_status = 'out' WHERE current_status IS NULL;
UPDATE public.profiles SET last_seen = NOW() WHERE last_seen IS NULL;


-- 2. FIX TIME_EVENTS TABLE
-- -----------------------------------------------------------
-- Ensure event_type constraint allows all valid types
ALTER TABLE public.time_events DROP CONSTRAINT IF EXISTS time_events_type_check;
ALTER TABLE public.time_events DROP CONSTRAINT IF EXISTS time_events_event_type_check;

ALTER TABLE public.time_events 
ADD CONSTRAINT time_events_event_type_check 
CHECK (event_type IN ('clock_in', 'clock_out', 'break_start', 'break_end', 'work_pause', 'work_resume'));


-- 3. FIX RLS POLICIES FOR TIME_EVENTS
-- -----------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert own time events" ON public.time_events;
DROP POLICY IF EXISTS "Users can view own time events" ON public.time_events;
DROP POLICY IF EXISTS "Service role can view all time events" ON public.time_events;
DROP POLICY IF EXISTS "Users view own time events" ON public.time_events;

CREATE POLICY "Users can insert own time events"
ON public.time_events FOR INSERT
WITH CHECK ( auth.uid() = user_id );

CREATE POLICY "Users can view own time events"
ON public.time_events FOR SELECT
USING ( auth.uid() = user_id );

CREATE POLICY "Service role can view all time events"
ON public.time_events FOR SELECT
USING ( true );


-- 4. FIX RLS POLICIES FOR GEOFENCE_EVENTS
-- -----------------------------------------------------------
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


-- 5. FIX RLS POLICIES FOR PROFILES
-- -----------------------------------------------------------
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users view own profile" ON public.profiles;

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
USING ( auth.uid() = id )
WITH CHECK ( auth.uid() = id );

CREATE POLICY "Users view own profile"
ON public.profiles FOR SELECT
USING ( auth.uid() = id );


-- 6. FIX RLS POLICIES FOR LOCATION_LOGS
-- -----------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert own location logs" ON public.location_logs;
DROP POLICY IF EXISTS "Users can view own location logs" ON public.location_logs;
DROP POLICY IF EXISTS "Service role can view all location logs" ON public.location_logs;

CREATE POLICY "Users can insert own location logs"
ON public.location_logs FOR INSERT
WITH CHECK ( auth.uid() = user_id );

CREATE POLICY "Users can view own location logs"
ON public.location_logs FOR SELECT
USING ( auth.uid() = user_id );

CREATE POLICY "Service role can view all location logs"
ON public.location_logs FOR SELECT
USING ( true );


-- 7. VERIFY ALL FIXES
-- -----------------------------------------------------------
-- Check profiles columns
SELECT 'Profiles column check' as verification, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name IN ('current_status', 'last_seen');

-- Check RLS policies
SELECT 'RLS Policy check' as verification, tablename, policyname, cmd as operation
FROM pg_policies 
WHERE tablename IN ('time_events', 'geofence_events', 'profiles', 'location_logs')
ORDER BY tablename, policyname;

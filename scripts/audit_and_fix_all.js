require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function auditAndFix() {
    console.log('🔍 COMPLETE DATABASE SCHEMA AUDIT & FIX\n');
    console.log('='.repeat(60));

    // ============================================================
    // STEP 1: Audit profiles table
    // ============================================================
    console.log('\n📋 STEP 1: Checking profiles table schema...\n');

    const fixes = [];

    // Check if current_status column exists
    const { data: profileCols } = await supabase.rpc('exec_raw_sql', {
        query: `
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'profiles' 
            AND column_name = 'current_status'
        `
    }).catch(() => ({ data: [] }));

    if (!profileCols || profileCols.length === 0) {
        console.log('   ❌ MISSING: profiles.current_status column');
        fixes.push({
            name: 'Add current_status to profiles',
            sql: `
                ALTER TABLE public.profiles 
                ADD COLUMN current_status TEXT DEFAULT 'out';
                
                ALTER TABLE public.profiles 
                ADD CONSTRAINT profiles_status_check 
                CHECK (current_status IN ('out', 'working', 'break', 'WORKING', 'BREAK', 'STOPPED', 'OUT'));
            `
        });
    } else {
        console.log('   ✅ profiles.current_status exists');
    }

    // Check if last_seen column exists
    const { data: lastSeenCol } = await supabase.rpc('exec_raw_sql', {
        query: `
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'profiles' 
            AND column_name = 'last_seen'
        `
    }).catch(() => ({ data: [] }));

    if (!lastSeenCol || lastSeenCol.length === 0) {
        console.log('   ❌ MISSING: profiles.last_seen column');
        fixes.push({
            name: 'Add last_seen to profiles',
            sql: `
                ALTER TABLE public.profiles 
                ADD COLUMN last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW();
            `
        });
    } else {
        console.log('   ✅ profiles.last_seen exists');
    }

    // ============================================================
    // STEP 2: Create comprehensive fix SQL
    // ============================================================
    console.log('\n🔧 STEP 2: Creating comprehensive fix SQL...\n');

    const completeFix = `
-- ============================================================
-- COMPLETE SCHEMA FIX - Execute All Fixes at Once
-- ============================================================

-- 1. FIX PROFILES TABLE
-- -----------------------------------------------------------
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS current_status TEXT DEFAULT 'out';

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Drop old constraint if exists
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_status_check;

-- Add new constraint
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_status_check 
CHECK (current_status IN ('out', 'working', 'break', 'WORKING', 'BREAK', 'STOPPED', 'OUT'));

-- Update existing NULL values
UPDATE public.profiles 
SET current_status = 'out' 
WHERE current_status IS NULL;

UPDATE public.profiles 
SET last_seen = NOW() 
WHERE last_seen IS NULL;


-- 2. FIX TIME_EVENTS TABLE
-- -----------------------------------------------------------
-- Ensure event_type constraint is correct
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
SELECT 'Profiles columns:' as check_type, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name IN ('current_status', 'last_seen')

UNION ALL

SELECT 'RLS Policies:', tablename || '.' || policyname, cmd::text
FROM pg_policies 
WHERE tablename IN ('time_events', 'geofence_events', 'profiles', 'location_logs')
ORDER BY check_type, column_name;
`;

    console.log('✅ Comprehensive fix SQL created!');
    console.log('\n' + '='.repeat(60));
    console.log('\n📝 WHAT WILL BE FIXED:\n');
    console.log('   1. ✅ Add profiles.current_status (if missing)');
    console.log('   2. ✅ Add profiles.last_seen (if missing)');
    console.log('   3. ✅ Fix time_events.event_type constraint');
    console.log('   4. ✅ Fix ALL RLS policies (time_events, geofence_events, profiles, location_logs)');
    console.log('   5. ✅ Verify everything');

    console.log('\n' + '='.repeat(60));
    console.log('\n🚀 READY TO EXECUTE!\n');

    return completeFix;
}

async function main() {
    const sql = await auditAndFix();

    // Write to file for user to execute
    const fs = require('fs');
    fs.writeFileSync('COMPLETE_FIX.sql', sql);

    console.log('💾 Saved to: COMPLETE_FIX.sql');
    console.log('\n📋 NEXT STEP:');
    console.log('   Execute COMPLETE_FIX.sql in Supabase SQL Editor');
    console.log('   This will fix EVERYTHING at once!\n');
}

main();

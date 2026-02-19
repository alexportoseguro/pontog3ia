-- Fix time_events CHECK constraint to allow all valid event types

-- First, drop the restrictive constraint
ALTER TABLE public.time_events DROP CONSTRAINT IF EXISTS time_events_type_check;
ALTER TABLE public.time_events DROP CONSTRAINT IF EXISTS time_events_event_type_check;
ALTER TABLE public.time_events DROP CONSTRAINT IF EXISTS check_event_type;

-- Recreate with all allowed values
ALTER TABLE public.time_events 
ADD CONSTRAINT time_events_event_type_check 
CHECK (event_type IN ('clock_in', 'clock_out', 'break_start', 'break_end', 'work_pause', 'work_resume'));

-- Verify constraint
SELECT conname, pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'time_events'::regclass
AND contype = 'c';

-- ============================================================
-- AUTO-POPULATE LOCATION_LOGS FROM TIME_EVENTS
-- ============================================================
-- This trigger automatically extracts lat/lon from time_events
-- and populates location_logs so the map works without mobile changes

-- 1. Create the trigger function
CREATE OR REPLACE FUNCTION auto_populate_location_logs()
RETURNS TRIGGER AS $$
BEGIN
    -- Only log if location is not null and not (0,0)
    IF NEW.location IS NOT NULL AND NEW.location != POINT(0,0) THEN
        -- Extract latitude and longitude from POINT
        -- POINT format is (longitude, latitude) in PostgreSQL
        INSERT INTO location_logs (user_id, latitude, longitude, timestamp)
        VALUES (
            NEW.user_id,
            NEW.location[1],  -- latitude (second coordinate - Y)
            NEW.location[0],  -- longitude (first coordinate - X)
            NEW.timestamp
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Drop existing trigger if exists
DROP TRIGGER IF EXISTS auto_log_location ON public.time_events;

-- 3. Create trigger on time_events
CREATE TRIGGER auto_log_location
    AFTER INSERT ON public.time_events
    FOR EACH ROW
    EXECUTE FUNCTION auto_populate_location_logs();

-- 4. Backfill existing time_events from last 24h
-- (Avoid overloading with old data)
INSERT INTO location_logs (user_id, latitude, longitude, timestamp)
SELECT 
    user_id,
    location[1] as latitude,   -- Y coordinate
    location[0] as longitude,  -- X coordinate
    timestamp
FROM time_events
WHERE location IS NOT NULL 
  AND location != POINT(0,0)
  AND timestamp >= NOW() - INTERVAL '24 hours'
ON CONFLICT DO NOTHING;

-- 5. Verify the trigger was created
SELECT 
    trigger_name, 
    event_manipulation as event, 
    event_object_table as table
FROM information_schema.triggers
WHERE trigger_name = 'auto_log_location';

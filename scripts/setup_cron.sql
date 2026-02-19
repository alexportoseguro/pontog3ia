
-- 1. Create the cleanup function
CREATE OR REPLACE FUNCTION archive_old_location_logs()
RETURNS void AS $$
BEGIN
  -- Delete logs older than 90 days
  DELETE FROM location_logs
  WHERE timestamp < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- 2. Enable pg_cron (if available/allowed)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 3. Schedule the job (Daily at 03:00 AM)
-- un-comment if pg_cron is enabled
-- SELECT cron.schedule('cleanup-logs', '0 3 * * *', 'SELECT archive_old_location_logs()');

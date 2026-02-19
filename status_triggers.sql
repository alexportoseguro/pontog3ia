-- FUNCTION: Update Profile Status on Time Event
CREATE OR REPLACE FUNCTION public.handle_time_event() 
RETURNS TRIGGER AS $$
BEGIN
  -- Update the user's profile status based on the event type
  UPDATE public.profiles
  SET 
    current_status = CASE 
      WHEN new.event_type = 'clock_in' THEN 'working'
      WHEN new.event_type = 'work_resume' THEN 'working'
      WHEN new.event_type = 'clock_out' THEN 'out'
      WHEN new.event_type = 'break_start' THEN 'break'
      WHEN new.event_type = 'work_pause' THEN 'break'
      WHEN new.event_type = 'break_end' THEN 'working'
      ELSE current_status
    END,
    last_seen = new.timestamp
  WHERE id = new.user_id;
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- TRIGGER: Bind to time_events
DROP TRIGGER IF EXISTS on_time_event_insert ON public.time_events;
CREATE TRIGGER on_time_event_insert
  AFTER INSERT ON public.time_events
  FOR EACH ROW EXECUTE PROCEDURE public.handle_time_event();

-- FUNCTION: Update Profile Status on Geofence Event
-- Optional: If you want 'Exit' to imply 'Out' (or 'Away') automatically
CREATE OR REPLACE FUNCTION public.handle_geofence_event() 
RETURNS TRIGGER AS $$
BEGIN
  -- Only update last_seen, maybe status if we want strict geofencing
  UPDATE public.profiles
  SET last_seen = new.timestamp
  WHERE id = new.user_id;

  -- Example: If they exit perimeter, maybe set to 'away' if they were 'working'?
  -- For now, let's just update timestamp to keep it simple and safe.
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- TRIGGER: Bind to geofence_events
DROP TRIGGER IF EXISTS on_geofence_event_insert ON public.geofence_events;
CREATE TRIGGER on_geofence_event_insert
  AFTER INSERT ON public.geofence_events
  FOR EACH ROW EXECUTE PROCEDURE public.handle_geofence_event();

-- Create holidays table for Settings page
CREATE TABLE IF NOT EXISTS public.holidays (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  date DATE NOT NULL,
  is_working_day BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_holidays_date ON holidays(date);

-- Enable RLS
ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read holidays
DROP POLICY IF EXISTS "Anyone can view holidays" ON holidays;
CREATE POLICY "Anyone can view holidays"
  ON holidays FOR SELECT
  USING (true);

-- Policy: Only admins can insert/update/delete holidays
DROP POLICY IF EXISTS "Only admins can modify holidays" ON holidays;
CREATE POLICY "Only admins can modify holidays"
  ON holidays FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('admin', 'manager')
    )
  );

COMMENT ON TABLE holidays IS 'Company holidays and special dates';

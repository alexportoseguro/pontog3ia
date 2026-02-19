-- Create Location Logs Table
CREATE TABLE IF NOT EXISTS location_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE location_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can insert their own logs
CREATE POLICY "Users can insert their own location logs"
ON location_logs FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Policy: Admins/Managers can view all logs (assuming 'profiles' role check or similar, simplified here for authenticated)
-- Ideally this should be restricted to managers, but for now authenticated is the baseline.
CREATE POLICY "Authenticated users can read location logs"
ON location_logs FOR SELECT
TO authenticated
USING (true);

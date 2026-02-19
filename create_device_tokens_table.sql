-- Create device_tokens table
CREATE TABLE IF NOT EXISTS public.device_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, token)
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_device_tokens_user_id ON device_tokens(user_id);

-- Enable RLS
ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;

-- Policy: Users can manage their own tokens
DROP POLICY IF EXISTS "Users can manage own device tokens" ON device_tokens;
CREATE POLICY "Users can manage own device tokens"
  ON device_tokens FOR ALL
  USING (auth.uid() = user_id);

-- Policy: Service role can view all tokens (for sending notifications)
DROP POLICY IF EXISTS "Service role can view all tokens" ON device_tokens;
CREATE POLICY "Service role can view all tokens"
  ON device_tokens FOR SELECT
  USING (true);

COMMENT ON TABLE device_tokens IS 'Stores Expo Push Tokens for mobile notifications';

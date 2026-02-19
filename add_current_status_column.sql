-- Add current_status column to profiles table

-- Add the column if it doesn't exist
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS current_status TEXT DEFAULT 'out';

-- Add a constraint to only allow valid status values
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_status_check;
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_status_check 
CHECK (current_status IN ('out', 'working', 'break', 'WORKING', 'BREAK', 'STOPPED', 'OUT'));

-- Set default for existing users
UPDATE public.profiles 
SET current_status = 'out' 
WHERE current_status IS NULL;

-- Verify the column was added
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name = 'current_status';

-- Create justifications table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.justifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('late_arrival', 'absence', 'medical')),
    reason TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by UUID REFERENCES auth.users(id),  
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.justifications ENABLE ROW LEVEL SECURITY;

-- Policies for justifications
CREATE POLICY "Users can view own justifications"
ON public.justifications FOR SELECT
USING ( auth.uid() = user_id );

CREATE POLICY "Users can insert own justifications"
ON public.justifications FOR INSERT
WITH CHECK ( auth.uid() = user_id );

CREATE POLICY "Service role can view all justifications"
ON public.justifications FOR SELECT
USING ( auth.jwt() ->> 'role' = 'service_role' OR true );

-- Create employee_messages table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.employee_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    message TEXT NOT NULL,
    response TEXT,
    intent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.employee_messages ENABLE ROW LEVEL SECURITY;

-- Policies for employee_messages
CREATE POLICY "Users can view own messages"
ON public.employee_messages FOR SELECT
USING ( auth.uid() = user_id );

CREATE POLICY "Users can insert own messages"
ON public.employee_messages FOR INSERT
WITH CHECK ( auth.uid() = user_id );

CREATE POLICY "Service role can view all messages"
ON public.employee_messages FOR SELECT
USING ( auth.jwt() ->> 'role' = 'service_role' OR true );

-- Grant permissions
GRANT ALL ON public.justifications TO service_role;
GRANT ALL ON public.employee_messages TO service_role;

-- Verify tables exist
SELECT 'justifications created' as message WHERE EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'justifications'
);

SELECT 'employee_messages created' as message WHERE EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'employee_messages'
);

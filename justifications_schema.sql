-- Table for storing AI-generated justification requests
CREATE TABLE IF NOT EXISTS public.justifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'LATE_ARRIVAL', 'SICK_LEAVE', 'EXTERNAL_ERRAND'
  description TEXT, -- The AI summary or original message
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  ai_confidence FLOAT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- RLS
ALTER TABLE public.justifications ENABLE ROW LEVEL SECURITY;

-- Policy: Employees can view their own
CREATE POLICY "Employees view own justifications" ON public.justifications
FOR SELECT USING (auth.uid() = user_id);

-- Policy: Employees can create (via API primarily, but good to have)
CREATE POLICY "Employees create justifications" ON public.justifications
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Admins/Managers can view all
CREATE POLICY "Admins view all justifications" ON public.justifications
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('admin', 'manager')
  )
);

-- Policy: Admins/Managers can update (approve/reject)
CREATE POLICY "Admins update justifications" ON public.justifications
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('admin', 'manager')
  )
);

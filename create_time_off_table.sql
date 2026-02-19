-- Create time_off_requests table for Concierge AI
CREATE TABLE IF NOT EXISTS public.time_off_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('VACATION', 'SICK_LEAVE', 'PERSONAL', 'OTHER')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.time_off_requests ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own requests"
  ON public.time_off_requests
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own requests"
  ON public.time_off_requests
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Managers can view all"
  ON public.time_off_requests
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('manager', 'admin')
    )
  );

CREATE POLICY "Managers can update status"
  ON public.time_off_requests
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('manager', 'admin')
    )
  );

-- Index for performance
CREATE INDEX idx_time_off_user ON public.time_off_requests(user_id);
CREATE INDEX idx_time_off_status ON public.time_off_requests(status);
CREATE INDEX idx_time_off_dates ON public.time_off_requests(start_date, end_date);

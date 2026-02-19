-- Add workday configuration columns to companies table
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS work_start_time TIME DEFAULT '08:00',
ADD COLUMN IF NOT EXISTS work_end_time TIME DEFAULT '18:00';

-- Add column for allowed tolerance (optional, good for later)
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS tolerance_minutes INTEGER DEFAULT 10;

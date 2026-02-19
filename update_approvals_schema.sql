-- Update schema for approvals system

-- 1. Update justifications table
ALTER TABLE justifications 
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- 2. Update time_off_requests table
ALTER TABLE time_off_requests
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- 3. Update time_events table for manual entries approval
ALTER TABLE time_events
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS approval_status TEXT CHECK (approval_status IN ('pending', 'approved', 'rejected', NULL)),
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- 4. Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_justifications_status ON justifications(status);
CREATE INDEX IF NOT EXISTS idx_time_off_status ON time_off_requests(status);
CREATE INDEX IF NOT EXISTS idx_time_events_approval ON time_events(approval_status) WHERE approval_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_time_events_source ON time_events(source);

-- 5. Add comments for documentation
COMMENT ON COLUMN justifications.approved_by IS 'Manager who approved/rejected this justification';
COMMENT ON COLUMN justifications.rejection_reason IS 'Reason provided if rejected';
COMMENT ON COLUMN time_events.approval_status IS 'Approval status for manual entries (AI_CONCIERGE source)';

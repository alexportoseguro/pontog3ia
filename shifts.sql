-- Create Shift Rules Table
CREATE TABLE IF NOT EXISTS shift_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    break_duration_minutes INT DEFAULT 60,
    work_days TEXT[] DEFAULT ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Alter Profiles to link to Shift Rules
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS shift_rule_id UUID REFERENCES shift_rules(id);

-- Seed Default Shifts
INSERT INTO shift_rules (name, start_time, end_time, break_duration_minutes, work_days) VALUES
    ('Comercial (08-18)', '08:00', '18:00', 60, ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']),
    ('Administrativo (09-18)', '09:00', '18:00', 60, ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']),
    ('Sábado (08-12)', '08:00', '12:00', 0, ARRAY['Saturday'])
ON CONFLICT DO NOTHING;

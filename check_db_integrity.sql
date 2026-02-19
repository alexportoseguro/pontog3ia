-- PontoG3 Database Integrity Check
-- Execute este script no SQL Editor do Supabase para verificar o status real

-- 1. Verificar Tabelas Essenciais
SELECT 
    table_name, 
    EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t.table_name) as exists
FROM (VALUES 
    ('profiles'), 
    ('time_events'), 
    ('geofence_events'), 
    ('locations'), 
    ('holidays'), 
    ('shifts'),
    ('shift_rules'),
    ('justifications'),
    ('employee_messages'),
    ('audit_logs')
) as t(table_name);

-- 2. Verificar Constraint de Pausa (Confirmar 100%)
SELECT 'time_events_check' as check, 
       check_clause 
FROM information_schema.check_constraints 
WHERE constraint_name = 'time_events_event_type_check';

-- 3. Scripts de Criação (Caso faltem tabelas)
-- Se a query 1 mostrar que audit_logs NÃO existe, execute:
/*
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    action TEXT NOT NULL,
    performed_by UUID REFERENCES auth.users(id),
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
*/

-- Create Holidays Table
CREATE TABLE IF NOT EXISTS holidays (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL UNIQUE,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed Brazilian National Holidays (2024 & 2025)
INSERT INTO holidays (date, name) VALUES
    ('2024-01-01', 'Confraternização Universal'),
    ('2024-02-12', 'Carnaval'),
    ('2024-02-13', 'Carnaval'),
    ('2024-03-29', 'Sexta-feira Santa'),
    ('2024-04-21', 'Tiradentes'),
    ('2024-05-01', 'Dia do Trabalho'),
    ('2024-05-30', 'Corpus Christi'),
    ('2024-09-07', 'Independência do Brasil'),
    ('2024-10-12', 'Nossa Senhora Aparecida'),
    ('2024-11-02', 'Finados'),
    ('2024-11-15', 'Proclamação da República'),
    ('2024-11-20', 'Dia da Consciência Negra'),
    ('2024-12-25', 'Natal'),
    ('2025-01-01', 'Confraternização Universal'),
    ('2025-03-03', 'Carnaval'),
    ('2025-03-04', 'Carnaval'),
    ('2025-04-18', 'Sexta-feira Santa'),
    ('2025-04-21', 'Tiradentes'),
    ('2025-05-01', 'Dia do Trabalho'),
    ('2025-06-19', 'Corpus Christi'),
    ('2025-09-07', 'Independência do Brasil'),
    ('2025-10-12', 'Nossa Senhora Aparecida'),
    ('2025-11-02', 'Finados'),
    ('2025-11-15', 'Proclamação da República'),
    ('2025-11-20', 'Dia da Consciência Negra'),
    ('2025-12-25', 'Natal')
ON CONFLICT (date) DO NOTHING;

const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env.local
dotenv.config({ path: path.join(__dirname, '../.env.local') });

// Construct DB URL from Supabase env vars if standard DATABASE_URL is missing
// Supabase usually provides DATABASE_URL in the dashboard, but in local env it might be different.
// Assuming the user has a connection string. If not, I'll try to construct it or ask the user.
// Since I can't ask easily in agent mode, I'll try to use the one from `process.env`.

const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;

if (!connectionString) {
    console.error('❌ DATABASE_URL or DIRECT_URL not found in .env.local');
    process.exit(1);
}

const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false } // Required for Supabase in many environments
});

const sql = `
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS holidays (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL UNIQUE,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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
`;

async function run() {
    try {
        await client.connect();
        console.log('✅ Connected to Database');
        await client.query(sql);
        console.log('✅ Migration applied successfully!');
    } catch (err) {
        console.error('❌ Migration failed:', err);
    } finally {
        await client.end();
    }
}

run();

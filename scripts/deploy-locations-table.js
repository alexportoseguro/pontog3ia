require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

const createTableQuery = `
CREATE TABLE IF NOT EXISTS public.location_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.location_logs ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'location_logs' AND policyname = 'Users can insert own location') THEN
        CREATE POLICY "Users can insert own location"
        ON public.location_logs FOR INSERT
        WITH CHECK ( auth.uid() = user_id );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'location_logs' AND policyname = 'Service role can do everything') THEN
        CREATE POLICY "Service role can do everything"
        ON public.location_logs
        USING ( auth.jwt() ->> 'role' = 'service_role' )
        WITH CHECK ( auth.jwt() ->> 'role' = 'service_role' );
    END IF;
END $$;
`;

async function run() {
    try {
        console.log('Connecting to database...');
        const client = await pool.connect();
        console.log('Running migration...');
        await client.query(createTableQuery);
        console.log('Success!');
        client.release();
    } catch (err) {
        console.error('Error executing query', err.stack);
    } finally {
        await pool.end();
    }
}

run();

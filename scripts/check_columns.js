
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);


async function checkColumns() {
    console.log('Checking columns for time_events...');
    const { data: rows, error } = await supabase
        .from('time_events')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error selecting row:', error);
    } else if (rows && rows.length > 0) {
        console.log('Columns found:', Object.keys(rows[0]));
    } else {
        console.log('Table exists but is empty. Cannot infer columns.');
        // Try to insert a dummy record to see if it fails on missing columns? No, too risky.
    }
}

checkColumns();

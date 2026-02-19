const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkPolicies() {
    console.log('Checking policies on profiles...');
    // Since we can't query pg_policies easily via JS client without admin/rpc, 
    // we'll try to insert a test profile and see if it works (proving write access)
    // or just read.

    // Actually, we can check if table exists by trying to select 1 row.
    const { data, error } = await supabase.from('profiles').select('count', { count: 'exact', head: true });

    if (error) {
        console.error('Error selecting profiles:', error);
    } else {
        console.log('Profile count (visible to this key):', data); // head: true returns null data but count in count
    }
}

checkPolicies();

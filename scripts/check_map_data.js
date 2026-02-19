require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkMapData() {
    console.log('🗺️  Checking Map Data Sources\n');

    // Check location_logs
    console.log('1️⃣ Checking location_logs table...');
    const { data: logs, error: logsError } = await supabase
        .from('location_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

    if (logsError) {
        console.log('   ❌ Error:', logsError.message);
    } else {
        console.log(`   ✅ Found ${logs.length} location logs`);
        if (logs.length > 0) {
            console.log('   Latest log:', {
                user_id: logs[0].user_id,
                location: logs[0].location,
                timestamp: logs[0].timestamp
            });
        }
    }

    // Check profiles with current_status
    console.log('\n2️⃣ Checking profiles (for current_status)...');
    const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, current_status, last_seen');

    if (profilesError) {
        console.log('   ❌ Error:', profilesError.message);
    } else {
        console.log(`   ✅ Found ${profiles.length} profiles`);
        profiles.forEach(p => {
            console.log(`   - ${p.full_name || 'Unnamed'}: ${p.current_status || 'no status'} (last seen: ${p.last_seen || 'never'})`);
        });
    }

    // Check if anyone is working
    console.log('\n3️⃣ Checking WORKING employees...');
    const { data: working, error: workingError } = await supabase
        .from('profiles')
        .select('id, full_name, current_status')
        .eq('current_status', 'WORKING');

    if (workingError) {
        console.log('   ❌ Error:', workingError.message);
    } else {
        console.log(`   ✅ Found ${working.length} working employees`);
        working.forEach(w => {
            console.log(`   - ${w.full_name || w.id}`);
        });
    }
}

checkMapData();

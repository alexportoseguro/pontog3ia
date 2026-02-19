require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('\n🔑 Supabase Connection Test\n');
console.log('URL:', supabaseUrl);
console.log('Key (first 20 chars):', supabaseKey ? supabaseKey.substring(0, 20) + '...' : 'MISSING');
console.log('Key length:', supabaseKey ? supabaseKey.length : 0);
console.log('Key contains "service_role"?', supabaseKey ? supabaseKey.includes('service_role') : 'N/A');

if (!supabaseUrl || !supabaseKey) {
    console.error('\n❌ Missing credentials!\n');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function simpleTest() {
    console.log('\n📊 Test 1: Simple select from profiles\n');

    const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .limit(1);

    console.log('Data:', data);
    console.log('Error:', error);
    console.log('Error (full):', JSON.stringify(error, null, 2));

    if (error) {
        console.log('\n❌ Failed! Error details:');
        console.log('  - Message:', error.message);
        console.log('  - Code:', error.code);
        console.log('  - Details:', error.details);
        console.log('  - Hint:', error.hint);
    } else if (data) {
        console.log('\n✅ Success! Retrieved', data.length, 'row(s)');
    }

    console.log('\n📊 Test 2: Count profiles\n');
    const { count, error: countError } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

    console.log('Count:', count);
    console.log('Error:', JSON.stringify(countError, null, 2));
}

simpleTest();

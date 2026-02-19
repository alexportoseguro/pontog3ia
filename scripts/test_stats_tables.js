require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('URL exists:', !!supabaseUrl);
console.log('Key exists:', !!supabaseKey);

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testTables() {
    console.log('\n🔍 Testing Database Tables for Stats API\n');

    // Test 1: profiles
    console.log('1️⃣ Testing profiles table...');
    try {
        const { count, error } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true });

        if (error) {
            console.error('   ❌ ERROR:', error.message);
        } else {
            console.log(`   ✅ profiles: ${count} rows`);
        }
    } catch (e) {
        console.error('   ❌ EXCEPTION:', e.message);
    }

    // Test 2: profiles with filter
    console.log('\n2️⃣ Testing profiles.current_status = working...');
    try {
        const { count, error } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('current_status', 'working');

        if (error) {
            console.error('   ❌ ERROR:', error.message);
        } else {
            console.log(`   ✅ working users: ${count} rows`);
        }
    } catch (e) {
        console.error('   ❌ EXCEPTION:', e.message);
    }

    // Test 3: justifications
    console.log('\n3️⃣ Testing justifications table...');
    try {
        const { count, error } = await supabase
            .from('justifications')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending');

        if (error) {
            console.error('   ❌ ERROR:', error.message);
            console.error('   Hint: Table might not exist or RLS is blocking');
        } else {
            console.log(`   ✅ pending justifications: ${count} rows`);
        }
    } catch (e) {
        console.error('   ❌ EXCEPTION:', e.message);
    }

    // Test 4: employee_messages
    console.log('\n4️⃣ Testing employee_messages table...');
    try {
        const today = new Date().toISOString().split('T')[0];
        const { count, error } = await supabase
            .from('employee_messages')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', today);

        if (error) {
            console.error('   ❌ ERROR:', error.message);
            console.error('   Hint: Table might not exist or RLS is blocking');
        } else {
            console.log(`   ✅ messages today: ${count} rows`);
        }
    } catch (e) {
        console.error('   ❌ EXCEPTION:', e.message);
    }

    console.log('\n✅ Test complete!\n');
}

testTables();

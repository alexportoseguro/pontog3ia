require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function test() {
    console.log('🔍 Testing holidays table...\n');

    // First, count existing
    const { count: before } = await supabase
        .from('holidays')
        .select('*', { count: 'exact', head: true });

    console.log('Current holidays count:', before);

    // Try to insert ONE holiday
    console.log('\n📝 Inserting one holiday...');
    const { data, error } = await supabase
        .from('holidays')
        .insert({
            date: '2025-01-01',
            name: 'Confraternização Universal',
            type: 'national'
        })
        .select();

    if (error) {
        console.log('❌ Error:', JSON.stringify(error, null, 2));
    } else {
        console.log('✅ Success! Inserted:', data);
    }

    // Count after
    const { count: after } = await supabase
        .from('holidays')
        .select('*', { count: 'exact', head: true });

    console.log('\nAfter insert, count:', after);
}

test();

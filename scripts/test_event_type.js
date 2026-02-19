require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkConstraints() {
    console.log('🔍 Checking time_events table constraints...\n');

    // Get table constraints
    const { data: constraints, error: constraintError } = await supabase.rpc('exec_sql', {
        query: `
            SELECT conname, pg_get_constraintdef(oid) as definition
            FROM pg_constraint
            WHERE conrelid = 'time_events'::regclass
            AND contype = 'c'
        `
    });

    console.log('Constraints:', constraints);

    // Try inserting with 'clock_in' (what mobile sends)
    console.log('\n📝 Testing INSERT with event_type = "clock_in"...');
    const { data: test1, error: error1 } = await supabase
        .from('time_events')
        .insert({
            user_id: 'f955daf7-b3e1-4099-9ec6-c3ceabd19424', // Your user ID
            event_type: 'clock_in',
            timestamp: new Date().toISOString(),
            location: '(-38.5, -12.9)'
        })
        .select();

    if (error1) {
        console.log('❌ Error with "clock_in":', error1.message);
        console.log('Full error:', JSON.stringify(error1, null, 2));
    } else {
        console.log('✅ Success with "clock_in"!');
    }
}

checkConstraints();

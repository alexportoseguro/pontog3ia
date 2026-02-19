require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in .env.local");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugSync() {
    console.log("🔍 Investigating Data Sync Issues...");

    // 1. Check recent time_events
    const { data: events, error: eventError } = await supabase
        .from('time_events')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(5);

    if (eventError) {
        console.error("❌ Error fetching time_events:", eventError);
    } else {
        console.log(`✅ Found ${events.length} recent events:`);
        events.forEach(e => {
            console.log(`   - [${e.timestamp}] User: ${e.user_id} | Type: ${e.event_type} | Loc: ${e.location}`);
        });
    }

    // 2. Check profiles of those users
    if (events && events.length > 0) {
        const userIds = [...new Set(events.map(e => e.user_id))];
        const { data: profiles, error: profileError } = await supabase
            .from('profiles')
            .select('id, email, current_status, last_seen')
            .in('id', userIds);

        if (profileError) {
            console.error("❌ Error fetching profiles:", profileError);
        } else {
            console.log("\n👤 User Profiles Status:");
            profiles.forEach(p => {
                console.log(`   - ${p.email}: Status='${p.current_status}' (Last Seen: ${p.last_seen})`);
            });
        }
    } else {
        console.log("⚠️ No recent events found. Is the mobile app actually sending data?");
    }
}

debugSync();

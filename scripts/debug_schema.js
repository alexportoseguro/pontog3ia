const { createClient } = require('@supabase/supabase-js');

// Hardcoded for debugging ONLY - Delete after use
const supabaseUrl = "https://imdwscrltdbvgltxiciq.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImltZHdzY3JsdGRidmdsdHhpY2lxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTA5MjY1MiwiZXhwIjoyMDg2NjY4NjUyfQ.q0E9Fq9q9s2x-5Fq9q9s2x-5Fq9q9s2x-5Fq9q9s2x"; // This is TRUNCATED in the view, I need the full key.

// Wait, the key I saw in view_file might be truncated or I might not have seen it all. 
// "q0E9Fq9q9s2x-5Fq9q9s2x-5Fq9q9s2x-5Fq9q9s2x" looks like a pattern I might have misread or it is truncated.
// Actually, looking at the previous view_file output of .env.local, it ended with... wait.

// Let's look at the view_file output again.
// Id: 2045
// Line 4: SUPABASE_SERVICE_ROLE_KEY=eyJhb... ... ...2x-5Fq9q9s2x
// It looks suspicious. "q9s2x-5Fq9q9s2x-5Fq9q9s2x-5Fq9q9s2x"

// If I can't trust the key reading, I should try to fix the dotenv path.
// The file is at c:\Users\cintr\Desktop\projetos\pontog3\web\.env.local
// The script is at c:\Users\cintr\Desktop\projetos\pontog3\web\scripts\debug_schema.js
// So path: '../.env.local' might be better if running from scripts dir, or '.env.local' if running from web dir.
// I ran `node scripts/debug_schema.js` from `web` dir. So `.env.local` should be correct.

// Retrying with correct path and some debug logs for env vars.

require('dotenv').config({ path: '.env.local' });
console.log("URL:", process.env.NEXT_PUBLIC_SUPABASE_URL ? "Exists" : "Missing");
console.log("KEY:", process.env.SUPABASE_SERVICE_ROLE_KEY ? "Exists" : "Missing");

// const { createClient } = require('@supabase/supabase-js'); // Removed duplicate
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkSchema() {
    console.log("Attempting test insert with Postgres POINT format (x,y)...");

    const { error: insertError } = await supabase.from('time_events').insert({
        user_id: '00000000-0000-0000-0000-000000000000',
        timestamp: new Date().toISOString(),
        event_type: 'TEST_PROBE',
        location: '(-39.0722993, -16.4405021)'
    });

    if (insertError) {
        console.log("❌ Insert Error:", insertError.message);
        if (insertError.message.includes("violates foreign key constraint")) {
            console.log("✅ SUCCESS! Type check passed. The column expects '(x,y)'.");
        }
    } else {
        console.log("✅ Insert succeeded. Column is native POINT type.");
        await supabase.from('time_events').delete().eq('event_type', 'TEST_PROBE');
    }
}

checkSchema();

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function findUser() {
    const email = 'alexcintra107@gmail.com';
    console.log(`--- Searching for: ${email} ---`);

    // 1. Check Auth
    const { data: { users }, error: authError } = await supabaseAdmin.auth.admin.listUsers();
    if (authError) {
        console.error('Auth Error:', authError);
    } else {
        const foundAuth = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
        if (foundAuth) {
            console.log('✅ Found in Auth:', foundAuth.id);
            console.log('Metadata:', foundAuth.user_metadata);
        } else {
            console.log('❌ NOT found in Auth');
        }
    }

    // 2. Check Profile
    // We select all and find in JS because we don't know if email is a column in profiles
    const { data: profiles, error: profileError } = await supabaseAdmin.from('profiles').select('*');
    if (profileError) {
        console.error('Profile Error:', profileError);
    } else {
        // Try matching by ID if we found auth, or by searching email if the column exists
        const foundProfile = profiles.find(p => p.email?.toLowerCase() === email.toLowerCase());
        console.log('--- Profiles Search Results ---');
        if (foundProfile) {
            console.log('✅ Found in Profiles by Column:', foundProfile);
        } else {
            console.log('❌ NOT found in Profiles by email column');
        }

        // Match profiles where ID is any user found
        profiles.forEach(p => {
            const user = users.find(u => u.id === p.id);
            if (user?.email?.toLowerCase() === email.toLowerCase()) {
                console.log('✅ Found matching Profile by ID:', p);
            }
        });
    }
}

findUser();

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function diagnoseUsers() {
    console.log('--- Checking Supabase Auth Users ---');
    const { data: { users }, error: authError } = await supabaseAdmin.auth.admin.listUsers();

    if (authError) {
        console.error('Auth Error:', authError);
        return;
    }

    console.log(`Auth Users Found: ${users.length}`);
    users.forEach(u => console.log(`- ID: ${u.id}, Email: ${u.email}, Metadata:`, u.user_metadata));

    console.log('\n--- Checking Profiles Table ---');
    const { data: profiles, error: profileError } = await supabaseAdmin.from('profiles').select('*');

    if (profileError) {
        console.error('Profile Error:', profileError);
    } else {
        console.log(`Profiles Found: ${profiles.length}`);
        profiles.forEach(p => {
            const authUser = users.find(u => u.id === p.id);
            console.log(`- Profile ID: ${p.id}, Role: ${p.role}, Company: ${p.company_id}, Email (from Auth): ${authUser?.email || 'N/A'}`);
        });
    }

    console.log('\n--- Checking Companies ---');
    const { data: companies } = await supabaseAdmin.from('companies').select('*');
    console.log('Companies:', companies);
}

diagnoseUsers();

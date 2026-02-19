const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createProfile() {
    const authId = 'eaf538f2-1f9b-43c1-95b0-6cfb2888015c';
    const email = 'alexcintra107@gmail.com';
    const fullName = 'Alexandre Martins';
    const companyId = 'dcdd698a-b7f3-433f-a0fb-757fa8d998a4';

    console.log(`--- Creating Profile for: ${email} ---`);
    const { data, error } = await supabaseAdmin
        .from('profiles')
        .insert({
            id: authId,
            full_name: fullName,
            role: 'employee',
            company_id: companyId,
            current_status: 'out'
        })
        .select();

    if (error) {
        console.error('Error creating profile:', error);
    } else {
        console.log('✅ Success! Profile created:', data);
    }
}

createProfile();

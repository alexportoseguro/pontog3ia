const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function repairProfile() {
    console.log('--- Linking Admin to Company ---');
    const { data, error } = await supabaseAdmin
        .from('profiles')
        .update({ company_id: 'dcdd698a-b7f3-433f-a0fb-757fa8d998a4' })
        .eq('id', 'f955daf7-b3e1-4099-9ec6-c3ceabd19424')
        .select();

    if (error) {
        console.error('Repair Error:', error);
    } else {
        console.log('✅ Success! Profile updated:', data);
    }
}

repairProfile();

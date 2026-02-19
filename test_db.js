const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkSchema() {
    console.log('Checking profiles table...');
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error fetching profiles:', error);
    } else {
        console.log('Profiles sample:', data);
    }

    console.log('Checking companies table...');
    const { data: company, error: companyError } = await supabase
        .from('companies')
        .select('*')
        .limit(1);

    if (companyError) {
        console.error('Error fetching companies:', companyError);
    } else {
        console.log('Companies sample:', company);
    }
}

checkSchema();

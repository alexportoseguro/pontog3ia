
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars from web/.env.local
// Load env vars from web/.env.local or root .env
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    dotenv.config({ path: path.resolve(__dirname, '../../.env') });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase URL or Key');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLocations() {
    console.log('Checking recent location logs...');

    const { data, error } = await supabase
        .from('location_logs')
        .select('*, profiles(full_name)')
        .order('timestamp', { ascending: false })
        .limit(10);

    if (error) {
        console.error('Error fetching locations:', error);
        return;
    }

    if (!data || data.length === 0) {
        console.log('No location logs found.');
    } else {
        console.log(`Found ${data.length} recent logs:`);
        data.forEach(log => {
            console.log(`[${new Date(log.timestamp).toLocaleString()}] User: ${log.profiles?.full_name || log.user_id} - Lat: ${log.latitude}, Lng: ${log.longitude} - Source: ${log.source}`);
        });
    }
}

checkLocations();

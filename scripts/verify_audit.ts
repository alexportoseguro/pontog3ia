
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Fix env loading
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    dotenv.config({ path: path.resolve(__dirname, '../../.env') });
}

async function verifyAudit() {
    // Import after env is loaded
    const { logAudit } = await import('../lib/audit');

    // Initialize client locally for fetching user and verification reading
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get a real user ID to avoid FK violation
    const { data: user } = await supabase.from('profiles').select('id').limit(1).single();

    if (!user) {
        console.error('No users found for test');
        return;
    }

    console.log('--- Verifying Audit Log ---');
    console.log('Using User ID:', user.id);
    const testId = `test-${Date.now()}`;

    console.log('1. Writing test audit log...');
    await logAudit({
        userId: user.id, // Real ID
        action: 'TEST_AUDIT',
        tableName: 'test_table',
        recordId: testId,
        newData: { foo: 'bar' },
        ipAddress: '127.0.0.1'
    });

    console.log('2. Reading back from database...');

    // Reuse existing client
    const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('record_id', testId)
        .single();

    if (error) {
        console.error('❌ Verification Failed:', error);
    } else if (data) {
        console.log('✅ Success! Found audit log:', data);
    } else {
        console.error('❌ User not found (logic error)');
    }
}

verifyAudit();

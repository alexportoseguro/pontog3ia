import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET() {
    try {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
        const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

        const status = {
            urlConfigured: !!url,
            serviceKeyConfigured: !!serviceKey,
            anonKeyConfigured: !!anonKey,
            serviceKeyLength: serviceKey ? serviceKey.length : 0,
            anonKeyLength: anonKey ? anonKey.length : 0,
            connectionTest: 'Pending'
        }

        if (!url || !anonKey) {
            return NextResponse.json({ ...status, error: 'Missing required env vars' }, { status: 500 })
        }

        // Try simple connection
        const supabase = createClient(url, serviceKey || anonKey!)
        const { data, error } = await supabase.from('profiles').select('count').limit(1)

        if (error) {
            status.connectionTest = 'Failed: ' + error.message
            return NextResponse.json(status, { status: 500 })
        }

        status.connectionTest = 'Success'
        return NextResponse.json(status)

    } catch (error: any) {
        return NextResponse.json({ error: 'Crash: ' + error.message, stack: error.stack }, { status: 500 })
    }
}

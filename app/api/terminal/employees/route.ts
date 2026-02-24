import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth-server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
})

export async function GET() {
    try {
        const auth = await verifyAuth()
        if (auth.error) {
            return NextResponse.json({ error: auth.error }, { status: auth.status })
        }

        if (auth.role !== 'admin' && auth.role !== 'manager') {
            return NextResponse.json({ error: 'Only admins or managers can access the terminal list' }, { status: 403 })
        }

        const { data: employees, error } = await supabaseAdmin
            .from('profiles')
            .select('id, full_name, avatar_url, current_status')
            .eq('company_id', auth.companyId)
            .order('full_name', { ascending: true })

        if (error) throw error

        return NextResponse.json({ employees })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

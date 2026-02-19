import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

export const dynamic = 'force-dynamic'

import { checkAdminRole } from '@/lib/auth-server'

export async function GET() {
    try {
        const auth = await checkAdminRole()
        if (auth.error) {
            console.error('Stats API Auth Error:', auth.error)
            return NextResponse.json({ error: auth.error }, { status: auth.status })
        }

        console.log(`[Stats API] User: ${auth.user?.email} (${auth.user?.id})`)
        console.log(`[Stats API] Company: ${auth.companyId}`)

        // 1. Fetch Profiles Summary
        // DEBUG: Check what's actually in the DB for this company
        const { data: allProfiles } = await supabase
            .from('profiles')
            .select('id, role, company_id')
            .eq('company_id', auth.companyId)

        console.log(`[Stats API] Total profiles found for company ${auth.companyId}: ${allProfiles?.length}`)

        const { data: profiles, error: pError } = await supabase
            .from('profiles')
            .select('current_status, role')
            .eq('company_id', auth.companyId)


        console.log(`[Stats API] Employee profiles found: ${profiles?.length}`)

        if (pError) throw pError

        const totalEmployees = profiles?.length || 0
        const workingNow = profiles?.filter(p => p.current_status === 'working').length || 0
        const onBreak = profiles?.filter(p => p.current_status === 'break').length || 0
        const stopped = totalEmployees - workingNow - onBreak

        // 2. Fetch Late Arrivals (Calculated as users with pending justifications)
        const { count: lateCount, error: jError } = await supabase
            .from('justifications')
            .select('*, profiles!inner(company_id)', { count: 'exact', head: true })
            .eq('profiles.company_id', auth.companyId)
            .eq('status', 'pending')

        if (jError) throw jError

        return NextResponse.json({
            totalEmployees,
            workingNow,
            onBreak,
            stopped,
            lateArrivals: lateCount || 0
        })

    } catch (error: any) {
        console.error('Dashboard stats API error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

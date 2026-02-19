import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { verifyAuth, checkAdminRole } from '@/lib/auth-server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
})

export async function POST(request: Request) {
    try {
        const auth = await checkAdminRole()
        if (auth.error) {
            return NextResponse.json({ error: auth.error }, { status: auth.status })
        }

        const body = await request.json()
        const { id, action } = body

        if (!id || !action || !['approved', 'rejected'].includes(action)) {
            return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
        }

        // 1. Verify ownership
        const { data: items, error: fetchError } = await supabaseAdmin
            .from('justifications')
            .select('user_id, profiles!inner(company_id)')
            .eq('id', id)

        const item: any = items?.[0]

        if (fetchError || !item || item.profiles?.company_id !== auth.companyId) {
            return NextResponse.json({ error: 'Item not found or permission denied' }, { status: 403 })
        }

        // 2. Update Justification Status
        const { error: updateError } = await supabaseAdmin
            .from('justifications')
            .update({
                status: action,
                approved_by: auth.user?.id,
                approved_at: new Date().toISOString()
            })
            .eq('id', id)

        if (updateError) throw updateError

        // 3. Log Audit
        await supabaseAdmin.from('audit_logs').insert({
            user_id: item.user_id,
            action: `JUSTIFICATION_${action.toUpperCase()}`,
            details: {
                justification_id: id,
                approver_id: auth.user?.id
            }
        })

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('Error in manager/approve:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

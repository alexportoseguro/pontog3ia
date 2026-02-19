import { NextResponse } from 'next/server'
import { checkAdminRole, supabaseAdmin } from '@/lib/auth-server'

export async function POST(request: Request) {
    try {
        const auth = await checkAdminRole()
        if (auth.error) {
            return NextResponse.json({ error: auth.error }, { status: auth.status })
        }

        const body = await request.json()
        const { userId, type, description, startDate, endDate } = body

        if (!userId || !type || !startDate) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        // 1. Verify target user belongs to company
        const { data: targetUser, error: targetError } = await supabaseAdmin
            .from('profiles')
            .select('company_id')
            .eq('id', userId)
            .single()

        if (targetError || !targetUser || targetUser.company_id !== auth.companyId) {
            return NextResponse.json({ error: 'User not found or permission denied' }, { status: 403 })
        }

        // 2. Insert Justification (Auto-approved since Manager creates it)
        const { data, error } = await supabaseAdmin
            .from('justifications')
            .insert({
                user_id: userId,
                type,
                description,
                start_date: startDate,
                end_date: endDate || startDate, // Default to single day
                status: 'approved',
                approved_by: auth.user?.id,
                approved_at: new Date().toISOString()
            })
            .select()
            .single()

        if (error) throw error

        // 3. Log Audit
        await supabaseAdmin.from('audit_logs').insert({
            user_id: auth.user?.id, // Manager performed logic
            action: 'CREATE_JUSTIFICATION',
            details: {
                target_user_id: userId,
                justification_id: data.id,
                type,
                range: `${startDate} to ${endDate}`
            }
        })

        return NextResponse.json({ success: true, data })

    } catch (error: any) {
        console.error('Error creating justification:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

import { NextResponse } from 'next/server'
import { verifyAuth, supabaseAdmin } from '@/lib/auth-server'

export async function GET(request: Request) {
    try {
        const auth = await verifyAuth()
        if (auth.error) {
            return NextResponse.json({ error: auth.error }, { status: auth.status })
        }

        // Only admins/managers should see approvals
        if (auth.role !== 'admin' && auth.role !== 'manager') {
            return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
        }

        const { searchParams } = new URL(request.url)
        const filter = searchParams.get('filter') || 'all'
        const status = searchParams.get('status') || 'pending'

        // 1. Fetch Justifications (filtered by company)
        let justifications: any[] = []
        if (filter === 'all' || filter === 'justifications') {
            const { data, error } = await supabaseAdmin
                .from('justifications')
                .select(`
                    *,
                    profiles!justifications_user_id_fkey!inner (full_name, role, company_id),
                    approver:profiles!justifications_approved_by_fkey (full_name)
                `)
                .eq('profiles.company_id', auth.companyId)
                .eq('status', status)
                .order('created_at', { ascending: false })

            if (!error && data) {
                justifications = data.map(item => ({
                    ...item,
                    type: 'justification',
                    employee_name: item.profiles?.full_name || 'Unknown',
                    approver_name: item.approver?.full_name
                }))
            }
        }

        // 2. Fetch Time Off Requests (filtered by company)
        let timeOffRequests: any[] = []
        if (filter === 'all' || filter === 'time_off') {
            const { data, error } = await supabaseAdmin
                .from('time_off_requests')
                .select(`
                    *,
                    profiles!time_off_requests_user_id_fkey!inner (full_name, role, company_id),
                    approver:profiles!time_off_requests_approved_by_fkey (full_name)
                `)
                .eq('profiles.company_id', auth.companyId)
                .eq('status', status)
                .order('created_at', { ascending: false })

            if (!error && data) {
                timeOffRequests = data.map(item => ({
                    ...item,
                    type: 'time_off',
                    employee_name: item.profiles?.full_name || 'Unknown',
                    approver_name: item.approver?.full_name,
                    days_count: calculateDays(item.start_date, item.end_date)
                }))
            }
        }

        // 3. Fetch Manual Time Events (filtered by company)
        let manualTimeEvents: any[] = []
        if (filter === 'all' || filter === 'time_events') {
            const approvalStatus = status === 'pending' ? 'pending' : status

            const { data, error } = await supabaseAdmin
                .from('time_events')
                .select(`
                    *,
                    profiles!time_events_user_id_fkey!inner (full_name, role, company_id),
                    approver:profiles!time_events_approved_by_fkey (full_name)
                `)
                .eq('profiles.company_id', auth.companyId)
                .eq('source', 'AI_CONCIERGE')
                .eq('approval_status', approvalStatus)
                .order('timestamp', { ascending: false })

            if (!error && data) {
                manualTimeEvents = data.map(item => ({
                    ...item,
                    type: 'time_event',
                    employee_name: item.profiles?.full_name || 'Unknown',
                    approver_name: item.approver?.full_name
                }))
            }
        }

        // 4. Combine and return
        const all = [...justifications, ...timeOffRequests, ...manualTimeEvents]

        return NextResponse.json({
            justifications,
            timeOffRequests,
            manualTimeEvents,
            all,
            total: all.length,
            counts: {
                justifications: justifications.length,
                timeOffRequests: timeOffRequests.length,
                manualTimeEvents: manualTimeEvents.length
            }
        })

    } catch (error: any) {
        console.error('Error fetching approvals:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        const auth = await checkAdminRole()
        if (auth.error) {
            return NextResponse.json({ error: auth.error }, { status: auth.status })
        }

        const body = await request.json()
        const { type, id, action, rejectionReason } = body

        if (!type || !id || !action || !['approved', 'rejected'].includes(action)) {
            return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
        }

        if (action === 'rejected' && !rejectionReason) {
            return NextResponse.json({ error: 'Rejection reason required' }, { status: 400 })
        }

        const approverId = auth.user?.id || ''

        // Process based on type with company ownership check
        let result
        switch (type) {
            case 'justification':
                result = await approveJustification(id, action, approverId, auth.companyId, rejectionReason || '')
                break
            case 'time_off':
                result = await approveTimeOff(id, action, approverId, auth.companyId, rejectionReason || '')
                break
            case 'time_event':
                result = await approveTimeEvent(id, action, approverId, auth.companyId, rejectionReason || '')
                break
            default:
                return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
        }

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 500 })
        }

        // Audit & Notification ... (Keep original logic but use result.userId)
        await supabaseAdmin.from('audit_logs').insert({
            user_id: result.userId,
            action: `${type.toUpperCase()}_${action.toUpperCase()}`,
            details: { id, type, approved_by: approverId, rejection_reason: rejectionReason }
        })

        const typeLabels: Record<string, string> = {
            justification: 'justificativa',
            time_off: 'solicitação de folga',
            time_event: 'registro de ponto'
        }

        await supabaseAdmin.from('notifications').insert({
            user_id: result.userId,
            title: action === 'approved' ? '✅ Solicitação Aprovada' : '❌ Solicitação Rejeitada',
            message: action === 'approved' ? `Sua ${typeLabels[type]} foi aprovada!` : `Sua ${typeLabels[type]} foi rejeitada. Motivo: ${rejectionReason}`,
            type: 'approval',
            link: '/dashboard/approvals'
        })

        return NextResponse.json({ success: true })

    } catch (error: any) {
        console.error('Error processing approval:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

async function approveJustification(id: string, action: string, approverId: string, companyId: string, rejectionReason?: string) {
    // Check ownership via profile join
    const { data: items } = await supabaseAdmin.from('justifications').select('user_id, profiles!inner(company_id)').eq('id', id)
    const item: any = items?.[0]

    if (!item || item.profiles?.company_id !== companyId) return { success: false, error: 'Item not found or permission denied' }

    const { error } = await supabaseAdmin.from('justifications').update({
        status: action,
        approved_by: approverId,
        approved_at: new Date().toISOString(),
        rejection_reason: rejectionReason
    }).eq('id', id)

    if (error) return { success: false, error: error.message }
    return { success: true, userId: item.user_id }
}

async function approveTimeOff(id: string, action: string, approverId: string, companyId: string, rejectionReason?: string) {
    const { data: items } = await supabaseAdmin.from('time_off_requests').select('user_id, profiles!inner(company_id)').eq('id', id)
    const item: any = items?.[0]

    if (!item || item.profiles?.company_id !== companyId) return { success: false, error: 'Item not found or permission denied' }

    const { error } = await supabaseAdmin.from('time_off_requests').update({
        status: action,
        approved_by: approverId,
        approved_at: new Date().toISOString(),
        rejection_reason: rejectionReason
    }).eq('id', id)

    if (error) return { success: false, error: error.message }
    return { success: true, userId: item.user_id }
}

async function approveTimeEvent(id: string, action: string, approverId: string, companyId: string, rejectionReason?: string) {
    const { data: items } = await supabaseAdmin.from('time_events').select('user_id, profiles!inner(company_id)').eq('id', id)
    const item: any = items?.[0]

    if (!item || item.profiles?.company_id !== companyId) return { success: false, error: 'Item mapping failed or permission denied' }

    if (action === 'rejected') {
        const { error } = await supabaseAdmin.from('time_events').delete().eq('id', id)
        if (error) return { success: false, error: error.message }
    } else {
        const { error } = await supabaseAdmin.from('time_events').update({
            approval_status: 'approved',
            approved_by: approverId,
            approved_at: new Date().toISOString()
        }).eq('id', id)
        if (error) return { success: false, error: error.message }
    }
    return { success: true, userId: item.user_id }
}

function calculateDays(startDate: string, endDate: string): number {
    const start = new Date(startDate)
    const end = new Date(endDate)
    return Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
}

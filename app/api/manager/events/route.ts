import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

import { checkAdminRole } from '@/lib/auth-server'
import { logAudit } from '@/lib/audit'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
    try {
        const auth = await checkAdminRole()
        if (auth.error) {
            return NextResponse.json({ error: auth.error }, { status: auth.status })
        }

        const body = await request.json()
        const { userId, timestamp, type, reason, managerId } = body

        if (!userId || !timestamp || !type) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        // 1. Verify target user belongs to the same company
        const { data: targetProfile, error: targetError } = await supabase
            .from('profiles')
            .select('company_id')
            .eq('id', userId)
            .single()

        if (targetError || !targetProfile) {
            return NextResponse.json({ error: 'Target user not found' }, { status: 404 })
        }

        if (targetProfile.company_id !== auth.companyId) {
            return NextResponse.json({ error: 'Permission denied: User belongs to another company' }, { status: 403 })
        }

        // 2. Insert Time Event
        const { data: event, error: eventError } = await supabase
            .from('time_events')
            .insert({
                user_id: userId,
                event_type: type, // clock_in, clock_out, break_start, break_end
                timestamp: timestamp,
                location: null // NULL for manual entries
            })
            .select()
            .single()

        if (eventError) throw eventError

        // 3. Audit Log
        if (managerId && managerId !== 'admin-manager') {
            await logAudit({
                userId: managerId,
                action: 'MANUAL_TIME_ENTRY',
                tableName: 'time_events',
                recordId: event.id,
                newData: {
                    target_user: userId,
                    type,
                    reason: reason || 'No reason provided',
                    timestamp
                },
                ipAddress: request.headers.get('x-forwarded-for') || 'unknown'
            })
        }

        return NextResponse.json({ success: true, event })
    } catch (error: any) {
        console.error('Error adding manual event:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

export async function DELETE(request: Request) {
    try {
        const auth = await checkAdminRole()
        if (auth.error) {
            return NextResponse.json({ error: auth.error }, { status: auth.status })
        }

        const { searchParams } = new URL(request.url)
        const eventId = searchParams.get('id')
        const managerId = searchParams.get('managerId')
        const reason = searchParams.get('reason')

        if (!eventId) {
            return NextResponse.json({ error: 'Missing event ID' }, { status: 400 })
        }

        // 1. Get Event Data and verify company
        const { data: event, error: fetchError } = await supabase
            .from('time_events')
            .select('*, profiles!inner(company_id)')
            .eq('id', eventId)
            .single()

        if (fetchError || !event) {
            return NextResponse.json({ error: 'Event not found' }, { status: 404 })
        }

        const eventData = event as any
        if (eventData.profiles?.company_id !== auth.companyId) {
            return NextResponse.json({ error: 'Permission denied: Event belongs to another company' }, { status: 403 })
        }

        // 2. Delete Event
        const { error } = await supabase
            .from('time_events')
            .delete()
            .eq('id', eventId)

        if (error) throw error

        // 3. Audit Log
        if (managerId && managerId !== 'admin-manager' && event) {
            try {
                await supabase.from('audit_logs').insert({
                    action: 'MANUAL_TIME_DELETION',
                    user_id: managerId, // Changed from performed_by to user_id
                    details: {
                        deleted_event_id: eventId,
                        target_user: event.user_id,
                        original_event: event,
                        reason: reason || 'No reason provided'
                    }
                })
            } catch (auditError) {
                console.error('Audit Log Error (Ignored):', auditError)
            }
        }

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('Error deleting event:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

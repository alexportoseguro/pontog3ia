
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { detectAnomalies } from '@/lib/intelligence'
import { sendPointSms } from '@/lib/sms'
import { sendPointPush } from '@/lib/notifications'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

export async function POST(request: Request) {
    try {
        // 1. Authenticate User
        const authHeader = request.headers.get('authorization')
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const token = authHeader.split(' ')[1]
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

        if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        // 2. Parse Body
        const body = await request.json()
        const { eventType, location, timestamp, targetUserId: bodyTargetUserId } = body

        if (!eventType || !timestamp) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        // 3. Security Check: Who are we recording for?
        let activeUserId = user.id
        if (bodyTargetUserId && bodyTargetUserId !== user.id) {
            // Check if requester is manager/admin
            const { data: requesterProfile } = await supabaseAdmin
                .from('profiles')
                .select('role, company_id')
                .eq('id', user.id)
                .single()

            if (requesterProfile?.role !== 'admin' && requesterProfile?.role !== 'manager') {
                return NextResponse.json({ error: 'Unauthorized to record point for others' }, { status: 403 })
            }

            // Verify target belongs to the same company
            const { data: targetProfile } = await supabaseAdmin
                .from('profiles')
                .select('company_id')
                .eq('id', bodyTargetUserId)
                .single()

            if (targetProfile?.company_id !== requesterProfile.company_id) {
                return NextResponse.json({ error: 'Target user belongs to another company' }, { status: 403 })
            }

            activeUserId = bodyTargetUserId
        }

        // 4. Get User Profile & Company Info (Consolidated Optimization)
        const { data: userData, error: userError } = await supabaseAdmin
            .from('profiles')
            .select(`
                full_name, 
                phone, 
                company_id,
                companies (
                    latitude,
                    longitude,
                    radius_meters
                )
            `)
            .eq('id', activeUserId)
            .single()

        if (userError || !userData) {
            console.error('[API Points] Profile error:', userError)
            return NextResponse.json({ error: 'User profile or company not found' }, { status: 400 })
        }

        const company = (userData as any).companies;

        // 5. Anomaly Detection (Optimized with pre-fetched data)
        const anomaly = await detectAnomalies(
            activeUserId,
            userData.company_id,
            location,
            new Date(timestamp),
            supabaseAdmin,
            company // Pass pre-fetched config to avoid extra DB hit
        )

        // 6. Insert Event
        const { data: event, error: insertError } = await supabaseAdmin
            .from('time_events')
            .insert({
                user_id: activeUserId,
                event_type: eventType,
                timestamp: timestamp,
                location: location,
                is_flagged: anomaly.isFlagged,
                flag_reason: anomaly.reason
            })
            .select()
            .single()

        if (insertError) throw insertError

        // 7. Update Profile Status
        const statusMap: Record<string, string> = {
            'clock_in': 'working',
            'clock_out': 'out',
            'break_start': 'break',
            'break_end': 'working'
        }
        const newStatus = statusMap[eventType] || 'out'

        console.log(`[API Points] Updating status for ${activeUserId} to ${newStatus}`)

        const { error: statusError } = await supabaseAdmin
            .from('profiles')
            .update({
                current_status: newStatus,
                last_seen: timestamp
            })
            .eq('id', activeUserId)

        if (statusError) {
            console.error('[API Points] Error updating profile status:', statusError)
        }

        // 8. Send Notifications (Non-blocking)
        try {
            const firstName = userData.full_name?.split(' ')[0] || 'Colaborador'

            // Push is ALWAYS tried
            sendPointPush(activeUserId, firstName, eventType, timestamp)
                .catch(err => console.error('[API Points] Push send failed:', err))

            // SMS only if phone exists
            if (userData.phone) {
                sendPointSms(userData.phone, firstName, eventType, timestamp)
                    .catch(err => console.error('[API Points] SMS send failed:', err))
            }
        } catch (notifErr) {
            console.error('[API Points] Error preparing notifications:', notifErr)
        }

        return NextResponse.json({ success: true, event })

    } catch (error: any) {
        console.error('Error recording point:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}


import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { detectAnomalies } from '@/lib/intelligence'

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
        const { eventType, location, timestamp } = body

        if (!eventType || !timestamp) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        // 3. Get User Company (for Rules)
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('company_id')
            .eq('id', user.id)
            .single()

        if (!profile?.company_id) {
            return NextResponse.json({ error: 'User has no company' }, { status: 400 })
        }

        // 4. Anomaly Detection
        const anomaly = await detectAnomalies(
            user.id,
            profile.company_id,
            location, // "(lon, lat)" or "lat,lon"? Mobile sends string `(${loc.coords.longitude},${loc.coords.latitude})`
            new Date(timestamp),
            supabaseAdmin
        )

        // 5. Insert Event
        const { data: event, error: insertError } = await supabaseAdmin
            .from('time_events')
            .insert({
                user_id: user.id,
                event_type: eventType,
                timestamp: timestamp,
                location: location,
                is_flagged: anomaly.isFlagged,
                flag_reason: anomaly.reason
            })
            .select()
            .single()

        if (insertError) throw insertError

        // 6. Update Profile Status
        const statusMap: Record<string, string> = {
            'clock_in': 'working',
            'clock_out': 'out',
            'break_start': 'break',
            'break_end': 'working'
        }
        const newStatus = statusMap[eventType] || 'offline'

        await supabaseAdmin
            .from('profiles')
            .update({
                current_status: newStatus,
                last_seen: timestamp
            })
            .eq('id', user.id)

        return NextResponse.json({ success: true, event })

    } catch (error: any) {
        console.error('Error recording point:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

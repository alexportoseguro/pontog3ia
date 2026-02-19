import { NextResponse } from 'next/server'
import { verifyAuth, supabaseAdmin } from '@/lib/auth-server'

export async function GET(request: Request) {
    try {
        const auth = await verifyAuth()
        if (auth.error) {
            return NextResponse.json({ error: auth.error }, { status: auth.status })
        }

        const { searchParams } = new URL(request.url)
        const unreadOnly = searchParams.get('unreadOnly') === 'true'

        // Only fetch notifications for the authenticated user
        let query = supabaseAdmin
            .from('notifications')
            .select('*')
            .eq('user_id', auth.user?.id)
            .order('created_at', { ascending: false })
            .limit(50)

        if (unreadOnly) {
            query = query.eq('read', false)
        }

        const { data, error } = await query

        if (error) throw error

        return NextResponse.json({
            notifications: data || [],
            unreadCount: data?.filter(n => !n.read).length || 0
        })

    } catch (error: any) {
        console.error('Error fetching notifications:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        const auth = await verifyAuth()
        if (auth.error) {
            return NextResponse.json({ error: auth.error }, { status: auth.status })
        }

        const body = await request.json()
        const { userId, title, message, type, link } = body

        if (!userId || !title || !message || !type) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        // Security: If not service role/admin, can only send to self (though typically POST is for system/managers)
        // Let's assume admins/managers can send notifications to anyone in their company
        if (auth.role !== 'admin' && auth.role !== 'manager' && userId !== auth.user?.id) {
            return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
        }

        // Verify target user company
        const { data: targetProfile } = await supabaseAdmin
            .from('profiles')
            .select('company_id')
            .eq('id', userId)
            .single()

        if (targetProfile?.company_id !== auth.companyId) {
            return NextResponse.json({ error: 'User belongs to another company' }, { status: 403 })
        }

        const { data, error } = await supabaseAdmin
            .from('notifications')
            .insert({
                user_id: userId,
                title,
                message,
                type,
                link
            })
            .select()
            .single()

        if (error) throw error

        return NextResponse.json({ notification: data })

    } catch (error: any) {
        console.error('Error creating notification:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

export async function PATCH(request: Request) {
    try {
        const auth = await verifyAuth()
        if (auth.error) {
            return NextResponse.json({ error: auth.error }, { status: auth.status })
        }

        const body = await request.json()
        const { notificationId, read } = body

        if (!notificationId) {
            return NextResponse.json({ error: 'notificationId required' }, { status: 400 })
        }

        // Verify ownership
        const { data: notification } = await supabaseAdmin
            .from('notifications')
            .select('user_id')
            .eq('id', notificationId)
            .single()

        if (notification?.user_id !== auth.user?.id) {
            return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
        }

        const { error } = await supabaseAdmin
            .from('notifications')
            .update({ read })
            .eq('id', notificationId)

        if (error) throw error

        return NextResponse.json({ success: true })

    } catch (error: any) {
        console.error('Error updating notification:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

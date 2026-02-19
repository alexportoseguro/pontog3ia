
import { NextResponse } from 'next/server'
import { checkAdminRole, supabaseAdmin } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
    try {
        // 1. Auth Check
        const auth = await checkAdminRole()
        if (auth.error) {
            return NextResponse.json({ error: auth.error }, { status: auth.status })
        }

        const { searchParams } = new URL(request.url)
        const recordId = searchParams.get('recordId')
        const userId = searchParams.get('userId')
        const limit = parseInt(searchParams.get('limit') || '50')

        let query = supabaseAdmin
            .from('audit_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit)

        if (recordId) {
            query = query.eq('record_id', recordId)
        }

        if (userId) {
            // Filter by ACTOR (who did it) or TARGET? 
            // Usually we want history FOR a record, which is recordId.
            // If userId param is passed, assume we want logs where this user is the TARGET (if stored in details) OR the actor?
            // Let's stick to recordId for now as the primary filter for specific entity history.
            // But if we want logs performed BY a user:
            query = query.eq('user_id', userId)
        }

        const { data: logs, error } = await query

        if (error) throw error

        // Manual join for profiles since FK might be missing
        if (logs && logs.length > 0) {
            const userIds = Array.from(new Set(logs.map((l: any) => l.user_id).filter(Boolean)))
            if (userIds.length > 0) {
                const { data: profiles } = await supabaseAdmin
                    .from('profiles')
                    .select('id, full_name, email')
                    .in('id', userIds)

                const profileMap = new Map(profiles?.map((p: any) => [p.id, p]) || [])

                // Attach profile data
                return NextResponse.json(logs.map((log: any) => ({
                    ...log,
                    profiles: profileMap.get(log.user_id) || null
                })))
            }
        }

        return NextResponse.json(logs)
    } catch (error: any) {
        console.error('Error fetching audit logs:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

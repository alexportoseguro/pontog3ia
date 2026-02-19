import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth-server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    try {
        const auth = await verifyAuth()
        if (auth.error) {
            return NextResponse.json({ error: auth.error }, { status: auth.status })
        }

        // --- Granular RBAC ---
        const isManager = auth.role === 'admin' || auth.role === 'manager'
        const currentUserId = auth.user?.id

        if (!isManager) {
            // If employee, they MUST provide their own ID or no ID (if no ID, we force their ID)
            if (userId && userId !== currentUserId) {
                return NextResponse.json({ error: 'Forbidden: You can only access your own data' }, { status: 403 })
            }
        }

        const targetUserId = isManager ? userId : currentUserId

        const today = new Date()
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(today.getDate() - 6)
        sevenDaysAgo.setHours(0, 0, 0, 0)

        // 1. Fetch Events (filtered by company)
        let query = supabase
            .from('time_events')
            .select('timestamp, event_type, user_id, profiles!inner(company_id)')
            .eq('profiles.company_id', auth.companyId)
            .gte('timestamp', sevenDaysAgo.toISOString())
            .order('timestamp', { ascending: true })

        if (targetUserId) {
            query = query.eq('user_id', targetUserId)
        }

        const { data: events, error } = await query
        if (error) throw error

        // 2. Process Data by Day
        const daysMap = new Map<string, { totalMs: number, userCount: Set<string> }>()
        for (let i = 0; i < 7; i++) {
            const d = new Date(sevenDaysAgo)
            d.setDate(d.getDate() + i)
            const dateKey = d.toISOString().split('T')[0]
            daysMap.set(dateKey, { totalMs: 0, userCount: new Set() })
        }

        if (events) {
            const userEventsByDay = new Map<string, Map<string, any[]>>()

            events.forEach(e => {
                const dateKey = e.timestamp.split('T')[0]
                const uId = e.user_id

                if (!userEventsByDay.has(uId)) userEventsByDay.set(uId, new Map())
                const userDays = userEventsByDay.get(uId)!

                if (!userDays.has(dateKey)) userDays.set(dateKey, [])
                userDays.get(dateKey)!.push(e)
            })

            userEventsByDay.forEach((days, uId) => {
                days.forEach((dayEvents, dateKey) => {
                    if (daysMap.has(dateKey)) {
                        let workedMs = 0
                        let lastIn: number | null = null

                        dayEvents.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

                        dayEvents.forEach(e => {
                            const time = new Date(e.timestamp).getTime()
                            if (['clock_in', 'work_resume', 'break_end'].includes(e.event_type)) {
                                if (lastIn === null) lastIn = time
                            } else if (['clock_out', 'work_pause', 'break_start'].includes(e.event_type)) {
                                if (lastIn !== null) {
                                    workedMs += (time - lastIn)
                                    lastIn = null
                                }
                            }
                        })

                        if (lastIn !== null && dateKey === new Date().toISOString().split('T')[0]) {
                            workedMs += (Date.now() - lastIn)
                        }

                        const dayStats = daysMap.get(dateKey)!
                        dayStats.totalMs += workedMs
                        dayStats.userCount.add(uId)
                    }
                })
            })
        }

        // 3. Format Response
        const result = Array.from(daysMap.entries()).map(([date, stats]) => {
            const d = new Date(date)
            const dayName = d.toLocaleDateString('pt-BR', { weekday: 'short', timeZone: 'UTC' }).replace('.', '')

            let hours = stats.totalMs / (1000 * 60 * 60)
            const count = stats.userCount.size

            return {
                name: dayName.charAt(0).toUpperCase() + dayName.slice(1),
                horas: Number(hours.toFixed(1)),
                // If it's team view, maybe return average? 
                // Decision: For team view, return average per active user if aggregate.
                // For personal view, it's just total.
                avg_horas: count > 0 ? Number((hours / count).toFixed(1)) : 0,
                ativos: count
            }
        })

        return NextResponse.json(result)

    } catch (error: any) {
        console.error('Weekly hours API error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

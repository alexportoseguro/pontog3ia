import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth-server'

// Initialize Supabase Admin Client
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
)

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const userIdFilter = searchParams.get('userId')
        const startDate = searchParams.get('startDate') || new Date(new Date().setDate(new Date().getDate() - 30)).toISOString()
        let endDateParam = searchParams.get('endDate') || new Date().toISOString()

        // Fix: If endDate is just YYYY-MM-DD, append time to include the whole day
        if (endDateParam.length === 10) {
            endDateParam += 'T23:59:59.999Z'
        }
        const endDate = endDateParam

        // 1. Verify Auth
        const auth = await verifyAuth()
        if (auth.error) {
            return NextResponse.json({ error: auth.error }, { status: auth.status })
        }

        // 2. Security: Employees can only view their own data
        let targetUserId = userIdFilter
        if (auth.role === 'employee' && auth.user) {
            targetUserId = auth.user.id
        }

        // 3. Fetch holidays (Global or Company specific)
        const { data: holidays } = await supabaseAdmin
            .from('holidays')
            .select('date')
            .gte('date', startDate)
            .lte('date', endDate)
            .or(`company_id.is.null,company_id.eq.${auth.companyId}`)

        const holidayDates = new Set(holidays?.map((h: any) => h.date) || [])

        const page = parseInt(searchParams.get('page') || '1')
        const limit = parseInt(searchParams.get('limit') || '10')
        const shiftIdFilter = searchParams.get('shiftId')
        const onlyIssuesFilter = searchParams.get('onlyIssues') === 'true'
        const offset = (page - 1) * limit

        // 4. Fetch profiles for this company
        let profileQuery = supabaseAdmin
            .from('profiles')
            .select('id, full_name, role, shift_rules(*), employee_shifts!inner(shift_rules(*))', { count: 'exact' })
            .eq('company_id', auth.companyId)

        if (targetUserId) {
            profileQuery = profileQuery.eq('id', targetUserId)
        }

        if (shiftIdFilter && shiftIdFilter !== 'all') {
            profileQuery = profileQuery.eq('employee_shifts.shift_id', shiftIdFilter)
        }

        // Apply pagination
        profileQuery = profileQuery.range(offset, offset + limit - 1)
        profileQuery = profileQuery.order('full_name', { ascending: true })

        const { data: profiles, error: profileError, count } = await profileQuery
        if (profileError) throw profileError

        const userIds = profiles?.map(p => p.id) || []
        const { data: justifications } = await supabaseAdmin
            .from('justifications')
            .select('*')
            .in('user_id', userIds)
            .eq('status', 'approved')

        let reportData = []

        for (const profile of profiles) {
            // Fetch events
            const { data: events } = await supabaseAdmin
                .from('time_events')
                .select('*')
                .eq('user_id', profile.id)
                .gte('timestamp', startDate)
                .lte('timestamp', endDate)
                .order('timestamp', { ascending: true })

            const days: any[] = []
            let current = new Date(startDate)
            const end = new Date(endDate)

            let totalBalance = 0;

            while (current <= end) {
                const dateStr = current.toISOString().split('T')[0]
                const dayOfWeekIndex = current.getDay()
                const daysMap = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
                const weekDayName = daysMap[dayOfWeekIndex]
                const isHoliday = holidayDates.has(dateStr)

                // Define "Virtual Day" Window
                const TZ_OFFSET = 3;

                let windowStart = new Date(current)
                windowStart.setUTCHours(TZ_OFFSET, 0, 0, 0)

                let windowEnd = new Date(current)
                windowEnd.setDate(windowEnd.getDate() + 1)
                windowEnd.setUTCHours(TZ_OFFSET - 1, 59, 59, 999)

                // Determine applicable shift
                let shiftRule: any = null
                const assignedShifts = profile.employee_shifts?.map((es: any) => es.shift_rules) || []

                if (assignedShifts.length > 0) {
                    shiftRule = assignedShifts.find((s: any) => s.work_days?.includes(weekDayName))
                } else {
                    shiftRule = profile.shift_rules
                }

                let expected = 0

                if (shiftRule && shiftRule.work_days && shiftRule.work_days.includes(weekDayName)) {
                    const [startH, startM] = shiftRule.start_time.split(':').map(Number)
                    const [endH, endM] = shiftRule.end_time.split(':').map(Number)

                    if (endH < startH) {
                        windowStart.setHours(startH - 4, startM, 0, 0)
                        windowEnd = new Date(current)
                        windowEnd.setDate(windowEnd.getDate() + 1)
                        windowEnd.setHours(endH + 4, endM, 0, 0)

                        const startMinutes = startH * 60 + startM
                        const endMinutes = (endH + 24) * 60 + endM
                        const breakMinutes = shiftRule.break_duration_minutes || 0
                        expected = (endMinutes - startMinutes) - breakMinutes
                    } else {
                        const startMinutes = startH * 60 + startM
                        const endMinutes = endH * 60 + endM
                        const breakMinutes = shiftRule.break_duration_minutes || 0
                        expected = (endMinutes - startMinutes) - breakMinutes
                    }
                } else if (!shiftRule) {
                    const isWeekend = dayOfWeekIndex === 0 || dayOfWeekIndex === 6
                    if (isWeekend) expected = dayOfWeekIndex === 6 ? 240 : 0
                    else expected = 480
                }

                if (isHoliday) {
                    expected = 0
                }

                const userJustifications = justifications?.filter((j: any) => j.user_id === profile.id) || []
                const justification = userJustifications.find((j: any) => {
                    const jStart = new Date(j.start_date)
                    const jEnd = new Date(j.end_date || j.start_date)
                    const currentStr = current.toISOString().split('T')[0]
                    const startStr = jStart.toISOString().split('T')[0]
                    const endStr = jEnd.toISOString().split('T')[0]
                    return currentStr >= startStr && currentStr <= endStr
                })

                if (justification) {
                    expected = 0
                }

                const dayEvents = events?.filter((e: any) => {
                    const t = new Date(e.timestamp)
                    return t >= windowStart && t <= windowEnd
                }) || []

                dayEvents.sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

                let workedMinutes = 0
                let startTime: number | null = null

                for (const event of dayEvents) {
                    const time = new Date(event.timestamp).getTime()
                    const type = event.event_type

                    if (['clock_in', 'work_resume', 'break_end'].includes(type)) {
                        if (startTime === null) startTime = time
                    } else if (['clock_out', 'work_pause', 'break_start'].includes(type)) {
                        if (startTime !== null) {
                            workedMinutes += (time - startTime) / 1000 / 60
                            startTime = null
                        }
                    }
                }

                if (startTime !== null) {
                    const now = new Date().getTime()
                    const limit = Math.min(now, windowEnd.getTime())
                    if (limit > startTime) {
                        workedMinutes += (limit - startTime) / 1000 / 60
                    }
                }

                const balance = Math.floor(workedMinutes - expected)
                totalBalance += balance

                const realTodayStr = new Date().toISOString().split('T')[0]
                const isFuture = dateStr > realTodayStr
                const shouldShow = dayEvents.length > 0 || (!isFuture && expected > 0) || isHoliday || !!justification;

                if (shouldShow) {
                    days.push({
                        date: dateStr,
                        workedMinutes: Math.floor(workedMinutes),
                        expectedMinutes: expected,
                        balanceMinutes: balance,
                        events: dayEvents,
                        isHoliday,
                        justification: justification ? {
                            type: justification.type,
                            description: justification.description
                        } : null
                    })
                }
                current.setDate(current.getDate() + 1)
            }

            const hasIssue = days.some((d: any) => d.balanceMinutes < 0)
            if (!onlyIssuesFilter || hasIssue) {
                reportData.push({
                    ...profile,
                    report: onlyIssuesFilter ? days.filter((d: any) => d.balanceMinutes < 0) : days,
                    totalBalanceMinutes: totalBalance
                })
            }
        }

        return NextResponse.json({
            data: reportData,
            metadata: {
                total: count || 0,
                page,
                limit,
                totalPages: Math.ceil((count || 0) / limit)
            }
        })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

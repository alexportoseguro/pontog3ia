import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

export type DailyBalance = {
    date: string
    events: any[]
    totalWorkedMinutes: number
    expectedMinutes: number
    balanceMinutes: number
    status: 'pending' | 'ok' | 'missing_punch'
}

export async function calculateBankForUser(userId: string, startDate: Date, endDate: Date): Promise<DailyBalance[]> {
    // 1. Fetch all events in range
    const { data: events } = await supabase
        .from('time_events')
        .select('*')
        .eq('user_id', userId)
        .gte('timestamp', startDate.toISOString())
        .lte('timestamp', endDate.toISOString())
        .order('timestamp', { ascending: true })

    // 2. Fetch approved justifications (credits)
    // For simplicity, we assume justifications act as "credits" adding to worked time
    // In a real system, they might replace specific missing punches.
    // Here we just fetch them to list them or add simple credit if structured.
    // For now, ignoring complex justification logic, just focusing on punch calculation.

    const balances: DailyBalance[] = []

    // Iterate days
    let current = new Date(startDate)
    while (current <= endDate) {
        const dateStr = current.toISOString().split('T')[0]
        const dayEvents = events?.filter(e => e.timestamp.startsWith(dateStr)) || []

        let workedMinutes = 0
        let lastIn: Date | null = null
        let hasIn = false

        // Simple chronologic calculation: In -> Out
        // Robustness: Sort by time. If In -> In (ignore first? or error?). Assumes In -> Out -> In -> Out
        // Using "status" from the event might be safer if we trust the machine, but let's just use pairs.

        // Filter out 'manual' adjustments if they are just comments, but if they are 'clock_in' type...
        // We rely on event_type: 'clock_in' | 'clock_out' | 'break_start' | 'break_end'

        // Logic:
        // Work Block: clock_in -> (break_start OR clock_out)
        // Break Block: break_start -> break_end

        // We can flatten the timeline.
        // A simpler approach for MVP:
        // Sort events.
        // Iterate. If type=IN/RESUME => startTime.
        // If type=OUT/PAUSE => endTime. Add diff to total.

        let startTime: number | null = null;

        // Mapping event types to logical actions
        // clock_in, break_end, work_resume -> START_COUNTING
        // clock_out, break_start, work_pause -> STOP_COUNTING

        for (const event of dayEvents) {
            const time = new Date(event.timestamp).getTime()
            const type = event.event_type // clock_in, clock_out, break_start, break_end

            if (type === 'clock_in' || type === 'break_end') {
                if (startTime === null) startTime = time
            } else if (type === 'clock_out' || type === 'break_start') {
                if (startTime !== null) {
                    workedMinutes += (time - startTime) / 1000 / 60
                    startTime = null
                }
            }
        }

        // Expected Minutes
        const dayOfWeek = current.getDay() // 0=Sun, 6=Sat
        let expected = 480 // 8 hours M-F
        if (dayOfWeek === 6) expected = 240 // 4 hours Sat
        if (dayOfWeek === 0) expected = 0 // 0 hours Sun

        // Adjust for "missing punch" (if startTime is left open)
        let status: DailyBalance['status'] = 'ok'
        if (startTime !== null) {
            status = 'pending' // Still open
            // Do not add the open interval
        } else if (dayEvents.length === 0 && expected > 0) {
            status = 'missing_punch'
        }

        balances.push({
            date: dateStr,
            events: dayEvents,
            totalWorkedMinutes: Math.floor(workedMinutes),
            expectedMinutes: expected,
            balanceMinutes: Math.floor(workedMinutes - expected),
            status
        })

        current.setDate(current.getDate() + 1)
    }

    return balances
}

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { verifyAuth, checkAdminRole } from '@/lib/auth-server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

export async function GET(request: Request) {
    try {
        // 1. Verify Auth & Role (Managers Only)
        const auth = await checkAdminRole()
        if (auth.error) {
            return NextResponse.json({ error: auth.error }, { status: auth.status })
        }

        const companyId = auth.companyId

        // 2. Fetch Weekly Aggregated Data for the Company
        const now = new Date()
        const startOfWeek = getStartOfWeek()
        const endOfWeek = getEndOfWeek()

        // Fetch all time events for the company in this period
        const { data: events, error: eventsError } = await supabaseAdmin
            .from('time_events')
            .select('*, profiles!inner(id, full_name, shift_rule_id)')
            .eq('profiles.company_id', companyId)
            .gte('timestamp', startOfWeek.toISOString())
            .lte('timestamp', endOfWeek.toISOString())

        if (eventsError) throw eventsError

        // Simple processing to get stats
        // In a real "AI-First OS", we would have a dedicated stats table or materialized view
        // For now, we calculate on the fly for the prototype
        const stats = processEvents(events || [])

        // 3. Call Gemini 2.0 Flash
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
        const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash-exp",
            generationConfig: { responseMimeType: "application/json" }
        })

        const prompt = `
            Atue como um Analista de Operações Sênior para uma empresa.
            Analise os dados da semana atual (${startOfWeek.toLocaleDateString()} a ${endOfWeek.toLocaleDateString()}) e gere 3 insights estratégicos.
            
            DADOS DA EMPRESA:
            - Funcionários Ativos: ${stats.uniqueEmployees}
            - Total Horas Trabalhadas: ${stats.totalHours.toFixed(1)}
            - Pontos Registrados: ${stats.totalEvents}
            - Atrasos (Late Arrivals): ${stats.lateArrivals}
            - Horas Extras Estimadas: ${stats.overtimeHours.toFixed(1)}
            
            Gere um JSON estritamente neste formato:
            {
                "efficiency": {
                    "trend": "up" | "down" | "neutral",
                    "value": "percentual ou valor",
                    "message": "Curta frase sobre a produtividade"
                },
                "anomaly": {
                    "severity": "high" | "medium" | "low",
                    "title": "Título do problema",
                    "description": "Descrição ultra-concisa do problema detectado"
                },
                "recommendation": {
                    "action": "Ação sugerida",
                    "impact": "Impacto esperado"
                }
            }
            
            Se os dados forem zero ou insuficientes, gere insights genéricos motivacionais/organizacionais, mas não invente números.
        `

        const result = await model.generateContent(prompt)
        const text = result.response.text()
        const insights = JSON.parse(text)

        return NextResponse.json(insights)

    } catch (error: any) {
        console.error('Insights Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

// Helpers
function getStartOfWeek() {
    const d = new Date()
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    return new Date(d.setDate(diff))
}

function getEndOfWeek() {
    const d = new Date(getStartOfWeek())
    d.setDate(d.getDate() + 6)
    return d
}

function processEvents(events: any[]) {
    // Basic aggregation logic
    const uniqueEmployees = new Set(events.map(e => e.user_id)).size
    const totalEvents = events.length

    // Simple heuristic for "hours" (pairing ins/outs)
    let totalMinutes = 0
    // Separate by user
    const usersEvents: any = {}
    events.forEach(e => {
        if (!usersEvents[e.user_id]) usersEvents[e.user_id] = []
        usersEvents[e.user_id].push(e)
    })

    let overtimeHours = 0
    let lateArrivals = 0

    // This is a simplified calculation for the "AI Context"
    // The AI will do the qualitative analysis, we just feed it rough quantities
    Object.values(usersEvents).forEach((userEvts: any) => {
        userEvts.sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

        let lastIn: Date | null = null

        for (const e of userEvts) {
            if (['clock_in', 'work_resume'].includes(e.event_type)) {
                lastIn = new Date(e.timestamp)
                // Check if 'late' (e.g., after 9AM) - heuristic
                if (lastIn.getHours() > 9) lateArrivals++
            } else if (['clock_out', 'work_pause'].includes(e.event_type) && lastIn) {
                const diff = (new Date(e.timestamp).getTime() - lastIn.getTime()) / 60000
                totalMinutes += diff
                lastIn = null
            }
        }

        // Rough overtime estimate (if > 8h in a day basically)
        // We accumulate total minutes for the week. If avg > 44h worth...
    })

    // If total minutes > users * 44h * (days passed / 5) ... rough calc
    const totalHours = totalMinutes / 60
    if (totalHours > (uniqueEmployees * 44)) {
        overtimeHours = totalHours - (uniqueEmployees * 44)
    }

    return {
        uniqueEmployees,
        totalHours,
        totalEvents,
        lateArrivals,
        overtimeHours
    }
}

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { generateAEJ } from '@/lib/compliance/aej'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

export async function POST(request: Request) {
    try {
        const { companyId, startDate, endDate } = await request.json()

        if (!companyId || !startDate || !endDate) {
            return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
        }

        // 1. Fetch Company
        const { data: company } = await supabaseAdmin
            .from('companies')
            .select('*')
            .eq('id', companyId)
            .single()

        if (!company) throw new Error('Company not found')

        // 2. Fetch Employees (Profiles)
        const { data: employees } = await supabaseAdmin
            .from('profiles')
            .select('*')
            .eq('company_id', companyId)

        if (!employees) throw new Error('No employees found')

        // 3. Fetch Time Events
        const { data: events } = await supabaseAdmin
            .from('time_events')
            .select('*')
            .in('user_id', employees.map(e => e.id)) // Filter by company employees
            .gte('timestamp', startDate)
            .lte('timestamp', endDate)
            .order('timestamp', { ascending: true })

        // 4. Map to AEJ structure
        const markings = events?.map((e: any) => ({
            employeeId: e.user_id,
            date: new Date(e.timestamp),
            repId: 1, // Default Virtual REP
            type: determineEventType(e.event_type) // Helper to map type
        })) || []

        // 5. Generate Content
        const fileContent = generateAEJ({
            company: {
                cnpj: company.cnpj || '00000000000000',
                razaoSocial: company.name,
                startDate: new Date(startDate),
                endDate: new Date(endDate)
            },
            employees: employees.map(e => ({
                id: e.id,
                cpf: e.cpf || '00000000000',
                name: e.full_name,
                pis: e.pis || '00000000000'
            })),
            markings
        })

        return new NextResponse(fileContent, {
            status: 200,
            headers: {
                'Content-Type': 'text/plain',
                'Content-Disposition': `attachment; filename="aej_${startDate}_${endDate}.txt"`
            }
        })

    } catch (error: any) {
        console.error('AEJ Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

function determineEventType(type: string): 'E' | 'S' | 'D' {
    if (['clock_in', 'work_resume', 'break_end'].includes(type)) return 'E'
    if (['clock_out', 'work_pause', 'break_start'].includes(type)) return 'S'
    return 'E' // Default to Entry if unknown
}

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { generateAFD } from '@/lib/compliance/afd'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

export async function POST(request: Request) {
    try {
        const { companyId, startDate, endDate } = await request.json()

        if (!companyId || !startDate || !endDate) {
            return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
        }

        // 1. Fetch Company Details
        const { data: company } = await supabaseAdmin
            .from('companies')
            .select('*')
            .eq('id', companyId)
            .single()

        if (!company) throw new Error('Company not found')

        // 2. Fetch Time Events
        const { data: events } = await supabaseAdmin
            .from('time_events')
            .select(`
                *,
                profiles!inner(*)
            `)
            .eq('profiles.company_id', companyId)
            .gte('timestamp', startDate)
            .lte('timestamp', endDate)
            .order('timestamp', { ascending: true })

        // 3. Map to AFD structure
        const records = events?.map((e: any, index: number) => ({
            nsr: index + 1, // Sequential number
            date: new Date(e.timestamp),
            cpf: e.profiles.cpf || '00000000000'
        })) || []

        // 4. Generate Content
        const fileContent = generateAFD({
            company: {
                cnpj: company.cnpj || '00000000000000',
                razaoSocial: company.name,
                repId: '00000000000000001' // Fixed for SaaS or fetched from settings
            },
            records
        })

        return new NextResponse(fileContent, {
            status: 200,
            headers: {
                'Content-Type': 'text/plain',
                'Content-Disposition': `attachment; filename="afd_${startDate}_${endDate}.txt"`
            }
        })

    } catch (error: any) {
        console.error('AFD Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

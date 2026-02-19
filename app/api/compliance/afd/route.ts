
import { NextResponse } from 'next/server'
import { checkAdminRole, supabaseAdmin } from '@/lib/auth-server'
import { generateAFD } from '@/lib/compliance/afd'

export async function GET(request: Request) {
    const auth = await checkAdminRole()
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const companyId = auth.companyId
    if (!companyId) return NextResponse.json({ error: 'Company not found' }, { status: 401 })
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate') // yyyy-mm-dd
    const endDate = searchParams.get('endDate')

    try {
        // Fetch Company
        const { data: company } = await supabaseAdmin
            .from('companies')
            .select('*')
            .eq('id', companyId)
            .single()

        if (!company) throw new Error('Company not found')

        // Fetch Markings (Type 7 needs markings)
        // Join with profiles to get CPF
        let query = supabaseAdmin
            .from('time_events') // This holds the markings? Or location_logs?
            // "Marking" is usually an event. time_events has "timestamp".
            .select('*, profiles(cpf)')
            .eq('company_id', companyId)
            .order('timestamp', { ascending: true })

        if (startDate) query = query.gte('timestamp', `${startDate}T00:00:00`)
        if (endDate) query = query.lte('timestamp', `${endDate}T23:59:59`)

        const { data: events } = await query

        // Map to AFD format
        const afdContent = generateAFD({
            company: {
                cnpj: company.cnpj || '00000000000000',
                razaoSocial: company.name || 'Empresa',
                repId: '00000000000000001' // Placeholder
            },
            records: (events || []).map((e: any, index: number) => ({
                nsr: index + 1, // Sequential within this file generation? Or DB ID? Standard is usually sequential within file.
                date: new Date(e.timestamp),
                cpf: e.profiles?.cpf || '00000000000'
            }))
        })

        return new NextResponse(afdContent, {
            headers: {
                'Content-Type': 'text/plain',
                'Content-Disposition': `attachment; filename="afd-${startDate || 'all'}.txt"`
            }
        })

    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

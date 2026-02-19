
import { NextResponse } from 'next/server'
import { checkAdminRole, supabaseAdmin } from '@/lib/auth-server'
import { generateAEJ } from '@/lib/compliance/aej'

export async function GET(request: Request) {
    const auth = await checkAdminRole()
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const admin = auth.user
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate') // yyyy-mm-dd
    const endDate = searchParams.get('endDate')

    try {
        // Fetch Company
        const { data: company } = await supabaseAdmin
            .from('companies')
            .select('*')
            .eq('id', admin.company_id)
            .single()

        if (!company) throw new Error('Company not found')

        // Fetch Employees (Type 03)
        const { data: employees } = await supabaseAdmin
            .from('profiles')
            .select('id, full_name, cpf, pis') // Need PIS?
            .eq('company_id', admin.company_id)
            .eq('role', 'employee') // Only employees?

        // Fetch Markings (Type 05)
        let query = supabaseAdmin
            .from('time_events')
            .select('*')
            .eq('company_id', admin.company_id)
            .order('timestamp', { ascending: true })

        if (startDate) query = query.gte('timestamp', `${startDate}T00:00:00`)
        if (endDate) query = query.lte('timestamp', `${endDate}T23:59:59`)

        const { data: markings } = await query

        const aejContent = generateAEJ({
            company: {
                cnpj: company.cnpj || '00000000000000',
                razaoSocial: company.name || 'Empresa',
                startDate: startDate ? new Date(startDate) : new Date(),
                endDate: endDate ? new Date(endDate) : new Date()
            },
            employees: (employees || []).map((e: any) => ({
                id: e.id,
                cpf: e.cpf || '00000000000',
                name: e.full_name || 'Funcionario',
                pis: e.pis
            })),
            markings: (markings || []).map((m: any) => ({
                employeeId: m.user_id, // Ensure time_events has user_id
                date: new Date(m.timestamp),
                repId: 1, // Fixed
                type: 'E' // We need to infer logic later, assuming generic 'Entry' or 'Original' for now.
                // In a real system, we'd check if it's start or end of shift.
            }))
        })

        return new NextResponse(aejContent, {
            headers: {
                'Content-Type': 'text/plain',
                'Content-Disposition': `attachment; filename="aej-${startDate || 'all'}.txt"`
            }
        })

    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

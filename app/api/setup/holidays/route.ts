import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyAuth, checkAdminRole } from '@/lib/auth-server'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Basic GET/POST/DELETE handled by unified exports below

export async function GET() {
    try {
        const auth = await verifyAuth()
        if (auth.error) {
            return NextResponse.json({ error: auth.error }, { status: auth.status })
        }

        const { data, error } = await supabase
            .from('holidays')
            .select('*')
            .or(`company_id.is.null,company_id.eq.${auth.companyId}`)
            .order('date')

        if (error) throw error
        return NextResponse.json(data)
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        const auth = await checkAdminRole()
        if (auth.error) {
            return NextResponse.json({ error: auth.error }, { status: auth.status })
        }

        const body = await request.json()
        const { date, name } = body

        if (!date || !name) {
            return NextResponse.json({ error: 'Date and name required' }, { status: 400 })
        }

        const { data, error } = await supabase
            .from('holidays')
            .insert({
                date,
                name,
                company_id: auth.companyId
            })
            .select()
            .single()

        if (error) throw error
        return NextResponse.json(data)
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}

export async function DELETE(request: Request) {
    try {
        const auth = await checkAdminRole()
        if (auth.error) {
            return NextResponse.json({ error: auth.error }, { status: auth.status })
        }

        const { searchParams } = new URL(request.url)
        const id = searchParams.get('id')

        if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

        // 1. Verify ownership
        const { data: holiday } = await supabase
            .from('holidays')
            .select('company_id')
            .eq('id', id)
            .single()

        if (holiday && holiday.company_id && holiday.company_id !== auth.companyId) {
            return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
        }

        const { error } = await supabase.from('holidays').delete().eq('id', id)
        if (error) throw error

        return NextResponse.json({ success: true })
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}

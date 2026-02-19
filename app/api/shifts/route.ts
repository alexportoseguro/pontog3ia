import { NextResponse } from 'next/server'
import { checkAdminRole, verifyAuth, supabaseAdmin } from '@/lib/auth-server'

export async function GET() {
    try {
        const auth = await verifyAuth()
        if (auth.error) {
            return NextResponse.json({ error: auth.error }, { status: auth.status })
        }

        let query = supabaseAdmin
            .from('shift_rules')
            .select('*')

        if (auth.companyId) {
            query = query.or(`company_id.is.null,company_id.eq.${auth.companyId}`)
        } else {
            query = query.is('company_id', null)
        }

        const { data, error } = await query.order('name')

        if (error) {
            throw error
        }
        return NextResponse.json(data)
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}



export async function POST(request: Request) {
    try {
        const auth = await checkAdminRole()
        if (auth.error) {
            return NextResponse.json({ error: auth.error }, { status: auth.status })
        }

        const body = await request.json()
        const { name, start_time, end_time, break_duration_minutes, work_days } = body

        if (!name || !start_time || !end_time) {
            return NextResponse.json({ error: 'Missing defined fields' }, { status: 400 })
        }

        const { data, error } = await supabaseAdmin
            .from('shift_rules')
            .insert({
                name,
                start_time,
                end_time,
                break_duration_minutes: break_duration_minutes || 60,
                work_days: work_days || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
                company_id: auth.companyId
            })
            .select()
            .single()

        if (error) throw error
        return NextResponse.json(data)
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
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

        // 1. Verify ownership before deletion
        const { data: shift } = await supabaseAdmin
            .from('shift_rules')
            .select('company_id')
            .eq('id', id)
            .single()

        if (shift && shift.company_id && shift.company_id !== auth.companyId) {
            return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
        }

        const { error } = await supabaseAdmin.from('shift_rules').delete().eq('id', id)
        if (error) throw error

        return NextResponse.json({ success: true })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

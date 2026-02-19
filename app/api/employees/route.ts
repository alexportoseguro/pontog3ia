import { NextResponse } from 'next/server'
import { logAudit } from '@/lib/audit'
import { checkAdminRole, supabaseAdmin } from '@/lib/auth-server'

// Removed local supabaseAdmin initialization in favor of imported one

export async function GET(request: Request) {
    console.log('--- API Employees GET (Native Headers) ---')
    try {
        const authHeader = request.headers.get('authorization')

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            console.error('API Employees: Missing or invalid auth header')
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const token = authHeader.split(' ')[1]

        // 1. Verify Token and Get User
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

        if (authError || !user) {
            console.error('API Employees: Auth Error', authError)
            return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 })
        }

        // 2. Fetch the requester's profile
        const { data: requesterProfile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('company_id, role')
            .eq('id', user.id)
            .single()

        if (profileError || !requesterProfile) {
            console.error('API Employees: Profile Error', profileError)
            return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
        }

        // 3. Role check
        if (requesterProfile.role !== 'admin' && requesterProfile.role !== 'manager') {
            return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
        }

        if (!requesterProfile.company_id) {
            return NextResponse.json({ error: 'User not associated with a company' }, { status: 400 })
        }

        // 4. Fetch company members with multiple shifts
        const { data: employees, error: fetchError } = await supabaseAdmin
            .from('profiles')
            .select('*, employee_shifts(shift_rules(id, name, work_days))')
            .eq('company_id', requesterProfile.company_id)
            .order('full_name', { ascending: true })

        if (fetchError) throw fetchError

        console.log(`API Employees: Success! Found ${employees.length} members`)
        return NextResponse.json(employees)

    } catch (error: any) {
        console.error('API Employees Critical Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        const authHeader = request.headers.get('authorization')
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const token = authHeader.split(' ')[1]
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

        if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { data: requester } = await supabaseAdmin
            .from('profiles')
            .select('company_id, role')
            .eq('id', user.id)
            .single()

        if (!requester || (requester.role !== 'admin' && requester.role !== 'manager')) {
            return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
        }

        const body = await request.json()
        const { email, password, name, role, shiftId, shiftIds } = body

        // 1. Create Auth User
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name: name }
        })

        if (createError) throw createError

        if (!newUser.user) throw new Error('Failed to create user')

        // 2. Create Profile
        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .insert({
                id: newUser.user.id,
                email,
                full_name: name,
                role: role || 'employee',
                company_id: requester.company_id,
                shift_rule_id: shiftId !== 'none' ? shiftId : null // Legacy support
            })

        if (profileError) throw profileError

        // Log Audit
        await logAudit({
            userId: user.id,
            action: 'CREATE_EMPLOYEE',
            tableName: 'profiles',
            recordId: newUser.user.id,
            newData: { email, name, role, shiftId, shiftIds, company_id: requester.company_id },
            ipAddress: request.headers.get('x-forwarded-for') || 'unknown'
        })

        // 3. Assign Shifts
        const shiftsToAssign: { user_id: string; shift_id: string }[] = []

        if (shiftIds && Array.isArray(shiftIds) && shiftIds.length > 0) {
            // New multi-select mode
            shiftIds.forEach((sid: string) => {
                if (sid !== 'none') {
                    shiftsToAssign.push({ user_id: newUser.user.id, shift_id: sid })
                }
            })
        } else if (shiftId && shiftId !== 'none') {
            // Legacy single-select fallback
            shiftsToAssign.push({ user_id: newUser.user.id, shift_id: shiftId })
        }

        if (shiftsToAssign.length > 0) {
            const { error: shiftError } = await supabaseAdmin.from('employee_shifts').insert(shiftsToAssign)
            if (shiftError) console.error('Error assigning shifts:', shiftError)
        }

        return NextResponse.json({ success: true, user: newUser.user })

    } catch (error: any) {
        console.error('Create Employee Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

export async function PUT(request: Request) {
    try {
        const authHeader = request.headers.get('authorization')
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const token = authHeader.split(' ')[1]
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

        if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        // Check permission
        const { data: requester } = await supabaseAdmin
            .from('profiles')
            .select('company_id, role')
            .eq('id', user.id)
            .single()

        if (!requester || (requester.role !== 'admin' && requester.role !== 'manager')) {
            return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
        }

        const body = await request.json()
        const { id, name, role, email, shiftId, shiftIds } = body

        if (!id) return NextResponse.json({ error: 'User ID required' }, { status: 400 })

        // 1. Update Profile Logic
        const updates: any = {}
        if (name) updates.full_name = name
        if (role) updates.role = role
        // Legacy field update
        if (shiftId) updates.shift_rule_id = shiftId !== 'none' ? shiftId : null

        if (Object.keys(updates).length > 0) {
            const { error: updateError } = await supabaseAdmin
                .from('profiles')
                .update(updates)
                .eq('id', id)
                .eq('company_id', requester.company_id) // Ensure same company

            if (updateError) throw updateError
        }

        // 2. Update Employee Shifts
        // If shiftIds is provided, we do a full replace
        if (shiftIds && Array.isArray(shiftIds)) {
            // Delete existing
            await supabaseAdmin.from('employee_shifts').delete().eq('user_id', id)

            // Insert new
            const newShifts = shiftIds.filter((sid: string) => sid !== 'none')
            if (newShifts.length > 0) {
                const inserts = newShifts.map((sid: string) => ({
                    user_id: id,
                    shift_id: sid
                }))
                // Use upsert to be safe, or just insert
                const { error: insError } = await supabaseAdmin.from('employee_shifts').insert(inserts)
                if (insError) {
                    console.error('Error inserting shifts:', insError)
                    throw insError
                }
            }
        }
        // Legacy: if only shiftId provided (old UI), sync it
        else if (shiftId) {
            // Only update if shiftIds was NOT provided (to avoid double update if both are sent)
            await supabaseAdmin.from('employee_shifts').delete().eq('user_id', id)
            if (shiftId !== 'none') {
                const { error: insError } = await supabaseAdmin.from('employee_shifts').insert({ user_id: id, shift_id: shiftId })
                if (insError) throw insError
            }
        }

        return NextResponse.json({ success: true, message: 'Employee updated' })

    } catch (error: any) {
        console.error('Update Employee Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

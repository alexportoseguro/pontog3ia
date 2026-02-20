import { createClient } from '@supabase/supabase-js'
import { headers } from 'next/headers'
import type { NextRequest } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('WARNING: SUPABASE_SERVICE_ROLE_KEY is missing. Using ANON_KEY, which may cause permission errors.')
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
})

export async function verifyAuth(request?: Request | NextRequest) {
    try {
        let authHeader: string | null = null

        if (request) {
            // Prefer reading directly from request (more reliable in API Routes)
            authHeader = request.headers.get('authorization')
        } else {
            // Fallback for Server Components
            const headerList = await headers()
            authHeader = headerList.get('authorization')
        }

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            console.warn('[VerifyAuth] Missing or invalid auth header')
            return { error: 'Missing or invalid authorization header', status: 401 }
        }

        const token = authHeader.split(' ')[1]

        // 1. Verify Token and Get User
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

        if (authError || !user) {
            console.warn('[VerifyAuth] Token verification failed:', authError?.message)
            return { error: 'Unauthorized: Invalid token', status: 401 }
        }

        // 2. Get Profile Role and Company
        const { data: profile, error } = await supabaseAdmin
            .from('profiles')
            .select('role, company_id')
            .eq('id', user.id)
            .single()

        if (error || !profile) {
            return { error: 'User profile not found', status: 404 }
        }

        return { user, role: profile.role, companyId: profile.company_id }
    } catch (error) {
        console.error('VerifyAuth Error:', error)
        return { error: 'Internal Server Error during auth check', status: 500 }
    }
}

export async function checkAdminRole() {
    const auth = await verifyAuth()
    if (auth.error) return auth

    if (auth.role !== 'admin' && auth.role !== 'manager') {
        return { error: 'Forbidden: Admin access required', status: 403 }
    }

    return auth
}

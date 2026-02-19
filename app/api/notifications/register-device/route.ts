import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { userId, token, platform } = body

        if (!userId || !token) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        // Upsert token
        const { data, error } = await supabase
            .from('device_tokens')
            .upsert({
                user_id: userId,
                token,
                platform,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'user_id,token'
            })
            .select()
            .single()

        if (error) throw error

        return NextResponse.json({ success: true, data })

    } catch (error: any) {
        console.error('Error registering device:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

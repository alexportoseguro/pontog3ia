import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { verifyAuth, checkAdminRole } from '@/lib/auth-server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

export async function POST(request: Request) {
    try {
        // 1. Verify Auth & Role
        const auth = await checkAdminRole()
        if (auth.error) {
            return NextResponse.json({ error: auth.error }, { status: auth.status })
        }

        const rawFormData = await request.formData()
        const formData = rawFormData as unknown as { get: (key: string) => File | null }
        const file = formData.get('file')

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
        }

        // 2. Prepare for Gemini
        const arrayBuffer = await file.arrayBuffer()
        const base64Data = Buffer.from(arrayBuffer).toString('base64')
        const mimeType = file.type

        // 3. Call Gemini Vision
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
        const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash-exp",
            generationConfig: { responseMimeType: "application/json" }
        })

        const prompt = `
            Extract the following information from this identification document (CNH, RG, or CTPS).
            Return a JSON object with these fields (use null if not found):
            {
                "full_name": "Nome completo",
                "cpf": "CPF only numbers",
                "birth_date": "YYYY-MM-DD",
                "address": "Full address if available",
                "job_role": "Job title if available (CTPS only)"
            }
        `

        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    data: base64Data,
                    mimeType
                }
            }
        ])

        const text = result.response.text()
        const extractedData = JSON.parse(text)

        return NextResponse.json(extractedData)

    } catch (error: any) {
        console.error('Onboarding Processing Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

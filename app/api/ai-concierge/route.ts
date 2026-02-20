import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { conciergeTools } from '@/lib/concierge-tools'
import { verifyAuth } from '@/lib/auth-server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
})

export async function POST(request: Request) {
    try {
        // 1. Verify Auth
        const auth = await verifyAuth()
        if (auth.error) {
            return NextResponse.json({ error: auth.error }, { status: auth.status })
        }

        const contentType = request.headers.get('content-type') || '';
        let message = '';
        const requesterId = auth.user?.id;
        let isAudio = false;
        let audioBase64 = '';
        let audioMimeType = 'audio/m4a';

        if (!requesterId) {
            return NextResponse.json({ error: 'User ID not found in session' }, { status: 401 })
        }

        if (contentType.includes('multipart/form-data')) {
            const rawFormData = await request.formData();
            const formData = rawFormData as unknown as { get: (key: string) => File | null };
            const file = formData.get('audio');

            if (file && file.arrayBuffer) {
                isAudio = true;
                audioMimeType = file.type || 'audio/m4a';
                const arrayBuffer = await file.arrayBuffer();
                audioBase64 = Buffer.from(arrayBuffer).toString('base64');
                message = "[ÁUDIO ENVIADO]";
            }
        } else {
            const body = await request.json();
            message = body.message;
        }

        if ((!message && !isAudio)) {
            return NextResponse.json({ error: 'Missing message or audio' }, { status: 400 })
        }

        console.log(`[AI Concierge] Verified User: ${requesterId}, Company: ${auth.companyId}, Message: "${message}" (Audio: ${isAudio})`)

        // 1. Log the message (non-blocking - table may not exist yet)
        let msgData: any = null;
        try {
            const { data, error: msgError } = await supabaseAdmin
                .from('employee_messages')
                .insert({
                    user_id: requesterId,
                    content: message,
                    type: isAudio ? 'audio' : 'text',
                    status: 'processing'
                })
                .select()
                .single();
            if (!msgError) msgData = data;
        } catch (e) {
            console.warn('[AI Concierge] Could not log to employee_messages (table may not exist):', e);
        }

        // 2. AI with Function Calling
        const { GoogleGenerativeAI } = require("@google/generative-ai");
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

        const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash",
            tools: [{ functionDeclarations: conciergeTools }]
        });

        const isManager = auth.role === 'admin' || auth.role === 'manager';

        const basePrompt = `
Você é o "Concierge PontoG3", um Especialista em RH e DP com foco na legislação brasileira (CLT).
ID do usuário atual: ${requesterId}
Empresa ID: ${auth.companyId}
        `.trim();

        const managerPrompt = `
${basePrompt}

SEU PAPEL: "BRAÇO DIREITO DO GESTOR"
Você é um consultor estratégico para o administrador da empresa.
OBJETIVOS:
1.  **Gestão de Equipe**: Ajudar a monitorar a produtividade e assiduidade.
2.  **Prevenção de Passivos**: Alertar sobre horas extras excessivas, falta de intervalo (intrajornada) e descanso entre jornadas (interjornada - 11h).
3.  **Inteligência**: Identificar padrões (ex: "Setor X tem muitos atrasos às segundas").

COMPORTAMENTO:
- Tenha acesso total aos dados da equipe (use get_team_status, get_week_summary para qualquer um).
- Seja direto e executivo. Foco em métricas e alertas.
- Se o gestor pedir "Resumo", traga: Presentes/Ausentes, Atrasos críticos e Horas Extras projetadas.
        `.trim();

        const employeePrompt = `
${basePrompt}

SEU PAPEL: "ASSISTENTE DO COLABORADOR"
Você ajuda o funcionário a gerenciar seu próprio ponto e direitos.
OBJETIVOS:
1.  **Auto-Gestão**: Informar saldo de horas, escalas e espelho de ponto.
2.  **Educação**: Explicar direitos básicos (férias, 13º) se perguntado.
3.  **Compliance**: Alertar se ele estiver esquecendo de marcar ponto ou fazendo horas proibidas.

RESTRIÇÕES:
- **PRIVACIDADE**: NUNCA forneça dados de outros funcionários.
- **HIERARQUIA**: Não revele estratégias da empresa ou salários de terceiros.
- Se perguntarem algo fora da alçada (ex: "quanto o João ganha?"), responda: "Não tenho acesso a essa informação."

COMPORTAMENTO:
- Seja prestativo, educado e claro.
- Incentive o cumprimento das regras (marcar ponto na hora certa).
        `.trim();

        const systemPrompt = isManager ? managerPrompt : employeePrompt;

        const parts: any[] = [];
        if (isAudio) {
            parts.push({
                inlineData: {
                    mimeType: audioMimeType,
                    data: audioBase64
                }
            });
        }
        parts.push({ text: isAudio ? `${systemPrompt}\n\nO funcionário enviou um áudio. Transcreva e processe o pedido.` : `${systemPrompt}\n\nMensagem: "${message}"` });

        const chat = model.startChat();
        let result = await chat.sendMessage(parts);
        let response = result.response;

        // Handle function calling loop
        let toolCalls: any[] = [];
        let finalResponse = '';
        let transcription = message;

        while (response.functionCalls && response.functionCalls().length > 0) {
            const functionCall = response.functionCalls()[0];
            console.log(`[AI] Calling tool: ${functionCall.name}`, functionCall.args);

            toolCalls.push({
                name: functionCall.name,
                args: functionCall.args
            });

            // Execute the tool
            const toolResponse = await executeToolServer(functionCall.name, functionCall.args, requesterId, auth.companyId);

            // Send the tool response back to the model
            result = await chat.sendMessage([{
                functionResponse: {
                    name: functionCall.name,
                    response: toolResponse
                }
            }]);

            response = result.response;
        }

        // Get final text response
        finalResponse = response.text();

        // Extract transcription if audio
        if (isAudio && finalResponse.includes('[Transcrição]')) {
            const match = finalResponse.match(/\[Transcrição\]: (.+?)(?:\n|$)/);
            if (match) transcription = match[1];
        }

        // 3. Update message (non-blocking)
        if (msgData?.id) {
            await supabaseAdmin
                .from('employee_messages')
                .update({
                    status: 'processed',
                    ai_response: finalResponse,
                    content: isAudio ? `[Áudio]: ${transcription}` : message
                })
                .eq('id', msgData.id)
                .then(() => { });
        }

        // 4. Log tool calls to audit (non-blocking)
        if (toolCalls.length > 0) {
            supabaseAdmin.from('audit_logs').insert({
                user_id: requesterId,
                action: 'AI_TOOL_EXECUTION',
                details: {
                    message_id: msgData?.id,
                    tools_called: toolCalls.map(t => t.name),
                    full_calls: toolCalls
                }
            }).then(() => { }).catch((e: any) => console.warn('[AI] audit_logs insert failed (non-critical):', e.message))
        }

        return NextResponse.json({
            response: finalResponse,
            transcription: isAudio ? transcription : undefined,
            toolsCalled: toolCalls.map(t => t.name)
        }, {
            status: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            },
        })

    } catch (error: any) {
        // Log the full error — Gemini errors have a .status and .errorDetails
        console.error('[AI Concierge] Processing Error:', {
            message: error?.message,
            status: error?.status,
            errorDetails: error?.errorDetails,
            stack: error?.stack?.split('\n').slice(0, 4).join('\n')
        })
        const userMessage = error?.status === 429
            ? 'Limite de requisições à IA atingido. Tente novamente em alguns segundos.'
            : error?.status === 503
                ? 'O serviço de IA está temporariamente indisponível. Tente novamente em breve.'
                : `Erro ao processar: ${error?.message || 'Erro desconhecido'}`
        return NextResponse.json({ error: userMessage }, {
            status: error?.status || 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            },
        })
    }
}

// Server-side tool execution
async function executeToolServer(toolName: string, args: any, requestingUserId: string, companyId: string) {
    // Validate that userId in args matches requesting user (security)
    if (args.userId && args.userId !== requestingUserId) {
        return { error: "You can only execute actions for yourself" };
    }

    try {
        switch (toolName) {
            case 'get_work_hours':
                return await getWorkHours(args, companyId);
            case 'register_time_event':
                return await registerTimeEvent(args, companyId);
            case 'get_shift_schedule':
                return await getShiftSchedule(args, companyId);
            case 'get_team_status':
                return await getTeamStatus(args, companyId);
            case 'get_week_summary':
                return await getWeekSummary(args, companyId);
            case 'request_time_off':
                return await requestTimeOff(args, companyId);
            default:
                return { error: `Unknown tool: ${toolName}` };
        }
    } catch (error: any) {
        console.error(`Error in ${toolName}:`, error);
        return { error: error.message };
    }
}

// Tool implementations
async function getWorkHours(args: any, companyId: string) {
    const { userId, startDate, endDate } = args;

    const start = startDate || getStartOfWeek();
    const end = endDate || new Date().toISOString().split('T')[0];

    // Join with profiles to ensure company isolation
    const { data: events, error } = await supabaseAdmin
        .from('time_events')
        .select('*, profiles!inner(company_id)')
        .eq('user_id', userId)
        .eq('profiles.company_id', companyId)
        .gte('timestamp', start)
        .lte('timestamp', end)
        .order('timestamp', { ascending: true });

    if (error) throw error;

    // Calculate total hours
    const totalMinutes = calculateTotalMinutes(events || []);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.round(totalMinutes % 60);

    return {
        totalHours: hours,
        totalMinutes: minutes,
        formattedTotal: `${hours}h${minutes.toString().padStart(2, '0')}min`,
        eventCount: events?.length || 0,
        period: { start, end }
    };
}

async function registerTimeEvent(args: any, companyId: string) {
    const { userId, eventType, timestamp, reason } = args;

    const eventTime = timestamp || new Date().toISOString();

    // Verify company for the target user (secondary check)
    const { data: targetProfile } = await supabaseAdmin
        .from('profiles')
        .select('company_id')
        .eq('id', userId)
        .single();

    if (targetProfile?.company_id !== companyId) {
        throw new Error('User belongs to another company');
    }

    // Insert time event
    const { data, error } = await supabaseAdmin
        .from('time_events')
        .insert({
            user_id: userId,
            event_type: eventType,
            timestamp: eventTime,
            location: null,
            source: 'AI_CONCIERGE'
        })
        .select()
        .single();

    if (error) throw error;

    // Create justification matching the constraints of its table
    await supabaseAdmin.from('justifications').insert({
        user_id: userId,
        company_id: companyId,
        type: 'late_arrival', // Valid type in justifications table
        reason: `Registro via Concierge: ${reason || 'Sem motivo especificado'}`,
        status: 'pending'
    });

    return {
        success: true,
        eventId: data.id,
        eventType,
        timestamp: eventTime,
        message: "Ponto registrado! Aguardando aprovação do gestor."
    };
}

async function getShiftSchedule(args: any, companyId: string) {
    const { userId } = args;

    const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('shift_rule_id')
        .eq('id', userId)
        .eq('company_id', companyId)
        .single();

    if (!profile?.shift_rule_id) {
        return { message: "Você não tem escala definida ainda." };
    }

    const { data: shift } = await supabaseAdmin
        .from('shift_rules')
        .select('*')
        .eq('id', profile.shift_rule_id)
        .single();

    if (!shift) return { message: "Escala não encontrada." };

    return {
        shiftName: shift.name || 'Padrão',
        startTime: shift.start_time,
        endTime: shift.end_time,
        workDays: shift.work_days || [],
        dailyHours: shift.daily_hours || 8
    };
}

async function getTeamStatus(args: any, companyId: string) {
    // Return status for all company members
    const { data: members, error } = await supabaseAdmin
        .from('profiles')
        .select('full_name, role, current_status, last_seen')
        .eq('company_id', companyId)
        .order('full_name', { ascending: true });

    if (error) throw error;

    return {
        team: members.map((m: any) => ({
            name: m.full_name,
            role: m.role,
            status: m.current_status || 'offline',
            lastSeen: m.last_seen
        })),
        totalOnline: members?.filter((u: any) => ['working', 'WORKING'].includes(u.current_status)).length || 0
    };
}

async function getWeekSummary(args: any, companyId: string) {
    const { userId, weekOffset = 0 } = args;

    const startOfWeek = getStartOfWeek(weekOffset);
    const endOfWeek = getEndOfWeek(weekOffset);

    const workHours = await getWorkHours({ userId, startDate: startOfWeek, endDate: endOfWeek }, companyId);

    return {
        ...workHours,
        targetHours: 44,
        overUnder: workHours.totalHours - 44
    };
}

async function requestTimeOff(args: any, companyId: string) {
    const { userId, startDate, endDate, reason, type } = args;

    // Use justifications table for generic requests
    const { data, error } = await supabaseAdmin
        .from('justifications')
        .insert({
            user_id: userId,
            company_id: companyId,
            type: 'absence',
            reason: `Solicitação via Concierge [${type}, ${startDate} a ${endDate}]: ${reason}`,
            status: 'pending'
        })
        .select()
        .single();

    if (error) throw error;

    return {
        success: true,
        requestId: data.id,
        message: "Solicitação de folga enviada! Aguardando aprovação."
    };
}

// Helpers
function getStartOfWeek(offset = 0) {
    const now = new Date();
    now.setDate(now.getDate() + (offset * 7));
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const start = new Date(now.setDate(diff));
    start.setHours(0, 0, 0, 0);
    return start.toISOString();
}

function getEndOfWeek(offset = 0) {
    const start = new Date(getStartOfWeek(offset));
    start.setDate(start.getDate() + 6);
    start.setHours(23, 59, 59, 999);
    return start.toISOString();
}

function calculateTotalMinutes(events: any[]) {
    let total = 0;
    let lastCheckIn: Date | null = null;

    // Sort to be sure
    const sorted = [...events].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    for (const event of sorted) {
        const type = event.event_type;
        if (['clock_in', 'work_resume', 'break_end'].includes(type)) {
            if (!lastCheckIn) lastCheckIn = new Date(event.timestamp);
        } else if (['clock_out', 'work_pause', 'break_start'].includes(type) && lastCheckIn) {
            const checkOut = new Date(event.timestamp);
            total += (checkOut.getTime() - lastCheckIn.getTime()) / 60000;
            lastCheckIn = null;
        }
    }

    // Ongoing shift?
    if (lastCheckIn) {
        const now = new Date();
        total += (now.getTime() - lastCheckIn.getTime()) / 60000;
    }

    return total;
}

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
    })
}

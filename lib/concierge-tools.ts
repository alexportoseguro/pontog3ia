// Gemini Function Calling Tool Definitions for Concierge AI

export const conciergeTools = [
    {
        name: "get_work_hours",
        description: "Busca as horas trabalhadas de um funcionário em um período específico. Retorna total de horas, breakdown por dia, e comparação com meta.",
        parameters: {
            type: "object",
            properties: {
                userId: {
                    type: "string",
                    description: "ID do funcionário no sistema"
                },
                startDate: {
                    type: "string",
                    description: "Data inicial no formato YYYY-MM-DD. Se não fornecida, usa início da semana atual."
                },
                endDate: {
                    type: "string",
                    description: "Data final no formato YYYY-MM-DD. Se não fornecida, usa data atual."
                }
            },
            required: ["userId"]
        }
    },
    {
        name: "register_time_event",
        description: "Registra um evento de ponto manual (entrada, saída, início/fim de intervalo). Cria justificativa automática. Requer aprovação do gestor.",
        parameters: {
            type: "object",
            properties: {
                userId: {
                    type: "string",
                    description: "ID do funcionário"
                },
                eventType: {
                    type: "string",
                    enum: ["CHECK_IN", "CHECK_OUT", "BREAK_START", "BREAK_END"],
                    description: "Tipo de evento de ponto"
                },
                timestamp: {
                    type: "string",
                    description: "Data/hora do evento no formato ISO 8601. Se não fornecida, usa agora."
                },
                reason: {
                    type: "string",
                    description: "Motivo/justificativa do registro manual"
                }
            },
            required: ["userId", "eventType", "reason"]
        }
    },
    {
        name: "get_shift_schedule",
        description: "Consulta a escala de trabalho de um funcionário para uma data específica ou período. Retorna horários, tipo de jornada, e folgas.",
        parameters: {
            type: "object",
            properties: {
                userId: {
                    type: "string",
                    description: "ID do funcionário"
                },
                date: {
                    type: "string",
                    description: "Data para consultar escala no formato YYYY-MM-DD. Se não fornecida, usa hoje."
                },
                daysAhead: {
                    type: "number",
                    description: "Número de dias futuros para consultar (padrão: 7)"
                }
            },
            required: ["userId"]
        }
    },
    {
        name: "get_team_status",
        description: "Mostra status atual da equipe: quem está trabalhando, em intervalo, ou ausente. Inclui localização se disponível.",
        parameters: {
            type: "object",
            properties: {
                userId: {
                    type: "string",
                    description: "ID do usuário solicitante (para verificar permissões)"
                },
                includeLocation: {
                    type: "boolean",
                    description: "Se deve incluir localização GPS dos funcionários (padrão: false)"
                }
            },
            required: ["userId"]
        }
    },
    {
        name: "get_week_summary",
        description: "Gera um resumo detalhado da semana de trabalho: horas totais, dias trabalhados, atrasos, horas extras, e comparação com meta.",
        parameters: {
            type: "object",
            properties: {
                userId: {
                    type: "string",
                    description: "ID do funcionário"
                },
                weekOffset: {
                    type: "number",
                    description: "Offset de semanas (0 = semana atual, -1 = semana passada, padrão: 0)"
                }
            },
            required: ["userId"]
        }
    },
    {
        name: "request_time_off",
        description: "Solicita folga, férias ou ausência. Cria solicitação pendente de aprovação do gestor.",
        parameters: {
            type: "object",
            properties: {
                userId: {
                    type: "string",
                    description: "ID do funcionário"
                },
                startDate: {
                    type: "string",
                    description: "Data inicial da ausência (YYYY-MM-DD)"
                },
                endDate: {
                    type: "string",
                    description: "Data final da ausência (YYYY-MM-DD)"
                },
                reason: {
                    type: "string",
                    description: "Motivo da solicitação"
                },
                type: {
                    type: "string",
                    enum: ["VACATION", "SICK_LEAVE", "PERSONAL", "OTHER"],
                    description: "Tipo de ausência"
                }
            },
            required: ["userId", "startDate", "endDate", "reason", "type"]
        }
    }
]

// Helper to execute a tool
export async function executeTool(toolName: string, args: any) {
    const endpoint = `/api/ai-concierge/tools/${toolName.replace(/_/g, '-')}`

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(args)
        })

        if (!response.ok) {
            throw new Error(`Tool execution failed: ${response.statusText}`)
        }

        return await response.json()
    } catch (error) {
        console.error(`Error executing tool ${toolName}:`, error)
        throw error
    }
}

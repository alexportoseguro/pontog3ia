
import { useEffect, useState } from 'react'

type AuditLog = {
    id: string
    action: string
    created_at: string
    details: any
    profiles?: { full_name: string; email: string }
    old_data?: any
    new_data?: any
}

export default function AuditHistory({ recordId, userId }: { recordId?: string, userId?: string }) {
    const [logs, setLogs] = useState<AuditLog[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function fetchLogs() {
            try {
                const params = new URLSearchParams()
                if (recordId) params.append('recordId', recordId)
                if (userId) params.append('userId', userId)

                const res = await fetch(`/api/audit-logs?${params.toString()}`)
                if (res.ok) {
                    const data = await res.json()
                    setLogs(data)
                }
            } catch (err) {
                console.error('Failed to fetch audit logs', err)
            } finally {
                setLoading(false)
            }
        }
        if (recordId || userId) fetchLogs()
    }, [recordId, userId])

    if (loading) return <div className="p-4 text-center text-gray-500">Carregando histórico...</div>
    if (logs.length === 0) return <div className="p-4 text-center text-gray-500">Nenhum registro encontrado.</div>

    return (
        <div className="space-y-4 max-h-96 overflow-y-auto p-2">
            {logs.map(log => (
                <div key={log.id} className="border-l-2 border-gray-200 pl-4 py-2 text-sm relative">
                    <div className="absolute -left-[5px] top-3 w-2.5 h-2.5 rounded-full bg-gray-300"></div>
                    <div className="flex justify-between items-start">
                        <span className="font-semibold text-gray-800">{formatAction(log.action)}</span>
                        <span className="text-xs text-gray-500">{new Date(log.created_at).toLocaleString()}</span>
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                        Por: <span className="font-medium">{log.profiles?.full_name || 'Sistema'}</span>
                    </div>
                    {/* Diff or Details */}
                    {renderDetails(log)}
                </div>
            ))}
        </div>
    )
}

function formatAction(action: string) {
    const map: any = {
        'CREATE_EMPLOYEE': 'Funcionário Criado',
        'UPDATE_EMPLOYEE': 'Funcionário Atualizado',
        'MANUAL_TIME_ENTRY': 'Ponto Manual',
        'TEST_AUDIT': 'Teste de Sistema'
    }
    return map[action] || action
}

function renderDetails(log: AuditLog) {
    if (log.action === 'MANUAL_TIME_ENTRY') {
        const d = log.new_data || log.details
        return (
            <div className="mt-1 bg-gray-50 p-2 rounded">
                <p>Tipo: {d.type}</p>
                <p>Motivo: {d.reason}</p>
                <p>Horário: {new Date(d.timestamp).toLocaleString()}</p>
            </div>
        )
    }
    if (log.action === 'CREATE_EMPLOYEE') {
        const d = log.new_data || log.details
        return (
            <div className="mt-1 bg-gray-50 p-2 rounded truncate">
                Nome: {d.name} | Role: {d.role}
            </div>
        )
    }
    return <pre className="mt-1 text-xs bg-gray-50 p-2 rounded overflow-x-auto">{JSON.stringify(log.new_data || log.details, null, 2)}</pre>
}

'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import {
    ShieldCheckIcon,
    MagnifyingGlassIcon,
    FunnelIcon,
    ClockIcon,
    UserIcon,
    DocumentTextIcon
} from '@heroicons/react/24/outline'

type AuditLog = {
    id: string
    created_at: string
    action: string
    details: any
    ip_address: string
    user_id: string
    user?: {
        full_name: string
        email: string
        role: string
    }
}

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function AuditPage() {
    const [logs, setLogs] = useState<AuditLog[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState('')
    // Client initialized globally

    useEffect(() => {
        fetchLogs()
    }, [])

    async function fetchLogs() {
        setLoading(true)
        try {
            // Fetch logs with user details
            // Note: audit_logs usually relate to profiles via user_id
            const { data, error } = await supabase
                .from('audit_logs')
                .select(`
                    *,
                    user:user_id (
                        full_name,
                        email,
                        role
                    )
                `)
                .order('created_at', { ascending: false })
                .limit(100)

            if (error) throw error
            setLogs(data || [])
        } catch (error) {
            console.error('Error fetching audit logs:', error)
        } finally {
            setLoading(false)
        }
    }

    const getActionColor = (action: string) => {
        if (action.includes('DELETE')) return 'text-rose-600 bg-rose-50 border-rose-100'
        if (action.includes('UPDATE')) return 'text-amber-600 bg-amber-50 border-amber-100'
        if (action.includes('CREATE') || action.includes('INSERT')) return 'text-emerald-600 bg-emerald-50 border-emerald-100'
        return 'text-slate-600 bg-slate-50 border-slate-100'
    }

    const filteredLogs = logs.filter(log =>
        log.action.toLowerCase().includes(filter.toLowerCase()) ||
        log.user?.full_name?.toLowerCase().includes(filter.toLowerCase()) ||
        JSON.stringify(log.details).toLowerCase().includes(filter.toLowerCase())
    )

    return (
        <div className="min-h-screen animate-fade-in -m-4 md:-m-0 rounded-3xl overflow-hidden bg-slate-50">
            {/* Header */}
            <div className="glass-effect p-8 border-b border-slate-200/50 relative z-30">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-indigo-50 rounded-xl">
                                <ShieldCheckIcon className="h-6 w-6 text-indigo-600" />
                            </div>
                            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Auditoria & Segurança</h1>
                        </div>
                        <p className="text-slate-500 font-medium">Histórico completo de ações e alterações no sistema.</p>
                    </div>

                    <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm w-full lg:w-96">
                        <MagnifyingGlassIcon className="h-5 w-5 text-slate-400 ml-2" />
                        <input
                            type="text"
                            placeholder="Buscar por ação, usuário ou detalhes..."
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            className="flex-1 bg-transparent border-none focus:ring-0 text-sm font-medium text-slate-700 placeholder:text-slate-400"
                        />
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="p-8">
                <div className="premium-card bg-white/90 backdrop-blur-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-100 bg-slate-50/50">
                                    <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Data / Hora</th>
                                    <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Usuário</th>
                                    <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Ação</th>
                                    <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Detalhes</th>
                                    <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">IP</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {loading ? (
                                    [...Array(5)].map((_, i) => (
                                        <tr key={i} className="animate-pulse">
                                            <td className="p-5"><div className="h-4 w-24 bg-slate-100 rounded"></div></td>
                                            <td className="p-5"><div className="h-8 w-8 bg-slate-100 rounded-full"></div></td>
                                            <td className="p-5"><div className="h-6 w-32 bg-slate-100 rounded"></div></td>
                                            <td className="p-5"><div className="h-4 w-48 bg-slate-100 rounded"></div></td>
                                            <td className="p-5"><div className="h-4 w-20 bg-slate-100 rounded ml-auto"></div></td>
                                        </tr>
                                    ))
                                ) : filteredLogs.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="p-20 text-center text-slate-400">
                                            <ShieldCheckIcon className="h-12 w-12 mx-auto mb-4 opacity-20" />
                                            <p className="font-medium">Nenhum registro encontrado</p>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredLogs.map(log => (
                                        <tr key={log.id} className="hover:bg-slate-50/80 transition-colors group">
                                            <td className="p-5">
                                                <div className="flex flex-col gap-1 text-slate-500 font-medium text-xs">
                                                    <div className="flex items-center gap-2">
                                                        <ClockIcon className="h-4 w-4 text-slate-300" />
                                                        {new Date(log.created_at).toLocaleDateString('pt-BR')}
                                                    </div>
                                                    <div className="text-[10px] text-slate-400 ml-6">
                                                        {new Date(log.created_at).toLocaleTimeString('pt-BR')}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-5">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs ring-2 ring-white shadow-sm">
                                                        {log.user?.full_name?.charAt(0) || '?'}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-slate-700">{log.user?.full_name || 'Sistema'}</p>
                                                        <p className="text-[10px] text-slate-400 font-medium">{log.user?.email || '---'}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-5">
                                                <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${getActionColor(log.action)}`}>
                                                    {log.action}
                                                </span>
                                            </td>
                                            <td className="p-5">
                                                <div className="flex flex-col gap-2 max-w-md">
                                                    {log.details && Object.keys(log.details).length > 0 && (
                                                        <div className="text-[10px] text-slate-500 bg-slate-50 p-2 rounded border border-slate-100 font-mono overflow-auto max-h-32">
                                                            <pre>{JSON.stringify(log.details, null, 2)}</pre>
                                                        </div>
                                                    )}
                                                    {(log as any).old_data || (log as any).new_data ? (
                                                        <div className="flex gap-2 text-[9px] font-mono">
                                                            {(log as any).old_data && (
                                                                <div className="flex-1 bg-red-50/50 p-1 rounded border border-red-100 truncate">
                                                                    <span className="text-red-600 font-bold uppercase block mb-1">Old Data</span>
                                                                    {JSON.stringify((log as any).old_data)}
                                                                </div>
                                                            )}
                                                            {(log as any).new_data && (
                                                                <div className="flex-1 bg-emerald-50/50 p-1 rounded border border-emerald-100 truncate">
                                                                    <span className="text-emerald-600 font-bold uppercase block mb-1">New Data</span>
                                                                    {JSON.stringify((log as any).new_data)}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : null}
                                                </div>
                                            </td>
                                            <td className="p-5 text-right">
                                                <span className="text-[10px] font-mono text-slate-400 bg-slate-50 px-2 py-1 rounded border border-slate-100">
                                                    {log.ip_address || '---'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    )
}

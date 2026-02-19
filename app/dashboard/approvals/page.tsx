'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import {
    CheckCircleIcon,
    XCircleIcon,
    ClockIcon,
    UserGroupIcon,
    CalendarDaysIcon,
    DocumentTextIcon,
    FunnelIcon,
    ArchiveBoxIcon
} from '@heroicons/react/24/outline'

type ApprovalItem = {
    id: string
    type: 'justification' | 'time_off' | 'time_event'
    employee_name: string
    status: 'pending' | 'approved' | 'rejected'
    created_at: string
    approved_at?: string
    approved_by?: string
    approver_name?: string
    rejection_reason?: string
    // Justification fields
    description?: string
    type_name?: string
    // Time off fields
    start_date?: string
    end_date?: string
    reason?: string
    days_count?: number
    // Time event fields
    event_type?: string
    timestamp?: string
    related_justification?: string
}

export default function ApprovalsPage() {
    const [items, setItems] = useState<ApprovalItem[]>([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<'all' | 'justifications' | 'time_off' | 'time_events'>('all')
    const [viewMode, setViewMode] = useState<'pending' | 'history'>('pending')
    const [historyFilter, setHistoryFilter] = useState<'approved' | 'rejected'>('approved')
    const [searchTerm, setSearchTerm] = useState('')
    const [counts, setCounts] = useState({ justifications: 0, timeOffRequests: 0, manualTimeEvents: 0 })

    // RBAC
    const [role, setRole] = useState<'admin' | 'manager' | 'employee' | null>(null)
    const [currentUserId, setCurrentUserId] = useState<string | null>(null)

    useEffect(() => {
        checkUserRole()
    }, [])

    useEffect(() => {
        // Only fetch when we know the role to avoid fetching all data for employee then filtering
        if (role) {
            fetchApprovals()
        }
    }, [activeTab, viewMode, historyFilter, role])

    async function checkUserRole() {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
            setCurrentUserId(user.id)
            const { data: profile } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', user.id)
                .single()
            setRole(profile?.role || 'employee')
        }
    }

    async function fetchApprovals() {
        setLoading(true)
        try {
            const filter = activeTab === 'all' ? 'all' : activeTab
            // If viewMode is history, use the specific historyFilter status, otherwise 'pending'
            const status = viewMode === 'history' ? historyFilter : 'pending'

            const { data: { session } } = await supabase.auth.getSession()
            const headers: any = {}
            if (session?.access_token) {
                headers['Authorization'] = `Bearer ${session.access_token}`
            }

            const res = await fetch(`/api/approvals?filter=${filter}&status=${status}`, { headers })
            const data = await res.json()

            if (data.error) throw new Error(data.error)

            let fetchedItems = data.all || []
            let fetchedCounts = data.counts || { justifications: 0, timeOffRequests: 0, manualTimeEvents: 0 }

            if (!Array.isArray(fetchedItems)) {
                console.error('Expected array for approvals but got:', fetchedItems)
                fetchedItems = []
            }

            // Client-side filtering for Employee (Security Note: API handles isolation, but we filter for personal view)
            if (role === 'employee' && currentUserId) {
                fetchedItems = fetchedItems.filter((i: any) => i.user_id === currentUserId)
                // Recalculate counts for employee
                fetchedCounts = {
                    justifications: fetchedItems.filter((i: any) => i.type === 'justification').length,
                    timeOffRequests: fetchedItems.filter((i: any) => i.type === 'time_off').length,
                    manualTimeEvents: fetchedItems.filter((i: any) => i.type === 'time_event').length
                }
            }

            setItems(fetchedItems)
            if (viewMode === 'pending') {
                setCounts(fetchedCounts)
            }
        } catch (error) {
            console.error('Error fetching approvals:', error)
            setItems([])
        } finally {
            setLoading(false)
        }
    }

    async function handleAction(item: ApprovalItem, action: 'approved' | 'rejected') {
        if (role === 'employee') return // Double check

        const rejectionReason = action === 'rejected'
            ? prompt('Motivo da rejeição:')
            : undefined

        if (action === 'rejected' && !rejectionReason) {
            alert('Motivo da rejeição é obrigatório')
            return
        }

        try {
            const { data: { session } } = await supabase.auth.getSession()
            const headers: any = { 'Content-Type': 'application/json' }
            if (session?.access_token) {
                headers['Authorization'] = `Bearer ${session.access_token}`
            }

            const res = await fetch('/api/approvals', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    type: item.type,
                    id: item.id,
                    action,
                    rejectionReason,
                    managerId: currentUserId
                })
            })

            if (!res.ok) {
                const errData = await res.json()
                throw new Error(errData.error || 'Falha ao processar')
            }

            // Remove from list
            setItems(items.filter(i => i.id !== item.id))

            // Update counts locally
            const key = item.type === 'justification' ? 'justifications' :
                item.type === 'time_off' ? 'timeOffRequests' : 'manualTimeEvents'
            setCounts(prev => ({ ...prev, [key as keyof typeof counts]: Math.max(0, prev[key as keyof typeof counts] - 1) }))

        } catch (error: any) {
            alert('Erro: ' + error.message)
        }
    }

    const filteredItems = items.filter(item =>
        item.employee_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.reason?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const totalPending = counts.justifications + counts.timeOffRequests + counts.manualTimeEvents

    return (
        <div className="space-y-8 animate-fade-in p-4 md:p-0">
            {/* Header & Stats Section */}
            <div className="glass-effect p-8 rounded-3xl shadow-xl shadow-slate-200/50">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 mb-10">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-indigo-50 rounded-xl">
                                {viewMode === 'pending' ? (
                                    <CheckCircleIcon className="h-6 w-6 text-indigo-600" />
                                ) : (
                                    <ArchiveBoxIcon className="h-6 w-6 text-indigo-600" />
                                )}
                            </div>
                            <h1 className="text-3xl font-black text-slate-900 tracking-tight">
                                {viewMode === 'pending'
                                    ? (role === 'employee' ? 'Minhas Solicitações' : 'Aprovações Pendentes')
                                    : (role === 'employee' ? 'Meu Histórico' : 'Histórico de Solicitações')}
                            </h1>
                        </div>
                        <p className="text-slate-500 font-medium">
                            {viewMode === 'pending'
                                ? (role === 'employee' ? 'Acompanhe o status e progresso dos seus pedidos.' : 'Gerencie e neutralize solicitações pendentes da sua equipe.')
                                : 'Visualize e audite solicitações processadas anteriormente.'}
                        </p>
                    </div>

                    {viewMode === 'pending' && (
                        <div className="premium-card bg-indigo-600 p-6 rounded-2xl flex items-center gap-6 min-w-[200px]">
                            <div className="h-12 w-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-md">
                                <span className="text-2xl font-black text-white">{totalPending}</span>
                            </div>
                            <div>
                                <p className="text-white/70 text-[10px] font-black uppercase tracking-widest leading-none">Total</p>
                                <p className="text-white font-bold text-lg mt-1">Pendentes</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Sub-stats Cards */}
                {viewMode === 'pending' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <SmallStatCard
                            title="Justificativas"
                            value={counts.justifications}
                            icon={DocumentTextIcon}
                            color="text-blue-600"
                            bg="bg-blue-50"
                        />
                        <SmallStatCard
                            title="Folgas & Férias"
                            value={counts.timeOffRequests}
                            icon={CalendarDaysIcon}
                            color="text-violet-600"
                            bg="bg-violet-50"
                        />
                        <SmallStatCard
                            title="Ajustes de Ponto"
                            value={counts.manualTimeEvents}
                            icon={ClockIcon}
                            color="text-emerald-600"
                            bg="bg-emerald-50"
                        />
                    </div>
                )}
            </div>

            {/* Controls Bar */}
            <div className="premium-card p-4 flex flex-col md:flex-row items-center gap-6 bg-white/80 backdrop-blur-sm sticky top-0 z-20">
                <div className="flex bg-slate-100 p-1 rounded-2xl w-full md:w-auto">
                    <button
                        onClick={() => setViewMode('pending')}
                        className={`flex-1 md:flex-none px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${viewMode === 'pending' ? 'bg-white shadow-lg text-indigo-600' : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        Pendentes
                    </button>
                    <button
                        onClick={() => setViewMode('history')}
                        className={`flex-1 md:flex-none px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${viewMode === 'history' ? 'bg-white shadow-lg text-indigo-600' : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        Histórico
                    </button>
                </div>

                <div className="flex-1 flex flex-wrap items-center gap-3">
                    {[
                        { key: 'all', label: 'Todos', icon: FunnelIcon },
                        { key: 'justifications', label: 'Justificativas', icon: DocumentTextIcon },
                        { key: 'time_off', label: 'Folgas', icon: CalendarDaysIcon },
                        { key: 'time_events', label: 'Pontos', icon: ClockIcon }
                    ].map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key as any)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${activeTab === tab.key
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-200'
                                : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                                }`}
                        >
                            <tab.icon className="h-3.5 w-3.5" />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {viewMode === 'history' && (
                    <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-2xl border border-slate-100">
                        <button
                            onClick={() => setHistoryFilter('approved')}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${historyFilter === 'approved' ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-500'
                                }`}
                        >
                            Aprovados
                        </button>
                        <button
                            onClick={() => setHistoryFilter('rejected')}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${historyFilter === 'rejected' ? 'bg-rose-500 text-white shadow-lg' : 'text-slate-500'
                                }`}
                        >
                            Rejeitados
                        </button>
                    </div>
                )}

                <div className="relative w-full md:w-64">
                    <input
                        type="text"
                        placeholder="Buscar por colaborador..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-2.5 text-sm font-medium text-slate-700 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 transition-all pl-11"
                    />
                    <FunnelIcon className="h-4 w-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                </div>
            </div>

            {/* Content Area */}
            <div className="space-y-6">
                {loading ? (
                    <div className="py-24 flex flex-col items-center justify-center space-y-4">
                        <div className="h-12 w-12 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin"></div>
                        <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Sincronizando dados...</p>
                    </div>
                ) : filteredItems.length === 0 ? (
                    <div className="premium-card p-24 text-center bg-white">
                        <div className="h-24 w-24 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-6 text-slate-200">
                            <ArchiveBoxIcon className="h-12 w-12" />
                        </div>
                        <h3 className="text-xl font-black text-slate-800 tracking-tight">Tudo em ordem!</h3>
                        <p className="text-slate-400 font-medium mt-2 max-w-sm mx-auto">
                            {viewMode === 'pending'
                                ? 'Nenhuma solicitação pendente encontrada para os critérios selecionados.'
                                : 'Seu histórico está vazio para este filtro.'}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-6">
                        {filteredItems.map(item => (
                            <ApprovalCard
                                key={item.id}
                                item={item}
                                viewMode={viewMode}
                                onAction={handleAction}
                                role={role}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

function SmallStatCard({ title, value, icon: Icon, color, bg }: any) {
    return (
        <div className="premium-card p-6 flex items-center justify-between hover:scale-[1.02] active:scale-[0.98] bg-white">
            <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl ${bg} shadow-inner`}>
                    <Icon className={`w-5 h-5 ${color}`} />
                </div>
                <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">{title}</p>
                    <p className="text-2xl font-black text-slate-900 mt-1">{value}</p>
                </div>
            </div>
        </div>
    )
}

// Approval Card Component
function ApprovalCard({
    item,
    viewMode,
    onAction,
    role
}: {
    item: ApprovalItem,
    viewMode: 'pending' | 'history',
    onAction: (item: ApprovalItem, action: 'approved' | 'rejected') => void,
    role: string | null
}) {
    const typeConfig: { [key: string]: { icon: string; color: string; badge: string } } = {
        justification: {
            icon: '📝',
            color: 'bg-blue-50 border-blue-200',
            badge: 'bg-blue-100 text-blue-700 border-blue-200'
        },
        time_off: {
            icon: '🏖️',
            color: 'bg-purple-50 border-purple-200',
            badge: 'bg-purple-100 text-purple-700 border-purple-200'
        },
        time_event: {
            icon: '⏰',
            color: 'bg-amber-50 border-amber-200',
            badge: 'bg-amber-100 text-amber-700 border-amber-200'
        }
    }

    // Safely handle missing/invalid types by defaulting to 'justification'
    const itemType = item.type || 'justification'
    const config = typeConfig[itemType] || typeConfig.justification

    // Ajuste visual para itens de histórico
    const containerClasses = viewMode === 'history'
        ? `p-6 rounded-2xl border ${item.status === 'approved' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'} shadow-sm`
        : `p-6 rounded-2xl border-2 ${config.color} shadow-sm hover:shadow-md transition-all`

    const getTypeLabel = () => {
        if (item.type === 'justification') {
            const labels: any = {
                'LATE_ARRIVAL': '⏳ Atraso',
                'SICK_LEAVE': '🏥 Médico/Doença',
                'EXTERNAL_ERRAND': '🏦 Externo',
                'MANUAL_ENTRY': '✏️ Manual'
            }
            return labels[item.type_name || ''] || item.type_name
        }
        if (item.type === 'time_off') {
            const labels: any = {
                'VACATION': '🏖️ Férias',
                'SICK_LEAVE': '🏥 Atestado',
                'PERSONAL': '🙋 Pessoal',
                'OTHER': '📋 Outro'
            }
            return labels[item.type_name || ''] || 'Folga'
        }
        if (item.type === 'time_event') {
            const labels: any = {
                'CHECK_IN': '🔵 Entrada',
                'CHECK_OUT': '🔴 Saída',
                'BREAK_START': '⏸️ Início Intervalo',
                'BREAK_END': '▶️ Fim Intervalo'
            }
            return labels[item.event_type || ''] || 'Ponto Manual'
        }
    }

    return (
        <div className={containerClasses}>
            <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                        <span className="text-3xl">{config.icon}</span>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-lg font-bold text-gray-900">{item.employee_name}</h3>
                                {viewMode === 'history' && (
                                    <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${item.status === 'approved' ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'
                                        }`}>
                                        {item.status === 'approved' ? 'Aprovado' : 'Rejeitado'}
                                    </span>
                                )}
                            </div>
                            <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold border ${config.badge}`}>
                                {getTypeLabel()}
                            </span>
                        </div>
                    </div>

                    {/* Content based on type */}
                    {item.type === 'justification' && (
                        <p className="text-gray-700 mt-3 text-sm leading-relaxed">{item.description}</p>
                    )}

                    {item.type === 'time_off' && (
                        <div className="mt-3 space-y-2">
                            <div className="flex items-center gap-2 text-sm">
                                <CalendarDaysIcon className="h-4 w-4 text-gray-400" />
                                <span className="font-medium text-gray-700">
                                    {new Date(item.start_date!).toLocaleDateString('pt-BR')}
                                    →
                                    {new Date(item.end_date!).toLocaleDateString('pt-BR')}
                                </span>
                                <span className="text-gray-500">({item.days_count} dia{item.days_count !== 1 ? 's' : ''})</span>
                            </div>
                            <p className="text-gray-600 text-sm">{item.reason}</p>
                        </div>
                    )}

                    {item.type === 'time_event' && (
                        <div className="mt-3 space-y-2">
                            <div className="flex items-center gap-2 text-sm">
                                <ClockIcon className="h-4 w-4 text-gray-400" />
                                <span className="font-medium text-gray-700">
                                    {item.timestamp ? new Date(item.timestamp).toLocaleString('pt-BR') : 'Sem data'}
                                </span>
                            </div>
                            {item.related_justification && (
                                <p className="text-gray-600 text-sm italic">"{item.related_justification}"</p>
                            )}
                        </div>
                    )}

                    <div className="flex items-center gap-4 mt-4 text-xs text-gray-400">
                        <div className="flex items-center gap-1">
                            <ClockIcon className="h-4 w-4" />
                            <span>Solicitado {formatTimeAgo(item.created_at)}</span>
                        </div>
                        {viewMode === 'history' && item.approver_name && (
                            <div className="flex items-center gap-1">
                                <CheckCircleIcon className="h-4 w-4" />
                                <span>Processado por {item.approver_name}</span>
                            </div>
                        )}
                    </div>

                    {/* Rejection Reason display */}
                    {viewMode === 'history' && item.status === 'rejected' && item.rejection_reason && (
                        <div className="mt-3 bg-red-100 p-3 rounded-lg border border-red-200">
                            <p className="text-xs font-bold text-red-800 uppercase mb-1">Motivo da Rejeição:</p>
                            <p className="text-sm text-red-900">{item.rejection_reason}</p>
                        </div>
                    )}
                </div>

                {/* Actions - Only in Pending Mode AND NOT EMPLOYEE */}
                {viewMode === 'pending' && role !== 'employee' && (
                    <div className="flex flex-col gap-2 ml-4">
                        <button
                            onClick={() => onAction(item, 'rejected')}
                            className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg font-medium text-sm hover:bg-red-600 transition-all shadow-sm hover:shadow-md hover:scale-105 active:scale-95"
                        >
                            <XCircleIcon className="h-4 w-4" />
                            Rejeitar
                        </button>
                        <button
                            onClick={() => onAction(item, 'approved')}
                            className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg font-medium text-sm hover:bg-green-600 transition-all shadow-sm hover:shadow-md hover:scale-105 active:scale-95"
                        >
                            <CheckCircleIcon className="h-4 w-4" />
                            Aprovar
                        </button>
                    </div>
                )}
                {/* Employee Pending Status Indicator */}
                {viewMode === 'pending' && role === 'employee' && (
                    <div className="flex flex-col gap-2 ml-4">
                        <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-semibold border border-yellow-200">
                            Aguardando Análise
                        </span>
                    </div>
                )}
            </div>
        </div>
    )
}

function formatTimeAgo(timestamp: string) {
    if (!timestamp) return ''
    const minutes = Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000)
    if (minutes < 1) return 'agora'
    if (minutes < 60) return `há ${minutes}min`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `há ${hours}h`
    return `há ${Math.floor(hours / 24)}d`
}

'use client'
import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { UsersIcon, MapPinIcon, ClockIcon, ArrowPathIcon, XMarkIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Dynamically import Map to avoid SSR issues with Leaflet
const LocationMap = dynamic(() => import('../../../components/LocationMap'), {
    ssr: false,
    loading: () => (
        <div className="h-full w-full flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600 mb-4"></div>
            <p className="text-gray-600 font-medium">Carregando Mapa...</p>
        </div>
    )
})

type EmployeeDetail = {
    user_id: string
    full_name: string
    role: string
    current_status: string
    latitude: number
    longitude: number
    timestamp: string
    events?: TimeEvent[]
    hoursWorked?: number
}

type TimeEvent = {
    id: string
    event_type: string
    timestamp: string
    is_flagged?: boolean
}

export default function MapPage() {
    const [locations, setLocations] = useState<any[]>([])
    const [filteredLocations, setFilteredLocations] = useState<any[]>([])
    const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
    const [statusFilter, setStatusFilter] = useState('all')
    const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null)
    const [isRefreshing, setIsRefreshing] = useState(false)

    // Detail drawer state
    const [drawerEmployee, setDrawerEmployee] = useState<EmployeeDetail | null>(null)
    const [isDrawerOpen, setIsDrawerOpen] = useState(false)
    const [loadingDetails, setLoadingDetails] = useState(false)

    async function fetchLocations() {
        setIsRefreshing(true)
        try {
            const { data: { session } } = await supabase.auth.getSession()
            const headers: any = {}
            if (session?.access_token) {
                headers['Authorization'] = `Bearer ${session.access_token}`
            }

            const res = await fetch('/api/locations', { headers })

            if (!res.ok) {
                console.warn(`Locations API Warning: ${res.status} ${res.statusText}`)
                setLocations([])
                return
            }

            const data = await res.json()
            if (Array.isArray(data)) {
                setLocations(data)
                setLastUpdate(new Date())
            } else {
                console.warn('Invalid locations format:', data)
                setLocations([])
            }
        } catch (error) {
            console.error('Failed to fetch locations', error)
            setLocations([])
        } finally {
            setTimeout(() => setIsRefreshing(false), 500)
        }
    }

    async function fetchEmployeeDetails(loc: any) {
        setLoadingDetails(true)
        setDrawerEmployee({ ...loc, events: [], hoursWorked: 0 })
        setIsDrawerOpen(true)

        try {
            const { data: { session } } = await supabase.auth.getSession()

            // Fetch today's time events for this user
            const todayStart = new Date()
            todayStart.setHours(0, 0, 0, 0)

            const { data: events } = await supabase
                .from('time_events')
                .select('id, event_type, timestamp, is_flagged')
                .eq('user_id', loc.user_id)
                .gte('timestamp', todayStart.toISOString())
                .order('timestamp', { ascending: true })

            // Calculate hours worked today
            let hoursWorked = 0
            if (events && events.length > 0) {
                let workStart: Date | null = null
                let breakStart: Date | null = null
                let totalBreakMs = 0
                let totalWorkMs = 0

                for (const evt of events) {
                    const t = new Date(evt.timestamp)
                    if (evt.event_type === 'clock_in') {
                        workStart = t
                    } else if (evt.event_type === 'break_start' && workStart) {
                        totalWorkMs += t.getTime() - workStart.getTime()
                        breakStart = t
                        workStart = null
                    } else if (evt.event_type === 'break_end') {
                        if (breakStart) totalBreakMs += t.getTime() - breakStart.getTime()
                        workStart = t
                        breakStart = null
                    } else if (evt.event_type === 'clock_out' && workStart) {
                        totalWorkMs += t.getTime() - workStart.getTime()
                        workStart = null
                    }
                }

                // If still working (no clock_out yet)
                if (workStart) {
                    totalWorkMs += Date.now() - workStart.getTime()
                }

                hoursWorked = totalWorkMs / (1000 * 60 * 60)
            }

            setDrawerEmployee({ ...loc, events: events || [], hoursWorked })
        } catch (error) {
            console.error('Error fetching employee details:', error)
        } finally {
            setLoadingDetails(false)
        }
    }

    function openDetails(loc: any) {
        fetchEmployeeDetails(loc)
    }

    function closeDrawer() {
        setIsDrawerOpen(false)
        setTimeout(() => setDrawerEmployee(null), 300)
    }

    function viewOnMap(userId: string) {
        setSelectedEmployee(userId)
        closeDrawer()
    }

    useEffect(() => {
        fetchLocations()
        const interval = setInterval(fetchLocations, 30000)
        return () => clearInterval(interval)
    }, [])

    // Apply filters
    useEffect(() => {
        let filtered = locations
        if (statusFilter !== 'all') {
            filtered = filtered.filter(loc => loc.current_status === statusFilter)
        }
        setFilteredLocations(filtered)
    }, [locations, statusFilter])

    // Calculate stats
    const stats = {
        total: locations.length,
        working: locations.filter(l => l.current_status === 'working').length,
        break: locations.filter(l => l.current_status === 'break').length,
        offline: locations.filter(l => !l.current_status || l.current_status === 'out').length
    }

    function getStatusBadge(status: string) {
        const badges: Record<string, { label: string; color: string; dot: string; bg: string }> = {
            working: { label: 'Trabalhando', color: 'text-emerald-700', dot: 'bg-emerald-500', bg: 'bg-emerald-50 border border-emerald-200' },
            break: { label: 'Intervalo', color: 'text-amber-700', dot: 'bg-amber-500', bg: 'bg-amber-50 border border-amber-200' },
            out: { label: 'Ausente', color: 'text-rose-700', dot: 'bg-rose-500', bg: 'bg-rose-50 border border-rose-200' },
            offline: { label: 'Offline', color: 'text-slate-600', dot: 'bg-slate-400', bg: 'bg-slate-100 border border-slate-200' }
        }
        return badges[status] || badges.offline
    }

    function formatTimeAgo(timestamp: string) {
        const minutes = Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000)
        if (minutes < 1) return 'agora'
        if (minutes < 60) return `há ${minutes}min`
        const hours = Math.floor(minutes / 60)
        if (hours < 24) return `há ${hours}h`
        return `há ${Math.floor(hours / 24)}d`
    }

    function formatTime(timestamp: string) {
        return new Date(timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    }

    function getEventInfo(type: string) {
        const map: Record<string, { label: string; icon: string; color: string; dot: string }> = {
            clock_in: { label: 'Entrada', icon: '🟢', color: 'text-emerald-700', dot: 'bg-emerald-500' },
            clock_out: { label: 'Saída', icon: '🔴', color: 'text-rose-700', dot: 'bg-rose-500' },
            break_start: { label: 'Início Intervalo', icon: '☕', color: 'text-amber-700', dot: 'bg-amber-400' },
            break_end: { label: 'Fim Intervalo', icon: '🔄', color: 'text-blue-700', dot: 'bg-blue-500' },
        }
        return map[type] || { label: type, icon: '📍', color: 'text-slate-600', dot: 'bg-slate-400' }
    }

    function formatHours(hours: number) {
        const h = Math.floor(hours)
        const m = Math.floor((hours - h) * 60)
        return `${h}h${m > 0 ? `${m.toString().padStart(2, '0')}m` : ''}`
    }

    return (
        <div className="h-[calc(100vh-4rem)] flex flex-col animate-fade-in -m-4 md:-m-0 rounded-3xl overflow-hidden">
            {/* Glass Header */}
            <div className="glass-effect p-8 border-b border-slate-200/50 relative z-30">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-indigo-50 rounded-xl">
                                <MapPinIcon className="h-6 w-6 text-indigo-600" />
                            </div>
                            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Geolocalização</h1>
                        </div>
                        <p className="text-slate-500 font-medium flex items-center gap-2">
                            Acompanhe sua equipe em tempo real através do mapa interativo.
                            <span className="h-1 w-1 bg-slate-300 rounded-full mx-1"></span>
                            {typeof window !== 'undefined' && (
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    Visto em {lastUpdate.toLocaleTimeString('pt-BR')}
                                </span>
                            )}
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">
                        <div className="hidden md:flex items-center gap-2 px-6 border-r border-slate-200 mr-2">
                            <div className="text-right">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Status da Rede</p>
                                <p className="text-xs font-bold text-emerald-500 mt-1">Sincronizado</p>
                            </div>
                            <div className="h-2 w-2 bg-emerald-500 rounded-full animate-pulse"></div>
                        </div>

                        <button
                            onClick={fetchLocations}
                            disabled={isRefreshing}
                            className="flex-1 lg:flex-none inline-flex items-center justify-center px-6 py-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-500/20 text-xs font-black uppercase tracking-widest text-white hover:bg-indigo-700 transition-all transform hover:scale-105 active:scale-95 disabled:opacity-50"
                        >
                            <ArrowPathIcon className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                            {isRefreshing ? 'Atualizando...' : 'Atualizar Mapa'}
                        </button>
                    </div>
                </div>

                {/* Sub-stats overview */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
                    {[
                        { label: 'Integrantes', value: stats.total, color: 'indigo', icon: '👥' },
                        { label: 'Em Campo', value: stats.working, color: 'emerald', icon: '📍' },
                        { label: 'Pausa', value: stats.break, color: 'amber', icon: '☕' },
                        { label: 'Offline', value: stats.offline, color: 'slate', icon: '💤' }
                    ].map((s) => (
                        <div key={s.label} className="bg-white/50 border border-slate-200/50 rounded-2xl p-3 flex items-center gap-3">
                            <span className="text-lg">{s.icon}</span>
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">{s.label}</p>
                                <p className="text-lg font-black text-slate-900">{s.value}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex overflow-hidden bg-slate-50">
                {/* Modern Sidebar */}
                <div className="w-96 bg-white/80 backdrop-blur-xl border-r border-slate-200/50 flex flex-col shadow-2xl z-20">
                    <div className="p-6 space-y-6">
                        <div className="space-y-2">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Filtrar por Status</p>
                            <div className="relative group">
                                <select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 text-xs font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 transition-all appearance-none cursor-pointer"
                                >
                                    <option value="all">🌐 Todos os Integrantes</option>
                                    <option value="working">🟢 Em Atividade</option>
                                    <option value="break">🟡 Em Intervalo</option>
                                    <option value="out">⚫ Offline / Ausente</option>
                                </select>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7"></path></svg>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between px-1">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                {filteredLocations.length} Resultados
                            </p>
                            <button onClick={fetchLocations} className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline">
                                Atualizar
                            </button>
                        </div>
                    </div>

                    {/* Scrollable List */}
                    <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-4 custom-scrollbar">
                        {filteredLocations.length === 0 ? (
                            <div className="py-20 text-center space-y-4">
                                <div className="h-20 w-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-200">
                                    <UsersIcon className="h-10 w-10" />
                                </div>
                                <p className="text-sm font-bold text-slate-400">Nenhum registro encontrado</p>
                            </div>
                        ) : (
                            filteredLocations.map((loc) => {
                                const statusBadge = getStatusBadge(loc.current_status)
                                const isSelected = selectedEmployee === loc.user_id
                                const initials = (loc.full_name || 'U').split(' ').map((n: any) => n[0]).join('').slice(0, 2).toUpperCase()

                                return (
                                    <div
                                        key={loc.user_id}
                                        className={`premium-card !p-4 transition-all duration-300 group ${isSelected
                                            ? 'ring-2 ring-indigo-500 bg-indigo-50/30'
                                            : 'bg-white hover:bg-slate-50'
                                            }`}
                                    >
                                        <div
                                            className="flex items-center gap-3 cursor-pointer"
                                            onClick={() => setSelectedEmployee(loc.user_id)}
                                        >
                                            <div className="h-12 w-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-black text-sm shadow-lg shadow-indigo-200">
                                                {initials}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="text-sm font-black text-slate-800 truncate group-hover:text-indigo-600 transition-colors">
                                                    {loc.full_name || 'Usuário'}
                                                </h4>
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    <span className={`h-1.5 w-1.5 rounded-full ${statusBadge.dot} ${loc.current_status === 'working' ? 'animate-pulse' : ''}`}></span>
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{statusBadge.label}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                                            <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                <ClockIcon className="h-3.5 w-3.5" />
                                                <span>{formatTimeAgo(loc.timestamp)}</span>
                                            </div>
                                            <button
                                                onClick={() => openDetails(loc)}
                                                className="flex items-center gap-1 text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:text-indigo-700 transition-colors group/btn"
                                            >
                                                Ver Detalhes
                                                <ChevronRightIcon className="h-3 w-3 transition-transform group-hover/btn:translate-x-0.5" />
                                            </button>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>

                {/* Map Container */}
                <div className="flex-1 relative">
                    <div className="absolute inset-0 z-10">
                        <LocationMap
                            locations={filteredLocations}
                            selectedUserId={selectedEmployee}
                            onMarkerClick={(userId) => setSelectedEmployee(userId)}
                        />
                    </div>

                    {/* Map Context Bar */}
                    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex items-center gap-4">
                        <div className="glass-effect !bg-slate-900/80 !backdrop-blur-md px-6 py-3 rounded-2xl shadow-2xl border border-white/10 flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <div className="h-2 w-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
                                <p className="text-[10px] font-black text-white uppercase tracking-widest leading-none">Mapa em Tempo Real</p>
                            </div>
                            <div className="h-4 w-px bg-white/20"></div>
                            <p className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest leading-none">
                                {filteredLocations.length} Conectados
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Employee Detail Drawer */}
            {/* Overlay */}
            {isDrawerOpen && (
                <div
                    className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 transition-opacity"
                    onClick={closeDrawer}
                />
            )}

            {/* Drawer Panel */}
            <div className={`fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-out ${isDrawerOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                {drawerEmployee && (
                    <>
                        {/* Drawer Header */}
                        <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-indigo-600 to-indigo-700">
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="h-14 w-14 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center text-white font-black text-xl shadow-lg">
                                        {(drawerEmployee.full_name || 'U').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-black text-white">{drawerEmployee.full_name || 'Usuário'}</h2>
                                        <p className="text-indigo-200 text-sm font-medium capitalize">{drawerEmployee.role || 'Colaborador'}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={closeDrawer}
                                    className="p-2 rounded-xl hover:bg-white/20 transition-colors text-white"
                                >
                                    <XMarkIcon className="h-5 w-5" />
                                </button>
                            </div>

                            {/* Status badge */}
                            <div className="mt-4">
                                {(() => {
                                    const badge = getStatusBadge(drawerEmployee.current_status)
                                    return (
                                        <span className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest bg-white/20 text-white border border-white/30`}>
                                            <span className={`h-2 w-2 rounded-full ${badge.dot} ${drawerEmployee.current_status === 'working' ? 'animate-pulse' : ''}`}></span>
                                            {badge.label}
                                        </span>
                                    )
                                })()}
                            </div>
                        </div>

                        {/* Drawer Content */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {loadingDetails ? (
                                <div className="py-20 flex flex-col items-center gap-3">
                                    <div className="animate-spin rounded-full h-10 w-10 border-b-4 border-indigo-600"></div>
                                    <p className="text-sm font-bold text-slate-400">Carregando detalhes...</p>
                                </div>
                            ) : (
                                <>
                                    {/* Stats Cards */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-center">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Horas Hoje</p>
                                            <p className="text-2xl font-black text-slate-900 mt-1">
                                                {drawerEmployee.hoursWorked && drawerEmployee.hoursWorked > 0
                                                    ? formatHours(drawerEmployee.hoursWorked)
                                                    : '—'}
                                            </p>
                                        </div>
                                        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-center">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Eventos</p>
                                            <p className="text-2xl font-black text-slate-900 mt-1">{drawerEmployee.events?.length || 0}</p>
                                        </div>
                                    </div>

                                    {/* Last Location */}
                                    <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4">
                                        <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                            <MapPinIcon className="h-3.5 w-3.5" />
                                            Última Localização
                                        </p>
                                        <div className="space-y-1">
                                            <p className="text-xs font-mono font-bold text-indigo-800">
                                                {drawerEmployee.latitude?.toFixed(6)}, {drawerEmployee.longitude?.toFixed(6)}
                                            </p>
                                            <p className="text-[10px] text-indigo-500 font-medium">
                                                Atualizado {formatTimeAgo(drawerEmployee.timestamp)}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => viewOnMap(drawerEmployee.user_id)}
                                            className="mt-3 w-full py-2 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-colors"
                                        >
                                            🗺️ Ver no Mapa / Rota
                                        </button>
                                    </div>

                                    {/* Today's Events Timeline */}
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 px-1 flex items-center gap-2">
                                            <ClockIcon className="h-3.5 w-3.5" />
                                            Eventos de Hoje
                                        </p>

                                        {!drawerEmployee.events || drawerEmployee.events.length === 0 ? (
                                            <div className="py-10 text-center bg-slate-50 rounded-2xl border border-slate-100">
                                                <p className="text-sm font-bold text-slate-400">Nenhum evento hoje</p>
                                            </div>
                                        ) : (
                                            <div className="relative">
                                                {/* Timeline line */}
                                                <div className="absolute left-[18px] top-0 bottom-0 w-px bg-slate-200"></div>

                                                <div className="space-y-4">
                                                    {drawerEmployee.events.map((evt, idx) => {
                                                        const info = getEventInfo(evt.event_type)
                                                        return (
                                                            <div key={evt.id} className="flex items-start gap-4 relative">
                                                                {/* Timeline dot */}
                                                                <div className={`h-9 w-9 rounded-xl ${info.dot} flex items-center justify-center flex-shrink-0 z-10 shadow-sm`}>
                                                                    <span className="text-sm">{info.icon}</span>
                                                                </div>

                                                                {/* Content */}
                                                                <div className="flex-1 bg-white border border-slate-100 rounded-2xl p-3 shadow-sm">
                                                                    <div className="flex items-center justify-between">
                                                                        <p className={`text-xs font-black ${info.color}`}>{info.label}</p>
                                                                        {evt.is_flagged && (
                                                                            <span className="text-[10px] font-black text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">⚠️ Sinalizado</span>
                                                                        )}
                                                                    </div>
                                                                    <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                                                                        {formatTime(evt.timestamp)}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}

'use client'
import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { UsersIcon, MapPinIcon, ClockIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
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

export default function MapPage() {
    const [locations, setLocations] = useState<any[]>([])
    const [filteredLocations, setFilteredLocations] = useState<any[]>([])
    const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
    const [statusFilter, setStatusFilter] = useState('all')
    const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null)
    const [isRefreshing, setIsRefreshing] = useState(false)

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

    // Calculate stats - count null/undefined status as offline
    const stats = {
        total: locations.length,
        working: locations.filter(l => l.current_status === 'working').length,
        break: locations.filter(l => l.current_status === 'break').length,
        offline: locations.filter(l => !l.current_status || l.current_status === 'out').length
    }

    function getStatusBadge(status: string) {
        const badges = {
            working: { label: 'Trabalhando', color: 'bg-emerald-100 text-emerald-700 border border-emerald-200', dot: 'bg-emerald-500' },
            break: { label: 'Intervalo', color: 'bg-amber-100 text-amber-700 border border-amber-200', dot: 'bg-amber-500' },
            out: { label: 'Ausente', color: 'bg-rose-100 text-rose-700 border border-rose-200', dot: 'bg-rose-500' },
            offline: { label: 'Offline', color: 'bg-slate-100 text-slate-600 border border-slate-200', dot: 'bg-slate-400' }
        }
        return badges[status as keyof typeof badges] || badges.offline
    }

    function formatTimeAgo(timestamp: string) {
        const minutes = Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000)
        if (minutes < 1) return 'agora'
        if (minutes < 60) return `há ${minutes}min`
        const hours = Math.floor(minutes / 60)
        if (hours < 24) return `há ${hours}h`
        return `há ${Math.floor(hours / 24)}d`
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
                                        onClick={() => setSelectedEmployee(loc.user_id)}
                                        className={`premium-card !p-4 cursor-pointer transition-all duration-300 group ${isSelected
                                            ? 'ring-2 ring-indigo-500 bg-indigo-50/30'
                                            : 'bg-white hover:bg-slate-50'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
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
                                            <button className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:text-indigo-700 transition-colors">
                                                Ver Detalhes
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
        </div>
    )
}

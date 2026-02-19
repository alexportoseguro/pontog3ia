'use client'

import React, { useEffect, useState } from 'react'
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Legend
} from 'recharts'
import { supabase } from '@/lib/supabaseClient'
import {
    UserGroupIcon,
    ClockIcon,
    ExclamationTriangleIcon,
    CheckCircleIcon,
    SparklesIcon
} from '@heroicons/react/24/outline'

const COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444']

export default function DashboardStats() {
    const [role, setRole] = useState<'admin' | 'manager' | 'employee' | null>(null)
    const [userId, setUserId] = useState<string | null>(null)
    const [user, setUser] = useState<any>(null)

    // Stats State
    const [stats, setStats] = useState({
        totalEmployees: 0,
        workingNow: 0,
        onBreak: 0,
        stopped: 0,
        lateArrivals: 0,
        // Personal Stats
        myBalance: 0,
        myStatus: 'offline',
        myMonthlyHours: 0
    })
    const [weeklyData, setWeeklyData] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        checkUserRole()
    }, [])

    useEffect(() => {
        if (role) {
            fetchStats()
        }
    }, [role])

    async function checkUserRole() {
        try {
            const { data: { user: authUser } } = await supabase.auth.getUser()
            if (authUser) {
                setUserId(authUser.id)
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('*, role')
                    .eq('id', authUser.id)
                    .single()
                setRole(profile?.role || 'employee')
                setUser(profile)
            } else {
                setLoading(false)
            }
        } catch (error) {
            console.error('Error checking role:', error)
            setLoading(false)
        }
    }

    async function fetchStats() {
        setLoading(true)
        try {
            // Get Auth Token for API calls
            const { data: { session } } = await supabase.auth.getSession()
            const headers = {
                'Authorization': `Bearer ${session?.access_token}`,
                'Content-Type': 'application/json'
            }

            // 1. Fetch Basic Totals
            const statsRes = await fetch('/api/dashboard/stats', { headers })
            const statsData = await statsRes.json()

            // 2. Fetch Weekly Breakdown
            const weeklyRes = await fetch(`/api/dashboard/weekly-hours${role === 'employee' ? `?userId=${userId}` : ''}`, { headers })
            const weeklyChartData = await weeklyRes.json()

            if (Array.isArray(weeklyChartData)) {
                setWeeklyData(weeklyChartData)
            }

            if (role === 'employee' && userId) {
                // --- EMPLOYEE VIEW ---
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('current_status')
                    .eq('id', userId)
                    .single()

                setStats(prev => ({
                    ...prev,
                    ...statsData,
                    myStatus: profile?.current_status || 'offline',
                    myMonthlyHours: Array.isArray(weeklyChartData)
                        ? weeklyChartData.reduce((acc: number, curr: any) => acc + (curr.horas || 0), 0)
                        : 0
                }))
            } else {
                // --- ADMIN/MANAGER VIEW ---
                setStats(prev => ({
                    ...prev,
                    ...statsData
                }))
            }
        } catch (error) {
            console.error('Stats fetch error:', error)
        } finally {
            setLoading(false)
        }
    }

    const pieData = [
        { name: 'Trabalhando', value: stats.workingNow },
        { name: 'Pausa', value: stats.onBreak },
        { name: 'Ausente', value: stats.stopped },
    ]

    if (loading) {
        return <div className="animate-pulse space-y-4">
            <div className="h-32 bg-gray-200 rounded-xl"></div>
        </div>
    }

    // --- RENDER EMPLOYEE VIEW ---
    if (role === 'employee') {
        return (
            <div className="space-y-8 animate-fade-in">
                {/* Personal Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <StatCard
                        title="Meu Status"
                        value={stats.myStatus === 'working' ? 'Trabalhando' : stats.myStatus === 'break' ? 'Em Pausa' : 'Ausente'}
                        icon={stats.myStatus === 'working' ? ClockIcon : ExclamationTriangleIcon}
                        color={stats.myStatus === 'working' ? 'text-emerald-600' : 'text-slate-600'}
                        bg={stats.myStatus === 'working' ? 'bg-emerald-50' : 'bg-slate-50'}
                    />
                    <StatCard
                        title="Horas na Semana"
                        value={`${stats.myMonthlyHours.toFixed(1)}h`}
                        icon={ClockIcon}
                        color="text-indigo-600"
                        bg="bg-indigo-50"
                        subtext="Últimos 7 dias"
                    />
                    <div className="bg-gradient-to-br from-indigo-600 via-violet-600 to-emerald-500 p-8 rounded-2xl shadow-xl text-white transform hover:scale-[1.02] transition-transform duration-300 flex flex-col justify-center relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                            <SparklesIcon className="w-24 h-24" />
                        </div>
                        <h3 className="text-xl font-black mb-2 relative z-10">👋 Olá, {user?.full_name?.split(' ')[0] || 'Usuário'}!</h3>
                        <p className="text-indigo-100 text-sm font-medium relative z-10">Desejamos um ótimo dia de trabalho. Acompanhe seu desempenho abaixo.</p>
                    </div>
                </div>

                {/* My Hours Chart */}
                <div className="premium-card p-8 bg-white/80 backdrop-blur-sm">
                    <div className="flex justify-between items-center mb-8">
                        <h3 className="text-xl font-black text-slate-800 tracking-tight">Análise de Jornada (7 Dias)</h3>
                        <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-xs font-bold uppercase tracking-wider">Histórico Pessoal</span>
                    </div>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={weeklyData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#64748B', fontSize: 12, fontWeight: 600 }}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#64748B', fontSize: 12, fontWeight: 600 }}
                                />
                                <Tooltip
                                    contentStyle={{
                                        borderRadius: '16px',
                                        border: 'none',
                                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
                                        background: 'rgba(15, 23, 42, 0.9)',
                                        color: '#fff',
                                        padding: '12px'
                                    }}
                                    itemStyle={{ color: '#fff' }}
                                    cursor={{ fill: '#F1F5F9', radius: 4 }}
                                />
                                <Bar dataKey="horas" fill="url(#colorHoras)" radius={[6, 6, 0, 0]} barSize={48}>
                                    <defs>
                                        <linearGradient id="colorHoras" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#6366F1" stopOpacity={1} />
                                            <stop offset="95%" stopColor="#8B5CF6" stopOpacity={1} />
                                        </linearGradient>
                                    </defs>
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        )
    }

    // --- RENDER ADMIN VIEW ---
    return (
        <div className="space-y-8 animate-fade-in">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <StatCard
                    title="Total Funcionários"
                    value={stats.totalEmployees}
                    icon={UserGroupIcon}
                    color="text-indigo-600"
                    bg="bg-indigo-50"
                />
                <StatCard
                    title="Trabalhando Agora"
                    value={stats.workingNow}
                    icon={ClockIcon}
                    color="text-emerald-600"
                    bg="bg-emerald-50"
                />
                <StatCard
                    title="Em Pausa"
                    value={stats.onBreak}
                    icon={ClockIcon}
                    color="text-amber-600"
                    bg="bg-amber-50"
                />
                <StatCard
                    title="Atrasos Hoje"
                    value={stats.lateArrivals}
                    icon={ExclamationTriangleIcon}
                    color="text-rose-600"
                    bg="bg-rose-50"
                    subtext="Relatório Geral"
                />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* Weekly Hours Bar Chart */}
                <div className="premium-card p-8 bg-white/80 backdrop-blur-sm">
                    <div className="flex justify-between items-center mb-8">
                        <h3 className="text-xl font-black text-slate-800 tracking-tight">Média de Horas (Semana)</h3>
                        <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-xs font-bold uppercase tracking-wider">Produtividade</span>
                    </div>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={weeklyData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12, fontWeight: 600 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12, fontWeight: 600 }} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', background: '#0F172A', color: '#fff' }}
                                    cursor={{ fill: '#F1F5F9' }}
                                />
                                <Bar dataKey="horas" fill="#6366F1" radius={[6, 6, 0, 0]} barSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Status Pie Chart */}
                <div className="premium-card p-8 bg-white/80 backdrop-blur-sm">
                    <div className="flex justify-between items-center mb-8">
                        <h3 className="text-xl font-black text-slate-800 tracking-tight">Status da Equipe</h3>
                        <span className="px-3 py-1 bg-violet-50 text-violet-600 rounded-full text-xs font-bold uppercase tracking-wider">Distribuição</span>
                    </div>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={pieData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={70}
                                    outerRadius={90}
                                    paddingAngle={8}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}
                                />
                                <Legend
                                    verticalAlign="bottom"
                                    height={36}
                                    iconType="circle"
                                    formatter={(value) => <span className="text-slate-600 font-bold ml-1">{value}</span>}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    )
}

function StatCard({ title, value, icon: Icon, color, bg, subtext }: any) {
    return (
        <div className="premium-card p-6 flex items-start justify-between hover:scale-[1.03] active:scale-[0.98]">
            <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{title}</p>
                <h4 className="text-3xl font-black text-slate-900 mt-2">{value}</h4>
                {subtext && <span className="text-xs font-semibold text-slate-400 mt-2 block">{subtext}</span>}
            </div>
            <div className={`p-4 rounded-2xl ${bg} shadow-inner`}>
                <Icon className={`w-7 h-7 ${color}`} />
            </div>
        </div>
    )
}

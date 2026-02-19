'use client'

import { useState, useEffect } from 'react'
import { SparklesIcon, ArrowPathIcon, ArrowTrendingUpIcon, ExclamationTriangleIcon, LightBulbIcon } from '@heroicons/react/24/outline'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type InsightsData = {
    efficiency: {
        trend: 'up' | 'down' | 'neutral'
        value: string
        message: string
    }
    anomaly: {
        severity: 'high' | 'medium' | 'low'
        title: string
        description: string
    }
    recommendation: {
        action: string
        impact: string
    }
}

export default function AIInsightsWidget() {
    const [insights, setInsights] = useState<InsightsData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        fetchInsights()
    }, [])

    async function fetchInsights() {
        setLoading(true)
        setError(null)
        try {
            const { data: { session } } = await supabase.auth.getSession()
            const headers: any = {}
            if (session?.access_token) {
                headers['Authorization'] = `Bearer ${session.access_token}`
            }

            const res = await fetch('/api/dashboard/insights', { headers })
            if (!res.ok) throw new Error('Falha ao carregar insights')

            const data = await res.json()
            if (data.error) throw new Error(data.error)

            setInsights(data)
        } catch (err: any) {
            console.error(err)
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    if (error) return null // Hide on error to not clutter dashboard

    return (
        <div className="w-full mb-8 animate-fade-in relative group">
            {/* Glossy Background with gradient border */}
            <div className="absolute -inset-[2px] bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-3xl opacity-75 blur-sm group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-tilt"></div>

            <div className="relative bg-white rounded-2xl p-6 shadow-xl border border-slate-100/50 backdrop-blur-xl">
                {/* Header */}
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 rounded-xl">
                            <SparklesIcon className="w-5 h-5 text-indigo-600 animate-pulse" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-slate-800 tracking-tight">AI Manager Insights</h2>
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Análise Operacional Proativa</p>
                        </div>
                    </div>
                    <button
                        onClick={fetchInsights}
                        disabled={loading}
                        className="p-2 hover:bg-slate-50 rounded-full transition-colors group/btn"
                    >
                        <ArrowPathIcon className={`w-5 h-5 text-slate-400 group-hover/btn:text-indigo-600 transition-colors ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>

                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-pulse">
                        <div className="h-24 bg-slate-50 rounded-xl"></div>
                        <div className="h-24 bg-slate-50 rounded-xl"></div>
                        <div className="h-24 bg-slate-50 rounded-xl"></div>
                    </div>
                ) : insights ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Efficiency Card */}
                        <div className="bg-gradient-to-br from-slate-50 to-white p-4 rounded-xl border border-slate-100 hover:border-indigo-100 transition-colors">
                            <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <ArrowTrendingUpIcon className={`w-4 h-4 ${insights.efficiency.trend === 'up' ? 'text-green-500' : insights.efficiency.trend === 'down' ? 'text-red-500' : 'text-slate-400'}`} />
                                    <span className="text-xs font-bold text-slate-500 uppercase">Eficiência</span>
                                </div>
                                <span className={`text-sm font-black ${insights.efficiency.trend === 'up' ? 'text-green-600' : 'text-slate-700'}`}>
                                    {insights.efficiency.value}
                                </span>
                            </div>
                            <p className="text-sm font-medium text-slate-700 leading-tight">
                                {insights.efficiency.message}
                            </p>
                        </div>

                        {/* Anomaly Card */}
                        <div className={`bg-gradient-to-br p-4 rounded-xl border transition-colors ${insights.anomaly.severity === 'high' ? 'from-red-50 to-white border-red-100' : 'from-amber-50 to-white border-amber-100'
                            }`}>
                            <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <ExclamationTriangleIcon className={`w-4 h-4 ${insights.anomaly.severity === 'high' ? 'text-red-500' : 'text-amber-500'}`} />
                                    <span className="text-xs font-bold text-slate-500 uppercase">Atenção</span>
                                </div>
                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-white/50 border border-black/5">
                                    {insights.anomaly.severity === 'high' ? 'Crítico' : 'Alerta'}
                                </span>
                            </div>
                            <p className="text-sm font-bold text-slate-800 mb-1">{insights.anomaly.title}</p>
                            <p className="text-xs text-slate-600 leading-tight">{insights.anomaly.description}</p>
                        </div>

                        {/* Recommendation Card */}
                        <div className="bg-gradient-to-br from-indigo-50 to-white p-4 rounded-xl border border-indigo-100 hover:border-indigo-200 transition-colors">
                            <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <LightBulbIcon className="w-4 h-4 text-indigo-500" />
                                    <span className="text-xs font-bold text-slate-500 uppercase">Sugestão</span>
                                </div>
                            </div>
                            <p className="text-sm font-bold text-indigo-700 mb-1">{insights.recommendation.action}</p>
                            <p className="text-xs text-indigo-600/80 leading-tight">Impacto: {insights.recommendation.impact}</p>
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    )
}

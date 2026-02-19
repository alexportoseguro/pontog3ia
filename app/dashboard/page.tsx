'use client'

import DashboardStats from '@/components/DashboardStats'
import AIInsightsWidget from '@/components/AIInsightsWidget'

export default function DashboardPage() {
    return (
        <div className="space-y-8 animate-fade-in">
            <div className="flex flex-col gap-1">
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">Visão Geral</h1>
                <p className="text-slate-500 font-medium">Acompanhe métricas e status da sua equipe em tempo real.</p>
            </div>

            <AIInsightsWidget />
            <DashboardStats />
        </div>
    )
}

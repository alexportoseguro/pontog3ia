'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

// Client-side Supabase for Realtime Subscription
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type EventLog = {
    id: string
    created_at: string
    action?: string // specific to audit_logs
    content?: string // specific to employee_messages
    type: 'SYSTEM' | 'CHAT'
    user_email?: string
}

export default function FeedPage() {
    const [events, setEvents] = useState<EventLog[]>([])
    const [userId, setUserId] = useState<string | null>(null)

    useEffect(() => {
        const init = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                setUserId(user.id)
                fetchLogs(user.id)
                setupRealtime(user.id)
            }
        }
        init()
    }, [])

    function setupRealtime(uid: string) {
        const channel = supabase
            .channel('dashboard-feed')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'employee_messages',
                    filter: `user_id=eq.${uid}`
                },
                (payload) => {
                    const newEvent: EventLog = {
                        id: payload.new.id,
                        created_at: payload.new.created_at,
                        content: payload.new.content,
                        type: 'CHAT'
                    }
                    setEvents(prev => [newEvent, ...prev])
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }

    async function fetchLogs(uid: string) {
        // Fetch last 20 messages for THIS user only
        const { data: messages } = await supabase
            .from('employee_messages')
            .select('id, created_at, content')
            .eq('user_id', uid)
            .order('created_at', { ascending: false })
            .limit(20)

        // For employees, we typically don't show system audit logs unless it's about them.
        // For now, let's keep Audit Logs HIDDEN for Personal Feed to avoid noise/leaks,
        // unless we filter audit_logs by target_user_id (which might vary).

        const combined = [
            ...(messages || []).map(m => ({ ...m, type: 'CHAT' }))
        ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) as EventLog[]

        setEvents(combined)
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
            <div className="flex flex-col gap-1">
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">Diário de Bordo</h1>
                <p className="text-slate-500 font-medium text-sm">Acompanhe suas interações e registros recentes de jornada.</p>
            </div>

            <div className="premium-card p-10 bg-white/90 backdrop-blur-sm">
                <div className="flow-root">
                    <ul role="list" className="-mb-10">
                        {events.map((event, eventIdx) => (
                            <li key={event.id}>
                                <div className="relative pb-10">
                                    {eventIdx !== events.length - 1 ? (
                                        <span className="absolute top-5 left-5 -ml-px h-full w-0.5 bg-slate-100" aria-hidden="true" />
                                    ) : null}
                                    <div className="relative flex items-start space-x-4">
                                        <div className="relative">
                                            <span className={`h-10 w-10 rounded-2xl flex items-center justify-center ring-8 ring-white shadow-lg transform transition-transform hover:scale-110 ${event.type === 'CHAT'
                                                    ? 'bg-gradient-to-br from-indigo-500 to-indigo-600'
                                                    : 'bg-gradient-to-br from-slate-400 to-slate-500'
                                                }`}>
                                                {event.type === 'CHAT' ? (
                                                    <span className="text-white text-lg font-bold">💬</span>
                                                ) : (
                                                    <span className="text-white text-lg font-bold">⚙️</span>
                                                )}
                                            </span>
                                        </div>
                                        <div className="min-w-0 flex-1 bg-slate-50/50 p-4 rounded-2xl border border-slate-100 hover:border-indigo-100 hover:bg-white hover:shadow-md transition-all duration-300">
                                            <div className="flex justify-between items-center gap-4">
                                                <p className="text-sm font-bold text-slate-800">
                                                    {event.type === 'CHAT' ? 'Nova Mensagem' : 'Registro de Sistema'}
                                                </p>
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white px-2 py-1 rounded-lg border border-slate-100 shadow-sm">
                                                    {new Date(event.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                            <div className="mt-2">
                                                <p className="text-sm text-slate-600 leading-relaxed font-medium">
                                                    {event.type === 'CHAT' ? (
                                                        event.content
                                                    ) : (
                                                        event.action
                                                    )}
                                                </p>
                                            </div>
                                            <div className="mt-2 flex items-center gap-2">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                    {new Date(event.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </li>
                        ))}
                        {events.length === 0 && (
                            <li className="py-20 flex flex-col items-center justify-center text-center space-y-4">
                                <div className="h-20 w-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-300">
                                    <span className="text-4xl">📭</span>
                                </div>
                                <div>
                                    <p className="text-slate-800 font-bold">Nada por aqui ainda</p>
                                    <p className="text-slate-400 text-sm">Sua atividade recente aparecerá nesta linha do tempo.</p>
                                </div>
                            </li>
                        )}
                    </ul>
                </div>
            </div>
        </div>
    )
}

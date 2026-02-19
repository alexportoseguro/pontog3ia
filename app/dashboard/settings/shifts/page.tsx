'use client'
import { useState, useEffect } from 'react'
import {
    ClockIcon,
    PlusIcon,
    TrashIcon,
    CalendarDaysIcon,
    ArrowLeftIcon
} from '@heroicons/react/24/outline'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function ShiftsPage() {
    const [shifts, setShifts] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [form, setForm] = useState({
        name: '',
        start_time: '08:00',
        end_time: '18:00',
        break_duration_minutes: 60,
        work_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
    })

    const WEEKDAYS = [
        { en: 'Monday', pt: 'Seg' },
        { en: 'Tuesday', pt: 'Ter' },
        { en: 'Wednesday', pt: 'Qua' },
        { en: 'Thursday', pt: 'Qui' },
        { en: 'Friday', pt: 'Sex' },
        { en: 'Saturday', pt: 'Sáb' },
        { en: 'Sunday', pt: 'Dom' }
    ]

    useEffect(() => {
        fetchShifts()
    }, [])

    async function fetchShifts() {
        try {
            const { data: { session } } = await supabase.auth.getSession()
            const headers: any = {}
            if (session?.access_token) {
                headers['Authorization'] = `Bearer ${session.access_token}`
            }

            const res = await fetch('/api/shifts', { headers })
            const data = await res.json()
            if (Array.isArray(data)) {
                setShifts(data)
            } else {
                console.error('Invalid shifts data received:', data)
                setShifts([])
            }
        } catch (err) {
            console.error('Error fetching shifts:', err)
            setShifts([])
        } finally {
            setLoading(false)
        }
    }

    async function handleAdd() {
        if (!form.name) return alert('Nome é obrigatório')
        try {
            const { data: { session } } = await supabase.auth.getSession()
            const headers: any = { 'Content-Type': 'application/json' }
            if (session?.access_token) {
                headers['Authorization'] = `Bearer ${session.access_token}`
            }

            const res = await fetch('/api/shifts', {
                method: 'POST',
                headers,
                body: JSON.stringify(form)
            })
            if (res.ok) {
                setForm({ ...form, name: '', start_time: '08:00', end_time: '18:00', break_duration_minutes: 60 })
                fetchShifts()
            } else {
                const err = await res.json()
                alert('Erro ao salvar: ' + (err.error || 'Erro desconhecido'))
            }
        } catch (err: any) {
            alert('Erro ao salvar: ' + err.message)
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('Tem certeza?')) return
        try {
            const { data: { session } } = await supabase.auth.getSession()
            const headers: any = {}
            if (session?.access_token) {
                headers['Authorization'] = `Bearer ${session.access_token}`
            }

            const res = await fetch(`/api/shifts?id=${id}`, {
                method: 'DELETE',
                headers
            })
            if (res.ok) {
                fetchShifts()
            } else {
                const err = await res.json()
                alert('Erro ao excluir: ' + (err.error || 'Erro desconhecido'))
            }
        } catch (err: any) {
            alert('Erro ao excluir: ' + err.message)
        }
    }

    const toggleDay = (day: string) => {
        if (form.work_days.includes(day)) {
            setForm({ ...form, work_days: form.work_days.filter(d => d !== day) })
        } else {
            setForm({ ...form, work_days: [...form.work_days, day] })
        }
    }

    return (
        <div className="min-h-screen animate-fade-in -m-4 md:-m-0 rounded-3xl overflow-hidden bg-slate-50">
            {/* Header */}
            <div className="glass-effect p-8 border-b border-slate-200/50 relative z-30">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                    <div className="flex items-center gap-4">
                        <Link href="/dashboard/settings" className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                            <ArrowLeftIcon className="h-5 w-5 text-slate-500" />
                        </Link>
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <div className="p-2 bg-indigo-50 rounded-xl">
                                    <ClockIcon className="h-6 w-6 text-indigo-600" />
                                </div>
                                <h1 className="text-3xl font-black text-slate-900 tracking-tight">Escalas de Trabalho</h1>
                            </div>
                            <p className="text-slate-500 font-medium ml-12">Defina os turnos e jornadas da sua equipe.</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-8">
                <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Form Section */}
                    <div className="lg:col-span-5 space-y-6">
                        <div className="premium-card p-8 bg-white/90 backdrop-blur-sm">
                            <h2 className="text-base font-black text-slate-900 mb-6 uppercase tracking-widest flex items-center gap-2">
                                <PlusIcon className="h-5 w-5 text-indigo-600" />
                                Novo Turno
                            </h2>

                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Identificação</label>
                                    <input
                                        type="text"
                                        value={form.name}
                                        onChange={e => setForm({ ...form, name: e.target.value })}
                                        placeholder="Ex: Padrão Comunitário"
                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 transition-all font-sans"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Início</label>
                                        <input
                                            type="time"
                                            value={form.start_time}
                                            onChange={e => setForm({ ...form, start_time: e.target.value })}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 transition-all"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Fim</label>
                                        <input
                                            type="time"
                                            value={form.end_time}
                                            onChange={e => setForm({ ...form, end_time: e.target.value })}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 transition-all"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Tempo de Intervalo</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={form.break_duration_minutes}
                                            onChange={e => setForm({ ...form, break_duration_minutes: parseInt(e.target.value) })}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 transition-all"
                                        />
                                        <span className="absolute right-5 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Minutos</span>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Dias da Semana</label>
                                    <div className="flex flex-wrap gap-2">
                                        {WEEKDAYS.map(day => {
                                            const isActive = form.work_days.includes(day.en)
                                            return (
                                                <button
                                                    key={day.en}
                                                    onClick={() => toggleDay(day.en)}
                                                    className={`h - 10 w - 10 rounded - xl text - [10px] font - black transition - all transform active: scale - 95 ${isActive
                                                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                                                        : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                                                        } `}
                                                >
                                                    {day.pt}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>

                                <div className="pt-4">
                                    <button
                                        onClick={handleAdd}
                                        className="w-full py-4 bg-slate-900 rounded-2xl shadow-xl text-xs font-black uppercase tracking-widest text-white hover:bg-slate-800 transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
                                    >
                                        <PlusIcon className="h-4 w-4" />
                                        Criar Escala
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* List Section */}
                    <div className="lg:col-span-7 space-y-6">
                        <div className="premium-card p-8 bg-white/90 backdrop-blur-sm">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 px-1">Escalas Ativas</h3>

                            {loading ? (
                                <div className="py-20 text-center animate-pulse space-y-4">
                                    <div className="h-10 w-10 bg-slate-100 rounded-xl mx-auto"></div>
                                    <p className="text-xs font-bold text-slate-300">Carregando turnos...</p>
                                </div>
                            ) : shifts.length === 0 ? (
                                <div className="py-20 text-center bg-slate-50 rounded-3xl space-y-4">
                                    <CalendarDaysIcon className="h-12 w-12 text-slate-200 mx-auto" />
                                    <p className="text-sm font-bold text-slate-400">Nenhum turno cadastrado</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {shifts.map((shift: any) => (
                                        <div key={shift.id} className="group p-5 bg-white border border-slate-100 rounded-2xl hover:border-indigo-200 transition-all">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h4 className="font-black text-slate-900 text-base tracking-tight mb-1">{shift.name}</h4>
                                                    <div className="flex items-center gap-4 text-[10px] font-black text-indigo-600 uppercase tracking-widest">
                                                        <div className="flex items-center gap-1.5">
                                                            <ClockIcon className="h-3.5 w-3.5" />
                                                            {shift.start_time.slice(0, 5)} - {shift.end_time.slice(0, 5)}
                                                        </div>
                                                        <span className="text-slate-300">|</span>
                                                        <span>Intervalo: {shift.break_duration_minutes}m</span>
                                                    </div>

                                                    <div className="flex flex-wrap gap-1.5 mt-4">
                                                        {shift.work_days?.map((d: string) => (
                                                            <span key={d} className="px-2 py-1 bg-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest rounded-lg">
                                                                {WEEKDAYS.find(w => w.en === d)?.pt || d}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleDelete(shift.id)}
                                                    className="opacity-0 group-hover:opacity-100 p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                                                >
                                                    <TrashIcon className="h-5 w-5" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

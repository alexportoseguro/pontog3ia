'use client'
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface Employee {
    id: string
    full_name: string
    avatar_url: string | null
    current_status: string
}

type ViewState = 'initials' | 'list' | 'actions' | 'success' | 'error'

export default function PontoFacilPage() {
    const [employees, setEmployees] = useState<Employee[]>([])
    const [loading, setLoading] = useState(true)
    const [view, setView] = useState<ViewState>('initials')
    const [selectedInitial, setSelectedInitial] = useState<string | null>(null)
    const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
    const [actionLoading, setActionLoading] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')
    const [currentTime, setCurrentTime] = useState(new Date())
    const router = useRouter()

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000)
        fetchEmployees()
        return () => clearInterval(timer)
    }, [])

    async function fetchEmployees() {
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) {
                setLoading(false)
                return
            }
            const res = await fetch('/api/terminal/employees', {
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            })
            const data = await res.json()
            if (data.employees) setEmployees(data.employees)
        } catch (err) {
            console.error('[PontoFacil] Fetch Error:', err)
        } finally {
            setLoading(false)
        }
    }

    // Get unique initials from employees
    const availableInitials = useMemo(() => {
        const initials = new Set<string>()
        employees.forEach(emp => {
            if (emp.full_name) {
                initials.add(emp.full_name[0].toUpperCase())
            }
        })
        return Array.from(initials).sort()
    }, [employees])

    const filteredEmployeesByInitial = useMemo(() => {
        if (!selectedInitial) return []
        return employees.filter(e =>
            e.full_name.toUpperCase().startsWith(selectedInitial)
        ).sort((a, b) => a.full_name.localeCompare(b.full_name))
    }, [employees, selectedInitial])

    const handleSelectInitial = (char: string) => {
        setSelectedInitial(char)
        const matched = employees.filter(e => e.full_name.toUpperCase().startsWith(char))
        if (matched.length === 1) {
            setSelectedEmployee(matched[0])
            setView('actions')
        } else {
            setView('list')
        }
    }

    const handleSelectEmployee = (emp: Employee) => {
        setSelectedEmployee(emp)
        setView('actions')
    }

    const handleRecordPoint = async (type: string) => {
        if (!selectedEmployee) return
        setActionLoading(true)

        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) throw new Error('Terminal não autenticado')

            const res = await fetch('/api/points', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({
                    eventType: type,
                    timestamp: new Date().toISOString(),
                    targetUserId: selectedEmployee.id,
                    location: '(0,0)'
                })
            })

            const result = await res.json()
            if (result.success) {
                setView('success')
                setTimeout(() => {
                    setView('initials')
                    setSelectedEmployee(null)
                    setSelectedInitial(null)
                    fetchEmployees()
                }, 3000)
            } else {
                setErrorMessage(result.error || 'Erro ao registrar ponto')
                setView('error')
            }
        } catch (err: any) {
            setErrorMessage(err.message)
            setView('error')
        } finally {
            setActionLoading(false)
        }
    }

    const handleKioskLogout = async () => {
        await supabase.auth.signOut()
        router.push('/login')
    }

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-900">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-400"></div>
            </div>
        )
    }

    if (employees.length === 0 && !loading) {
        return (
            <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-center">
                <div className="bg-slate-800 p-12 rounded-[3.5rem] shadow-2xl max-w-lg w-full border border-slate-700/50">
                    <div className="text-6xl mb-6">🔒</div>
                    <h1 className="text-3xl font-black text-white mb-4 tracking-tight">Terminal Bloqueado</h1>
                    <p className="text-slate-400 font-medium leading-relaxed mb-8">
                        Para ativar este dispositivo como um quiosque de ponto, um **Gestor ou Gerente** precisa autorizar o acesso primeiro.
                    </p>
                    <button
                        onClick={() => router.push('/login?redirect=/ponto-facil')}
                        className="w-full bg-indigo-500 hover:bg-indigo-600 text-white p-5 rounded-3xl font-black text-lg transition-all shadow-xl shadow-indigo-900/40"
                    >
                        AUTORIZAR DISPOSITIVO
                    </button>
                    <button
                        onClick={() => router.push('/login')}
                        className="mt-6 text-slate-500 font-bold uppercase text-xs tracking-widest hover:text-indigo-400 transition-colors"
                    >
                        VOLTAR AO LOGIN PADRÃO
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-900 flex flex-col text-white font-sans overflow-hidden">
            {/* Minimal Header */}
            <header className="px-6 py-4 flex justify-between items-center border-b border-slate-800 bg-slate-900/50 backdrop-blur-md z-10">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center text-white text-lg font-black italic">G3</div>
                    <h1 className="text-sm font-black tracking-widest uppercase opacity-80">Ponto Fácil</h1>
                </div>
                <div className="text-right">
                    <div className="text-xl font-black text-indigo-400 font-mono tracking-tighter">
                        {currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                </div>
            </header>

            <main className="flex-1 flex flex-col p-4 relative">

                {/* VIEW: INITIALS (Touch Grid) */}
                {view === 'initials' && (
                    <div className="flex-1 flex flex-col items-center justify-center max-w-lg mx-auto w-full space-y-8 animate-in fade-in zoom-in duration-300">
                        <div className="text-center space-y-2">
                            <h2 className="text-4xl font-black tracking-tight">Identifique-se</h2>
                            <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.2em]">Toque na primeira letra do seu nome</p>
                        </div>

                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-4 w-full px-4">
                            {availableInitials.map(char => (
                                <button
                                    key={char}
                                    onClick={() => handleSelectInitial(char)}
                                    className="aspect-square bg-slate-800 border-b-4 border-slate-700 rounded-3xl flex items-center justify-center text-4xl font-black text-white hover:bg-slate-700 hover:border-indigo-500 hover:text-indigo-400 transition-all shadow-xl active:translate-y-1 active:border-b-0"
                                >
                                    {char}
                                </button>
                            ))}
                        </div>

                        {availableInitials.length === 0 && (
                            <p className="text-slate-500 font-bold italic">Nenhum funcionário sincronizado...</p>
                        )}
                    </div>
                )}

                {/* VIEW: LIST (Multiple employees for same initial) */}
                {view === 'list' && (
                    <div className="flex-1 flex flex-col items-center justify-center max-w-lg mx-auto w-full space-y-6 animate-in slide-in-from-right duration-300">
                        <div className="text-center">
                            <h2 className="text-3xl font-black">Nomes com &quot;{selectedInitial}&quot;</h2>
                            <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.2em] mt-2">Selecione o seu nome abaixo</p>
                        </div>

                        <div className="w-full space-y-3 max-h-[60vh] overflow-y-auto px-2 custom-scrollbar">
                            {filteredEmployeesByInitial.map(emp => (
                                <button
                                    key={emp.id}
                                    onClick={() => handleSelectEmployee(emp)}
                                    className="w-full flex items-center gap-4 p-5 bg-slate-800 border border-slate-700 rounded-3xl hover:bg-slate-700 transition-all text-left shadow-lg group active:scale-95"
                                >
                                    <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-black text-2xl border border-indigo-500/30">
                                        {emp.avatar_url ? (
                                            <img src={emp.avatar_url} className="w-full h-full object-cover rounded-2xl" />
                                        ) : emp.full_name[0]}
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-black text-xl group-hover:text-indigo-400 transition-colors">{emp.full_name}</p>
                                    </div>
                                    <div className="text-slate-600 group-hover:text-indigo-400">
                                        <ArrowRightIcon />
                                    </div>
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={() => { setView('initials'); setSelectedInitial(null); }}
                            className="flex items-center gap-2 text-slate-500 font-black text-[10px] uppercase tracking-widest hover:text-white transition-colors py-4"
                        >
                            <XCircleIcon /> VOLTAR
                        </button>
                    </div>
                )}

                {/* VIEW: ACTIONS */}
                {view === 'actions' && selectedEmployee && (
                    <div className="flex-1 flex flex-col items-center justify-center max-w-lg mx-auto w-full animate-in slide-in-from-bottom-12 duration-500">
                        <button
                            onClick={() => { setView('initials'); setSelectedEmployee(null); setSelectedInitial(null); }}
                            className="absolute top-6 left-2 flex items-center gap-2 text-slate-500 font-black text-[10px] uppercase tracking-widest hover:text-white transition-colors"
                        >
                            <XCircleIcon /> CANCELAR
                        </button>

                        <div className="w-24 h-24 rounded-[2rem] bg-indigo-500 flex items-center justify-center text-white text-4xl font-black mb-6 shadow-2xl skew-y-3">
                            {selectedEmployee.avatar_url ? (
                                <img src={selectedEmployee.avatar_url} className="w-full h-full object-cover rounded-[2rem]" />
                            ) : selectedEmployee.full_name[0]}
                        </div>

                        <div className="text-center mb-12">
                            <h2 className="text-3xl font-black mb-2">{selectedEmployee.full_name.split(' ')[0]}</h2>
                            <div className="flex justify-center mb-4">
                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-slate-700 bg-slate-800/50 ${selectedEmployee.current_status === 'working' ? 'text-emerald-400' :
                                        selectedEmployee.current_status === 'break' ? 'text-amber-400' : 'text-slate-400'
                                    }`}>
                                    Status Atual: {
                                        selectedEmployee.current_status === 'working' ? 'TRABALHANDO' :
                                            selectedEmployee.current_status === 'break' ? 'EM INTERVALO' : 'FORA'
                                    }
                                </span>
                            </div>
                            <p className="text-slate-400 font-black text-[10px] uppercase tracking-[0.2em]">O que vamos registrar agora?</p>
                        </div>

                        <div className="w-full space-y-4">
                            {selectedEmployee.current_status === 'working' ? (
                                <>
                                    <BigActionButton
                                        color="amber"
                                        icon="☕"
                                        label="PAUSA / INTERVALO"
                                        loading={actionLoading}
                                        onClick={() => handleRecordPoint('break_start')}
                                    />
                                    <BigActionButton
                                        color="rose"
                                        icon="🚪"
                                        label="REGISTRAR SAÍDA"
                                        loading={actionLoading}
                                        onClick={() => handleRecordPoint('clock_out')}
                                    />
                                </>
                            ) : selectedEmployee.current_status === 'break' ? (
                                <BigActionButton
                                    color="indigo"
                                    icon="🚀"
                                    label="RETORNAR AO TRABALHO"
                                    loading={actionLoading}
                                    onClick={() => handleRecordPoint('break_end')}
                                />
                            ) : (
                                <BigActionButton
                                    color="emerald"
                                    icon="✅"
                                    label="INICIAR TRABALHO"
                                    loading={actionLoading}
                                    onClick={() => handleRecordPoint('clock_in')}
                                />
                            )}
                        </div>
                    </div>
                )}

                {/* VIEW: SUCCESS */}
                {view === 'success' && selectedEmployee && (
                    <div className="flex-1 flex flex-col items-center justify-center animate-in zoom-in duration-500">
                        <div className="w-32 h-32 bg-emerald-500 rounded-full flex items-center justify-center text-6xl shadow-2xl shadow-emerald-500/20 mb-8">
                            🎉
                        </div>
                        <h2 className="text-4xl font-black text-center mb-4">Ponto Registrado!</h2>
                        <p className="text-slate-400 text-center font-bold max-w-xs mx-auto">
                            Tudo certo, {selectedEmployee.full_name.split(' ')[0]}! O terminal voltará às letras em instantes.
                        </p>
                    </div>
                )}

                {/* VIEW: ERROR */}
                {view === 'error' && (
                    <div className="flex-1 flex flex-col items-center justify-center animate-in shake duration-500">
                        <div className="w-32 h-32 bg-rose-500 rounded-full flex items-center justify-center text-6xl shadow-2xl shadow-rose-500/20 mb-8">
                            ⚠️
                        </div>
                        <h2 className="text-3xl font-black text-center mb-4">Ops! Ocorreu um erro</h2>
                        <p className="text-rose-400 text-center font-bold mb-8">{errorMessage}</p>
                        <button
                            onClick={() => setView('initials')}
                            className="bg-white text-slate-900 px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl"
                        >
                            TENTAR NOVAMENTE
                        </button>
                    </div>
                )}
            </main>

            {/* Secure Exit */}
            {view === 'initials' && (
                <button
                    onClick={handleKioskLogout}
                    className="absolute bottom-6 right-6 p-4 bg-slate-800 text-slate-500 rounded-2xl hover:bg-rose-500 hover:text-white transition-all opacity-30 hover:opacity-100"
                    title="Encerrar Terminal"
                >
                    <LogoutIcon />
                </button>
            )}

            <style jsx global>{`
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-10px); }
                    75% { transform: translateX(10px); }
                }
                .shake { animation: shake 0.4s ease-in-out; }
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
            `}</style>
        </div>
    )
}

function BigActionButton({ color, icon, label, onClick, loading }: { color: string, icon: string, label: string, onClick: () => void, loading: boolean }) {
    const colors: Record<string, string> = {
        emerald: 'bg-emerald-500 border-emerald-600 shadow-emerald-900/40 hover:bg-emerald-600',
        amber: 'bg-amber-500 border-amber-600 shadow-amber-900/40 hover:bg-amber-600',
        rose: 'bg-rose-500 border-rose-600 shadow-rose-900/40 hover:bg-rose-600',
        indigo: 'bg-indigo-500 border-indigo-600 shadow-indigo-900/40 hover:bg-indigo-600'
    }

    return (
        <button
            disabled={loading}
            onClick={onClick}
            className={`w-full ${colors[color]} border-b-8 p-6 rounded-[2.5rem] flex flex-col items-center justify-center gap-2 transition-all active:translate-y-1 active:border-b-0 disabled:opacity-50 disabled:translate-y-0`}
        >
            {loading ? (
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-white"></div>
            ) : (
                <>
                    <span className="text-4xl">{icon}</span>
                    <span className="text-xs font-black uppercase tracking-widest">{label}</span>
                </>
            )}
        </button>
    )
}

function ArrowRightIcon() { return <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg> }
function XCircleIcon() { return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> }
function LogoutIcon() { return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg> }

'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { MagnifyingGlassIcon, PencilIcon, TrashIcon, MapPinIcon, ChartBarIcon, UserGroupIcon, IdentificationIcon, XMarkIcon } from '@heroicons/react/24/outline'
import SmartOnboardingModal from '@/components/SmartOnboardingModal'
import AuditHistory from '@/components/AuditHistory'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Employee = {
    id: string
    full_name: string | null
    email?: string
    role: string
    current_status: 'working' | 'break' | 'out' | 'offline'
    last_seen?: string
    phone?: string
    shift_rule_id?: string
    shift_rules?: { name: string }
    employee_shifts?: { shift_rules: { id: string, name: string } }[]
    company_id?: string
}

export default function EmployeesPage() {
    const [employees, setEmployees] = useState<Employee[]>([])
    const [loading, setLoading] = useState(true)
    const [shifts, setShifts] = useState<any[]>([])
    const [currentCompanyId, setCurrentCompanyId] = useState<string | null>(null)

    // History Modal State
    const [showHistoryModal, setShowHistoryModal] = useState(false)
    const [historyTargetId, setHistoryTargetId] = useState<string | null>(null)

    // Filters and search
    const [searchTerm, setSearchTerm] = useState('')
    const [statusFilter, setStatusFilter] = useState<string>('all')
    const [roleFilter, setRoleFilter] = useState<string>('all')
    const [shiftFilter, setShiftFilter] = useState<string>('all')

    // Modals
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [showEditModal, setShowEditModal] = useState(false)
    const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
    const [newEmployee, setNewEmployee] = useState({
        name: '',
        email: '',
        password: '',
        role: 'employee',
        phone: '',
        shiftId: 'none',
        shiftIds: [] as string[]
    })
    const [inviteLoading, setInviteLoading] = useState(false)
    const [showOnboardingModal, setShowOnboardingModal] = useState(false)

    const handleSmartOnboarding = (data: any) => {
        setNewEmployee({
            ...newEmployee,
            name: data.full_name || '',
            // Simple heuristic for role
            role: (data.job_role?.toLowerCase().includes('gerente') || data.job_role?.toLowerCase().includes('manager')) ? 'manager' : 'employee',
            shiftId: 'none',
            shiftIds: []
        })
        setShowOnboardingModal(false)
        setShowCreateModal(true)
    }

    useEffect(() => {
        fetchCurrentUserCompany()
        fetchEmployees()
        fetchShifts()
    }, [])

    async function fetchCurrentUserCompany() {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
            const { data } = await supabase.from('profiles').select('company_id').eq('id', user.id).single()
            if (data) setCurrentCompanyId(data.company_id)
        }
    }

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
            console.error('Error loading shifts', err)
            setShifts([])
        }
    }

    async function fetchEmployees() {
        try {
            console.log('Fetching session...')
            const { data: { session } } = await supabase.auth.getSession()
            console.log('Session status:', session ? 'Token acquired' : 'No session found')

            const headers: any = {}
            if (session?.access_token) {
                headers['Authorization'] = `Bearer ${session.access_token}`
            }

            console.log('Fetching employees via secure API...')
            const res = await fetch('/api/employees', { headers })
            if (!res.ok) {
                const errorData = await res.json()
                console.error('API Response Error:', errorData)
                throw new Error(errorData.error || 'Falha ao carregar funcionários')
            }
            const data = await res.json()
            console.log('Employees loaded successfully:', data.length)
            if (data) setEmployees(data)
        } catch (err: any) {
            console.error('Error loading employees:', err)
        } finally {
            setLoading(false)
        }
    }



    async function handleInvite() {
        // Validations
        if (!newEmployee.name.trim()) {
            alert('Nome é obrigatório')
            return
        }
        if (!newEmployee.email.trim() || !newEmployee.email.includes('@')) {
            alert('Email válido é obrigatório')
            return
        }
        if (!newEmployee.password || newEmployee.password.length < 6) {
            alert('Senha deve ter pelo menos 6 caracteres')
            return
        }

        setInviteLoading(true)
        try {
            const { data: { session } } = await supabase.auth.getSession()
            const token = session?.access_token

            const res = await fetch('/api/employees', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ ...newEmployee, shiftIds: newEmployee.shiftIds })
            })
            const json = await res.json()
            if (json.error) throw new Error(json.error)

            // Shift assignment is now handled by the API in the POST body


            alert('✅ Funcionário criado com sucesso!')
            setShowCreateModal(false)
            setNewEmployee({ name: '', email: '', password: '', role: 'employee', phone: '', shiftId: 'none', shiftIds: [] })
            fetchEmployees()
        } catch (err: any) {
            alert('❌ Erro ao criar: ' + err.message)
        } finally {
            setInviteLoading(false)
        }
    }

    async function handleEdit() {
        if (!selectedEmployee) return

        try {
            const { data: { session } } = await supabase.auth.getSession()
            const token = session?.access_token

            const res = await fetch('/api/employees', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    id: selectedEmployee.id,
                    name: selectedEmployee.full_name,
                    role: selectedEmployee.role,
                    phone: selectedEmployee.phone,
                    shiftIds: selectedEmployee.employee_shifts?.map((es: any) => es.shift_rules.id) || [],
                    shiftId: 'none' // Legacy
                })
            })
            const json = await res.json()

            if (json.error) throw new Error(json.error)

            setEmployees(employees.map(e => e.id === selectedEmployee.id ? selectedEmployee : e))
            setShowEditModal(false)
            setSelectedEmployee(null)
            alert('Funcionário atualizado!')
            fetchEmployees() // Refresh to get updated shifts
        } catch (err: any) {
            alert('Erro ao atualizar: ' + err.message)
        }
    }

    // Calculate statistics
    const stats = {
        total: employees.length,
        working: employees.filter(e => e.current_status === 'working').length,
        break: employees.filter(e => e.current_status === 'break').length,
        out: employees.filter(e => e.current_status === 'out').length
    }

    // Filter employees
    const filteredEmployees = employees.filter(emp => {
        const name = emp.full_name?.toLowerCase() || ''
        const email = emp.email?.toLowerCase() || ''
        const search = searchTerm.toLowerCase()

        const matchesSearch = name.includes(search) || email.includes(search)
        const matchesStatus = statusFilter === 'all' || emp.current_status === statusFilter
        const matchesRole = roleFilter === 'all' || emp.role === roleFilter
        const matchesShift = shiftFilter === 'all' || emp.shift_rule_id === shiftFilter || (shiftFilter === 'none' && !emp.shift_rule_id)

        return matchesSearch && matchesStatus && matchesRole && matchesShift
    })

    const getStatusConfig = (status: string) => {
        switch (status) {
            case 'working': return { label: '🟢 Trabalhando', color: 'bg-green-100 text-green-800' }
            case 'break': return { label: '☕ Intervalo', color: 'bg-yellow-100 text-yellow-800' }
            case 'out': return { label: '🔴 Ausente', color: 'bg-red-100 text-red-800' }
            default: return { label: '⚫ Offline', color: 'bg-gray-100 text-gray-800' }
        }
    }

    return (
        <div className="space-y-10 animate-fade-in p-4 md:p-0">
            {/* Header & Main Actions */}
            <div className="glass-effect p-8 rounded-3xl shadow-xl shadow-slate-200/50">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Equipe</h1>
                        <p className="text-slate-500 font-medium mt-1">Gerencie permissões, escalas e status dos seus colaboradores.</p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <a href="/dashboard/settings/shifts" className="inline-flex items-center px-6 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-all shadow-sm">
                            ⚙️ Gerenciar Turnos
                        </a>
                        <button
                            onClick={() => setShowOnboardingModal(true)}
                            className="inline-flex items-center px-6 py-3 bg-slate-800 rounded-2xl shadow-lg shadow-slate-500/20 text-xs font-black uppercase tracking-widest text-white hover:bg-slate-900 transition-all transform hover:scale-105 active:scale-95 mr-3"
                        >
                            <IdentificationIcon className="w-4 h-4 mr-2" />
                            Admissão via IA
                        </button>
                        <button
                            onClick={() => setShowOnboardingModal(true)}
                            className="inline-flex items-center px-6 py-3 bg-slate-800 rounded-2xl shadow-lg shadow-slate-500/20 text-xs font-black uppercase tracking-widest text-white hover:bg-slate-900 transition-all transform hover:scale-105 active:scale-95 mr-3"
                        >
                            <IdentificationIcon className="w-4 h-4 mr-2" />
                            Admissão via IA
                        </button>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="inline-flex items-center px-6 py-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-500/20 text-xs font-black uppercase tracking-widest text-white hover:bg-indigo-700 transition-all transform hover:scale-105 active:scale-95"
                        >
                            + Novo Integrante
                        </button>
                    </div>
                </div>

                {/* Statistics Row */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-10">
                    <EmployeeStatCard title="Total" value={stats.total} icon="👥" color="indigo" />
                    <EmployeeStatCard title="Trabalhando" value={stats.working} icon="🟢" color="emerald" percentage={stats.total > 0 ? Math.round(stats.working / stats.total * 100) : 0} />
                    <EmployeeStatCard title="Intervalo" value={stats.break} icon="☕" color="amber" percentage={stats.total > 0 ? Math.round(stats.break / stats.total * 100) : 0} />
                    <EmployeeStatCard title="Ausente" value={stats.out} icon="🔴" color="rose" percentage={stats.total > 0 ? Math.round(stats.out / stats.total * 100) : 0} />
                </div>
            </div>

            {/* Filters Bar */}
            <div className="premium-card p-6 bg-white/80 backdrop-blur-sm sticky top-0 z-20 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6 items-end">
                    <div className="lg:col-span-4">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Buscar Integrante</p>
                        <div className="relative group">
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Nome, email ou cargo..."
                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 text-sm font-medium text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 focus:bg-white transition-all pl-12"
                            />
                            <MagnifyingGlassIcon className="h-5 w-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-indigo-500 transition-colors" />
                        </div>
                    </div>

                    <div className="lg:col-span-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Status</p>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 transition-all appearance-none"
                        >
                            <option value="all">Todos os Status</option>
                            <option value="working">Trabalhando</option>
                            <option value="break">Intervalo</option>
                            <option value="out">Ausentes</option>
                        </select>
                    </div>

                    <div className="lg:col-span-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Cargo</p>
                        <select
                            value={roleFilter}
                            onChange={(e) => setRoleFilter(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 transition-all appearance-none"
                        >
                            <option value="all">Todos os Cargos</option>
                            <option value="employee">Funcionário</option>
                            <option value="manager">Gerente</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>

                    <div className="lg:col-span-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Escala</p>
                        <select
                            value={shiftFilter}
                            onChange={(e) => setShiftFilter(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 transition-all appearance-none"
                        >
                            <option value="all">Todas Escalas</option>
                            <option value="none">Padrão</option>
                            {shifts.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="lg:col-span-2">
                        <p className="text-right text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
                            Resultados: <span className="text-indigo-600">{filteredEmployees.length}</span>
                        </p>
                    </div>
                </div>
            </div>

            {/* Employee Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {filteredEmployees.map((employee) => {
                    const statusConfig = getStatusConfig(employee.current_status)
                    const initials = (employee.full_name || 'U').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

                    return (
                        <div key={employee.id} className="premium-card p-0 overflow-hidden bg-white group hover:scale-[1.02] active:scale-[0.98]">
                            {/* Card Header Background */}
                            <div className="h-24 bg-gradient-to-br from-slate-50 to-slate-100 relative">
                                <div className={`absolute top-4 right-4 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-sm ${statusConfig.color} bg-white/80 backdrop-blur-md`}>
                                    {statusConfig.label}
                                </div>
                            </div>

                            {/* Main Content */}
                            <div className="px-8 pb-8 -mt-12 relative z-10 text-center">
                                {/* Avatar */}
                                <div className="h-24 w-24 rounded-3xl bg-white shadow-2xl mx-auto flex items-center justify-center border-4 border-white mb-4 group-hover:rotate-3 transition-transform">
                                    <div className="h-full w-full rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center">
                                        <span className="text-2xl font-black text-white">{initials}</span>
                                    </div>
                                </div>

                                <h3 className="text-xl font-black text-slate-900 tracking-tight leading-tight">{employee.full_name || 'Sem Nome'}</h3>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1 mb-2">{employee.email || '-'}</p>
                                <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-6">{employee.phone || 'Sem telefone'}</p>

                                <div className="grid grid-cols-2 gap-4 mb-8">
                                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Cargo</p>
                                        <p className="text-xs font-bold text-slate-800 capitalize">
                                            {employee.role === 'manager' ? 'Gerente' : employee.role === 'admin' ? 'Admin' : 'Funcionário'}
                                        </p>
                                    </div>
                                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col justify-center">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Escalas</p>
                                        <div className="flex flex-wrap gap-1">
                                            {employee.employee_shifts && employee.employee_shifts.length > 0 ? (
                                                employee.employee_shifts.map((es: any) => (
                                                    <span key={es.shift_rules.id} className="inline-flex items-center px-2 py-1 rounded text-[10px] font-bold bg-white border border-slate-200 text-slate-700 shadow-sm">
                                                        {es.shift_rules.name}
                                                    </span>
                                                ))
                                            ) : (
                                                <span className="text-xs font-bold text-slate-400 italic">Sem escala</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        setHistoryTargetId(employee.id)
                                        setShowHistoryModal(true)
                                    }}
                                    className="text-gray-600 hover:text-blue-600"
                                    title="Ver Histórico"
                                >
                                    <IdentificationIcon className="h-5 w-5" />
                                </button>
                                {/* Actions Row */}
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => {
                                            setSelectedEmployee(employee)
                                            setShowEditModal(true)
                                        }}
                                        className="flex-1 bg-white border border-slate-200 p-3 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                                    >
                                        <PencilIcon className="h-3.5 w-3.5" />
                                        Editar
                                    </button>
                                    <a
                                        href={`/dashboard/reports?userId=${employee.id}`}
                                        className="flex-1 bg-indigo-50 p-3 rounded-2xl text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:bg-indigo-100 transition-all flex items-center justify-center gap-2"
                                    >
                                        <ChartBarIcon className="h-3.5 w-3.5" />
                                        Métricas
                                    </a>
                                    <a
                                        href="/dashboard/map"
                                        className="bg-slate-900 p-3 rounded-2xl text-white hover:bg-black transition-all"
                                    >
                                        <MapPinIcon className="h-4 w-4" />
                                    </a>
                                </div>

                                {employee.last_seen && (
                                    <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest mt-6">
                                        Visto {new Date(employee.last_seen).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>

            {filteredEmployees.length === 0 && (
                <div className="py-32 flex flex-col items-center justify-center text-center space-y-4">
                    <div className="h-24 w-24 bg-slate-50 rounded-full flex items-center justify-center text-slate-200">
                        <UserGroupIcon className="h-12 w-12" />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-slate-800 tracking-tight">Ninguém encontrado</h3>
                        <p className="text-slate-400 font-medium">Tente ajustar seus filtros de busca.</p>
                    </div>
                </div>
            )}
            {showCreateModal && (
                <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md relative">
                        {/* Header */}
                        <div className="bg-emerald-600 px-6 py-4 rounded-t-lg">
                            <h3 className="text-xl font-bold text-white">Novo Funcionário</h3>
                            <p className="text-emerald-100 text-sm mt-1">Preencha os dados para criar a conta</p>
                        </div>

                        {/* Form */}
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Nome Completo <span className="text-red-500">*</span>
                                </label>
                                <input
                                    className="w-full border border-gray-300 p-2.5 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
                                    placeholder="Ex: João Silva"
                                    value={newEmployee.name}
                                    onChange={e => setNewEmployee({ ...newEmployee, name: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Email (Login) <span className="text-red-500">*</span>
                                </label>
                                <input
                                    className="w-full border border-gray-300 p-2.5 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
                                    placeholder="joao@empresa.com"
                                    type="email"
                                    value={newEmployee.email}
                                    onChange={e => setNewEmployee({ ...newEmployee, email: e.target.value })}
                                />
                                <p className="mt-1 text-xs text-gray-500">Será usado para fazer login</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Senha Provisória <span className="text-red-500">*</span>
                                </label>
                                <input
                                    className="w-full border border-gray-300 p-2.5 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
                                    placeholder="Mínimo 6 caracteres"
                                    type="password"
                                    value={newEmployee.password}
                                    onChange={e => setNewEmployee({ ...newEmployee, password: e.target.value })}
                                />
                                <p className="mt-1 text-xs text-gray-500">Funcionário deve trocar no primeiro acesso</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Telefone para SMS
                                </label>
                                <input
                                    className="w-full border border-gray-300 p-2.5 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
                                    placeholder="+55 (11) 99999-9999"
                                    value={newEmployee.phone}
                                    onChange={e => setNewEmployee({ ...newEmployee, phone: e.target.value })}
                                />
                                <p className="mt-1 text-xs text-gray-500">Formato internacional: +5511999999999</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Cargo <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        className="w-full border border-gray-300 p-2.5 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
                                        value={newEmployee.role}
                                        onChange={e => setNewEmployee({ ...newEmployee, role: e.target.value })}
                                    >
                                        <option value="employee">Funcionário</option>
                                        <option value="manager">Gerente</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Escalas de Trabalho
                                    </label>
                                    <div className="border border-gray-300 rounded-md p-2 max-h-32 overflow-y-auto bg-white">
                                        {shifts.length === 0 && <p className="text-xs text-gray-400">Nenhuma escala cadastrada</p>}
                                        {shifts.map(s => (
                                            <div key={s.id} className="flex items-center mb-1">
                                                <input
                                                    type="checkbox"
                                                    id={`shift-${s.id}`}
                                                    checked={newEmployee.shiftIds?.includes(s.id)}
                                                    onChange={e => {
                                                        const current = newEmployee.shiftIds || []
                                                        if (e.target.checked) {
                                                            setNewEmployee({ ...newEmployee, shiftIds: [...current, s.id] })
                                                        } else {
                                                            setNewEmployee({ ...newEmployee, shiftIds: current.filter(id => id !== s.id) })
                                                        }
                                                    }}
                                                    className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded"
                                                />
                                                <label htmlFor={`shift-${s.id}`} className="ml-2 text-sm text-gray-700">
                                                    {s.name}
                                                </label>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Info box */}
                            <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                                <p className="text-xs text-blue-800">
                                    <strong>💡 Dica:</strong> O funcionário receberá as credenciais e poderá fazer login imediatamente no app mobile.
                                </p>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 bg-gray-50 rounded-b-lg flex justify-end gap-3">
                            <button
                                onClick={() => {
                                    setShowCreateModal(false)
                                    setNewEmployee({ name: '', email: '', password: '', role: 'employee', phone: '', shiftId: 'none', shiftIds: [] })
                                }}
                                disabled={inviteLoading}
                                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition disabled:opacity-50"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleInvite}
                                disabled={inviteLoading}
                                className="px-6 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition disabled:opacity-50 flex items-center gap-2"
                            >
                                {inviteLoading ? (
                                    <>
                                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                        Criando...
                                    </>
                                ) : (
                                    '✓ Criar Funcionário'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Employee Modal */}
            {showEditModal && selectedEmployee && (
                <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg shadow-xl w-96 relative">
                        <h3 className="text-lg font-bold mb-4">Editar Funcionário</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
                                <input
                                    className="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    value={selectedEmployee.full_name || ''}
                                    onChange={e => setSelectedEmployee({ ...selectedEmployee, full_name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                <input
                                    className="w-full border border-gray-300 p-2 rounded bg-gray-100"
                                    value={selectedEmployee.email || ''}
                                    disabled
                                    title="Email não pode ser alterado"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Cargo</label>
                                <select
                                    className="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    value={selectedEmployee.role}
                                    onChange={e => setSelectedEmployee({ ...selectedEmployee, role: e.target.value })}
                                >
                                    <option value="employee">Funcionário</option>
                                    <option value="manager">Gerente</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                                <input
                                    className="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    value={selectedEmployee.phone || ''}
                                    onChange={e => setSelectedEmployee({ ...selectedEmployee, phone: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Escalas de Trabalho</label>
                                <div className="border border-gray-300 rounded-md p-2 max-h-32 overflow-y-auto bg-white">
                                    {shifts.length === 0 && <p className="text-xs text-gray-400">Nenhuma escala cadastrada</p>}
                                    {shifts.map(s => {
                                        const currentShifts = selectedEmployee.employee_shifts?.map((es: any) => es.shift_rules.id) || []
                                        const isSelected = currentShifts.includes(s.id)
                                        return (
                                            <div key={s.id} className="flex items-center mb-1">
                                                <input
                                                    type="checkbox"
                                                    id={`edit-shift-${s.id}`}
                                                    checked={isSelected}
                                                    onChange={e => {
                                                        let newShifts = [...currentShifts]
                                                        if (e.target.checked) {
                                                            newShifts.push(s.id)
                                                        } else {
                                                            newShifts = newShifts.filter(id => id !== s.id)
                                                        }
                                                        // Reconstruct employee_shifts object structure for state
                                                        const newEmployeeShifts = newShifts.map(id => ({
                                                            shift_rules: shifts.find(shift => shift.id === id) || { id, name: 'Unknown' }
                                                        }))
                                                        setSelectedEmployee({ ...selectedEmployee, employee_shifts: newEmployeeShifts })
                                                    }}
                                                    className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded"
                                                />
                                                <label htmlFor={`edit-shift-${s.id}`} className="ml-2 text-sm text-gray-700">
                                                    {s.name}
                                                </label>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 mt-4">
                                <button
                                    onClick={() => {
                                        setShowEditModal(false)
                                        setSelectedEmployee(null)
                                    }}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleEdit}
                                    className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                                >
                                    Salvar Alterações
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <SmartOnboardingModal
                isOpen={showOnboardingModal}
                onClose={() => setShowOnboardingModal(false)}
                onSuccess={handleSmartOnboarding}
            />

            {/* History Modal */}
            {showHistoryModal && historyTargetId && (
                <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-2xl relative max-h-[90vh] flex flex-col">
                        <button
                            onClick={() => setShowHistoryModal(false)}
                            className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
                        >
                            <XMarkIcon className="h-6 w-6" />
                        </button>
                        <h3 className="text-lg font-bold mb-4">Histórico de Auditoria</h3>
                        <div className="flex-1 overflow-auto">
                            <AuditHistory userId={historyTargetId} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

function EmployeeStatCard({ title, value, icon, color, percentage }: any) {
    const colorClasses: any = {
        indigo: 'text-indigo-600 bg-indigo-50',
        emerald: 'text-emerald-600 bg-emerald-50',
        amber: 'text-amber-600 bg-amber-50',
        rose: 'text-rose-600 bg-rose-50'
    }

    return (
        <div className="premium-card p-6 flex items-center justify-between hover:scale-[1.02] transition-transform bg-white">
            <div className="flex items-center gap-4">
                <div className={`h-12 w-12 rounded-2xl flex items-center justify-center text-xl shadow-inner ${colorClasses[color]}`}>
                    {icon}
                </div>
                <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</p>
                    <div className="flex items-baseline gap-2 mt-1">
                        <h4 className="text-2xl font-black text-slate-900">{value}</h4>
                        {percentage !== undefined && (
                            <span className="text-[10px] font-bold text-slate-400">({percentage}%)</span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

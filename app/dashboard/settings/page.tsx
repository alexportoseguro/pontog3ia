'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import {
    CalendarDaysIcon,
    BuildingOfficeIcon,
    MapPinIcon,
    PlusIcon,
    TrashIcon
} from '@heroicons/react/24/outline'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Holiday = {
    id: string
    name: string
    date: string
    is_working_day: boolean
}

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState<'company' | 'holidays' | 'geofence'>('company')
    const [holidays, setHolidays] = useState<Holiday[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    // Company info
    const [companyId, setCompanyId] = useState<string | null>(null)
    const [companyName, setCompanyName] = useState('')
    const [companyDetails, setCompanyDetails] = useState({
        cnpj: '',
        phone: '',
        email_contact: '',
        website: '',
        address: '',
        city: '',
        state: '',
        zip_code: ''
    })
    const [requireAuditoria, setRequireAuditoria] = useState(true)

    // Geofence
    const [geofence, setGeofence] = useState({
        latitude: '',
        longitude: '',
        radius_meters: 100
    })

    // New holiday form
    const [newHoliday, setNewHoliday] = useState({
        name: '',
        date: '',
        is_working_day: false
    })

    useEffect(() => {
        fetchCompanySettings()
    }, [])

    useEffect(() => {
        if (activeTab === 'holidays') {
            fetchHolidays()
        }
    }, [activeTab])

    async function fetchCompanySettings() {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data: profile } = await supabase
                .from('profiles')
                .select('company_id')
                .eq('id', user.id)
                .single()

            if (profile?.company_id) {
                setCompanyId(profile.company_id)
                const { data: company } = await supabase
                    .from('companies')
                    .select('*')
                    .eq('id', profile.company_id)
                    .single()

                if (company) {
                    setCompanyName(company.name)
                    setGeofence({
                        latitude: company.latitude?.toString() || '',
                        longitude: company.longitude?.toString() || '',
                        radius_meters: company.radius_meters || 100
                    })
                    setCompanyDetails({
                        cnpj: company.cnpj || '',
                        phone: company.phone || '',
                        email_contact: company.email_contact || '',
                        website: company.website || '',
                        address: company.address || '',
                        city: company.city || '',
                        state: company.state || '',
                        zip_code: company.zip_code || ''
                    })
                    setRequireAuditoria(company.require_facial_recognition ?? true)
                }
            }
        } catch (error) {
            console.error('Error fetching settings:', error)
        }
    }

    async function saveCompanySettings() {
        if (!companyId) return
        setSaving(true)
        try {
            const { error } = await supabase
                .from('companies')
                .update({
                    name: companyName,
                    latitude: parseFloat(geofence.latitude),
                    longitude: parseFloat(geofence.longitude),
                    radius_meters: geofence.radius_meters,
                    require_facial_recognition: requireAuditoria,
                    ...companyDetails
                })
                .eq('id', companyId)

            if (error) throw error
            alert('Configurações atualizadas com sucesso!')
        } catch (error: any) {
            alert('Erro ao salvar: ' + error.message)
        } finally {
            setSaving(false)
        }
    }

    async function fetchHolidays() {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('holidays')
                .select('*')
                .order('date', { ascending: true })

            if (error) {
                console.error('Error fetching holidays:', error)
                setHolidays([])
            } else {
                setHolidays(data || [])
            }
        } catch (error) {
            console.error('Error:', error)
            setHolidays([])
        } finally {
            setLoading(false)
        }
    }

    async function addHoliday() {
        if (!newHoliday.name || !newHoliday.date) {
            alert('Preencha nome e data')
            return
        }

        try {
            const { error } = await supabase.from('holidays').insert({
                name: newHoliday.name,
                date: newHoliday.date,
                is_working_day: newHoliday.is_working_day,
                company_id: companyId
            })

            if (error) throw error

            setNewHoliday({ name: '', date: '', is_working_day: false })
            fetchHolidays()
        } catch (error: any) {
            alert('Erro ao adicionar: ' + error.message)
        }
    }

    async function deleteHoliday(id: string) {
        if (!confirm('Remover este feriado?')) return

        try {
            const { error } = await supabase.from('holidays').delete().eq('id', id)
            if (error) throw error
            fetchHolidays()
        } catch (error: any) {
            alert('Erro ao remover: ' + error.message)
        }
    }

    async function seedBrazilianHolidays() {
        if (!companyId) return
        const currentYear = new Date().getFullYear()
        const brazilianHolidays = [
            { name: 'Ano Novo', date: `${currentYear}-01-01`, is_working_day: false, company_id: companyId },
            { name: 'Carnaval', date: `${currentYear}-02-13`, is_working_day: false, company_id: companyId },
            { name: 'Sexta-feira Santa', date: `${currentYear}-03-29`, is_working_day: false, company_id: companyId },
            { name: 'Tiradentes', date: `${currentYear}-04-21`, is_working_day: false, company_id: companyId },
            { name: 'Dia do Trabalho', date: `${currentYear}-05-01`, is_working_day: false, company_id: companyId },
            { name: 'Corpus Christi', date: `${currentYear}-05-30`, is_working_day: false, company_id: companyId },
            { name: 'Independência', date: `${currentYear}-09-07`, is_working_day: false, company_id: companyId },
            { name: 'Nossa Senhora Aparecida', date: `${currentYear}-10-12`, is_working_day: false, company_id: companyId },
            { name: 'Finados', date: `${currentYear}-11-02`, is_working_day: false, company_id: companyId },
            { name: 'Proclamação da República', date: `${currentYear}-11-15`, is_working_day: false, company_id: companyId },
            { name: 'Consciência Negra', date: `${currentYear}-11-20`, is_working_day: false, company_id: companyId },
            { name: 'Natal', date: `${currentYear}-12-25`, is_working_day: false, company_id: companyId },
        ]

        try {
            const { error } = await supabase.from('holidays').insert(brazilianHolidays)
            if (error) throw error
            alert('Feriados brasileiros adicionados!')
            fetchHolidays()
        } catch (error: any) {
            alert('Erro ao importar: ' + error.message)
        }
    }

    return (
        <div className="min-h-screen animate-fade-in -m-4 md:-m-0 rounded-3xl overflow-hidden bg-slate-50">
            {/* Premium Header */}
            <div className="glass-effect p-8 border-b border-slate-200/50 relative z-30">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-indigo-50 rounded-xl">
                                <BuildingOfficeIcon className="h-6 w-6 text-indigo-600" />
                            </div>
                            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Configurações</h1>
                        </div>
                        <p className="text-slate-500 font-medium">Gerencie parâmetros globais e políticas da sua organização.</p>
                    </div>

                    {/* Premium Tabs */}
                    <div className="flex p-1.5 bg-slate-900/5 backdrop-blur-sm rounded-2xl w-full lg:w-auto overflow-x-auto">
                        {[
                            { key: 'company', label: 'Empresa', icon: BuildingOfficeIcon },
                            { key: 'holidays', label: 'Feriados', icon: CalendarDaysIcon },
                            { key: 'geofence', label: 'Cerca Geográfica', icon: MapPinIcon }
                        ].map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key as any)}
                                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === tab.key
                                    ? 'bg-white text-indigo-600 shadow-xl shadow-indigo-100'
                                    : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
                                    }`}
                            >
                                <tab.icon className="h-4 w-4" />
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="p-8">
                <div className="max-w-4xl mx-auto space-y-8">
                    {/* Company Tab */}
                    {activeTab === 'company' && (
                        <div className="premium-card p-10 bg-white/90 backdrop-blur-sm animate-fade-in space-y-8">

                            {/* Identity Section */}
                            <div>
                                <h2 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2">
                                    <BuildingOfficeIcon className="h-6 w-6 text-indigo-600" />
                                    Identidade da Organização
                                </h2>
                                <div className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Nome Fantasia</label>
                                            <input
                                                type="text"
                                                value={companyName}
                                                onChange={(e) => setCompanyName(e.target.value)}
                                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 transition-all"
                                                placeholder="Nome da Empresa"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">CNPJ</label>
                                            <input
                                                type="text"
                                                value={companyDetails.cnpj}
                                                onChange={(e) => setCompanyDetails({ ...companyDetails, cnpj: e.target.value })}
                                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 transition-all"
                                                placeholder="00.000.000/0000-00"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Telefone</label>
                                            <input
                                                type="text"
                                                value={companyDetails.phone}
                                                onChange={(e) => setCompanyDetails({ ...companyDetails, phone: e.target.value })}
                                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 transition-all"
                                                placeholder="(00) 00000-0000"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Email Contato</label>
                                            <input
                                                type="email"
                                                value={companyDetails.email_contact}
                                                onChange={(e) => setCompanyDetails({ ...companyDetails, email_contact: e.target.value })}
                                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 transition-all"
                                                placeholder="contato@empresa.com"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Site</label>
                                            <input
                                                type="text"
                                                value={companyDetails.website}
                                                onChange={(e) => setCompanyDetails({ ...companyDetails, website: e.target.value })}
                                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 transition-all"
                                                placeholder="www.empresa.com"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Endereço Completo</label>
                                        <input
                                            type="text"
                                            value={companyDetails.address}
                                            onChange={(e) => setCompanyDetails({ ...companyDetails, address: e.target.value })}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 transition-all"
                                            placeholder="Rua, Número, Bairro"
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Cidade</label>
                                            <input
                                                type="text"
                                                value={companyDetails.city}
                                                onChange={(e) => setCompanyDetails({ ...companyDetails, city: e.target.value })}
                                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 transition-all"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Estado (UF)</label>
                                            <input
                                                type="text"
                                                maxLength={2}
                                                value={companyDetails.state}
                                                onChange={(e) => setCompanyDetails({ ...companyDetails, state: e.target.value.toUpperCase() })}
                                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 transition-all"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">CEP</label>
                                            <input
                                                type="text"
                                                value={companyDetails.zip_code}
                                                onChange={(e) => setCompanyDetails({ ...companyDetails, zip_code: e.target.value })}
                                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 transition-all"
                                                placeholder="00000-000"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <hr className="border-slate-100" />

                            {/* Security Section */}
                            <div>
                                <h2 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2">
                                    <div className="p-1 bg-indigo-100 rounded-lg">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-indigo-600">
                                            <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 0 0-5.25 5.25v3a3 3 0 0 0-3 3v6.75a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3v-6.75a3 3 0 0 0-3-3v-3c0-2.9-2.35-5.25-5.25-5.25Zm3.75 8.25v-3a3.75 3.75 0 1 0-7.5 0v3h7.5Z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                    Segurança e Auditoria
                                </h2>

                                <div className="flex items-center justify-between p-6 bg-slate-50 border border-slate-200 rounded-2xl">
                                    <div className="space-y-1">
                                        <h3 className="font-bold text-slate-900">Reconhecimento Facial Obrigatório</h3>
                                        <p className="text-xs text-slate-500 font-medium max-w-md">
                                            Exigir biometria facial do colaborador ao iniciar o expediente. Isso garante a identidade e previne fraudes de ponto.
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setRequireAuditoria(!requireAuditoria)}
                                        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${requireAuditoria ? 'bg-indigo-600' : 'bg-slate-200'}`}
                                    >
                                        <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition shadow-sm ${requireAuditoria ? 'translate-x-6' : 'translate-x-1'}`} />
                                    </button>
                                </div>
                            </div>

                            <div className="flex justify-end pt-4">
                                <button
                                    onClick={saveCompanySettings}
                                    disabled={saving}
                                    className="px-8 py-4 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-500/20 text-xs font-black uppercase tracking-widest text-white hover:bg-indigo-700 transition-all transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {saving ? 'Salvando...' : 'Salvar Alterações'}
                                </button>
                            </div>
                        </div>
                    )}


                    {/* Holidays Tab */}
                    {activeTab === 'holidays' && (
                        <div className="space-y-8 animate-fade-in">
                            {/* Add Holiday Form */}
                            <div className="premium-card p-10 bg-white/90 backdrop-blur-sm">
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
                                    <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                                        <CalendarDaysIcon className="h-6 w-6 text-indigo-600" />
                                        Calendário de Feriados
                                    </h2>
                                    <button
                                        onClick={seedBrazilianHolidays}
                                        className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:text-indigo-700 transition-colors flex items-center gap-2"
                                    >
                                        <PlusIcon className="h-4 w-4" />
                                        Importar Feriados {new Date().getFullYear()}
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
                                    <div className="md:col-span-12 lg:col-span-5 space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Descrição</label>
                                        <input
                                            type="text"
                                            value={newHoliday.name}
                                            onChange={(e) => setNewHoliday({ ...newHoliday, name: e.target.value })}
                                            placeholder="Ex: Aniversário da Cidade"
                                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 transition-all"
                                        />
                                    </div>
                                    <div className="md:col-span-12 lg:col-span-4 space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Data</label>
                                        <input
                                            type="date"
                                            value={newHoliday.date}
                                            onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 transition-all"
                                        />
                                    </div>
                                    <div className="md:col-span-12 lg:col-span-3">
                                        <button
                                            onClick={addHoliday}
                                            className="w-full py-4 bg-slate-900 rounded-2xl shadow-lg text-xs font-black uppercase tracking-widest text-white hover:bg-slate-800 transition-all transform hover:scale-105 active:scale-95"
                                        >
                                            Cadastrar
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Holidays List */}
                            <div className="premium-card p-10 bg-white/90 backdrop-blur-sm">
                                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 px-1">Listagem de Eventos</h3>
                                {loading ? (
                                    <div className="py-20 text-center animate-pulse space-y-4">
                                        <div className="h-12 w-12 bg-slate-100 rounded-full mx-auto"></div>
                                        <p className="text-xs font-bold text-slate-400">Sincronizando dados...</p>
                                    </div>
                                ) : holidays.length === 0 ? (
                                    <div className="py-20 text-center bg-slate-50 rounded-3xl space-y-4">
                                        <CalendarDaysIcon className="h-10 w-10 text-slate-200 mx-auto" />
                                        <p className="text-sm font-bold text-slate-400">Nenhum feriado configurado</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {holidays.map(holiday => (
                                            <div
                                                key={holiday.id}
                                                className="group flex items-center justify-between p-5 bg-white border border-slate-100 rounded-2xl hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-500/5 transition-all"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className="h-10 w-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 font-black text-xs">
                                                        {new Date(holiday.date + 'T00:00:00').getDate()}
                                                    </div>
                                                    <div>
                                                        <p className="font-black text-slate-900 text-sm tracking-tight">{holiday.name}</p>
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                            {new Date(holiday.date + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                                                        </p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => deleteHoliday(holiday.id)}
                                                    className="opacity-0 group-hover:opacity-100 p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                                                >
                                                    <TrashIcon className="h-5 w-5" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Geofence Tab */}
                    {activeTab === 'geofence' && (
                        <div className="premium-card p-10 bg-white/90 backdrop-blur-sm animate-fade-in">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
                                <div>
                                    <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                                        <MapPinIcon className="h-6 w-6 text-indigo-600" />
                                        Cerca Geográfica
                                    </h2>
                                    <p className="text-slate-500 font-medium text-sm mt-1">Defina o perímetro de validação para registro de ponto na sede.</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-6">
                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Latitude</label>
                                            <input
                                                type="text"
                                                value={geofence.latitude}
                                                onChange={(e) => setGeofence({ ...geofence, latitude: e.target.value })}
                                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 transition-all font-mono"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Longitude</label>
                                            <input
                                                type="text"
                                                value={geofence.longitude}
                                                onChange={(e) => setGeofence({ ...geofence, longitude: e.target.value })}
                                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 transition-all font-mono"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Raio de Validação (Metros)</label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                value={geofence.radius_meters}
                                                onChange={(e) => setGeofence({ ...geofence, radius_meters: parseInt(e.target.value) })}
                                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 transition-all"
                                            />
                                            <span className="absolute right-5 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Metros</span>
                                        </div>
                                    </div>
                                    <div className="pt-4">
                                        <button
                                            onClick={saveCompanySettings}
                                            disabled={saving}
                                            className="w-full py-4 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-500/20 text-xs font-black uppercase tracking-widest text-white hover:bg-indigo-700 transition-all transform hover:scale-105 active:scale-95 disabled:opacity-50"
                                        >
                                            {saving ? 'Salvando...' : 'Atualizar Cerca'}
                                        </button>
                                    </div>
                                </div>

                                <div className="bg-slate-50 rounded-3xl p-8 flex flex-col justify-center border border-slate-100">
                                    <div className="flex items-center gap-3 mb-4">
                                        <span className="text-2xl">💡</span>
                                        <p className="text-xs font-bold text-slate-600">Dica de Configuração</p>
                                    </div>
                                    <p className="text-slate-500 text-sm leading-relaxed">
                                        Para obter as coordenadas precisas, abra o <b>Google Maps</b>, clique com o botão direito no local desejado e selecione as coordenadas que aparecem no topo do menu. Um raio entre <b>50m e 200m</b> é recomendado para compensar imprecisões de GPS em dispositivos móveis.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

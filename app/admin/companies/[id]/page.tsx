
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { ArrowLeftIcon, UserIcon } from '@heroicons/react/24/outline'

export default async function CompanyDetailPage({ params }: { params: { id: string } }) {
    const supabase = createServerComponentClient({ cookies })

    // Fetch company
    const { data: company, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', params.id)
        .single()

    if (error || !company) {
        return <div>Empresa não encontrada</div>
    }

    // Fetch users for this company
    // Note: profiles table has company_id
    const { data: users } = await supabase
        .from('profiles')
        .select('*')
        .eq('company_id', params.id)
        .order('created_at', { ascending: false })

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <Link href="/admin" className="text-sm text-slate-500 hover:text-indigo-600 flex items-center gap-1 mb-4">
                    <ArrowLeftIcon className="w-4 h-4" />
                    Voltar para Lista
                </Link>
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900">{company.name}</h1>
                        <p className="text-slate-500 font-mono text-sm mt-1">ID: {company.id}</p>
                    </div>
                    <div className="flex gap-3">
                        <span className={`px-3 py-1 rounded-full text-sm font-semibold border ${company.subscription_status === 'active'
                                ? 'bg-green-50 text-green-700 border-green-200'
                                : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                            }`}>
                            {company.subscription_status?.toUpperCase() || 'UNKNOWN'}
                        </span>
                        <span className="px-3 py-1 rounded-full text-sm font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            {company.plan_tier?.toUpperCase() || 'FREE'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="text-sm font-semibold text-slate-500 uppercase mb-4">Dados da Empresa</h3>
                    <div className="space-y-3">
                        <div>
                            <label className="text-xs text-slate-400">CNPJ</label>
                            <p className="font-medium text-slate-900">{company.cnpj || 'Não informado'}</p>
                        </div>
                        <div>
                            <label className="text-xs text-slate-400">Criado em</label>
                            <p className="font-medium text-slate-900">{new Date(company.created_at).toLocaleDateString()}</p>
                        </div>
                        <div>
                            <label className="text-xs text-slate-400">Localização Base</label>
                            <p className="font-medium text-slate-900 text-sm">{company.latitude}, {company.longitude}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="text-sm font-semibold text-slate-500 uppercase mb-4">Configurações</h3>
                    <div className="space-y-3">
                        <div>
                            <label className="text-xs text-slate-400">Jornada</label>
                            <p className="font-medium text-slate-900">{company.work_start_time} - {company.work_end_time}</p>
                        </div>
                        <div>
                            <label className="text-xs text-slate-400">Tolerância</label>
                            <p className="font-medium text-slate-900">{company.tolerance_minutes} min</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="text-sm font-semibold text-slate-500 uppercase mb-4">Assinatura</h3>
                    <div className="space-y-3">
                        <div>
                            <label className="text-xs text-slate-400">Status</label>
                            <p className="font-medium text-slate-900">{company.subscription_status}</p>
                        </div>
                        <div>
                            <label className="text-xs text-slate-400">Plano</label>
                            <p className="font-medium text-slate-900">{company.plan_tier}</p>
                        </div>
                        <button className="mt-2 text-sm text-indigo-600 font-medium hover:underline">
                            Editar Assinatura
                        </button>
                    </div>
                </div>
            </div>

            {/* Users List */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                    <h3 className="font-bold text-slate-900">Usuários ({users?.length || 0})</h3>
                </div>
                <table className="w-full text-left text-sm text-slate-600">
                    <thead className="bg-white text-slate-900 font-semibold border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-3">Nome</th>
                            <th className="px-6 py-3">Função</th>
                            <th className="px-6 py-3">Status</th>
                            <th className="px-6 py-3">Último Acesso</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {users?.map((user) => (
                            <tr key={user.id} className="hover:bg-slate-50">
                                <td className="px-6 py-3 flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                                        <UserIcon className="w-4 h-4 text-slate-500" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-slate-900">{user.full_name || 'Sem nome'}</p>
                                        <p className="text-xs text-slate-400">{user.id}</p>
                                    </div>
                                </td>
                                <td className="px-6 py-3">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${user.role === 'admin' ? 'bg-purple-50 text-purple-700' : 'bg-slate-100 text-slate-600'
                                        }`}>
                                        {user.role}
                                    </span>
                                </td>
                                <td className="px-6 py-3">
                                    <span className="text-slate-600">{user.current_status || 'offline'}</span>
                                </td>
                                <td className="px-6 py-3 text-slate-500">
                                    {user.last_seen ? new Date(user.last_seen).toLocaleString() : '-'}
                                </td>
                            </tr>
                        ))}
                        {(!users || users.length === 0) && (
                            <tr>
                                <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                                    Nenhum usuário encontrado.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

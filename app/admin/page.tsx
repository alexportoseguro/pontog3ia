
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { PlusIcon } from '@heroicons/react/24/solid'

export default async function AdminDashboard() {
    const supabase = await createClient()

    // Fetch companies
    const { data: companies, error } = await supabase
        .from('companies')
        .select('*')
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching companies:', error)
    }

    // Fetch user counts (simple for now)
    // In production, use .select('*, profiles(count)') or a join ideally
    // But since profiles.company_id is the link, let's just do a count for each or separate query

    // Optimized: get all profiles count grouped by company_id? 
    // For MVP, limit complexity: fetch all profiles and count locally (bad for scale)
    // Better: use rpc function or acceptable separate queries if manageable
    // Let's stick to listing companies first.

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Empresas</h1>
                    <p className="text-slate-500">Gerencie os clientes da plataforma SaaS</p>
                </div>
                <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium">
                    <PlusIcon className="w-5 h-5" />
                    Nova Empresa
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left text-sm text-slate-600">
                    <thead className="bg-slate-50 text-slate-900 font-semibold border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-4">Nome da Empresa</th>
                            <th className="px-6 py-4">CNPJ</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4">Plano</th>
                            <th className="px-6 py-4">Criado em</th>
                            <th className="px-6 py-4 text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {companies?.map((company) => (
                            <tr key={company.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4 font-medium text-slate-900">
                                    {company.name}
                                </td>
                                <td className="px-6 py-4 text-slate-500 font-mono text-xs">
                                    {company.cnpj || 'N/A'}
                                </td>
                                <td className="px-6 py-4">
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
                                        <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                                        Ativo
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="text-slate-600 font-medium">Free Tier</span>
                                </td>
                                <td className="px-6 py-4 text-slate-500">
                                    {new Date(company.created_at).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <Link href={`/admin/companies/${company.id}`} className="text-indigo-600 hover:text-indigo-800 font-medium hover:underline">
                                        Detalhes
                                    </Link>
                                </td>
                            </tr>
                        ))}

                        {(!companies || companies.length === 0) && (
                            <tr>
                                <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                    Nenhuma empresa cadastrada.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

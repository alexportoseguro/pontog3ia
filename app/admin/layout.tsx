
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { BuildingOffice2Icon, UsersIcon, CurrencyDollarIcon, ArrowLeftOnRectangleIcon } from '@heroicons/react/24/outline'

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const supabase = createServerComponentClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
        redirect('/login')
    }

    // Check if user is super_admin
    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()

    if (profile?.role !== 'super_admin') {
        redirect('/dashboard')
    }

    return (
        <div className="min-h-screen bg-slate-50 flex">
            {/* Sidebar */}
            <aside className="w-64 bg-slate-900 text-white flex flex-col fixed h-full">
                <div className="p-6 border-b border-slate-800">
                    <h1 className="text-xl font-bold tracking-tight">PontoG3 <span className="text-indigo-400">Admin</span></h1>
                </div>

                <nav className="flex-1 p-4 space-y-1">
                    <Link href="/admin" className="flex items-center gap-3 px-4 py-3 text-slate-300 hover:bg-slate-800 hover:text-white rounded-lg transition-colors">
                        <BuildingOffice2Icon className="w-5 h-5" />
                        Empresas
                    </Link>
                    <Link href="/admin/users" className="flex items-center gap-3 px-4 py-3 text-slate-300 hover:bg-slate-800 hover:text-white rounded-lg transition-colors">
                        <UsersIcon className="w-5 h-5" />
                        Usuários
                    </Link>
                    <Link href="/admin/finance" className="flex items-center gap-3 px-4 py-3 text-slate-300 hover:bg-slate-800 hover:text-white rounded-lg transition-colors">
                        <CurrencyDollarIcon className="w-5 h-5" />
                        Financeiro
                    </Link>
                </nav>

                <div className="p-4 border-t border-slate-800">
                    <Link href="/dashboard" className="flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-white rounded-lg transition-colors">
                        <ArrowLeftOnRectangleIcon className="w-5 h-5" />
                        Voltar ao App
                    </Link>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 ml-64 p-8">
                {children}
            </main>
        </div>
    )
}

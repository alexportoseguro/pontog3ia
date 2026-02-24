'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import {
    HomeIcon,
    UserGroupIcon,
    ClockIcon,
    ChatBubbleLeftRightIcon,
    Cog6ToothIcon,
    CheckCircleIcon,
    DocumentChartBarIcon,
    MapIcon,
    SparklesIcon,
    ShieldCheckIcon,
    ArrowRightOnRectangleIcon
} from '@heroicons/react/24/outline'
import { createClient } from '@supabase/supabase-js'
import { useEffect } from 'react'

const NotificationDropdown = dynamic(() => import('@/components/NotificationDropdown'), { ssr: false })

const navigation = [
    { name: 'Visão Geral', href: '/dashboard', icon: HomeIcon },
    { name: 'Funcionários', href: '/dashboard/employees', icon: UserGroupIcon },
    { name: 'Relatórios', href: '/dashboard/reports', icon: DocumentChartBarIcon },
    { name: 'Mapa (Ao Vivo)', href: '/dashboard/map', icon: MapIcon },
    { name: 'Diário / Feed', href: '/dashboard/feed', icon: ChatBubbleLeftRightIcon },
    { name: 'Aprovações', href: '/dashboard/approvals', icon: CheckCircleIcon },
    { name: 'Concierge IA', href: '/dashboard/concierge', icon: SparklesIcon },
    { name: 'Auditoria', href: '/dashboard/audit', icon: ShieldCheckIcon },
    { name: 'Configurações', href: '/dashboard/settings', icon: Cog6ToothIcon },
]

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const pathname = usePathname()
    const [user, setUser] = useState<{ full_name: string | null, role: string, email: string } | null>(null)
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const router = useRouter()

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push('/login')
    }

    useEffect(() => {
        const fetchUser = async () => {
            const { data: { user: authUser } } = await supabase.auth.getUser()
            if (authUser) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', authUser.id)
                    .single()

                const userData = {
                    full_name: profile?.full_name || authUser.user_metadata?.full_name || 'Usuário',
                    role: profile?.role || 'employee',
                    email: authUser.email || ''
                }
                setUser(userData)

                // RBAC - Route Protection
                // If user is employee, block access to restricted routes
                const role = userData.role || 'employee'

                if (role === 'employee') {
                    const restrictedRoutes = [
                        '/dashboard/employees',
                        // '/dashboard/reports', // Allowed
                        '/dashboard/settings',
                        // '/dashboard/approvals', // Allowed: Adapted for "My Requests"
                        '/dashboard/map'
                    ]

                    // Simple check: if current pathname starts with any restricted route
                    if (restrictedRoutes.some(route => pathname.startsWith(route))) {
                        // Redirect to safe functionality
                        window.location.href = '/dashboard'
                    }
                }
            }
        }
        fetchUser()
    }, [pathname])

    const getRoleLabel = (role: string) => {
        if (role === 'admin') return 'Gestor'
        if (role === 'manager') return 'Gerente'
        return 'Funcionário'
    }

    return (
        <div className="min-h-screen bg-slate-50 flex font-sans">
            {/* Sidebar */}
            <div className="hidden md:flex md:w-72 md:flex-col md:fixed md:inset-y-0 bg-slate-900 shadow-2xl z-20">
                <div className="flex-1 flex flex-col min-h-0">
                    <div className="flex items-center h-20 flex-shrink-0 px-6 bg-slate-900/50 backdrop-blur-md border-b border-slate-800/50">
                        <div className="text-2xl font-black text-white flex items-center gap-3 tracking-tighter">
                            <div className="relative h-10 w-10 bg-gradient-to-tr from-indigo-600 via-violet-600 to-indigo-400 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20 group">
                                <div className="absolute inset-0 bg-white/20 rounded-xl blur-sm group-hover:blur-md transition-all"></div>
                                <span className="relative text-white font-black text-xl italic select-none">G3</span>
                                <div className="absolute -top-1 -right-1 h-3 w-3 bg-emerald-400 rounded-full border-2 border-slate-900 animate-pulse"></div>
                            </div>
                            <span className="bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 italic">PontoG3</span>
                        </div>
                    </div>
                    <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
                        {navigation.filter(item => {
                            const role = user?.role || 'employee'
                            if (role === 'employee') {
                                const allowedPaths = ['/dashboard', '/dashboard/feed', '/dashboard/concierge', '/dashboard/reports', '/dashboard/approvals']
                                return allowedPaths.includes(item.href)
                            }
                            return true
                        }).map((item) => {
                            const isActive = pathname === item.href
                            return (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    className={`
                                        group flex items-center px-4 py-3 text-sm font-semibold rounded-2xl transition-all duration-200
                                        ${isActive
                                            ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/25 scale-[1.02]'
                                            : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'}
                                    `}
                                >
                                    <item.icon
                                        className={`mr-3 flex-shrink-0 h-5 w-5 transition-colors ${isActive ? 'text-white' : 'text-slate-500 group-hover:text-indigo-400'
                                            }`}
                                        aria-hidden="true"
                                    />
                                    {item.name}
                                </Link>
                            )
                        })}
                    </nav>
                    <div className="flex-shrink-0 flex bg-slate-800/30 backdrop-blur-sm p-4 m-4 rounded-2xl border border-slate-700/50">
                        <div className="flex items-center w-full">
                            <div className="relative">
                                <img
                                    className="h-10 w-10 rounded-xl object-cover ring-2 ring-indigo-500/20"
                                    src={`https://ui-avatars.com/api/?name=${user?.full_name || 'User'}&background=${user?.role === 'admin' ? '4F46E5' : '10B981'}&color=fff&bold=true`}
                                    alt=""
                                />
                                <div className="absolute -bottom-1 -right-1 h-3 w-3 bg-emerald-500 border-2 border-slate-900 rounded-full"></div>
                            </div>
                            <div className="ml-3 flex-1 min-w-0">
                                <p className="text-sm font-bold text-white truncate">{user?.full_name?.split(' ')[0] || 'Carregando'}</p>
                                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{getRoleLabel(user?.role || '')}</p>
                            </div>
                            <button
                                onClick={handleLogout}
                                className="ml-auto p-2 text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all group"
                                title="Sair do Sistema"
                            >
                                <ArrowRightOnRectangleIcon className="h-6 w-6" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="md:pl-72 flex flex-col flex-1">
                {/* Top Header */}
                <header className="sticky top-0 z-10 flex-shrink-0 flex h-20 bg-white/80 backdrop-blur-xl border-b border-slate-200/60">
                    <div className="flex-1 px-8 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-indigo-600 animate-pulse"></div>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">PontoG3 • Sistema de Gestão Inteligente</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <NotificationDropdown />
                        </div>
                    </div>
                </header>

                <main className="flex-1">
                    <div className="py-8">
                        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
                            {children}
                        </div>
                    </div>
                </main>
            </div>
        </div>
    )
}

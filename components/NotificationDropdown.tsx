'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import { BellIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { BellAlertIcon } from '@heroicons/react/24/solid'
import Link from 'next/link'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Notification = {
    id: string
    title: string
    message: string
    type: string
    read: boolean
    link?: string
    created_at: string
}

export default function NotificationDropdown() {
    const [isOpen, setIsOpen] = useState(false)
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [userId, setUserId] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const dropdownRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        loadUser()

        // Click outside to close
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    useEffect(() => {
        if (userId) {
            fetchNotifications()

            // Subscribe to realtime updates
            const channel = supabase
                .channel('notifications')
                .on('postgres_changes',
                    { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
                    (payload) => {
                        console.log('Notification update:', payload)
                        fetchNotifications()
                    }
                )
                .subscribe()

            // Refresh every 30 seconds
            const interval = setInterval(fetchNotifications, 30000)

            return () => {
                channel.unsubscribe()
                clearInterval(interval)
            }
        }
    }, [userId])

    async function loadUser() {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) setUserId(user.id)
    }

    async function fetchNotifications() {
        if (!userId) return

        setLoading(true)
        try {
            const { data: { session } } = await supabase.auth.getSession()
            const headers: any = {}
            if (session?.access_token) {
                headers['Authorization'] = `Bearer ${session.access_token}`
            }

            const response = await fetch(`/api/notifications?userId=${userId}`, { headers })
            const data = await response.json()

            if (data.notifications) {
                setNotifications(data.notifications)
                setUnreadCount(data.unreadCount || 0)
            }
        } catch (error) {
            console.error('Error fetching notifications:', error)
        } finally {
            setLoading(false)
        }
    }

    async function markAsRead(notificationId: string) {
        try {
            const { data: { session } } = await supabase.auth.getSession()
            const headers: any = { 'Content-Type': 'application/json' }
            if (session?.access_token) {
                headers['Authorization'] = `Bearer ${session.access_token}`
            }

            await fetch('/api/notifications', {
                method: 'PATCH',
                headers,
                body: JSON.stringify({ notificationId, read: true })
            })

            setNotifications(notifications.map(n =>
                n.id === notificationId ? { ...n, read: true } : n
            ))
            setUnreadCount(Math.max(0, unreadCount - 1))
        } catch (error) {
            console.error('Error marking as read:', error)
        }
    }

    async function markAllAsRead() {
        const unreadIds = notifications.filter(n => !n.read).map(n => n.id)

        for (const id of unreadIds) {
            await markAsRead(id)
        }
    }

    const typeIcons: Record<string, string> = {
        approval: '✅',
        justification: '📝',
        time_off: '🏖️',
        system: '⚙️',
        concierge: '✨'
    }

    return (
        <div ref={dropdownRef} className="relative">
            {/* Bell Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-lg transition-all"
            >
                {unreadCount > 0 ? (
                    <BellAlertIcon className="h-6 w-6 text-indigo-600 animate-pulse" />
                ) : (
                    <BellIcon className="h-6 w-6" />
                )}

                {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute right-0 mt-2 w-96 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-3">
                        <div className="flex items-center justify-between">
                            <h3 className="text-white font-semibold">Notificações</h3>
                            {unreadCount > 0 && (
                                <button
                                    onClick={markAllAsRead}
                                    className="text-xs text-white/90 hover:text-white underline"
                                >
                                    Marcar todas como lidas
                                </button>
                            )}
                        </div>
                    </div>

                    {/* List */}
                    <div className="max-h-96 overflow-y-auto">
                        {loading ? (
                            <div className="p-4 text-center text-gray-500">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="p-8 text-center">
                                <BellIcon className="h-12 w-12 mx-auto text-gray-300 mb-2" />
                                <p className="text-gray-500 text-sm">Nenhuma notificação</p>
                            </div>
                        ) : (
                            notifications.map(notification => (
                                <div
                                    key={notification.id}
                                    className={`p-4 border-b border-gray-100 hover:bg-gray-50 transition-all ${!notification.read ? 'bg-indigo-50/50' : ''
                                        }`}
                                >
                                    <div className="flex items-start gap-3">
                                        <span className="text-2xl flex-shrink-0">
                                            {typeIcons[notification.type] || '📬'}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2">
                                                <p className="font-semibold text-gray-900 text-sm">
                                                    {notification.title}
                                                </p>
                                                {!notification.read && (
                                                    <button
                                                        onClick={() => markAsRead(notification.id)}
                                                        className="text-indigo-600 hover:text-indigo-700 flex-shrink-0"
                                                        title="Marcar como lida"
                                                    >
                                                        <CheckIcon className="h-4 w-4" />
                                                    </button>
                                                )}
                                            </div>
                                            <p className="text-gray-600 text-sm mt-1">
                                                {notification.message}
                                            </p>
                                            <div className="flex items-center gap-2 mt-2">
                                                <p className="text-xs text-gray-400">
                                                    {formatTimeAgo(notification.created_at)}
                                                </p>
                                                {notification.link && (
                                                    <Link
                                                        href={notification.link}
                                                        className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                                                        onClick={() => {
                                                            markAsRead(notification.id)
                                                            setIsOpen(false)
                                                        }}
                                                    >
                                                        Ver →
                                                    </Link>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Footer */}
                    {notifications.length > 0 && (
                        <div className="bg-gray-50 px-4 py-2 text-center">
                            <button
                                onClick={() => setIsOpen(false)}
                                className="text-xs text-gray-600 hover:text-gray-800"
                            >
                                Fechar
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

function formatTimeAgo(timestamp: string) {
    const minutes = Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000)
    if (minutes < 1) return 'Agora'
    if (minutes < 60) return `${minutes}min atrás`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h atrás`
    return `${Math.floor(hours / 24)}d atrás`
}

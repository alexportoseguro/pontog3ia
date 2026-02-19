
'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PaperAirplaneIcon, UserIcon, BuildingOffice2Icon } from '@heroicons/react/24/solid'

type Message = {
    id: string
    content: string
    sender_id: string
    created_at: string
    sender?: { full_name: string, email: string }
}

export default function ChatPage() {
    const [messages, setMessages] = useState<Message[]>([])
    const [inputText, setInputText] = useState('')
    const [loading, setLoading] = useState(false)
    const [user, setUser] = useState<any>(null)
    const scrollRef = useRef<HTMLDivElement>(null)
    const supabase = createClient()

    useEffect(() => {
        getUser()
    }, [])

    useEffect(() => {
        if (!user) return

        fetchMessages()

        const channel = supabase
            .channel('team_chat_web')
            .on('postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'team_messages', filter: `company_id=eq.${user.company_id}` },
                (payload) => {
                    fetchMessages()
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [user])

    const getUser = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
            // Get profile for company_id
            const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
            setUser({ ...user, ...profile })
        }
    }

    const fetchMessages = async () => {
        if (!user?.company_id) return

        const { data, error } = await supabase
            .from('team_messages')
            .select(`
                *,
                sender:sender_id (full_name, email)
            `)
            .eq('company_id', user.company_id)
            .order('created_at', { ascending: true })
            .limit(100)

        if (data) {
            setMessages(data)
            setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
        }
    }

    const sendMessage = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!inputText.trim() || !user) return

        const content = inputText
        setInputText('')

        try {
            const { error } = await supabase.from('team_messages').insert({
                content,
                sender_id: user.id,
                company_id: user.company_id
            })
            if (error) throw error
        } catch (err) {
            console.error(err)
            alert('Erro ao enviar mensagem')
        }
    }

    return (
        <div className="flex flex-col h-[calc(100vh-120px)] bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                        <BuildingOffice2Icon className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="font-bold text-slate-900">Chat da Equipe</h2>
                        <p className="text-xs text-slate-500 font-medium">{user?.company_id ? 'Conectado' : 'Conectando...'}</p>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/30">
                {messages.map((msg) => {
                    const isMe = msg.sender_id === user?.id
                    return (
                        <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                            <div className={`flex max-w-[70%] gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                                <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${isMe ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-600'}`}>
                                    <UserIcon className="w-4 h-4" />
                                </div>
                                <div className={`p-3 rounded-2xl ${isMe
                                    ? 'bg-blue-600 text-white rounded-tr-none'
                                    : 'bg-white border border-slate-100 text-slate-800 rounded-tl-none shadow-sm'
                                    }`}>
                                    {!isMe && <p className="text-xs font-bold mb-1 text-slate-400">{msg.sender?.full_name || msg.sender?.email}</p>}
                                    <p className="text-sm">{msg.content}</p>
                                    <p className={`text-[10px] mt-1 ${isMe ? 'text-blue-200' : 'text-slate-400'} text-right`}>
                                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )
                })}
                <div ref={scrollRef} />
            </div>

            <div className="p-4 bg-white border-t border-slate-100">
                <form onSubmit={sendMessage} className="flex gap-2">
                    <input
                        type="text"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder="Digite sua mensagem..."
                        className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-slate-700 placeholder:text-slate-400"
                    />
                    <button
                        type="submit"
                        disabled={!inputText.trim()}
                        className="w-12 h-12 flex items-center justify-center bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20"
                    >
                        <PaperAirplaneIcon className="w-5 h-5" />
                    </button>
                </form>
            </div>
        </div>
    )
}

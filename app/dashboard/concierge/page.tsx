'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import {
    PaperAirplaneIcon,
    SparklesIcon,
    UserIcon,
    CpuChipIcon,
    MicrophoneIcon
} from '@heroicons/react/24/solid'

// Message type matches the AI response structure
type Message = {
    id: string
    role: 'user' | 'assistant'
    content: string
    timestamp: Date
    toolsCalled?: string[]
}

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function ConciergePage() {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'welcome',
            role: 'assistant',
            content: 'Olá! Sou o Concierge PontoG3. Posso ajudar com relatórios, dúvidas sobre a equipe ou validar escalas. Como posso ser útil hoje?',
            timestamp: new Date()
        }
    ])
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)
    const scrollRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        scrollToBottom()
    }, [messages])

    const scrollToBottom = () => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    const sendMessage = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!input.trim() || loading) return

        const userMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input,
            timestamp: new Date()
        }

        setMessages(prev => [...prev, userMsg])
        setInput('')
        setLoading(true)

        try {
            // Get current session for Auth context
            const { data: { session } } = await supabase.auth.getSession()

            if (!session) {
                throw new Error('Não autenticado')
            }

            const response = await fetch('/api/ai-concierge', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ message: userMsg.content })
            })

            const data = await response.json()

            if (!response.ok || data.error) {
                const errorText = data.error || `Erro HTTP ${response.status}`
                console.error('[Concierge] Erro da API:', response.status, errorText)
                throw new Error(errorText)
            }

            const aiMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: data.response,
                timestamp: new Date(),
                toolsCalled: data.toolsCalled
            }

            setMessages(prev => [...prev, aiMsg])
        } catch (error: any) {
            console.error('Erro no concierge:', error)
            const errorMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: `⚠️ Erro: ${error.message || 'Falha ao processar pedido. Tente novamente.'}`,
                timestamp: new Date()
            }
            setMessages(prev => [...prev, errorMsg])
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="h-[calc(100vh-140px)] flex flex-col bg-white rounded-3xl shadow-xl overflow-hidden animate-fade-in border border-slate-100">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-violet-600 p-6 flex justify-between items-center text-white">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl border border-white/10">
                        <SparklesIcon className="h-6 w-6 text-yellow-300" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black tracking-tight">Concierge IA</h1>
                        <p className="text-indigo-100 text-xs font-medium">Assistente Inteligente de RH</p>
                    </div>
                </div>
                <div className="px-3 py-1 bg-white/10 rounded-full text-[10px] font-bold uppercase tracking-widest">
                    Gemini 2.0 Flash
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50 scroll-smooth">
                {messages.map((msg) => {
                    const isAi = msg.role === 'assistant'
                    return (
                        <div key={msg.id} className={`flex ${isAi ? 'justify-start' : 'justify-end'}`}>
                            <div className={`flex max-w-[80%] gap-4 ${isAi ? 'flex-row' : 'flex-row-reverse'}`}>
                                {/* Avatar */}
                                <div className={`w-10 h-10 rounded-2xl flex-shrink-0 flex items-center justify-center shadow-lg ${isAi ? 'bg-white text-indigo-600' : 'bg-indigo-600 text-white'}`}>
                                    {isAi ? <CpuChipIcon className="w-6 h-6" /> : <UserIcon className="w-5 h-5" />}
                                </div>

                                {/* Bubble */}
                                <div className={`space-y-2 ${isAi ? 'items-start' : 'items-end flex flex-col'}`}>

                                    <div className={`p-5 rounded-2xl shadow-sm leading-relaxed text-sm ${isAi
                                        ? 'bg-white text-slate-700 rounded-tl-none border border-slate-100'
                                        : 'bg-indigo-600 text-white rounded-tr-none'
                                        }`}>
                                        <p className="whitespace-pre-wrap">{msg.content}</p>
                                    </div>

                                    {/* Tool Usage Indicator */}
                                    {isAi && msg.toolsCalled && msg.toolsCalled.length > 0 && (
                                        <div className="flex gap-2">
                                            {msg.toolsCalled.map(tool => (
                                                <span key={tool} className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 bg-indigo-50 px-2 py-1 rounded-md border border-indigo-100">
                                                    🔨 {tool}
                                                </span>
                                            ))}
                                        </div>
                                    )}

                                    <span className="text-[10px] font-bold text-slate-300 block">
                                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )
                })}

                {/* Typing Indicator */}
                {loading && (
                    <div className="flex justify-start">
                        <div className="flex max-w-[80%] gap-4">
                            <div className="w-10 h-10 rounded-2xl bg-white text-indigo-600 flex-shrink-0 flex items-center justify-center shadow-lg animate-pulse">
                                <CpuChipIcon className="w-6 h-6" />
                            </div>
                            <div className="p-5 bg-white rounded-2xl rounded-tl-none shadow-sm border border-slate-100 flex items-center gap-2">
                                <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                        </div>
                    </div>
                )}
                <div ref={scrollRef} />
            </div>

            {/* Input Area */}
            <div className="p-6 bg-white border-t border-slate-100">
                <form onSubmit={sendMessage} className="relative flex gap-3">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Pergunte sobre escalas, pontos ou solicite relatórios..."
                        className="flex-1 bg-slate-50 border border-slate-200 text-slate-700 text-sm font-medium rounded-2xl px-6 py-4 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all placeholder:text-slate-400"
                        disabled={loading}
                    />
                    <button
                        type="button"
                        className="p-4 rounded-2xl bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-all"
                        title="Gravar Áudio (Em Breve)"
                    >
                        <MicrophoneIcon className="w-6 h-6" />
                    </button>
                    <button
                        type="submit"
                        disabled={!input.trim() || loading}
                        className="px-8 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-2xl shadow-lg shadow-indigo-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                        <PaperAirplaneIcon className="w-6 h-6" />
                    </button>
                </form>
                <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
                    {['Resumo da semana', 'Quem faltou hoje?', 'Minhas horas extras', 'Equipe trabalhando agora'].map(suggestion => (
                        <button
                            key={suggestion}
                            onClick={() => {
                                setInput(suggestion)
                                // Optional: auto-submit or just fill
                            }}
                            className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-all whitespace-nowrap"
                        >
                            {suggestion}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    )
}

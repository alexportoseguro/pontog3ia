'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { useForm } from 'react-hook-form'
import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from '@headlessui/react'
import { Fragment } from 'react'
import { CloudArrowUpIcon, DocumentTextIcon, CheckCircleIcon, XMarkIcon } from '@heroicons/react/24/outline'

type Props = {
    isOpen: boolean
    onClose: () => void
    onSuccess: (data: any) => void
}

export default function SmartOnboardingModal({ isOpen, onClose, onSuccess }: Props) {
    const [step, setStep] = useState<'upload' | 'scanning' | 'review'>('upload')
    const [scannedData, setScannedData] = useState<any>(null)
    const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm()

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        const file = acceptedFiles[0]
        if (!file) return

        setStep('scanning')

        try {
            const formData = new FormData()
            formData.append('file', file)

            // Verify company auth token will be sent automatically by browser (cookie) or we need to pass headers if we were using a custom fetch wrapper.
            // But since this is a direct fetch in component, we need to ensure we grab the session token if RLS is strict,
            // OR we rely on the API route to handle the server-side auth check which grabs the cookie or header.
            // For now, let's assume we need to attach the token if we were using Supabase client, but here we can just fetch to our own API 
            // and let the API route handle the `checkAdminRole` using `headers()`.

            // Wait, our `checkAdminRole` checks for `Authorization: Bearer <token>`.
            // So we DO need to pass the token.

            // We need to import supabase to get the session token
            // importing specific client logic here inside the function to avoid top-level issues if any
            const { createClient } = await import('@supabase/supabase-js')
            const supabase = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
            )
            const { data: { session } } = await supabase.auth.getSession()

            const res = await fetch('/api/onboarding/process', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session?.access_token || ''}`
                },
                body: formData
            })

            if (!res.ok) throw new Error('Falha ao processar documento')

            const data = await res.json()
            setScannedData(data)

            // Auto-fill form
            setValue('full_name', data.full_name)
            setValue('cpf', data.cpf)
            setValue('birth_date', data.birth_date)
            setValue('address', data.address)
            setValue('job_role', data.job_role)

            setStep('review')

        } catch (error) {
            console.error(error)
            alert('Erro ao ler documento. Tente novamente.')
            setStep('upload')
        }
    }, [setValue])

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'image/*': ['.jpeg', '.jpg', '.png'],
            'application/pdf': ['.pdf']
        },
        maxFiles: 1
    })

    const onSubmit = (data: any) => {
        onSuccess(data)
        onClose()
        reset()
        setStep('upload')
    }

    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={onClose}>
                <TransitionChild
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black/25 backdrop-blur-sm" />
                </TransitionChild>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4 text-center">
                        <TransitionChild
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 scale-95"
                            enterTo="opacity-100 scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 scale-100"
                            leaveTo="opacity-0 scale-95"
                        >
                            <DialogPanel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all border border-indigo-100">
                                <div className="flex justify-between items-center mb-4">
                                    <DialogTitle as="h3" className="text-lg font-bold leading-6 text-indigo-900">
                                        Admissão Inteligente (AI)
                                    </DialogTitle>
                                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                                        <XMarkIcon className="w-5 h-5" />
                                    </button>
                                </div>

                                {step === 'upload' && (
                                    <div {...getRootProps()} className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${isDragActive ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 hover:border-indigo-400'}`}>
                                        <input {...getInputProps()} />
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="p-3 bg-indigo-100 rounded-full">
                                                <CloudArrowUpIcon className="w-8 h-8 text-indigo-600" />
                                            </div>
                                            <div className="text-sm text-slate-600">
                                                <span className="font-semibold text-indigo-600">Clique para enviar</span> ou arraste e solte
                                            </div>
                                            <p className="text-xs text-slate-400">CNH, RG ou Carteira de Trabalho (PDF, JPG, PNG)</p>
                                        </div>
                                    </div>
                                )}

                                {step === 'scanning' && (
                                    <div className="py-12 text-center flex flex-col items-center">
                                        <div className="relative w-16 h-16 mb-4">
                                            <div className="absolute inset-0 border-4 border-slate-100 rounded-full"></div>
                                            <div className="absolute inset-0 border-4 border-indigo-500 rounded-full border-t-transparent animate-spin"></div>
                                            <DocumentTextIcon className="absolute inset-0 m-auto w-6 h-6 text-indigo-500 animate-pulse" />
                                        </div>
                                        <h4 className="text-lg font-bold text-slate-800">Lendo Documento...</h4>
                                        <p className="text-sm text-slate-500 mt-1">A IA está extraindo os dados para você.</p>
                                    </div>
                                )}

                                {step === 'review' && (
                                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                                        <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 mb-4 flex items-start gap-3">
                                            <CheckCircleIcon className="w-5 h-5 text-indigo-600 mt-0.5" />
                                            <div>
                                                <p className="text-sm font-bold text-indigo-900">Leitura Concluída!</p>
                                                <p className="text-xs text-indigo-700">Confira os dados extraídos antes de criar.</p>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <div>
                                                <label className="block text-xs font-semibold text-slate-500 mb-1">Nome Completo</label>
                                                <input {...register('full_name', { required: true })} className="w-full px-3 py-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500" />
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-500 mb-1">CPF</label>
                                                    <input {...register('cpf')} className="w-full px-3 py-2 border rounded-lg text-sm bg-white" />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-500 mb-1">Nascimento</label>
                                                    <input {...register('birth_date')} type="date" className="w-full px-3 py-2 border rounded-lg text-sm bg-white" />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-semibold text-slate-500 mb-1">Cargo (Sugerido)</label>
                                                <input {...register('job_role')} className="w-full px-3 py-2 border rounded-lg text-sm bg-white" />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-semibold text-slate-500 mb-1">Endereço</label>
                                                <input {...register('address')} className="w-full px-3 py-2 border rounded-lg text-sm bg-white" />
                                            </div>
                                        </div>

                                        <div className="flex justify-end gap-2 mt-6">
                                            <button type="button" onClick={() => setStep('upload')} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg">
                                                Voltar
                                            </button>
                                            <button type="submit" className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-lg shadow-indigo-200">
                                                Confirmar e Criar
                                            </button>
                                        </div>
                                    </form>
                                )}
                            </DialogPanel>
                        </TransitionChild>
                    </div>
                </div>
            </Dialog>
        </Transition>
    )
}

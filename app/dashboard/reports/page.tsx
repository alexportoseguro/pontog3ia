'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type TimeEvent = {
    id: string
    event_type: string
    timestamp: string
    location: string
}

type EmployeeReport = {
    id: string
    full_name: string
    events: TimeEvent[]
}

export default function ReportsPage() {
    const [role, setRole] = useState<'admin' | 'manager' | 'employee' | null>(null)
    const [currentUserId, setCurrentUserId] = useState<string | null>(null)
    const [companyId, setCompanyId] = useState<string | null>(null)
    const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState<string>('all')
    const [reportData, setReportData] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [startDate, setStartDate] = useState(() => {
        const d = new Date()
        return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]
    })
    const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0])
    const [quickFilter, setQuickFilter] = useState('thisMonth')
    const [selectedShiftFilter, setSelectedShiftFilter] = useState<string>('all')
    const [onlyIssues, setOnlyIssues] = useState(false)
    const [availableShifts, setAvailableShifts] = useState<any[]>([])

    // Pagination State
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [totalRecords, setTotalRecords] = useState(0)
    const LIMIT = 10

    useEffect(() => {
        checkUserRole()
    }, [])

    async function checkUserRole() {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
            setCurrentUserId(user.id)
            const { data: profile } = await supabase
                .from('profiles')
                .select('role, company_id')
                .eq('id', user.id)
                .single()

            const userRole = profile?.role || 'employee'
            setRole(userRole)
            setCompanyId(profile?.company_id || null)

            // If employee, force filter immediately to their own data
            if (userRole === 'employee') {
                setSelectedEmployeeFilter(user.id)
            }
        }
    }

    useEffect(() => {
        setPage(1)
    }, [startDate, endDate, selectedEmployeeFilter])

    useEffect(() => {
        fetchReport()
    }, [startDate, endDate, page, selectedEmployeeFilter, selectedShiftFilter, onlyIssues])

    useEffect(() => {
        if (role === 'admin' || role === 'manager') {
            fetchShifts()
        }
    }, [role])

    async function fetchShifts() {
        try {
            const { data: { session } } = await supabase.auth.getSession()
            const response = await fetch('/api/shifts', {
                headers: { 'Authorization': `Bearer ${session?.access_token}` }
            })
            const data = await response.json()
            if (!data.error) setAvailableShifts(data)
        } catch (err) {
            console.error('Error fetching shifts:', err)
        }
    }

    async function fetchReport() {
        setLoading(true)
        try {
            const { data: { session } } = await supabase.auth.getSession()
            const headers: any = {}
            if (session?.access_token) {
                headers['Authorization'] = `Bearer ${session.access_token}`
            }

            let url = `/api/reports?startDate=${startDate}&endDate=${endDate}&page=${page}&limit=${LIMIT}`
            if (selectedEmployeeFilter !== 'all') {
                url += `&userId=${selectedEmployeeFilter}`
            }
            if (selectedShiftFilter !== 'all') {
                url += `&shiftId=${selectedShiftFilter}`
            }
            if (onlyIssues) {
                url += `&onlyIssues=true`
            }

            const response = await fetch(url, { headers })
            const result = await response.json()

            if (result.error) throw new Error(result.error)

            // Handle new paginated format
            if (result.data && Array.isArray(result.data)) {
                setReportData(result.data)
                if (result.metadata) {
                    setTotalPages(result.metadata.totalPages)
                    setTotalRecords(result.metadata.total)
                }
            } else if (Array.isArray(result)) {
                // Fallback for backward compatibility if API rollback
                setReportData(result)
            } else {
                setReportData([])
            }
        } catch (err) {
            console.error('Error fetching report:', err)
        } finally {
            setLoading(false)
        }
    }

    const applyQuickFilter = (filter: string) => {
        setQuickFilter(filter)
        const today = new Date()
        let start = new Date()

        switch (filter) {
            case 'today':
                start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
                break
            case 'yesterday':
                start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)
                const yEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)
                setEndDate(yEnd.toISOString().split('T')[0])
                break
            case '7days':
                start.setDate(today.getDate() - 7)
                break
            case '30days':
                start.setDate(today.getDate() - 30)
                break
            case 'thisMonth':
                start = new Date(today.getFullYear(), today.getMonth(), 1)
                break
            case 'lastMonth':
                start = new Date(today.getFullYear(), today.getMonth() - 1, 1)
                const end = new Date(today.getFullYear(), today.getMonth(), 0)
                setEndDate(end.toISOString().split('T')[0])
                break
            case 'thisYear':
                start = new Date(today.getFullYear(), 0, 1)
                break
        }

        setStartDate(start.toISOString().split('T')[0])
        if (filter !== 'lastMonth' && filter !== 'yesterday') {
            setEndDate(today.toISOString().split('T')[0])
        }
    }

    // Calculate summary metrics
    const calculateSummary = () => {
        let totalWorked = 0
        let totalExpected = 0
        let totalBalance = 0
        let dayCount = 0

        reportData.forEach(employee => {
            employee.report?.forEach((day: any) => {
                totalWorked += day.workedMinutes || 0
                totalExpected += day.expectedMinutes || 0
                totalBalance += day.balanceMinutes || 0
                dayCount++
            })
        })

        return {
            totalWorked,
            totalExpected,
            totalBalance,
            avgWorkedPerDay: dayCount > 0 ? Math.floor(totalWorked / dayCount) : 0,
            avgExpectedPerDay: dayCount > 0 ? Math.floor(totalExpected / dayCount) : 0
        }
    }

    const summary = calculateSummary()

    const getEventTypeLabel = (type: string) => {
        switch (type) {
            case 'clock_in': return 'Entrada'
            case 'clock_out': return 'Saída'
            case 'break_start': return 'Início Intervalo'
            case 'break_end': return 'Fim Intervalo'
            default: return type
        }
    }

    const getJustificationLabel = (type: string) => {
        const map: any = {
            'SICK_LEAVE': 'Atestado Médico',
            'ABSENCE': 'Falta Justificada',
            'VACATION': 'Férias',
            'PERSONAL': 'Assuntos Pessoais',
            'OTHER': 'Outras Justificativas'
        }
        return map[type] || type
    }

    const formatMinutes = (mins: number) => {
        const h = Math.floor(Math.abs(mins) / 60)
        const m = Math.abs(mins) % 60
        const sign = mins >= 0 ? '+' : '-'
        return `${sign}${h}h ${m.toString().padStart(2, '0')}m`
    }

    const formatHoursMinutes = (mins: number) => {
        const h = Math.floor(mins / 60)
        const m = mins % 60
        return `${h}h ${m.toString().padStart(2, '0')}m`
    }

    const exportToPDF = () => {
        if (!reportData || reportData.length === 0) {
            alert("Sem dados para exportar.")
            return
        }

        const doc = new jsPDF()

        reportData.forEach((employee, index) => {
            if (index > 0) doc.addPage()

            doc.setFontSize(18)
            doc.text("Relatório de Ponto - PontoG3", 14, 20)

            doc.setFontSize(12)
            doc.text(`Funcionário: ${employee.full_name}`, 14, 30)
            doc.text(`ID: ${employee.id}`, 14, 36)

            const today = new Date().toLocaleDateString()
            doc.text(`Data de Emissão: ${today}`, 150, 30)

            const tableBody = employee.report?.map((day: any) => [
                new Date(day.date).toLocaleDateString(),
                formatHoursMinutes(day.workedMinutes),
                formatHoursMinutes(day.expectedMinutes),
                formatMinutes(day.balanceMinutes),
                day.events?.map((e: any) => `${new Date(e.timestamp).toLocaleTimeString().substring(0, 5)} (${getEventTypeLabel(e.event_type).split(' ')[0]})`).join(', ') || ''
            ]) || []

            tableBody.push([
                { content: 'TOTAL', colSpan: 3, styles: { fontStyle: 'bold', halign: 'right' } },
                { content: formatMinutes(employee.totalBalanceMinutes), styles: { fontStyle: 'bold', textColor: employee.totalBalanceMinutes >= 0 ? [0, 128, 0] : [255, 0, 0] } },
                ''
            ])

            autoTable(doc, {
                startY: 45,
                head: [['Data', 'Trabalhado', 'Esperado', 'Saldo', 'Eventos']],
                body: tableBody,
                styles: { fontSize: 10 },
                headStyles: { fillColor: [79, 70, 229] },
                alternateRowStyles: { fillColor: [243, 244, 246] }
            })

            const finalY = (doc as any).lastAutoTable.finalY || 150
            doc.line(14, finalY + 40, 100, finalY + 40)
            doc.text("Assinatura do Funcionário", 14, finalY + 45)

            doc.line(120, finalY + 40, 196, finalY + 40)
            doc.text("Assinatura do Gestor", 120, finalY + 45)
        })

        doc.save(`relatorio_ponto_${startDate}_a_${endDate}.pdf`)
    }

    const exportToCSV = () => {
        if (!reportData || reportData.length === 0) {
            alert("Sem dados para exportar.")
            return
        }

        const headers = ["ID", "Nome", "Data", "Trabalhado (Min)", "Esperado (Min)", "Saldo (Min)", "Eventos"]
        const rows = [headers.join(",")]

        reportData.forEach(employee => {
            if (employee.report) {
                employee.report.forEach((day: any) => {
                    const eventsSummary = day.events?.map((e: any) =>
                        `${new Date(e.timestamp).toLocaleTimeString().substring(0, 5)} (${e.event_type})`
                    ).join(" | ") || ""

                    const row = [
                        employee.id,
                        `"${employee.full_name}"`,
                        day.date,
                        day.workedMinutes,
                        day.expectedMinutes,
                        day.balanceMinutes,
                        `"${eventsSummary}"`
                    ]
                    rows.push(row.join(","))
                })
            }
        })

        const csvContent = rows.join("\n")
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.setAttribute("href", url)
        link.setAttribute("download", `ponto_g3_${startDate}_a_${endDate}.csv`)
        link.style.visibility = 'hidden'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    const exportToExcel = () => {
        if (!reportData || reportData.length === 0) {
            alert("Sem dados para exportar.")
            return
        }

        // CSV optimized for Excel (using semicolon and BOM)
        const headers = ["ID", "Nome", "Data", "Trabalhado (Min)", "Esperado (Min)", "Saldo (Min)", "Eventos"]
        const rows = [headers.join(";")]

        reportData.forEach(employee => {
            if (employee.report) {
                employee.report.forEach((day: any) => {
                    const eventsSummary = day.events?.map((e: any) =>
                        `${new Date(e.timestamp).toLocaleTimeString().substring(0, 5)} (${e.event_type})`
                    ).join(" | ") || ""

                    const row = [
                        employee.id,
                        employee.full_name,
                        day.date,
                        day.workedMinutes,
                        day.expectedMinutes,
                        day.balanceMinutes,
                        eventsSummary
                    ]
                    rows.push(row.join(";"))
                })
            }
        })

        const csvContent = "\uFEFF" + rows.join("\n") // Add UTF-8 BOM
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.setAttribute("href", url)
        link.setAttribute("download", `ponto_g3_${startDate}_a_${endDate}.csv`)
        link.style.visibility = 'hidden'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    const handleExportFiscal = async (type: 'afd' | 'aej') => {
        if (!companyId) return alert('Empresa não identificada!')

        try {
            const { data: { session } } = await supabase.auth.getSession()
            const response = await fetch(`/api/reports/${type}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`
                },
                body: JSON.stringify({
                    companyId,
                    startDate,
                    endDate
                })
            })

            if (!response.ok) {
                const err = await response.json()
                throw new Error(err.error || 'Erro na exportação')
            }

            const blob = await response.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `${type}_${startDate}_${endDate}.txt`
            document.body.appendChild(a)
            a.click()
            window.URL.revokeObjectURL(url)
            document.body.removeChild(a)
        } catch (error: any) {
            alert('Erro ao exportar: ' + error.message)
        }
    }

    const [showModal, setShowModal] = useState(false)
    const [showFiscalMenu, setShowFiscalMenu] = useState(false)
    const [selectedEmployee, setSelectedEmployee] = useState<any>(null)
    const [auditReason, setAuditReason] = useState('')
    const [selectedDayEvents, setSelectedDayEvents] = useState<any[]>([])
    const [manualEntry, setManualEntry] = useState({
        date: new Date().toISOString().split('T')[0],
        time: '08:00',
        type: 'clock_in'
    })

    // Absence State
    const [modalTab, setModalTab] = useState<'adjustment' | 'absence'>('adjustment')
    const [absenceForm, setAbsenceForm] = useState({
        startDate: '',
        endDate: '',
        type: 'SICK_LEAVE',
        description: ''
    })

    // Client-side filtering removed in favor of Server-side filtering
    const filteredReports = reportData

    const openManualEntryModal = (employee: any, day?: any) => {
        setSelectedEmployee(employee)
        setManualEntry({
            date: day?.date || new Date().toISOString().split('T')[0],
            time: '08:00',
            type: 'clock_in'
        })
        setSelectedDayEvents(day?.events || [])
        setAuditReason('')

        // Init absence form
        setAbsenceForm({
            startDate: day?.date || new Date().toISOString().split('T')[0],
            endDate: day?.date || new Date().toISOString().split('T')[0],
            type: 'SICK_LEAVE',
            description: ''
        })
        setModalTab('adjustment')

        setShowModal(true)
    }

    const handleAddAbsence = async () => {
        if (!selectedEmployee || !absenceForm.startDate || !absenceForm.endDate) {
            alert('Preencha os campos obrigatórios')
            return
        }

        try {
            const { data: { session } } = await supabase.auth.getSession()
            const response = await fetch('/api/manager/justifications', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`
                },
                body: JSON.stringify({
                    userId: selectedEmployee.id,
                    type: absenceForm.type,
                    startDate: absenceForm.startDate,
                    endDate: absenceForm.endDate,
                    description: absenceForm.description
                })
            })

            if (!response.ok) throw new Error('Falha ao lançar ausência')

            alert('Ausência lançada com sucesso!')
            setShowModal(false)
            fetchReport() // Refresh data
        } catch (error: any) {
            alert('Erro: ' + error.message)
        }
    }

    const handleDeleteEvent = async (eventId: string) => {
        if (!confirm('Tem certeza que deseja remover este registro?')) return

        try {
            const { data: { session } } = await supabase.auth.getSession()
            const response = await fetch(`/api/manager/events?id=${eventId}&managerId=${currentUserId}&reason=${encodeURIComponent(auditReason || 'Ajuste manual')}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${session?.access_token}`
                }
            })

            if (!response.ok) {
                const data = await response.json()
                throw new Error(data.error || 'Erro ao deletar registro')
            }

            alert('Registro removido com sucesso!')
            setShowModal(false)
            fetchReport()
        } catch (error: any) {
            alert('Erro: ' + error.message)
        }
    }

    const handleAddEvent = async () => {
        if (!selectedEmployee) return

        try {
            const timestamp = new Date(`${manualEntry.date}T${manualEntry.time}:00`).toISOString()

            console.log('Sending manual entry:', {
                userId: selectedEmployee.id,
                timestamp,
                type: manualEntry.type,
                reason: auditReason
            })

            const { data: { session } } = await supabase.auth.getSession()
            const response = await fetch('/api/manager/events', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token || ''}`
                },
                body: JSON.stringify({
                    userId: selectedEmployee.id,
                    timestamp,
                    type: manualEntry.type,
                    reason: auditReason,
                    managerId: session?.user?.id || 'admin-manager'
                })
            })

            const data = await response.json()

            console.log('Response:', response.status, data)

            if (!response.ok || data.error) {
                throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`)
            }

            alert('Ponto adicionado com sucesso!')
            setShowModal(false)
            fetchReport()
        } catch (error: any) {
            console.error('Erro completo:', error)
            alert('Erro ao adicionar ponto:\n\n' + error.message + '\n\nVerifique o console para mais detalhes.')
        }
    }

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="glass-effect p-8 rounded-3xl flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 shadow-xl shadow-slate-200/50">
                <div className="flex flex-col gap-4 flex-1">
                    <div className="flex flex-col gap-1">
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight">
                            {role === 'employee' ? 'Meu Espelho de Ponto' : 'Relatório Detalhado'}
                        </h1>
                        <p className="text-slate-500 font-medium">
                            {role === 'employee'
                                ? 'Visualize seu histórico de jornada e saldo de horas.'
                                : 'Gerencie e visualize os relatórios de ponto da equipe.'}
                        </p>
                    </div>

                    {/* Quick Filters UI */}
                    <div className="flex flex-wrap gap-2">
                        {[
                            { id: 'today', label: 'Hoje' },
                            { id: 'yesterday', label: 'Ontem' },
                            { id: 'thisMonth', label: 'Este Mês' },
                            { id: 'lastMonth', label: 'Mês Passado' },
                            { id: 'thisYear', label: 'Este Ano' },
                        ].map(f => (
                            <button
                                key={f.id}
                                onClick={() => applyQuickFilter(f.id)}
                                className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${quickFilter === f.id
                                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                    }`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex flex-wrap gap-4 items-center">
                    <div className="flex items-center bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 shadow-inner focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
                        <input
                            type="date"
                            value={startDate}
                            onChange={e => setStartDate(e.target.value)}
                            className="bg-transparent text-sm font-bold text-slate-700 outline-none"
                        />
                        <span className="mx-3 text-slate-300 font-bold">—</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={e => setEndDate(e.target.value)}
                            className="bg-transparent text-sm font-bold text-slate-700 outline-none"
                        />
                    </div>

                    {role !== 'employee' && (
                        <select
                            value={selectedEmployeeFilter}
                            onChange={(e) => setSelectedEmployeeFilter(e.target.value)}
                            className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 shadow-inner outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all min-w-[200px]"
                        >
                            <option value="all">Equipe Completa</option>
                            {reportData.map(emp => (
                                <option key={emp.id} value={emp.id}>{emp.full_name || emp.name}</option>
                            ))}
                        </select>
                    )}

                    {role !== 'employee' && (
                        <select
                            value={selectedShiftFilter}
                            onChange={(e) => setSelectedShiftFilter(e.target.value)}
                            className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 shadow-inner outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all min-w-[160px]"
                        >
                            <option value="all">Todos os Turnos</option>
                            {availableShifts.map(shift => (
                                <option key={shift.id} value={shift.id}>{shift.name}</option>
                            ))}
                        </select>
                    )}

                    {role !== 'employee' && (
                        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 shadow-inner">
                            <input
                                type="checkbox"
                                id="onlyIssues"
                                checked={onlyIssues}
                                onChange={(e) => setOnlyIssues(e.target.checked)}
                                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                            />
                            <label htmlFor="onlyIssues" className="text-sm font-bold text-slate-600 cursor-pointer">
                                Apenas Inconsistências
                            </label>
                        </div>
                    )}

                    {role !== 'employee' && (
                        <div className="flex gap-2">
                            <div className="relative">
                                <button
                                    onClick={() => setShowFiscalMenu(!showFiscalMenu)}
                                    className="inline-flex items-center gap-2 px-6 py-3 border border-slate-200 rounded-2xl shadow-sm text-sm font-bold text-slate-700 bg-white hover:bg-slate-50 transition-all"
                                >
                                    Relatórios Fiscais
                                </button>
                                {showFiscalMenu && (
                                    <>
                                        <div className="fixed inset-0 z-40" onClick={() => setShowFiscalMenu(false)}></div>
                                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 z-50 animate-fade-in-up">
                                            <button onClick={() => { handleExportFiscal('afd'); setShowFiscalMenu(false) }} className="block w-full text-left px-4 py-3 text-sm text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 font-bold first:rounded-t-xl border-b border-slate-50 transition-colors">
                                                Exportar AFD
                                            </button>
                                            <button onClick={() => { handleExportFiscal('aej'); setShowFiscalMenu(false) }} className="block w-full text-left px-4 py-3 text-sm text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 font-bold last:rounded-b-xl transition-colors">
                                                Exportar AEJ
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>

                            <button
                                onClick={exportToCSV}
                                className="inline-flex items-center px-6 py-3 border border-slate-200 rounded-2xl shadow-sm text-sm font-bold text-slate-600 bg-white hover:bg-slate-50 hover:border-slate-300 transition-all"
                            >
                                CSV
                            </button>
                            <button
                                onClick={exportToExcel}
                                className="inline-flex items-center px-6 py-3 border border-slate-200 rounded-2xl shadow-sm text-sm font-bold text-indigo-600 bg-white hover:bg-indigo-50 hover:border-indigo-200 transition-all"
                            >
                                Excel
                            </button>
                            <button
                                onClick={exportToPDF}
                                className="inline-flex items-center px-6 py-3 bg-rose-600 rounded-2xl shadow-lg shadow-rose-500/20 text-sm font-bold text-white hover:bg-rose-700 transform hover:scale-[1.02] active:scale-[0.98] transition-all"
                            >
                                PDF
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Admin Summary Cards */}
            {role !== 'employee' && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <SummaryCard title="Total Trabalhado" value={formatHoursMinutes(summary.totalWorked)} color="text-indigo-600" />
                    <SummaryCard title="Tempo Esperado" value={formatHoursMinutes(summary.totalExpected)} color="text-slate-500" />
                    <SummaryCard
                        title="Saldo do Período"
                        value={formatMinutes(summary.totalBalance)}
                        color={summary.totalBalance >= 0 ? 'text-emerald-600' : 'text-rose-600'}
                        isBalance
                    />
                    <div className="premium-card p-6 bg-slate-900 text-white flex flex-col justify-center rounded-3xl">
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Gestão</p>
                        <button
                            onClick={() => alert('Em breve: Enviar lembrete para equipe')}
                            className="mt-2 text-sm font-bold bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl transition-all"
                        >
                            Notificar Equipe
                        </button>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="p-20 text-center animate-pulse">
                    <div className="inline-block h-12 w-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Carregando Relatórios...</p>
                </div>
            ) : (
                <div className="space-y-12">
                    {filteredReports.map(employee => (
                        <div key={employee.id} className="premium-card overflow-hidden bg-white">
                            <div className="bg-slate-50/50 px-8 py-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                <div className="flex items-center gap-4">
                                    <div className="h-14 w-14 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-600 text-xl font-black">
                                        {employee.full_name?.charAt(0)}
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black text-slate-900 tracking-tight">{employee.full_name}</h3>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{employee.role || 'Funcionário'}</p>
                                    </div>
                                </div>
                                <div className="bg-white px-6 py-3 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-end">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Saldo Acumulado</p>
                                    <span className={`text-xl font-black ${employee.totalBalanceMinutes >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        {formatMinutes(employee.totalBalanceMinutes)}
                                    </span>
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="min-w-full">
                                    <thead>
                                        <tr className="bg-slate-50/30 border-b border-slate-100">
                                            <th className="px-8 py-5 text-left text-[11px] font-black text-slate-400 uppercase tracking-widest">Data</th>
                                            <th className="px-8 py-5 text-left text-[11px] font-black text-slate-400 uppercase tracking-widest">Jornada Real</th>
                                            <th className="px-8 py-5 text-left text-[11px] font-black text-slate-400 uppercase tracking-widest">Esperado</th>
                                            <th className="px-8 py-5 text-left text-[11px] font-black text-slate-400 uppercase tracking-widest">Saldo Dia</th>
                                            <th className="px-8 py-5 text-left text-[11px] font-black text-slate-400 uppercase tracking-widest">Registros</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {employee.report && employee.report.map((day: any, idx: number) => (
                                            <tr key={idx} className="hover:bg-slate-50/30 transition-colors">
                                                <td
                                                    className={`px-8 py-5 whitespace-nowrap ${role !== 'employee' ? 'cursor-pointer hover:bg-indigo-50/50 group transition-all' : ''}`}
                                                    onClick={() => role !== 'employee' && openManualEntryModal(employee, day)}
                                                >
                                                    <div className="flex flex-col">
                                                        <span className={`text-sm font-bold ${role !== 'employee' ? 'text-indigo-600 group-hover:text-indigo-700' : 'text-slate-700'}`}>
                                                            {/* Prevent timezone shift by appending T12:00:00 */}
                                                            {new Date(day.date + 'T12:00:00').toLocaleDateString()}
                                                            {role !== 'employee' && <span className="ml-2 opacity-0 group-hover:opacity-100 text-[10px] bg-indigo-100 px-1.5 py-0.5 rounded transition-opacity">Ajustar</span>}
                                                        </span>
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                            {new Date(day.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long' })}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-5 whitespace-nowrap text-sm font-black text-slate-600">{formatHoursMinutes(day.workedMinutes)}</td>
                                                <td className="px-8 py-5 whitespace-nowrap text-sm font-bold text-slate-400">{formatHoursMinutes(day.expectedMinutes)}</td>
                                                <td className="px-8 py-5 whitespace-nowrap">
                                                    <span className={`px-3 py-1 rounded-lg text-xs font-black ${day.balanceMinutes >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                                        {formatMinutes(day.balanceMinutes)}
                                                    </span>
                                                </td>
                                                <td className="px-8 py-5">
                                                    <div className="flex flex-wrap gap-2">
                                                        {day.isHoliday && <span className="bg-purple-100 text-purple-800 text-xs px-2 py-0.5 rounded border border-purple-200">Feriado</span>}
                                                        {day.justification && (
                                                            <div className="group relative">
                                                                <span className="bg-rose-100 text-rose-800 text-xs px-2 py-0.5 rounded border border-rose-200 cursor-help">
                                                                    {getJustificationLabel(day.justification.type)}
                                                                </span>
                                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block w-48 p-2 bg-gray-900 text-white text-xs rounded-lg z-10 text-center">
                                                                    {day.justification.description || 'Sem descrição'}
                                                                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                                                                </div>
                                                            </div>
                                                        )}
                                                        {day.events?.map((e: any) => (
                                                            <span key={e.timestamp} className="bg-gray-100 text-gray-800 text-xs px-2 py-0.5 rounded" title={e.location}>
                                                                {new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({getEventTypeLabel(e.event_type).split(' ')[0]})
                                                            </span>
                                                        ))}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {role !== 'employee' && (
                                <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end">
                                    <button
                                        onClick={() => openManualEntryModal(employee)}
                                        className="text-sm text-indigo-600 hover:text-indigo-900 font-medium"
                                    >
                                        + Adicionar Ponto Manual
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex justify-center items-center gap-4 py-8">
                    <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-600 disabled:opacity-50 hover:bg-slate-50 transition-all font-bold text-sm"
                    >
                        Anterior
                    </button>
                    <span className="text-sm font-bold text-slate-500">
                        Página {page} de {totalPages}
                    </span>
                    <button
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-600 disabled:opacity-50 hover:bg-slate-50 transition-all font-bold text-sm"
                    >
                        Próxima
                    </button>
                </div>
            )}

            {/* Manual Entry Modal */}
            {showModal && (
                <div className="fixed inset-0 z-[9999] overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4 text-center">
                        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 transition-opacity" onClick={() => setShowModal(false)}></div>

                        <div className="relative transform overflow-hidden rounded-2xl bg-white text-left shadow-xl transition-all sm:w-full sm:max-w-lg">
                            <div className="px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Gerenciar Ponto / Ausências</h3>
                                <p className="text-sm text-gray-500 mb-4">Colaborador: <b>{selectedEmployee?.full_name}</b></p>

                                {/* Tabs */}
                                <div className="flex gap-2 mb-4 border-b border-slate-100 pb-2">
                                    <button
                                        onClick={() => setModalTab('adjustment')}
                                        className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest rounded-lg transition-colors ${modalTab === 'adjustment' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                                    >
                                        Ajuste Manual
                                    </button>
                                    <button
                                        onClick={() => setModalTab('absence')}
                                        className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest rounded-lg transition-colors ${modalTab === 'absence' ? 'bg-rose-50 text-rose-600' : 'text-slate-400 hover:text-slate-600'}`}
                                    >
                                        Lançar Ausência
                                    </button>
                                </div>

                                {modalTab === 'adjustment' ? (
                                    <>
                                        {/* Existing Events List */}
                                        {selectedDayEvents.length > 0 && (
                                            <div className="mb-6 bg-slate-50 p-4 rounded-xl border border-slate-100">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Registros em {new Date(manualEntry.date + 'T00:00:00').toLocaleDateString()}</p>
                                                <div className="space-y-2">
                                                    {selectedDayEvents.map((e: any) => (
                                                        <div key={e.id} className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-sm font-bold text-slate-700">
                                                                    {new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                </span>
                                                                <span className="text-[10px] font-bold bg-slate-100 px-2 py-0.5 rounded">
                                                                    {getEventTypeLabel(e.event_type)}
                                                                </span>
                                                            </div>
                                                            <button
                                                                onClick={() => handleDeleteEvent(e.id)}
                                                                className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                                                                title="Remover Registro"
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                                                                </svg>
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        <div className="space-y-4 border-t border-slate-100 pt-4">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Adicionar Novo Registro</p>
                                            <div className="grid grid-cols-2 gap-4">
                                                {/* Time */}
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Hora</label>
                                                    <input type="time" value={manualEntry.time} onChange={(e) => setManualEntry({ ...manualEntry, time: e.target.value })} className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 w-full outline-none focus:ring-2 focus:ring-indigo-500/20" />
                                                </div>
                                                {/* Type */}
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tipo</label>
                                                    <select value={manualEntry.type} onChange={(e) => setManualEntry({ ...manualEntry, type: e.target.value })} className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 w-full outline-none focus:ring-2 focus:ring-indigo-500/20">
                                                        <option value="clock_in">Entrada</option>
                                                        <option value="break_start">Início Pausa</option>
                                                        <option value="break_end">Fim Pausa</option>
                                                        <option value="clock_out">Saída</option>
                                                    </select>
                                                </div>
                                            </div>
                                            {/* Reason */}
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Motivo / Justificativa</label>
                                                <input type="text" value={auditReason} onChange={(e) => setAuditReason(e.target.value)} placeholder="Ex: Esquecimento do funcionário" className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 w-full outline-none focus:ring-2 focus:ring-indigo-500/20" />
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="space-y-4 animate-fade-in">
                                        <p className="text-sm text-slate-500 mb-2">Lance faltas, atestados ou férias para abonar/justificar os dias selecionados.</p>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data Início</label>
                                                <input
                                                    type="date"
                                                    value={absenceForm.startDate}
                                                    onChange={(e) => setAbsenceForm({ ...absenceForm, startDate: e.target.value })}
                                                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 w-full outline-none focus:ring-2 focus:ring-rose-500/20"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data Fim</label>
                                                <input
                                                    type="date"
                                                    value={absenceForm.endDate}
                                                    onChange={(e) => setAbsenceForm({ ...absenceForm, endDate: e.target.value })}
                                                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 w-full outline-none focus:ring-2 focus:ring-rose-500/20"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tipo de Ausência</label>
                                            <select
                                                value={absenceForm.type}
                                                onChange={(e) => setAbsenceForm({ ...absenceForm, type: e.target.value })}
                                                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 w-full outline-none focus:ring-2 focus:ring-rose-500/20"
                                            >
                                                <option value="SICK_LEAVE">Atestado Médico / Doença</option>
                                                <option value="ABSENCE">Falta Injustificada</option>
                                                <option value="VACATION">Férias</option>
                                                <option value="PERSONAL">Motivos Pessoais</option>
                                                <option value="OTHER">Outro</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Observação / Detalhes</label>
                                            <textarea
                                                value={absenceForm.description}
                                                onChange={(e) => setAbsenceForm({ ...absenceForm, description: e.target.value })}
                                                placeholder="Ex: Atestado de 3 dias (CID-10 ...)"
                                                rows={3}
                                                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 w-full outline-none focus:ring-2 focus:ring-rose-500/20 resize-none"
                                            />
                                        </div>
                                    </div>
                                )}

                            </div>
                            <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense px-4 pb-4 sm:px-6">
                                <button type="button" onClick={modalTab === 'adjustment' ? handleAddEvent : handleAddAbsence} className={`w-full inline-flex justify-center rounded-xl border border-transparent shadow-sm px-4 py-3 text-sm font-bold text-white sm:col-start-2 sm:text-sm shadow-lg transform transition-all hover:scale-105 active:scale-95 ${modalTab === 'adjustment' ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20' : 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/20'}`}>
                                    {modalTab === 'adjustment' ? 'Confirmar Ajuste' : 'Lançar Ausência'}
                                </button>
                                <button type="button" onClick={() => setShowModal(false)} className="mt-3 w-full inline-flex justify-center rounded-xl border border-slate-200 shadow-sm px-4 py-3 bg-white text-sm font-bold text-slate-700 hover:bg-slate-50 sm:mt-0 sm:col-start-1 sm:text-sm">Cancelar</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

function SummaryCard({ title, value, color, isBalance }: any) {
    return (
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between transition-all hover:shadow-md hover:border-indigo-100 group">
            <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 group-hover:text-indigo-400 transition-colors">{title}</p>
                <p className={`text-2xl font-black ${color}`}>{value}</p>
            </div>
            {isBalance && (
                <div className="mt-4 h-1.5 w-full bg-slate-50 rounded-full overflow-hidden">
                    <div className={`h-full transition-all duration-700 ${value.includes('-') ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: '100%' }}></div>
                </div>
            )}
        </div>
    )
}

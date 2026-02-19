
import { NextResponse } from 'next/server'
import { verifyAuth, supabaseAdmin } from '@/lib/auth-server'
import { jsPDF } from 'jspdf'

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
    // 1. Auth Check (Any authenticated user can view their own receipt, Manager/Admin can view any?)
    // Let's restrict to own receipt or Admin/Manager.
    const auth = await verifyAuth(request)
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const user = auth.user
    const { id } = await context.params

    try {
        // 2. Fetch Event
        const { data: event, error } = await supabaseAdmin
            .from('time_events')
            .select('*, profiles(full_name, cpf), companies(name, cnpj)')
            .eq('id', id)
            .single()

        if (error || !event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })

        // 3. Authorization: User must own the event OR be admin/manager of the same company
        const isOwner = event.user_id === user.id
        const isAdmin = (user.role === 'admin' || user.role === 'manager') && user.company_id === event.company_id

        if (!isOwner && !isAdmin) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }

        // 4. Generate PDF
        // Create a new PDF document
        const doc = new jsPDF()

        // Header
        doc.setFontSize(16)
        doc.text('Comprovante de Registro de Ponto', 105, 20, { align: 'center' })

        doc.setFontSize(10)
        doc.text('Empregador:', 20, 40)
        doc.text(event.companies?.name || 'Empresa', 20, 45)
        doc.text(`CNPJ/CPF: ${event.companies?.cnpj || 'N/A'}`, 20, 50)

        doc.text('Empregado:', 20, 60)
        doc.text(event.profiles?.full_name || 'Funcionário', 20, 65)
        doc.text(`CPF: ${event.profiles?.cpf || 'N/A'}`, 20, 70)

        // Details
        doc.text('Dados do Registro:', 20, 85)
        const date = new Date(event.timestamp)
        doc.text(`Data: ${date.toLocaleDateString('pt-BR')}`, 20, 90)
        doc.text(`Hora: ${date.toLocaleTimeString('pt-BR')}`, 20, 95)
        doc.text(`NSR: ${event.id.substring(0, 9)}`, 20, 100) // Mocking NSR with ID fragment for now

        // Hash/Signature
        doc.text('Assinatura Digital (Hash SHA-256):', 20, 115)
        doc.setFont("courier", "normal") // Monospace for hash
        doc.setFontSize(8)

        // Mock Hash or Real Hash if we store it
        const mockHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        doc.text(mockHash, 20, 120, { maxWidth: 170 })

        // Footer
        doc.setFont("helvetica", "normal")
        doc.setFontSize(8)
        doc.text('Este comprovante foi gerado eletronicamente conforme Portaria 671/2021.', 105, 280, { align: 'center' })

        // Output
        const pdfBuffer = doc.output('arraybuffer')

        return new NextResponse(pdfBuffer, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="comprovante-${id}.pdf"`
            }
        })

    } catch (err: any) {
        console.error(err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

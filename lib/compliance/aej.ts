
/**
 * AEJ Generator
 * Pipe separated format.
 */

type AEJParams = {
    company: {
        cnpj: string
        razaoSocial: string
        startDate: Date
        endDate: Date
    }
    employees: {
        id: string
        cpf: string
        name: string
        pis?: string // Optional?
    }[]
    markings: {
        employeeId: string
        date: Date // Full date+time
        repId: number // Reference to Type 02
        type: 'E' | 'S' | 'D' // E=Entry, S=Exit, D=Desconsiderada? No, E/S usually.
        // Actually Portaria 671 AEJ might just list raw markings.
    }[]
    // ... we need more data like Type 02 (REPs)
}

export function generateAEJ(params: AEJParams): string {
    const lines: string[] = []

    // 1. Header (Type 01)
    // 01|TipoDaFonte|CnpjCpf|RazaoSocial|DataInicio|DataFim|DataGeracao|HoraGeracao|VersaoLeiaute
    const typeId = params.company.cnpj.length > 11 ? '1' : '2' // 1=CNPJ, 2=CPF
    const identifier = params.company.cnpj.replace(/\D/g, '')
    const razao = params.company.razaoSocial.substring(0, 150)
    const dInicio = toDateStr(params.company.startDate)
    const dFim = toDateStr(params.company.endDate)
    const now = new Date()
    const dGeracao = toDateStr(now)
    const hGeracao = toTimeStr(now)

    // AEJ v01
    lines.push(`01|1|${typeId}|${identifier}|${razao}|${dInicio}|${dFim}|${dGeracao}|${hGeracao}|001`)

    // 2. REPs (Type 02)
    // 02|IdREP|TipoREP|Marca|Modelo|NumeroSerie|NumeroRegistro
    // Assuming virtual REP for SaaS
    lines.push(`02|1|3|PontoG3|SaaS|0000000000000001|0001`)

    // 3. Vínculos (Type 03)
    // 03|SeqVinculo|Cpf|Nome|Pis
    const empMap = new Map<string, number>()
    params.employees.forEach((emp, index) => {
        const seqId = index + 1
        empMap.set(emp.id, seqId)

        const cpf = emp.cpf.replace(/\D/g, '')
        const pis = emp.pis?.replace(/\D/g, '') || ''
        const nome = emp.name.substring(0, 150)

        lines.push(`03|${seqId}|${cpf}|${nome}|${pis}`)
    })

    // 4. Horário Contratual (Type 04) - Optional/Complex
    // Skipping for now as allowed by some interpretations for simplified SaaS, 
    // but ideally should list shifts.

    // 5. Marcações (Type 05)
    // 05|SeqVinculo|Data|Hora|IdRep|Tipo|Fonte|CodigoHash
    let count05 = 0
    for (const m of params.markings) {
        const seqId = empMap.get(m.employeeId)
        if (!seqId) continue

        const data = toDateStr(m.date)
        const hora = toTimeStr(m.date)
        const repId = 1
        const type = m.type // E, S, D
        const source = 'O' // Original
        const hash = '' // Optional in some contexts or needs impl

        lines.push(`05|${seqId}|${data}|${hora}|${repId}|${type}|${source}|${hash}`)
        count05++
    }

    // 9. Trailer (Type 99)
    // 99|QtdReg01|QtdReg02|QtdReg03|QtdReg04|QtdReg05|...
    const qtd01 = 1
    const qtd02 = 1
    const qtd03 = params.employees.length
    const qtd04 = 0 // Skipped
    const qtd05 = count05
    const qtd06 = 0
    const qtd07 = 0
    const qtd08 = 0
    const qtd09 = 0 // Events

    lines.push(`99|${qtd01}|${qtd02}|${qtd03}|${qtd04}|${qtd05}|${qtd06}|${qtd07}|${qtd08}|${qtd09}`)

    return lines.join('\r\n')
}

// Helpers
function toDateStr(d: Date): string {
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const yyyy = d.getFullYear()
    return `${dd}${mm}${yyyy}`
}

function toTimeStr(d: Date): string {
    const hh = String(d.getHours()).padStart(2, '0')
    const mm = String(d.getMinutes()).padStart(2, '0')
    return `${hh}${mm}`
}

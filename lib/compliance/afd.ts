
import { generateSignature } from './signature'

type AFDParams = {
    company: {
        cnpj: string // or CPF
        razaoSocial: string
        repId: string // 17 digits
    }
    records: {
        nsr: number
        date: Date
        cpf: string
    }[]
}

/**
 * Generates the content of an AFD file (REP-P Type 7)
 */
export function generateAFD(params: AFDParams): string {
    const lines: string[] = []

    // 1. Header (Type 1)
    // Fixed width logic based on specs
    // NSR(9) + Type(1) + IdType(1) + Identifier(14) + CEI(12) + Razao(150) + RepId(17) + DataInicio(8) + DataFim(8) + DataGeracao(12) + CRC(4)
    // Note: This is an approximation. Real implementation requires strict padding.
    const header = buildHeader(params.company)
    lines.push(header)

    // 2. Records (Type 7)
    for (const rec of params.records) {
        const nsr = pad(rec.nsr, 9)
        const type = '7'
        const dataHora = rec.date.toISOString().replace(/\.\d{3}Z$/, '-03:00') // Adjust to timezone if needed, simple replacement for now
        // Ideally should assume input date is already correct or use date-fns-tz

        const cpf = pad(rec.cpf.replace(/\D/g, ''), 11)

        // Hash payload: NSR + Type + DataHora + CPF (Standard varies, checking specs usually implies whole record content except hash)
        // But let's follow the "NSR+Type+DataHora+CPF" theory for now or just hash the previous fields.
        const payloadToSign = `${nsr}${type}${dataHora}${cpf}`
        const hash = generateSignature(payloadToSign)

        lines.push(`${nsr}${type}${dataHora}${cpf}${hash}`)
    }

    // 3. Trailer (Type 9)
    const trailer = buildTrailer(params.records.length + 2) // +Header +Trailer
    lines.push(trailer)

    return lines.join('\r\n')
}

function buildHeader(company: any): string {
    const nsr = pad(1, 9)
    const type = '1'
    const idType = company.cnpj.length > 11 ? '1' : '2' // 1=CNPJ
    const identifier = pad(company.cnpj.replace(/\D/g, ''), 14)
    const cei = pad('', 12) // Empty
    const razao = pad(company.razaoSocial, 150, ' ', 'right')
    const repId = pad(company.repId.replace(/\D/g, ''), 17) // 17 digits
    const now = new Date()
    const dataGeracao = toFixedDate(now) + toFixedTime(now)

    // Dates range - simplifying for header
    const dataInicio = toFixedDate(now)
    const dataFim = toFixedDate(now)

    // 1+1+1+14+12+150+17+8+8+12 = 224 chars?
    // We need to calculate CRC. Fake for now "0000"
    return `${nsr}${type}${idType}${identifier}${cei}${razao}${repId}${dataInicio}${dataFim}${dataGeracao}0000`
}

function buildTrailer(totalLines: number): string {
    const nsr = pad(totalLines, 9)
    const type = '9'
    // Qtds... Simplifying to just 0s and putting Type 7 count
    // The trailer spec is complex, filling with 0s for now
    const zeros = pad(0, 9 * 5)
    return `${nsr}${type}${zeros}`
}

// Helpers
function pad(val: string | number, len: number, char: string = '0', align: 'left' | 'right' = 'left'): string {
    const s = String(val).substring(0, len)
    if (align === 'left') return s.padStart(len, char) // Numbers usually left padded with 0 -> 0001
    return s.padEnd(len, char) // Text usually right padded with space -> "Name   "
}

function toFixedDate(d: Date): string {
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const yyyy = d.getFullYear()
    return `${dd}${mm}${yyyy}`
}

function toFixedTime(d: Date): string {
    const hh = String(d.getHours()).padStart(2, '0')
    const mm = String(d.getMinutes()).padStart(2, '0')
    return `${hh}${mm}`
}

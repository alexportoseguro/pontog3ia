
import { generateAFD } from '../lib/compliance/afd'
import { generateAEJ } from '../lib/compliance/aej'

// Mock Data
const company = {
    cnpj: '12345678000199',
    razaoSocial: 'Empresa Teste Ltda',
    repId: '00000000000000001',
    startDate: new Date('2023-01-01'),
    endDate: new Date('2023-01-31')
}

const employees = [
    { id: 'u1', cpf: '12345678901', name: 'João Silva', pis: '12345678901' },
    { id: 'u2', cpf: '98765432100', name: 'Maria Souza', pis: '98765432100' }
]

const markings = [
    { employeeId: 'u1', date: new Date('2023-01-01T08:00:00'), repId: 1, type: 'E' as const },
    { employeeId: 'u1', date: new Date('2023-01-01T12:00:00'), repId: 1, type: 'S' as const },
    { employeeId: 'u2', date: new Date('2023-01-01T09:00:00'), repId: 1, type: 'E' as const }
]

console.log('--- AFD Output ---')
const afd = generateAFD({
    company,
    records: markings.map((m, i) => ({
        nsr: i + 1,
        date: m.date,
        cpf: employees.find(e => e.id === m.employeeId)?.cpf || ''
    }))
})
console.log(afd)

console.log('\n--- AEJ Output ---')
const aej = generateAEJ({
    company,
    employees,
    markings
})
console.log(aej)

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing env vars')
    console.log('URL:', supabaseUrl ? 'OK' : 'MISSING')
    console.log('KEY:', supabaseKey ? 'OK' : 'MISSING')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

const holidays = [
    { date: '2025-01-01', name: 'Confraternização Universal', type: 'national' },
    { date: '2025-03-03', name: 'Carnaval', type: 'national' },
    { date: '2025-03-04', name: 'Carnaval', type: 'national' },
    { date: '2025-04-18', name: 'Paixão de Cristo', type: 'national' },
    { date: '2025-04-21', name: 'Tiradentes', type: 'national' },
    { date: '2025-05-01', name: 'Dia do Trabalho', type: 'national' },
    { date: '2025-06-19', name: 'Corpus Christi', type: 'national' },
    { date: '2025-09-07', name: 'Independência do Brasil', type: 'national' },
    { date: '2025-10-12', name: 'Nossa Senhora Aparecida', type: 'national' },
    { date: '2025-11-02', name: 'Finados', type: 'national' },
    { date: '2025-11-15', name: 'Proclamação da República', type: 'national' },
    { date: '2025-11-20', name: 'Dia da Consciência Negra', type: 'national' },
    { date: '2025-12-25', name: 'Natal', type: 'national' },
    // 2026
    { date: '2026-01-01', name: 'Confraternização Universal', type: 'national' },
    { date: '2026-02-16', name: 'Carnaval', type: 'national' },
    { date: '2026-02-17', name: 'Carnaval', type: 'national' },
    { date: '2026-04-03', name: 'Paixão de Cristo', type: 'national' },
    { date: '2026-04-21', name: 'Tiradentes', type: 'national' },
    { date: '2026-05-01', name: 'Dia do Trabalho', type: 'national' },
    { date: '2026-06-04', name: 'Corpus Christi', type: 'national' },
    { date: '2026-09-07', name: 'Independência do Brasil', type: 'national' },
    { date: '2026-10-12', name: 'Nossa Senhora Aparecida', type: 'national' },
    { date: '2026-11-02', name: 'Finados', type: 'national' },
    { date: '2026-11-15', name: 'Proclamação da República', type: 'national' },
    { date: '2026-11-20', name: 'Dia da Consciência Negra', type: 'national' },
    { date: '2026-12-25', name: 'Natal', type: 'national' }
]

async function seed() {
    console.log('📅 Seeding holidays...')

    const { data, error } = await supabase
        .from('holidays')
        .upsert(holidays, { onConflict: 'date' })

    if (error) {
        console.error('❌ Error inserting:', error)
    } else {
        console.log('✅ Success! Inserted', holidays.length, 'holidays')

        // Verify
        const { count } = await supabase
            .from('holidays')
            .select('*', { count: 'exact', head: true })

        console.log('📊 Total holidays in DB:', count)
    }
}

seed()

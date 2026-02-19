
import { detectAnomalies } from '../lib/intelligence'
import { createClient } from '@supabase/supabase-js'

// Mock Supabase Client for testing
const mockSupabase = {
    from: (table: string) => ({
        select: (cols: string) => ({
            eq: (col: string, val: string) => ({
                single: async () => {
                    if (table === 'companies') {
                        // Mock Company Settings
                        return { data: { address: 'Rua Teste, 123', latitude: -23.55052, longitude: -46.633308 } }
                    }
                    return { data: null }
                }
            })
        })
    })
}

async function testAnomaly() {
    console.log('--- Testing Anomaly Detection ---')

    // 1. Normal Case
    const res1 = await detectAnomalies(
        'user1',
        'comp1',
        '-23.55052,-46.633308', // Correct location (lat, lon) matching mock
        new Date('2023-01-01T10:00:00'), // Normal time
        mockSupabase
    )
    console.log('Normal Case:', res1)

    // 2. Time Anomaly (3 AM)
    const res2 = await detectAnomalies(
        'user1',
        'comp1',
        '-23.55052,-46.633308',
        new Date('2023-01-01T03:00:00'),
        mockSupabase
    )
    console.log('Time Anomaly:', res2)

    // 3. Location Anomaly (Wait, my logic for geofence was simple check for 0,0 or null)
    const res3 = await detectAnomalies(
        'user1',
        'comp1',
        '0,0',
        new Date('2023-01-01T10:00:00'),
        mockSupabase
    )
    console.log('Location Anomaly 0,0:', res3)

    // 4. Missing Location
    const res4 = await detectAnomalies(
        'user1',
        'comp1',
        null,
        new Date('2023-01-01T10:00:00'),
        mockSupabase
    )
    console.log('Missing Location:', res4)
}

testAnomaly()

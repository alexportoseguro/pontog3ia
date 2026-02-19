
import { createClient } from '@supabase/supabase-js'

// Simple Haversine distance
function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
    var R = 6371; // Radius of the earth in km
    var dLat = deg2rad(lat2 - lat1);  // deg2rad below
    var dLon = deg2rad(lon2 - lon1);
    var a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2)
        ;
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var d = R * c; // Distance in km
    return d;
}

function deg2rad(deg: number) {
    return deg * (Math.PI / 180)
}

type AnomalyResult = {
    isFlagged: boolean
    reason: string | null
}

export async function detectAnomalies(
    userId: string,
    companyId: string,
    location: string | null, // Text format "lat,lon" or address? Usually "lat,lon" from mobile
    timestamp: Date,
    supabaseClient: any // Pass the admin client to avoid RLS issues
): Promise<AnomalyResult> {
    const result: AnomalyResult = { isFlagged: false, reason: null }
    const reasons: string[] = []

    try {
        // 1. Time Anomaly (e.g. 11 PM to 5 AM)
        // Hardcoded rule for MVP: Flag if between 23:00 and 05:00
        const hour = timestamp.getHours()
        if (hour >= 23 || hour < 5) {
            reasons.push('Horário suspeito (23h-05h)')
        }

        // 2. Geofence Anomaly
        if (location && location.includes(',')) {
            const [latStr, lonStr] = location.split(',')
            const lat = parseFloat(latStr)
            const lon = parseFloat(lonStr)

            if (!isNaN(lat) && !isNaN(lon)) {
                // Fetch allowed location rules? 
                // For MVP, checking if far from Company address?
                // Or use `location_settings` table if it exists.
                // Let's assume we check against "Company HQ".

                const { data: company } = await supabaseClient
                    .from('companies')
                    .select('latitude, longitude, radius_meters')
                    .eq('id', companyId)
                    .single()

                if (company && company.latitude && company.longitude) {
                    const distance = getDistanceFromLatLonInKm(lat, lon, company.latitude, company.longitude)
                    const radiusKm = (company.radius_meters || 100) / 1000

                    if (distance > radiusKm) {
                        reasons.push(`Fora do perímetro (Distância: ${distance.toFixed(3)}km, Limite: ${radiusKm}km)`)
                    }
                } else if (lat === 0 && lon === 0) {
                    reasons.push('Localização inválida (0,0)')
                }


                if (reasons.length > 0) {
                    result.isFlagged = true
                    result.reason = reasons.join('; ')
                }
            }
        } else {
            reasons.push('Sem localização precisa')
        }

        if (reasons.length > 0) {
            result.isFlagged = true
            result.reason = reasons.join('; ')
        }

    } catch (err) {
        console.error('Error detecting anomalies:', err)
    }

    return result
}

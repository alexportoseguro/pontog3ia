import { NextResponse } from 'next/server'
import { checkAdminRole, supabaseAdmin } from '@/lib/auth-server'

// Helper for route optimization (Douglas-Peucker)
function simplifyPath(points: any[], tolerance: number): any[] {
    if (points.length <= 2) return points;

    let dmax = 0;
    let index = 0;
    const end = points.length - 1;

    for (let i = 1; i < end; i++) {
        const d = perpendicularDistance(points[i], points[0], points[end]);
        if (d > dmax) {
            index = i;
            dmax = d;
        }
    }

    if (dmax > tolerance) {
        const recResults1 = simplifyPath(points.slice(0, index + 1), tolerance);
        const recResults2 = simplifyPath(points.slice(index), tolerance);
        return recResults1.slice(0, recResults1.length - 1).concat(recResults2);
    } else {
        return [points[0], points[end]];
    }
}

function perpendicularDistance(point: any, lineStart: any, lineEnd: any): number {
    const x = point.longitude;
    const y = point.latitude;
    const startX = lineStart.longitude;
    const startY = lineStart.latitude;
    const endX = lineEnd.longitude;
    const endY = lineEnd.latitude;

    const dx = endX - startX;
    const dy = endY - startY;

    // Normalise
    const mag = Math.sqrt(dx * dx + dy * dy);
    if (mag > 0) {
        return Math.abs(dx * (startY - y) - (startX - x) * dy) / mag;
    }
    return 0;
}

export async function GET(request: Request) {
    try {
        const auth = await checkAdminRole()
        if (auth.error) {
            return NextResponse.json({ error: auth.error }, { status: auth.status })
        }
        const { searchParams } = new URL(request.url)
        const userId = searchParams.get('userId')
        const history = searchParams.get('history') === 'true'
        const dateStr = searchParams.get('date')

        if (userId && history) {
            // Step 1: verify user belongs to admin's company
            const { data: targetProfile } = await supabaseAdmin
                .from('profiles')
                .select('company_id')
                .eq('id', userId)
                .single()

            if (targetProfile?.company_id !== auth.companyId) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
            }

            // Step 2: get location history
            // Default to last 24h, but if a date is provided, get that full day
            let startTime, endTime

            if (dateStr) {
                // If a date string like '2023-10-25' is provided
                const targetDate = new Date(dateStr)
                startTime = new Date(targetDate.setHours(0, 0, 0, 0)).toISOString()
                endTime = new Date(targetDate.setHours(23, 59, 59, 999)).toISOString()
            } else {
                // Default fallback: Last 24 hours
                startTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
                endTime = new Date().toISOString()
            }

            const { data, error } = await supabaseAdmin
                .from('location_logs')
                .select('id, latitude, longitude, timestamp, user_id')
                .eq('user_id', userId)
                .gte('timestamp', startTime)
                .lte('timestamp', endTime)
                .order('timestamp', { ascending: true })

            if (error) {
                console.error('location_logs error:', error)
                return NextResponse.json([]) // Return empty instead of crashing
            }

            // Optimize points if there are too many
            const points = data || [];
            // Tolerance in degrees (roughly 5-10 meters depending on latitude)
            // 0.00005 is a good starting point for street level tracking
            const optimizedPoints = points.length > 50 ? simplifyPath(points, 0.00005) : points;

            return NextResponse.json(optimizedPoints)
        }

        // Get latest location for each active user
        // We look at 'location_logs', 'time_events', and 'geofence_events'
        // We fetch data from the last 7 days
        const QUERY_WINDOW_DAYS = 7
        const minTimestamp = new Date(Date.now() - QUERY_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()

        // 1. Fetch from Location Logs
        const { data: latestLogs, error: latestError } = await supabaseAdmin
            .from('location_logs')
            .select('user_id, latitude, longitude, timestamp, profiles!inner(company_id)')
            .eq('profiles.company_id', auth.companyId)
            .gte('timestamp', minTimestamp)
            .order('timestamp', { ascending: false })

        if (latestError) console.error('Location Logs Error:', latestError)

        // 2. Fetch from Time Events
        const { data: latestEvents, error: eventsError } = await supabaseAdmin
            .from('time_events')
            .select('user_id, latitude, longitude, timestamp, profiles!inner(company_id)')
            .eq('profiles.company_id', auth.companyId)
            .gte('timestamp', minTimestamp)
            .neq('latitude', null) // Only with location
            .neq('longitude', null)
            .order('timestamp', { ascending: false })

        if (eventsError) console.error('Time Events Error:', eventsError)

        // 3. Fetch from Geofence Events (New)
        const { data: geofences, error: geoError } = await supabaseAdmin
            .from('geofence_events')
            .select('user_id, location, timestamp, profiles!inner(company_id)')
            .eq('profiles.company_id', auth.companyId)
            .gte('timestamp', minTimestamp)
            .order('timestamp', { ascending: false })

        if (geoError) console.error('Geofence Events Error:', geoError)

        // 4. Merge and deduplicate
        const userLocations = new Map()

        const updateIfNewer = (userId: string, point: any) => {
            const existing = userLocations.get(userId)
            if (!existing || new Date(point.timestamp) > new Date(existing.timestamp)) {
                userLocations.set(userId, point)
            }
        }

        // Process Logs
        latestLogs?.forEach((loc: any) => updateIfNewer(loc.user_id, loc))

        const parseAndMerge = (items: any[]) => {
            items?.forEach((evt: any) => {
                if (evt.location) {
                    try {
                        const cleanLoc = evt.location.replace(/[()]/g, '')
                        const parts = cleanLoc.split(',')
                        let lon, lat
                        if (parts.length === 2) {
                            lon = parseFloat(parts[0])
                            lat = parseFloat(parts[1])
                        }
                        if (lat && lon && !isNaN(lat) && !isNaN(lon)) {
                            updateIfNewer(evt.user_id, {
                                user_id: evt.user_id, latitude: lat, longitude: lon,
                                timestamp: evt.timestamp, source: 'event'
                            })
                        }
                    } catch (e) {
                        console.error('Error parsing location:', evt.location)
                    }
                }
            })
        }

        parseAndMerge(latestEvents || [])
        parseAndMerge(geofences || [])

        const uniqueLocations = Array.from(userLocations.values())

        // Get user profiles
        if (uniqueLocations.length > 0) {
            const userIds = uniqueLocations.map((loc: any) => loc.user_id)
            const { data: profiles, error: profileError } = await supabaseAdmin
                .from('profiles')
                .select('id, full_name, role, current_status')
                .in('id', userIds)
                .eq('company_id', auth.companyId)

            if (profileError) throw profileError

            // Merge location data with profile data
            const enrichedLocations = uniqueLocations.map((loc: any) => {
                const profile = profiles?.find((p: any) => p.id === loc.user_id)
                return {
                    ...loc,
                    full_name: profile?.full_name || 'Usuário',
                    role: profile?.role || 'employee',
                    current_status: profile?.current_status || 'offline'
                }
            })

            return NextResponse.json(enrichedLocations)
        }

        return NextResponse.json([])
    } catch (error: any) {
        console.error('Error fetching locations:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        const authHeader = request.headers.get('authorization')
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const token = authHeader.split(' ')[1]
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

        if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        // Get requester's profile to verify company (optional, but good for data integrity)
        // Actually, we just trust the user is sending their own location? 
        // Yes, but we should force user_id to match the token user.

        const body = await request.json()
        const { locations } = body

        if (!locations || !Array.isArray(locations) || locations.length === 0) {
            return NextResponse.json({ error: 'No locations provided' }, { status: 400 })
        }

        // Sanitize and format
        const pointsToInsert = locations.map((loc: any) => ({
            user_id: user.id, // Enforce User ID
            latitude: loc.latitude,
            longitude: loc.longitude,
            timestamp: loc.timestamp,
            accuracy: loc.accuracy,
            speed: loc.speed,
            source: 'tracking'
        }))

        const { error: insertError } = await supabaseAdmin
            .from('location_logs')
            .insert(pointsToInsert)

        if (insertError) throw insertError

        return NextResponse.json({ success: true, count: pointsToInsert.length })

    } catch (error: any) {
        console.error('Upload Locations Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

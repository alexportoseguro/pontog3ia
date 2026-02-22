'use client'
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@supabase/supabase-js'
import MarkerClusterGroup from 'react-leaflet-cluster'

// Fix for default marker icon
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Helper to calculate distance between two points in meters
function getDistance(p1: [number, number], p2: [number, number]) {
    const R = 6371e3; // Earth radius in meters
    const phi1 = p1[0] * Math.PI / 180;
    const phi2 = p2[0] * Math.PI / 180;
    const deltaPhi = (p2[0] - p1[0]) * Math.PI / 180;
    const deltaLambda = (p2[1] - p1[1]) * Math.PI / 180;

    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
        Math.cos(phi1) * Math.cos(phi2) *
        Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

// Custom colored markers
const createColoredIcon = (color: string, pulse = false) => new L.DivIcon({
    html: `
        <div style="position:relative;width:44px;height:54px;">
            ${pulse ? `<div style="position:absolute;top:6px;left:6px;width:32px;height:32px;border-radius:50%;background:${color};opacity:0.25;animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></div>` : ''}
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 54" width="44" height="54">
                <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="rgba(0,0,0,0.3)"/>
                </filter>
                <path fill="${color}" filter="url(#shadow)" stroke="#fff" stroke-width="2" d="M22 2C14.3 2 8 8.3 8 16c0 9.5 14 32 14 32s14-22.5 14-32c0-7.7-6.3-14-14-14z"/>
                <circle cx="22" cy="16" r="7" fill="#fff"/>
            </svg>
        </div>
    `,
    iconSize: [44, 54],
    iconAnchor: [22, 54],
    popupAnchor: [0, -54],
    className: ''
})

// Custom Stop Pin
const createStopIcon = (durationStr: string) => new L.DivIcon({
    html: `
        <div style="position:relative;width:32px;height:32px;background:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 10px rgba(0,0,0,0.2);border:2px solid #6366f1;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            <div style="position:absolute;bottom:-20px;left:50%;transform:translateX(-50%);background:#1e293b;color:#fff;font-size:9px;font-weight:800;padding:2px 6px;border-radius:10px;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,0.3);">
                ${durationStr}
            </div>
        </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
    className: ''
})

// Normalize status to lowercase for consistent matching
function normalizeStatus(s: string | undefined): string {
    return (s || 'offline').toLowerCase()
}

const statusColors: Record<string, string> = {
    working: '#10b981',
    break: '#f59e0b',
    out: '#ef4444',
    offline: '#6b7280'
}

function getStatusColor(status: string): string {
    return statusColors[normalizeStatus(status)] || statusColors.offline
}

function getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
        working: '🟢 Trabalhando',
        break: '☕ Em Intervalo',
        out: '🔴 Ausente',
        offline: '⚫ Offline'
    }
    return labels[normalizeStatus(status)] || '⚫ Offline'
}

function formatTime(timestamp: string): string {
    return new Date(timestamp).toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
    })
}

function formatDuration(minutes: number): string {
    if (minutes < 60) return `${Math.round(minutes)}m`;
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return `${h}h${m > 0 ? m + 'm' : ''}`;
}

// Component to keep map centered on selected user
function MapController({ locations, selectedUserId }: { locations: any[], selectedUserId?: string | null }) {
    const map = useMap()
    useEffect(() => {
        if (selectedUserId) {
            const loc = locations.find(l => l.user_id === selectedUserId)
            if (loc?.latitude && loc?.longitude) {
                map.flyTo([loc.latitude, loc.longitude], 16, { duration: 1.2 })
            }
        } else if (locations.length > 0) {
            const bounds = L.latLngBounds(locations.map(l => [l.latitude, l.longitude]))
            if (bounds.isValid()) map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 })
        }
    }, [selectedUserId, locations])
    return null
}

interface LocationMapProps {
    locations: any[]
    selectedUserId?: string | null
    routeDate?: string | null
    geofences?: any[]
    onMarkerClick?: (userId: string) => void
    onViewDetails?: (loc: any) => void
}

export default function LocationMap({ locations, selectedUserId, routeDate, geofences = [], onMarkerClick, onViewDetails }: LocationMapProps) {
    const [fullRouteData, setFullRouteData] = useState<any[]>([])
    const [route, setRoute] = useState<[number, number][]>([])
    const [routeUser, setRouteUser] = useState<string | null>(null)
    const [loadingRoute, setLoadingRoute] = useState(false)
    const [noRouteData, setNoRouteData] = useState(false)

    const defaultCenter: [number, number] = [-16.440258, -39.072313]
    const center = locations.length > 0
        ? [locations[0].latitude, locations[0].longitude] as [number, number]
        : defaultCenter

    const fetchRoute = useCallback(async (userId: string, dateStr?: string | null) => {
        setLoadingRoute(true)
        setRouteUser(userId)
        setNoRouteData(false)
        try {
            const { data: { session } } = await supabase.auth.getSession()
            const headers: Record<string, string> = {}
            if (session?.access_token) {
                headers['Authorization'] = `Bearer ${session.access_token}`
            }

            let url = `/api/locations?userId=${userId}&history=true`
            if (dateStr) {
                url += `&date=${dateStr}`
            }

            const res = await fetch(url, { headers })
            if (res.ok) {
                const data = await res.json()
                if (Array.isArray(data) && data.length > 0) {
                    setFullRouteData(data)
                    setRoute(data.map((p: any) => [p.latitude, p.longitude] as [number, number]))
                    setNoRouteData(false)
                } else {
                    setFullRouteData([])
                    setRoute([])
                    setNoRouteData(true)
                    setTimeout(() => setNoRouteData(false), 4000)
                }
            } else {
                setFullRouteData([])
                setRoute([])
                setNoRouteData(true)
                setTimeout(() => setNoRouteData(false), 4000)
            }
        } catch (e) {
            console.error('Error fetching route', e)
            setRoute([])
            setFullRouteData([])
        } finally {
            setLoadingRoute(false)
        }
    }, [])

    // Detecção de Paradas (>10min em um local de 30m)
    const stops = useMemo(() => {
        if (fullRouteData.length < 2) return [];

        const detectedStops = [];
        let currentStop: any = null;

        for (let i = 0; i < fullRouteData.length - 1; i++) {
            const p1 = fullRouteData[i];
            const p2 = fullRouteData[i + 1];

            const dist = getDistance([p1.latitude, p1.longitude], [p2.latitude, p2.longitude]);
            const timeDiffMs = new Date(p2.timestamp).getTime() - new Date(p1.timestamp).getTime();
            const timeDiffMin = timeDiffMs / 1000 / 60;

            // Se a distância for curta (<35m), consideramos que está no mesmo lugar
            if (dist < 35) {
                if (!currentStop) {
                    currentStop = {
                        startP: p1,
                        endP: p2,
                        durationMin: timeDiffMin,
                        latitude: p1.latitude,
                        longitude: p1.longitude
                    };
                } else {
                    currentStop.endP = p2;
                    currentStop.durationMin += timeDiffMin;
                }
            } else {
                // Se saiu do raio e o stop durou > 10 min, salva
                if (currentStop && currentStop.durationMin >= 10) {
                    detectedStops.push(currentStop);
                }
                currentStop = null;
            }
        }
        // Final check
        if (currentStop && currentStop.durationMin >= 10) {
            detectedStops.push(currentStop);
        }

        return detectedStops;
    }, [fullRouteData]);

    async function handleMarkerClick(userId: string) {
        if (onMarkerClick) onMarkerClick(userId)
        await fetchRoute(userId, routeDate)
    }

    useEffect(() => {
        if (selectedUserId) {
            fetchRoute(selectedUserId, routeDate)
        } else {
            setRoute([])
            setFullRouteData([])
            setRouteUser(null)
            setNoRouteData(false)
        }
    }, [selectedUserId, routeDate])

    return (
        <div style={{ position: 'relative', height: '100%', width: '100%' }}>
            {/* Route Loading Overlay */}
            {loadingRoute && (
                <div style={{
                    position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
                    zIndex: 1000, background: 'rgba(17,24,39,0.85)', backdropFilter: 'blur(8px)',
                    borderRadius: 16, padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 10,
                    boxShadow: '0 4px 24px rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.1)'
                }}>
                    <div style={{ width: 16, height: 16, border: '2px solid #6366f1', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    <span style={{ color: '#fff', fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>
                        Carregando rota...
                    </span>
                </div>
            )}

            {/* No Route Data Toast */}
            {noRouteData && !loadingRoute && (
                <div style={{
                    position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
                    zIndex: 1000, background: 'rgba(217,119,6,0.92)', backdropFilter: 'blur(8px)',
                    borderRadius: 16, padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 10,
                    boxShadow: '0 4px 24px rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.15)'
                }}>
                    <span style={{ fontSize: 16 }}>📍</span>
                    <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>
                        Sem dados de rota nas últimas 24h
                    </span>
                </div>
            )}

            {/* Route Info Badge */}
            {route.length > 0 && !loadingRoute && (
                <div style={{
                    position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
                    zIndex: 1000, background: 'rgba(17,24,39,0.85)', backdropFilter: 'blur(8px)',
                    borderRadius: 16, padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 10,
                    boxShadow: '0 4px 24px rgba(0,0,0,0.25)', border: '1px solid rgba(99,102,241,0.3)',
                    cursor: 'pointer'
                }}
                    onClick={() => { setRoute([]); setRouteUser(null); setFullRouteData([]); }}
                >
                    <div style={{ width: 24, height: 4, background: '#6366f1', borderRadius: 2, borderTop: '2px solid #6366f1' }} />
                    <span style={{ color: '#fff', fontSize: 12, fontWeight: 700, letterSpacing: 0.5 }}>
                        Rota: {route.length} pontos • {stops.length} paradas
                    </span>
                    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginLeft: 10 }}>✕ fechar</span>
                </div>
            )}

            <style>{`
                @keyframes ping {
                    75%, 100% { transform: scale(2); opacity: 0; }
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>

            <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }}>
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                <MapController locations={locations} selectedUserId={selectedUserId} />

                {/* Draw Geofences */}
                {geofences.map(fence => {
                    const center = [fence.latitude, fence.longitude] as [number, number];
                    // Example: color based on type or status
                    const color = fence.status === 'active' ? '#3b82f6' : '#94a3b8';
                    return (
                        <CircleMarker
                            key={`geofence-${fence.id}`}
                            center={center}
                            radius={fence.radius > 0 ? fence.radius : 100} // Radius in meters
                            pathOptions={{
                                color: color,
                                fillColor: color,
                                fillOpacity: 0.15,
                                weight: 2,
                                dashArray: '5, 5'
                            }}
                        >
                            <Popup>
                                <div style={{ padding: '2px', fontFamily: 'system-ui, sans-serif' }}>
                                    <div style={{ fontWeight: 800, color: '#1e293b', fontSize: 13 }}>{fence.name}</div>
                                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                                        Raio: <strong>{fence.radius}m</strong>
                                    </div>
                                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                                        Tipo: <strong>{fence.type === 'site' ? 'Obra/Local' : fence.type === 'office' ? 'Escritório' : 'Posto'}</strong>
                                    </div>
                                </div>
                            </Popup>
                        </CircleMarker>
                    )
                })}

                {/* Draw Route */}
                {route.length > 0 && (
                    <>
                        {/* Shadow Path */}
                        <Polyline
                            positions={route}
                            pathOptions={{ color: '#000', weight: 8, opacity: 0.1, lineJoin: 'round' }}
                            smoothFactor={2}
                        />
                        {/* Main Path */}
                        <Polyline
                            positions={route}
                            pathOptions={{
                                color: '#6366f1',
                                weight: 4,
                                opacity: 0.8,
                                lineJoin: 'round',
                                lineCap: 'round'
                            }}
                            smoothFactor={1.5}
                        />

                        {/* Stop Markers */}
                        {stops.map((stop, idx) => (
                            <Marker
                                key={`stop-${idx}`}
                                position={[stop.latitude, stop.longitude]}
                                icon={createStopIcon(formatDuration(stop.durationMin))}
                            >
                                <Popup>
                                    <div style={{ padding: '2px', fontFamily: 'system-ui, sans-serif' }}>
                                        <div style={{ fontWeight: 800, color: '#6366f1', fontSize: 13 }}>⏱️ Local de Parada</div>
                                        <div style={{ fontSize: 12, marginTop: 4 }}>
                                            Permanência: <strong>{formatDuration(stop.durationMin)}</strong>
                                        </div>
                                        <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>
                                            {new Date(stop.startP.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -
                                            {new Date(stop.endP.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                        <div style={{ marginTop: 8 }}>
                                            <a
                                                href={`https://www.google.com/maps?q=${stop.latitude},${stop.longitude}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{
                                                    display: 'block',
                                                    width: '100%',
                                                    textAlign: 'center',
                                                    background: '#6366f1',
                                                    color: '#fff',
                                                    textDecoration: 'none',
                                                    borderRadius: '8px',
                                                    padding: '6px 0',
                                                    fontSize: '11px',
                                                    fontWeight: 'bold',
                                                    boxShadow: '0 2px 4px rgba(99,102,241,0.2)'
                                                }}
                                            >
                                                🗺️ Abrir no Maps
                                            </a>
                                        </div>
                                    </div>
                                </Popup>
                            </Marker>
                        ))}

                        {/* Start point - green dot */}
                        <CircleMarker
                            center={route[0]}
                            radius={8}
                            pathOptions={{ color: '#fff', fillColor: '#10b981', fillOpacity: 1, weight: 3 }}
                        />
                        {/* End point - blue dot */}
                        {route.length > 1 && (
                            <CircleMarker
                                center={route[route.length - 1]}
                                radius={8}
                                pathOptions={{ color: '#fff', fillColor: '#6366f1', fillOpacity: 1, weight: 3 }}
                            />
                        )}
                    </>
                )}

                {/* Locations Cluster */}
                <MarkerClusterGroup
                    chunkedLoading
                    maxClusterRadius={40}
                    spiderfyOnMaxZoom={true}
                    showCoverageOnHover={false}
                >
                    {locations.map((loc) => {
                        const isSelected = selectedUserId === loc.user_id
                        const icon = createColoredIcon(getStatusColor(loc.current_status), isSelected)
                        const accuracy = loc.accuracy || 15 // Default to 15m if not provided

                        return (
                            <div key={`container-${loc.user_id}`}>
                                {/* GPS Accuracy Circle */}
                                {isSelected && (
                                    <CircleMarker
                                        center={[loc.latitude, loc.longitude]}
                                        radius={accuracy} // Map radius in meters
                                        pathOptions={{
                                            color: '#6366f1',
                                            fillColor: '#6366f1',
                                            fillOpacity: 0.1,
                                            weight: 1,
                                            dashArray: '4, 4'
                                        }}
                                    />
                                )}

                                <Marker
                                    key={loc.user_id}
                                    position={[loc.latitude, loc.longitude]}
                                    icon={icon}
                                    eventHandlers={{ click: () => handleMarkerClick(loc.user_id) }}
                                    zIndexOffset={isSelected ? 1000 : 0}
                                >
                                    <Popup minWidth={220}>
                                        <div style={{ padding: '4px 0', fontFamily: 'system-ui, sans-serif' }}>
                                            <div style={{ fontWeight: 800, color: '#111827', fontSize: 15, marginBottom: 4 }}>
                                                {loc.full_name || 'Usuário'}
                                            </div>
                                            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                                                {getStatusLabel(loc.current_status)}
                                            </div>
                                            <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 10 }}>
                                                🕐 Visto em: {formatTime(loc.timestamp)}
                                                <br />
                                                🎯 Precisão: {Math.round(accuracy)}m
                                            </div>
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                <button
                                                    onClick={() => handleMarkerClick(loc.user_id)}
                                                    style={{
                                                        flex: 1, background: '#6366f1',
                                                        color: '#fff', border: 'none', borderRadius: 10, padding: '10px 0',
                                                        fontSize: 11, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 4px rgba(99,102,241,0.2)'
                                                    }}
                                                >
                                                    {loadingRoute && routeUser === loc.user_id
                                                        ? '⏳ Carregando...'
                                                        : '🗺️ Ver Rota'}
                                                </button>
                                                {onViewDetails && (
                                                    <button
                                                        onClick={() => onViewDetails(loc)}
                                                        style={{
                                                            flex: 1, border: '1.5px solid #e2e8f0', color: '#475569',
                                                            background: '#fff', borderRadius: 10, padding: '10px 0',
                                                            fontSize: 11, fontWeight: 700, cursor: 'pointer'
                                                        }}
                                                    >
                                                        👤 Perfil
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </Popup>
                                </Marker>
                            </div>
                        )
                    })}
                </MarkerClusterGroup>
            </MapContainer>
        </div>
    )
}

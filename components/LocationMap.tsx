'use client'
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

// Fix for default marker icon
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

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
    onMarkerClick?: (userId: string) => void
    onViewDetails?: (loc: any) => void
}

export default function LocationMap({ locations, selectedUserId, onMarkerClick, onViewDetails }: LocationMapProps) {
    const [route, setRoute] = useState<[number, number][]>([])
    const [routeUser, setRouteUser] = useState<string | null>(null)
    const [loadingRoute, setLoadingRoute] = useState(false)
    const [noRouteData, setNoRouteData] = useState(false)

    const defaultCenter: [number, number] = [-16.440258, -39.072313]
    const center = locations.length > 0
        ? [locations[0].latitude, locations[0].longitude] as [number, number]
        : defaultCenter

    const fetchRoute = useCallback(async (userId: string) => {
        setLoadingRoute(true)
        setRouteUser(userId)
        setNoRouteData(false)
        try {
            const { data: { session } } = await supabase.auth.getSession()
            const headers: Record<string, string> = {}
            if (session?.access_token) {
                headers['Authorization'] = `Bearer ${session.access_token}`
            }
            const res = await fetch(`/api/locations?userId=${userId}&history=true`, { headers })
            if (res.ok) {
                const data = await res.json()
                if (Array.isArray(data) && data.length > 0) {
                    setRoute(data.map((p: any) => [p.latitude, p.longitude] as [number, number]))
                    setNoRouteData(false)
                } else {
                    setRoute([])
                    setNoRouteData(true)
                    // Clear "no data" message after 4 seconds
                    setTimeout(() => setNoRouteData(false), 4000)
                }
            } else {
                console.warn('Route API error:', res.status)
                setRoute([])
                setNoRouteData(true)
                setTimeout(() => setNoRouteData(false), 4000)
            }
        } catch (e) {
            console.error('Error fetching route', e)
            setRoute([])
        } finally {
            setLoadingRoute(false)
        }
    }, [])

    async function handleMarkerClick(userId: string) {
        if (onMarkerClick) onMarkerClick(userId)
        await fetchRoute(userId)
    }

    // Auto-fetch route when selectedUserId changes
    useEffect(() => {
        if (selectedUserId) {
            fetchRoute(selectedUserId)
        } else {
            setRoute([])
            setRouteUser(null)
            setNoRouteData(false)
        }
    }, [selectedUserId])

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
                    onClick={() => { setRoute([]); setRouteUser(null); }}
                >
                    <div style={{ width: 24, height: 4, background: '#3b82f6', borderRadius: 2, borderTop: '2px dashed #3b82f6' }} />
                    <span style={{ color: '#fff', fontSize: 12, fontWeight: 700, letterSpacing: 0.5 }}>
                        Rota: {route.length} pontos GPS
                    </span>
                    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>✕ fechar</span>
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

                {/* Draw Route */}
                {route.length > 0 && (
                    <>
                        {/* Route shadow for depth */}
                        <Polyline
                            positions={route}
                            color="#1e3a5f"
                            weight={8}
                            opacity={0.15}
                        />
                        <Polyline
                            positions={route}
                            color="#3b82f6"
                            weight={4}
                            opacity={0.9}
                            dashArray="12, 8"
                        />
                        {/* Start point - green */}
                        <CircleMarker
                            center={route[0]}
                            radius={9}
                            pathOptions={{ color: '#fff', fillColor: '#10b981', fillOpacity: 1, weight: 3 }}
                        />
                        {/* End point - blue */}
                        {route.length > 1 && (
                            <CircleMarker
                                center={route[route.length - 1]}
                                radius={9}
                                pathOptions={{ color: '#fff', fillColor: '#3b82f6', fillOpacity: 1, weight: 3 }}
                            />
                        )}
                    </>
                )}

                {locations.map((loc) => {
                    const isSelected = selectedUserId === loc.user_id
                    const icon = createColoredIcon(getStatusColor(loc.current_status), isSelected)

                    return (
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
                                    <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 2 }}>
                                        📍 {loc.latitude?.toFixed(5)}, {loc.longitude?.toFixed(5)}
                                    </div>
                                    <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 10 }}>
                                        🕐 {formatTime(loc.timestamp)}
                                    </div>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button
                                            onClick={() => handleMarkerClick(loc.user_id)}
                                            style={{
                                                flex: 1, background: loadingRoute && routeUser === loc.user_id ? '#94a3b8' : '#3b82f6',
                                                color: '#fff', border: 'none', borderRadius: 8, padding: '8px 0',
                                                fontSize: 11, fontWeight: 700, cursor: 'pointer', letterSpacing: 0.3
                                            }}
                                        >
                                            {loadingRoute && routeUser === loc.user_id
                                                ? '⏳ Carregando...'
                                                : routeUser === loc.user_id && route.length > 0
                                                    ? `📍 ${route.length} pontos`
                                                    : '🗺️ Ver Rota'}
                                        </button>
                                        {onViewDetails && (
                                            <button
                                                onClick={() => onViewDetails(loc)}
                                                style={{
                                                    flex: 1, background: '#4f46e5', color: '#fff',
                                                    border: 'none', borderRadius: 8, padding: '8px 0',
                                                    fontSize: 11, fontWeight: 700, cursor: 'pointer'
                                                }}
                                            >
                                                👤 Detalhes
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </Popup>
                        </Marker>
                    )
                })}
            </MapContainer>
        </div>
    )
}

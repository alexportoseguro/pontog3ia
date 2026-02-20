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

    const defaultCenter: [number, number] = [-16.440258, -39.072313]
    const center = locations.length > 0
        ? [locations[0].latitude, locations[0].longitude] as [number, number]
        : defaultCenter

    const fetchRoute = useCallback(async (userId: string) => {
        setLoadingRoute(true)
        setRouteUser(userId)
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
                } else {
                    setRoute([])
                }
            } else {
                console.warn('Route API error:', res.status)
                setRoute([])
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
        }
    }, [selectedUserId])

    return (
        <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }}>
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <MapController locations={locations} selectedUserId={selectedUserId} />

            {/* Pulse animation style */}
            <style>{`
                @keyframes ping {
                    75%, 100% { transform: scale(2); opacity: 0; }
                }
            `}</style>

            {/* Draw Route */}
            {route.length > 0 && (
                <>
                    <Polyline
                        positions={route}
                        color="#3b82f6"
                        weight={4}
                        opacity={0.8}
                        dashArray="12, 8"
                    />
                    {/* Start point - green */}
                    <CircleMarker
                        center={route[0]}
                        radius={9}
                        pathOptions={{ color: '#fff', fillColor: '#10b981', fillOpacity: 1, weight: 2 }}
                    />
                    {/* End point - blue */}
                    {route.length > 1 && (
                        <CircleMarker
                            center={route[route.length - 1]}
                            radius={9}
                            pathOptions={{ color: '#fff', fillColor: '#3b82f6', fillOpacity: 1, weight: 2 }}
                        />
                    )}
                </>
            )}

            {locations.map((loc) => {
                const status = normalizeStatus(loc.current_status)
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
                            <div className="space-y-2 py-1">
                                <div className="font-bold text-gray-900 text-base">{loc.full_name || 'Usuário'}</div>
                                <div className="text-sm font-medium">{getStatusLabel(loc.current_status)}</div>
                                <div className="text-xs text-gray-500">
                                    📍 {loc.latitude?.toFixed(5)}, {loc.longitude?.toFixed(5)}
                                </div>
                                <div className="text-xs text-gray-400">
                                    🕐 {formatTime(loc.timestamp)}
                                </div>
                                <div className="flex gap-2 pt-2">
                                    <button
                                        onClick={() => handleMarkerClick(loc.user_id)}
                                        className="flex-1 bg-blue-600 text-white px-3 py-1.5 rounded text-xs font-semibold hover:bg-blue-700 transition"
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
                                            className="flex-1 bg-indigo-600 text-white px-3 py-1.5 rounded text-xs font-semibold hover:bg-indigo-700 transition"
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
    )
}

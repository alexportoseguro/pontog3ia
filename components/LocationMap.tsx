'use client'
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { useEffect, useState } from 'react'

// Fix for default marker icon
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;

// Custom colored markers
const createColoredIcon = (color: string) => new L.Icon({
    iconUrl: `data:image/svg+xml;base64,${btoa(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="32" height="48">
            <path fill="${color}" stroke="#fff" stroke-width="2" d="M12 0C7.58 0 4 3.58 4 8c0 5.5 8 16 8 16s8-10.5 8-16c0-4.42-3.58-8-8-8z"/>
            <circle cx="12" cy="8" r="4" fill="#fff"/>
        </svg>
    `)}`,
    iconSize: [32, 48],
    iconAnchor: [16, 48],
    popupAnchor: [0, -48]
})

const statusColors = {
    working: '#10b981', // green
    break: '#f59e0b', // yellow
    out: '#ef4444', // red
    offline: '#6b7280' // gray
}

interface LocationMapProps {
    locations: any[]
    selectedUserId?: string | null
    onMarkerClick?: (userId: string) => void
}

export default function LocationMap({ locations, selectedUserId, onMarkerClick }: LocationMapProps) {
    const [route, setRoute] = useState<[number, number][]>([])
    const [routeUser, setRouteUser] = useState<string | null>(null)

    // Default center
    const defaultCenter: [number, number] = [-16.440258, -39.072313]
    const center = locations.length > 0
        ? [locations[0].latitude, locations[0].longitude] as [number, number]
        : defaultCenter

    async function handleMarkerClick(userId: string) {
        setRouteUser(userId)
        if (onMarkerClick) onMarkerClick(userId)

        try {
            const res = await fetch(`/api/locations?userId=${userId}&history=true`)
            const data = await res.json()
            if (Array.isArray(data) && data.length > 0) {
                const points = data.map((p: any) => [p.latitude, p.longitude] as [number, number])
                setRoute(points)
            } else {
                setRoute([])
            }
        } catch (e) {
            console.error('Error fetching route', e)
            setRoute([])
        }
    }

    // Auto-fetch route when selectedUserId changes
    useEffect(() => {
        if (selectedUserId) {
            handleMarkerClick(selectedUserId)
        } else {
            setRoute([])
            setRouteUser(null)
        }
    }, [selectedUserId])

    function getStatusColor(status: string): string {
        return statusColors[status as keyof typeof statusColors] || statusColors.offline
    }

    function getStatusLabel(status: string): string {
        const labels = {
            working: '🟢 Trabalhando',
            break: '☕ Em Intervalo',
            out: '🔴 Ausente',
            offline: '⚫ Offline'
        }
        return labels[status as keyof typeof labels] || '⚫ Offline'
    }

    function formatTime(timestamp: string): string {
        return new Date(timestamp).toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    return (
        <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }}>
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* Draw Path if route exists */}
            {route.length > 0 && (
                <>
                    <Polyline
                        positions={route}
                        color="#3b82f6"
                        weight={3}
                        opacity={0.7}
                        dashArray="10, 10"
                    />
                    {/* Start point */}
                    {route.length > 0 && (
                        <CircleMarker
                            center={route[0]}
                            radius={10}
                            pathOptions={{ color: '#10b981', fillColor: '#10b981', fillOpacity: 0.8 }}
                        />
                    )}
                    {/* End point */}
                    {route.length > 1 && (
                        <CircleMarker
                            center={route[route.length - 1]}
                            radius={10}
                            pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.8 }}
                        />
                    )}
                </>
            )}

            {locations.map((loc) => {
                const icon = createColoredIcon(getStatusColor(loc.current_status))
                const isSelected = selectedUserId === loc.user_id

                return (
                    <Marker
                        key={loc.user_id}
                        position={[loc.latitude, loc.longitude]}
                        icon={icon}
                        eventHandlers={{
                            click: () => handleMarkerClick(loc.user_id),
                        }}
                        zIndexOffset={isSelected ? 1000 : 0}
                    >
                        <Popup>
                            <div className="min-w-[200px]">
                                <div className="font-bold text-gray-900 text-base mb-1">
                                    {loc.full_name || 'Usuário'}
                                </div>
                                <div className="space-y-1 text-sm">
                                    <div className="flex items-center justify-between">
                                        <span className="text-gray-600">Status:</span>
                                        <span className="font-medium">{getStatusLabel(loc.current_status)}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-gray-600">Cargo:</span>
                                        <span className="font-medium capitalize">{loc.role}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-gray-600">Última vez:</span>
                                        <span className="font-medium text-xs">{formatTime(loc.timestamp)}</span>
                                    </div>
                                    <div className="pt-2 border-t border-gray-200 text-xs text-gray-500">
                                        📍 {loc.latitude.toFixed(5)}, {loc.longitude.toFixed(5)}
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleMarkerClick(loc.user_id)}
                                    className="mt-3 w-full bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700 transition font-medium"
                                >
                                    {routeUser === loc.user_id && route.length > 0
                                        ? `📍 ${route.length} pontos na rota`
                                        : '🗺️ Ver Rota do Dia'
                                    }
                                </button>
                            </div>
                        </Popup>
                    </Marker>
                )
            })}
        </MapContainer>
    )
}

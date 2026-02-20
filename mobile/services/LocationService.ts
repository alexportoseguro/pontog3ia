import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../lib/api';

const GEOFENCE_TASK_NAME = 'GEOFENCE_TASK';
export const OFFLINE_QUEUE_KEY = '@offline_events';

// Max age for queued items before auto-discard (24 hours)
const MAX_QUEUE_AGE_MS = 24 * 60 * 60 * 1000;

// Default / Fallback Region (Porto Seguro) - Used if DB config fails
let currentRegion = {
    identifier: 'COMPANY_BASE',
    latitude: -16.440258229684606,
    longitude: -39.07231390395018,
    radius: 100, // meters
    notifyOnEnter: true,
    notifyOnExit: true,
};

// Fetch real config from Database
async function updateGeofenceConfig() {
    try {
        console.log('Fetching Company Config from DB...');
        const { data, error } = await supabase.from('companies').select('*').single();

        if (error) {
            console.warn('⚠️ Error fetching config (using default):', error.message);
            return;
        }

        if (data) {
            currentRegion = {
                identifier: 'COMPANY_BASE',
                latitude: data.latitude,
                longitude: data.longitude,
                radius: data.radius_meters || 100,
                notifyOnEnter: true,
                notifyOnExit: true,
            };
            console.log('✅ Geofence Updated from DB:', currentRegion);
        }
    } catch (err) {
        console.warn('⚠️ Failed to fetch geofence config, using default:', err);
    }
}

TaskManager.defineTask(GEOFENCE_TASK_NAME, async ({ data, error }: any) => {
    if (error) {
        console.error('Geofence task error:', error);
        return;
    }
    const { eventType, region } = data;

    // Try to sync old events before logging new one
    await syncOfflineEvents();

    if (eventType === Location.GeofencingEventType.Enter) {
        console.log('ENTROU NO PERIMETRO');
        await logEvent('ENTER_PERIMETER', region);
    } else if (eventType === Location.GeofencingEventType.Exit) {
        console.log('SAIU DO PERIMETRO');
        await logEvent('EXIT_PERIMETER', region);

        // Trigger Notification to ask for justification
        try {
            await Notifications.scheduleNotificationAsync({
                content: {
                    title: "⚠️ Saída Detectada",
                    body: "Você saiu do perímetro da empresa. Toque para justificar.",
                    data: { screen: 'chat', context: 'exit_justification' },
                },
                trigger: null, // show immediately
            });
        } catch (notifError) {
            console.log('⚠️ Failed to schedule notification (likely Expo Go restriction):', notifError);
        }
    }
});

async function logEvent(type: 'ENTER_PERIMETER' | 'EXIT_PERIMETER', region: any) {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user || !user.id) {
        console.warn('⚠️ Cannot log event: No valid user session.');
        return;
    }

    const payload = {
        user_id: user.id,
        event_type: type,
        location: `(${region.longitude},${region.latitude})`,
        timestamp: new Date().toISOString(),
    };

    try {
        const { error } = await supabase.from('geofence_events').insert(payload);
        if (error) throw error;
        console.log('✅ Event logged to Supabase:', type);
    } catch (e) {
        console.log('⚠️ Network/DB Error - Saving to Offline Queue:', e);
        await saveOfflineEvent(payload);
    }
}

async function saveOfflineEvent(event: any) {
    try {
        const existing = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
        const queue = existing ? JSON.parse(existing) : [];
        queue.push({ ...event, _queued_at: Date.now() });
        await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    } catch (err) {
        console.error('Failed to save offline event', err);
    }
}

export async function syncOfflineEvents() {
    try {
        const existing = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
        if (!existing) return;

        const queue = JSON.parse(existing);
        if (queue.length === 0) return;

        console.log(`🔄 Syncing ${queue.length} offline events...`);

        const now = Date.now();
        const remaining = [];

        for (const event of queue) {
            // Auto-discard events older than MAX_QUEUE_AGE_MS
            const queuedAt = event._queued_at || 0;
            if (now - queuedAt > MAX_QUEUE_AGE_MS) {
                console.warn('🗑️ Auto-discarding expired event (>24h old):', event.event_type);
                continue;
            }

            // Pre-check: if event has no user_id, discard immediately
            if (!event.user_id) {
                console.warn('❌ Discarding malformed event (no user_id)');
                continue;
            }

            try {
                const { _queued_at, ...cleanEvent } = event;
                const { error } = await supabase.from('geofence_events').insert(cleanEvent);
                if (error) throw error;
                console.log('✅ Synced offline event:', event.event_type);
            } catch (err: any) {
                const isFKViolation = err.code === '23503';
                const isIntegrityError = err.code?.startsWith('23');

                if (isFKViolation || isIntegrityError || err.message?.includes('violates foreign key')) {
                    console.error('❌ Discarding invalid event (FK Violation):', err.message);
                } else {
                    remaining.push(event);
                }
            }
        }

        if (remaining.length !== queue.length) {
            if (remaining.length === 0) {
                await AsyncStorage.removeItem(OFFLINE_QUEUE_KEY);
            } else {
                await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
            }
        }

    } catch (err) {
        console.error('Error syncing offline events', err);
    }
}

const LOCATION_TRACKING_TASK_NAME = 'LOCATION_TRACKING';

// --- BACKGROUND TRACKING TASK ---
TaskManager.defineTask(LOCATION_TRACKING_TASK_NAME, async ({ data, error }: any) => {
    if (error) {
        console.error('Location tracking task error:', error);
        return;
    }
    if (data) {
        const { locations } = data;
        if (locations && locations.length > 0) {
            console.log(`📍 Received ${locations.length} new locations`);

            const points = locations.map((loc: any) => ({
                latitude: loc.coords.latitude,
                longitude: loc.coords.longitude,
                timestamp: new Date(loc.timestamp).toISOString(),
                accuracy: loc.coords.accuracy,
                speed: loc.coords.speed,
                source: 'tracking'
            }));

            await saveRoutePoints(points);
            await syncRoutePoints();
        }
    }
});

// --- ROUTE BUFFERING & SYNC ---
export const ROUTE_QUEUE_KEY = '@route_queue';

async function saveRoutePoints(points: any[]) {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const now = Date.now();
        const pointsWithUser = points.map(p => ({
            ...p,
            user_id: user.id,
            _queued_at: now
        }));

        const existing = await AsyncStorage.getItem(ROUTE_QUEUE_KEY);
        const queue = existing ? JSON.parse(existing) : [];

        queue.push(...pointsWithUser);

        // Limit queue size (safety)
        if (queue.length > 500) {
            console.warn('Route queue too large, dropping oldest 250');
            queue.splice(0, 250);
        }

        await AsyncStorage.setItem(ROUTE_QUEUE_KEY, JSON.stringify(queue));
    } catch (err) {
        console.error('Error saving route points:', err);
    }
}

export async function syncRoutePoints() {
    try {
        const existing = await AsyncStorage.getItem(ROUTE_QUEUE_KEY);
        if (!existing) return;

        const queue: any[] = JSON.parse(existing);
        if (queue.length === 0) return;

        // Auto-discard points older than 24h before attempting sync
        const now = Date.now();
        const freshQueue = queue.filter(p => {
            const age = now - (p._queued_at || 0);
            if (age > MAX_QUEUE_AGE_MS) {
                console.warn('🗑️ Auto-discarding expired route point (>24h old)');
                return false;
            }
            return true;
        });

        if (freshQueue.length === 0) {
            await AsyncStorage.removeItem(ROUTE_QUEUE_KEY);
            console.log('🗑️ Route queue cleared (all points were expired)');
            return;
        }

        if (freshQueue.length !== queue.length) {
            await AsyncStorage.setItem(ROUTE_QUEUE_KEY, JSON.stringify(freshQueue));
            console.log(`🗑️ Discarded ${queue.length - freshQueue.length} expired route points`);
        }

        console.log(`🔄 Syncing ${freshQueue.length} route points...`);

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            console.warn('⚠️ No session available, skipping sync');
            return;
        }

        // Remove internal metadata before sending
        const pointsToSend = freshQueue.map(({ _queued_at, ...p }) => p);

        const response = await fetch(`${API_URL}/api/locations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ locations: pointsToSend })
        });

        if (!response.ok) {
            const text = await response.text();
            console.error('Failed to sync route points:', response.status, text);
            // If 4xx error (bad data), discard the queue to prevent infinite loop
            if (response.status >= 400 && response.status < 500) {
                console.warn('⚠️ Client error — clearing route queue to prevent infinite retry');
                await AsyncStorage.removeItem(ROUTE_QUEUE_KEY);
            }
            return;
        }

        await AsyncStorage.removeItem(ROUTE_QUEUE_KEY);
        console.log(`✅ ${freshQueue.length} route points synced successfully`);

    } catch (err) {
        console.error('Error syncing route:', err);
    }
}

/**
 * Manually clear the local queues (offline events + route points).
 * Useful for removing stale data that can't be synced.
 */
export async function clearLocalQueues(): Promise<{ events: number; routes: number }> {
    let eventsCount = 0;
    let routesCount = 0;
    try {
        const offlineEvents = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
        if (offlineEvents) {
            eventsCount = JSON.parse(offlineEvents).length;
            await AsyncStorage.removeItem(OFFLINE_QUEUE_KEY);
        }
        const routePoints = await AsyncStorage.getItem(ROUTE_QUEUE_KEY);
        if (routePoints) {
            routesCount = JSON.parse(routePoints).length;
            await AsyncStorage.removeItem(ROUTE_QUEUE_KEY);
        }
        console.log(`🗑️ Cleared queues: ${eventsCount} events + ${routesCount} route points`);
    } catch (err) {
        console.error('Error clearing queues:', err);
    }
    return { events: eventsCount, routes: routesCount };
}

export async function startBackgroundTracking() {
    console.log('Starting Background Tracking...');
    const { status } = await Location.requestBackgroundPermissionsAsync();
    if (status !== 'granted') {
        console.error('Background location permission denied');
        return false;
    }

    try {
        await Location.startLocationUpdatesAsync(LOCATION_TRACKING_TASK_NAME, {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 60000, // 1 minute
            distanceInterval: 50, // 50 meters
            deferredUpdatesInterval: 60000,
            deferredUpdatesDistance: 50,
            foregroundService: {
                notificationTitle: "Rastreamento Ativo",
                notificationBody: "Registrando sua rota de trabalho...",
                notificationColor: "#10b981"
            }
        });
        console.log('Background tracking started');
        return true;
    } catch (err) {
        console.error('Failed to start tracking:', err);
        return false;
    }
}

export async function stopBackgroundTracking() {
    try {
        await Location.stopLocationUpdatesAsync(LOCATION_TRACKING_TASK_NAME);
        console.log('Background tracking stopped');
    } catch (err) {
        // ignore
    }
}

export async function startGeofencing() {
    console.log('Requesting Foreground Permission...');
    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();

    if (foregroundStatus !== 'granted') {
        console.error('Permission to access location was denied (Foreground)');
        return false;
    }

    console.log('Requesting Background Permission...');
    const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();

    if (backgroundStatus !== 'granted') {
        console.error('Permission to access location was denied (Background)');
        return false;
    }

    await updateGeofenceConfig();
    syncOfflineEvents();

    try {
        await Location.startGeofencingAsync(GEOFENCE_TASK_NAME, [currentRegion]);
        console.log('Geofencing activated with region:', currentRegion);
        return true;
    } catch (err) {
        console.error('Failed to start geofencing task:', err);
        return false;
    }
}

export async function stopGeofencing() {
    try {
        await Location.stopGeofencingAsync(GEOFENCE_TASK_NAME);
        console.log('Geofencing stopped.');
    } catch (e) {
        // ignore if not running
    }
}

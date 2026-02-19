import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../lib/api';

const GEOFENCE_TASK_NAME = 'GEOFENCE_TASK';
export const OFFLINE_QUEUE_KEY = '@offline_events';

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
            // Keep using default if error
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

    // Safety check: Cannot log event without user_id
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

    // Insert into Supabase with Offline Fallback
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

        // Avoid duplicate events if possible
        queue.push(event);

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

        const remaining = [];

        for (const event of queue) {
            // Pre-check: if event has no user_id, discard immediately
            if (!event.user_id) {
                console.warn('❌ Discarding malformed event (no user_id)');
                continue;
            }

            try {
                const { error } = await supabase.from('geofence_events').insert(event);
                if (error) throw error;
                console.log('✅ Synced offline event:', event.event_type);
            } catch (err: any) {
                // Parse Supabase/Postgres error
                const isFKViolation = err.code === '23503'; // foreign_key_violation
                const isIntegrityError = err.code?.startsWith('23');

                if (isFKViolation || isIntegrityError || err.message?.includes('violates foreign key')) {
                    console.error('❌ Discarding invalid event (FK Violation):', err.message);
                    // Do NOT add back to remaining, effectively deleting it
                } else {
                    // Temporary error (network?), keep in queue
                    remaining.push(event);
                }
            }
        }

        if (remaining.length !== queue.length) {
            await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
        } else if (remaining.length === 0) {
            await AsyncStorage.removeItem(OFFLINE_QUEUE_KEY);
        }

    } catch (err) {
        console.error('Error syncing offline events', err);
    }
}

const LOCATION_TRACKING_TASK_NAME = 'LOCATION_TRACKING';

// ... (existing code: GEOFENCE_TASK_NAME, OFFLINE_QUEUE_KEY, currentRegion, updateGeofenceConfig, GEOFENCE Task Definition)

// --- BACKGROUND TRACKING TASK ---
TaskManager.defineTask(LOCATION_TRACKING_TASK_NAME, async ({ data, error }: any) => {
    if (error) {
        console.error('Location tracking task error:', error);
        return;
    }
    if (data) {
        const { locations } = data;
        // locations is an array of Location objects
        if (locations && locations.length > 0) {
            console.log(`📍 Received ${locations.length} new locations`);

            // Format for DB
            const points = locations.map((loc: any) => ({
                latitude: loc.coords.latitude,
                longitude: loc.coords.longitude,
                timestamp: new Date(loc.timestamp).toISOString(),
                accuracy: loc.coords.accuracy,
                speed: loc.coords.speed,
                source: 'tracking'
            }));

            // Save to buffer/sync
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
        if (!user) return; // Can't save without user

        const pointsWithUser = points.map(p => ({ ...p, user_id: user.id }));

        const existing = await AsyncStorage.getItem(ROUTE_QUEUE_KEY);
        const queue = existing ? JSON.parse(existing) : [];

        // Add new points
        queue.push(...pointsWithUser);

        // Limit queue size (safety)
        if (queue.length > 1000) {
            console.warn('Route queue too large, dropping oldest');
            queue.splice(0, queue.length - 1000);
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

        const queue = JSON.parse(existing);
        if (queue.length === 0) return;

        console.log(`🔄 Syncing ${queue.length} route points...`);

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        // Batch upload to Next.js API
        const response = await fetch(`${API_URL}/api/locations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ locations: queue })
        });

        if (!response.ok) {
            console.error('Failed to sync route points:', await response.text());
            return;
        }

        await AsyncStorage.removeItem(ROUTE_QUEUE_KEY);

        console.log('✅ Route points synced successfully');

    } catch (err) {
        console.error('Error syncing route:', err);
    }
}

export async function startBackgroundTracking() {
    console.log('Starting Background Tracking...');
    const { status } = await Location.requestBackgroundPermissionsAsync();
    if (status !== 'granted') {
        console.error('Background location permission denied');
        return false;
    }

    try {
        // Start updates
        await Location.startLocationUpdatesAsync(LOCATION_TRACKING_TASK_NAME, {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 60000, // 1 minute
            distanceInterval: 50, // 50 meters
            deferredUpdatesInterval: 60000, // Buffer 1 min
            deferredUpdatesDistance: 50, // Buffer 50m
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

// ... (keep existing exports)


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

    // UPDATE CONFIG FROM DB BEFORE STARTING
    await updateGeofenceConfig();

    // Trigger an initial sync
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

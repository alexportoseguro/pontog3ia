
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import {
    OFFLINE_QUEUE_KEY,
    ROUTE_QUEUE_KEY,
    syncOfflineEvents,
    syncRoutePoints
} from '../services/LocationService';
import { Theme } from '../lib/Theme';

export default function OfflineBanner() {
    const [isConnected, setIsConnected] = useState<boolean | null>(true);
    const [pendingItems, setPendingItems] = useState(0);
    const [isSyncing, setIsSyncing] = useState(false);

    useEffect(() => {
        // 1. Monitor Network State
        const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
            setIsConnected(state.isConnected);
        });

        // 2. Monitor Pending Items (Poll every 5s)
        const checkPending = async () => {
            try {
                const offlineEvents = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
                const routePoints = await AsyncStorage.getItem(ROUTE_QUEUE_KEY);

                const eventsCount = offlineEvents ? JSON.parse(offlineEvents).length : 0;
                const routesCount = routePoints ? JSON.parse(routePoints).length : 0;

                setPendingItems(eventsCount + routesCount);
            } catch (e) {
                // ignore
            }
        };

        checkPending(); // check immediately
        const interval = setInterval(checkPending, 5000);

        return () => {
            unsubscribe();
            clearInterval(interval);
        };
    }, []);

    // Auto-sync when back online
    useEffect(() => {
        if (isConnected && pendingItems > 0 && !isSyncing) {
            handleSync();
        }
    }, [isConnected, pendingItems]);

    const handleSync = async () => {
        if (isSyncing) return;
        // Double check real pending count before starting
        const offlineEvents = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
        const routePoints = await AsyncStorage.getItem(ROUTE_QUEUE_KEY);
        const realCount = (offlineEvents ? JSON.parse(offlineEvents).length : 0) +
            (routePoints ? JSON.parse(routePoints).length : 0);

        if (realCount === 0) {
            setPendingItems(0);
            return;
        }

        setIsSyncing(true);
        try {
            await Promise.all([
                syncOfflineEvents(),
                syncRoutePoints()
            ]);
            // Re-check after sync
            const offlineEvents = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
            const routePoints = await AsyncStorage.getItem(ROUTE_QUEUE_KEY);
            const eventsCount = offlineEvents ? JSON.parse(offlineEvents).length : 0;
            const routesCount = routePoints ? JSON.parse(routePoints).length : 0;
            setPendingItems(eventsCount + routesCount);
        } catch (error) {
            console.log('Sync failed', error);
        } finally {
            setIsSyncing(false);
        }
    };

    if (isConnected && pendingItems === 0) return null;

    return (
        <View style={[styles.container, !isConnected ? styles.offline : styles.pending]}>
            <View style={styles.content}>
                <Ionicons
                    name={!isConnected ? "cloud-offline" : "cloud-upload"}
                    size={20}
                    color="#FFF"
                />
                <Text style={styles.text}>
                    {!isConnected
                        ? "Você está offline. Dados salvos localmente."
                        : `${pendingItems} itens pendentes de sincronização...`}
                </Text>
            </View>

            {isConnected && (
                <TouchableOpacity onPress={handleSync} disabled={isSyncing}>
                    {isSyncing ? (
                        <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                        <Ionicons name="refresh" size={20} color="#FFF" />
                    )}
                </TouchableOpacity>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    offline: {
        backgroundColor: Theme.colors.danger,
    },
    pending: {
        backgroundColor: Theme.colors.warning,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    text: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: '600',
    }
});

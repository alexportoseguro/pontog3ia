import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import {
    OFFLINE_QUEUE_KEY,
    ROUTE_QUEUE_KEY,
    syncOfflineEvents,
    syncRoutePoints,
    clearLocalQueues
} from '../services/LocationService';
import { Theme } from '../lib/Theme';

export default function OfflineBanner() {
    const [isConnected, setIsConnected] = useState<boolean | null>(true);
    const [pendingEvents, setPendingEvents] = useState(0);
    const [pendingRoutes, setPendingRoutes] = useState(0);
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncAttempts, setSyncAttempts] = useState(0);

    const pendingItems = pendingEvents + pendingRoutes;

    const checkPending = useCallback(async () => {
        try {
            const offlineEvents = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
            const routePoints = await AsyncStorage.getItem(ROUTE_QUEUE_KEY);
            setPendingEvents(offlineEvents ? JSON.parse(offlineEvents).length : 0);
            setPendingRoutes(routePoints ? JSON.parse(routePoints).length : 0);
        } catch (e) {
            // ignore
        }
    }, []);

    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
            setIsConnected(state.isConnected);
        });

        checkPending();
        const interval = setInterval(checkPending, 8000);

        return () => {
            unsubscribe();
            clearInterval(interval);
        };
    }, []);

    // Auto-sync when back online (max 3 attempts to prevent infinite loops)
    useEffect(() => {
        if (isConnected && pendingItems > 0 && !isSyncing && syncAttempts < 3) {
            handleSync();
        }
    }, [isConnected]);

    const handleSync = async () => {
        if (isSyncing) return;
        await checkPending();

        setIsSyncing(true);
        setSyncAttempts(prev => prev + 1);
        try {
            await Promise.all([
                syncOfflineEvents(),
                syncRoutePoints()
            ]);
            await checkPending();
            // Reset attempts on success
            setSyncAttempts(0);
        } catch (error) {
            console.log('Sync failed', error);
        } finally {
            setIsSyncing(false);
        }
    };

    const handleClearQueue = () => {
        Alert.alert(
            'Limpar Fila Local',
            `Isso irá remover ${pendingItems} itens pendentes que não puderam ser sincronizados. Esta ação não pode ser desfeita.\n\nContinuar?`,
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Limpar Tudo',
                    style: 'destructive',
                    onPress: async () => {
                        const { events, routes } = await clearLocalQueues();
                        await checkPending();
                        setSyncAttempts(0);
                        console.log(`🗑️ Manually cleared: ${events} events + ${routes} route points`);
                    }
                }
            ]
        );
    };

    if (isConnected && pendingItems === 0) return null;

    const showClearButton = syncAttempts >= 3 && pendingItems > 0;

    return (
        <View style={[styles.container, !isConnected ? styles.offline : styles.pending]}>
            <View style={styles.content}>
                <Ionicons
                    name={!isConnected ? 'cloud-offline' : 'cloud-upload'}
                    size={18}
                    color="#FFF"
                />
                <View>
                    <Text style={styles.text}>
                        {!isConnected
                            ? 'Você está offline. Dados salvos localmente.'
                            : `${pendingItems} itens pendentes de sincronização`}
                    </Text>
                    {isConnected && (pendingRoutes > 0 || pendingEvents > 0) && (
                        <Text style={styles.subtext}>
                            {[
                                pendingRoutes > 0 ? `${pendingRoutes} pontos GPS` : null,
                                pendingEvents > 0 ? `${pendingEvents} eventos` : null,
                            ].filter(Boolean).join(' · ')}
                        </Text>
                    )}
                </View>
            </View>

            {isConnected && (
                <View style={styles.actions}>
                    {showClearButton && (
                        <TouchableOpacity onPress={handleClearQueue} style={styles.clearBtn}>
                            <Ionicons name="trash-outline" size={16} color="#FFF" />
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={handleSync} disabled={isSyncing} style={styles.syncBtn}>
                        {isSyncing ? (
                            <ActivityIndicator size="small" color="#FFF" />
                        ) : (
                            <Ionicons name="refresh" size={18} color="#FFF" />
                        )}
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    offline: {
        backgroundColor: Theme.colors.danger,
    },
    pending: {
        backgroundColor: '#D97706',
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flex: 1,
    },
    text: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: '700',
    },
    subtext: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 10,
        fontWeight: '500',
        marginTop: 1,
    },
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    syncBtn: {
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    clearBtn: {
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 8,
    },
});

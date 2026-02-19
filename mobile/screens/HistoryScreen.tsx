import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { supabase } from '../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '../lib/Theme';

export default function HistoryScreen({ user }: { user: any }) {
    const [events, setEvents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchHistory();
    }, []);

    const fetchHistory = async () => {
        const { data, error } = await supabase
            .from('time_events')
            .select('*')
            .eq('user_id', user.id)
            .order('timestamp', { ascending: false })
            .limit(50);

        if (error) console.error(error);
        else setEvents(data || []);
        setLoading(false);
    };

    const formatEvent = (type: string) => {
        switch (type) {
            case 'clock_in': return { label: 'Entrada', color: Theme.colors.success, icon: 'enter-outline' };
            case 'clock_out': return { label: 'Saída', color: Theme.colors.danger, icon: 'exit-outline' };
            case 'break_start': return { label: 'Intervalo', color: Theme.colors.warning, icon: 'cafe-outline' };
            case 'break_end': return { label: 'Retorno', color: Theme.colors.primary, icon: 'arrow-undo-outline' };
            case 'work_pause': return { label: 'Pausar Trabalho', color: Theme.colors.warning, icon: 'pause-outline' };
            case 'work_resume': return { label: 'Retomar Trabalho', color: Theme.colors.primary, icon: 'play-outline' };
            default: return { label: type, color: Theme.colors.text.secondary, icon: 'time-outline' };
        }
    };

    const renderItem = ({ item }: { item: any }) => {
        const info = formatEvent(item.event_type);
        const date = new Date(item.timestamp);

        return (
            <View style={styles.card}>
                <View style={[styles.iconContainer, { backgroundColor: info.color + '15' }]}>
                    <Ionicons name={info.icon as any} size={22} color={info.color} />
                </View>
                <View style={styles.infoContainer}>
                    <Text style={styles.typeText}>{info.label}</Text>
                    <Text style={styles.dateText}>{date.toLocaleDateString('pt-BR')} às {date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</Text>
                </View>
                <View style={styles.statusBadge}>
                    <Ionicons name="location-outline" size={12} color={Theme.colors.text.muted} />
                    <Text style={styles.locationText}>GPS</Text>
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={Theme.colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={events}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={<Text style={styles.emptyText}>Nenhum registro encontrado.</Text>}
                    showsVerticalScrollIndicator={false}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    listContent: {
        padding: 16,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        padding: 18,
        borderRadius: 20,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    infoContainer: {
        flex: 1,
    },
    typeText: {
        fontSize: 16,
        fontWeight: '800',
        color: '#1E293B',
        letterSpacing: -0.4,
    },
    dateText: {
        fontSize: 13,
        color: '#64748B',
        marginTop: 4,
        fontWeight: '500',
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
        gap: 4,
    },
    locationText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#94A3B8',
        textTransform: 'uppercase',
    },
    emptyText: {
        textAlign: 'center',
        color: '#94A3B8',
        marginTop: 80,
        fontSize: 15,
        fontWeight: '600',
    }
});

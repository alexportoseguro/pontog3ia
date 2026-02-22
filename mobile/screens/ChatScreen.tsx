import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { Theme } from '../lib/Theme';
import { Typography } from '../lib/Typography';
import { API_URL } from '../lib/api';

type Message = {
    id: number;
    text: string;
    sender: 'user' | 'ai';
    timestamp: Date;
};


type TeamMessage = {
    id: string;
    company_id: string;
    sender_id: string;
    content: string;
    created_at: string;
    sender_name?: string; // Hydrated later
};

export default function ChatScreen({ user }: { user: any }) {
    const [activeTab, setActiveTab] = useState<'ai' | 'team'>('ai');

    // AI Chat State
    const [messages, setMessages] = useState<Message[]>([
        { id: 1, text: "Olá! Sou o Concierge PontoG3. Como posso ajudar?", sender: 'ai', timestamp: new Date() }
    ]);

    // Team Chat State
    const [teamMessages, setTeamMessages] = useState<TeamMessage[]>([]);

    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(false);
    const [recording, setRecording] = useState<Audio.Recording | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const flatListRef = useRef<FlatList>(null);

    // Fetch Team Messages & Subscribe
    useEffect(() => {
        if (activeTab === 'team') {
            fetchTeamMessages();

            const channel = supabase
                .channel('team_chat')
                .on('postgres_changes',
                    { event: 'INSERT', schema: 'public', table: 'team_messages' },
                    (payload) => {
                        const newMsg = payload.new as TeamMessage;
                        // Avoid duplicates if we inserted it locally
                        setTeamMessages(prev => {
                            if (prev.find(m => m.id === newMsg.id)) return prev;
                            return [...prev, newMsg];
                        });
                    }
                )
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
            };
        }
    }, [activeTab]);

    const fetchTeamMessages = async () => {
        // Fetch last 50 messages
        // Join with profiles to get sender name? Supabase join syntax: select('*, profiles(full_name)')

        // Wait, 'team_messages' has 'sender_id'. We need to join manually if RLS permits, or just select.
        // Let's try simple select first.
        const { data, error } = await supabase
            .from('team_messages')
            .select(`
                *,
                profiles:sender_id (full_name)
            `)
            .order('created_at', { ascending: true })
            .limit(50);

        if (error) {
            console.error('Error fetching messages:', error);
        } else if (data) {
            const formatted = data.map((msg: any) => ({
                ...msg,
                sender_name: msg.profiles?.full_name || 'Usuário'
            }));
            setTeamMessages(formatted);
        }
    };

    const sendMessage = async () => {
        if (!inputText.trim()) return;

        if (activeTab === 'team') {
            // Team Chat Logic
            const content = inputText;
            setInputText(''); // Clear input immediately
            setLoading(true);

            try {
                const { error } = await supabase.from('team_messages').insert({
                    content,
                    sender_id: user.id,
                    company_id: user.company_id || (await getCompanyId(user.id))
                });

                if (error) throw error;
                // Realtime will handle the update in the list
            } catch (err: any) {
                Alert.alert("Erro", "Falha ao enviar mensagem: " + err.message);
            } finally {
                setLoading(false);
            }
            return;
        }

        // AI Chat Logic (Existing)
        const userMsg: Message = {
            id: Date.now(),
            text: inputText,
            sender: 'user',
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMsg]);
        setInputText('');
        setLoading(true);

        try {
            const ENDPOINT = `${API_URL}/api/ai-concierge`;

            // Get session token for authentication
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            if (!token) {
                throw new Error('Sessão expirada. Faça login novamente.');
            }

            const response = await fetch(ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    message: userMsg.text,
                })
            });

            const data = await response.json();
            if (data.error) throw new Error(data.error);

            const aiMsg: Message = {
                id: Date.now() + 1,
                text: data.response || "Não entendi.",
                sender: 'ai',
                timestamp: new Date()
            };

            setMessages(prev => [...prev, aiMsg]);
        } catch (error: any) {
            console.error(error);
            const errorMsg: Message = {
                id: Date.now() + 1,
                text: "⚠️ Erro de conexão: " + error.message,
                sender: 'ai',
                timestamp: new Date()
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setLoading(false);
        }
    };

    // Helper to get company_id if missing from user object
    const getCompanyId = async (userId: string) => {
        const { data } = await supabase.from('profiles').select('company_id').eq('id', userId).single();
        return data?.company_id;
    }

    const startRecording = async () => {
        try {
            const { status } = await Audio.requestPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permissão negada', 'Precisamos de acesso ao microfone.');
                return;
            }

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            const { recording: newRecording } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY
            );
            setRecording(newRecording);
            setIsRecording(true);
        } catch (err) {
            console.error('Failed to start recording', err);
        }
    };

    const stopRecording = async () => {
        setRecording(null);
        setIsRecording(false);
        if (!recording) return;
        await recording.stopAndUnloadAsync();
        const uri = recording.getURI();
        if (uri) await sendAudioMessage(uri);
    };

    const sendAudioMessage = async (uri: string) => {
        setLoading(true);
        const userMsg: Message = {
            id: Date.now(),
            text: "🎤 [Áudio Enviado]",
            sender: 'user',
            timestamp: new Date()
        };
        setMessages(prev => [...prev, userMsg]);

        try {
            const formData = new FormData();
            formData.append('userId', user.id);
            // @ts-ignore
            formData.append('audio', { uri: uri, name: 'recording.m4a', type: 'audio/m4a' });

            const ENDPOINT = `${API_URL}/api/ai-concierge`;
            const response = await fetch(ENDPOINT, { method: 'POST', body: formData });
            const data = await response.json();
            if (data.error) throw new Error(data.error);

            const aiMsg: Message = {
                id: Date.now() + 1,
                text: data.response || "Não entendi.",
                sender: 'ai',
                timestamp: new Date()
            };
            setMessages(prev => [...prev, aiMsg]);

        } catch (error: any) {
            console.error(error);
            const errorMsg: Message = {
                id: Date.now() + 1,
                text: "⚠️ Erro no áudio: " + error.message,
                sender: 'ai',
                timestamp: new Date()
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.container}
            keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
        >
            {/* Premium Header Overlay */}
            <View style={styles.headerGlass}>
                <View style={styles.tabContainer}>
                    <TouchableOpacity
                        style={[styles.tabButton, activeTab === 'ai' && styles.tabActive]}
                        onPress={() => setActiveTab('ai')}
                    >
                        <Ionicons name="sparkles" size={16} color={activeTab === 'ai' ? '#4F46E5' : '#94A3B8'} style={{ marginRight: 6 }} />
                        <Text style={[styles.tabText, activeTab === 'ai' && styles.tabTextActive]}>Concierge IA</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tabButton, activeTab === 'team' && styles.tabActive]}
                        onPress={() => setActiveTab('team')}
                    >
                        <Ionicons name="people" size={16} color={activeTab === 'team' ? '#4F46E5' : '#94A3B8'} style={{ marginRight: 6 }} />
                        <Text style={[styles.tabText, activeTab === 'team' && styles.tabTextActive]}>Equipe</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <FlatList
                ref={flatListRef}
                data={activeTab === 'ai' ? messages : teamMessages}
                keyExtractor={item => item.id.toString()}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                ListHeaderComponent={activeTab === 'ai' ? (
                    <View style={styles.aiWelcomeCard}>
                        <View style={styles.aiWelcomeIcon}>
                            <Ionicons name="sparkles" size={32} color={Theme.colors.surface} />
                        </View>
                        <Text style={styles.aiWelcomeTitle}>Como posso ajudar hoje?</Text>
                        <Text style={styles.aiWelcomeSubtitle}>Estou aqui para gerenciar seus registros e tirar dúvidas.</Text>
                    </View>
                ) : null}
                renderItem={({ item }) => {
                    const isAiMode = activeTab === 'ai';

                    if (isAiMode) {
                        const msg = item as Message;
                        if (msg.id === 1 && messages.length > 1) return null; // Hide initial welcome if we have chat
                        return (
                            <View style={[
                                styles.bubbleContainer,
                                msg.sender === 'user' ? styles.userContainer : styles.aiContainer
                            ]}>
                                <View style={[
                                    styles.bubble,
                                    msg.sender === 'user' ? styles.userBubble : styles.aiBubble
                                ]}>
                                    <Text style={[
                                        styles.messageText,
                                        msg.sender === 'user' ? styles.userText : styles.aiText
                                    ]}>
                                        {msg.text}
                                    </Text>
                                    <Text style={[
                                        styles.timestamp,
                                        msg.sender === 'user' ? styles.userTimestamp : styles.aiTimestamp
                                    ]}>
                                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </Text>
                                </View>
                            </View>
                        );
                    } else {
                        const msg = item as TeamMessage;
                        const isMe = msg.sender_id === user.id;

                        return (
                            <View style={[
                                styles.bubbleContainer,
                                isMe ? styles.userContainer : styles.aiContainer
                            ]}>
                                {!isMe && (
                                    <View style={styles.teamAvatar}>
                                        <Text style={styles.teamAvatarInitial}>{msg.sender_name?.charAt(0) || 'U'}</Text>
                                    </View>
                                )}
                                <View style={[
                                    styles.bubble,
                                    isMe ? styles.userBubble : styles.aiBubble,
                                    !isMe && { marginLeft: 8 }
                                ]}>
                                    {!isMe && <Text style={styles.senderName}>{msg.sender_name || 'Colega'}</Text>}
                                    <Text style={[
                                        styles.messageText,
                                        isMe ? styles.userText : styles.aiText
                                    ]}>
                                        {msg.content}
                                    </Text>
                                    <Text style={[
                                        styles.timestamp,
                                        isMe ? styles.userTimestamp : styles.aiTimestamp
                                    ]}>
                                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </Text>
                                </View>
                            </View>
                        );
                    }
                }}
                onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            />

            {loading && (
                <View style={styles.loadingWrapper}>
                    <ActivityIndicator size="small" color="#4F46E5" />
                    <Text style={styles.loadingText}>IA está digitando...</Text>
                </View>
            )}

            <View style={styles.footer}>
                <View style={styles.inputAreaPremium}>
                    <TextInput
                        style={styles.inputPremium}
                        value={inputText}
                        onChangeText={setInputText}
                        placeholder="Escreva sua mensagem..."
                        placeholderTextColor={Theme.colors.text.muted}
                        multiline
                    />
                    <View style={styles.inputActions}>
                        <TouchableOpacity
                            onPress={isRecording ? stopRecording : startRecording}
                            style={[styles.actionButton, isRecording && styles.micActive]}
                        >
                            <Ionicons name={isRecording ? "stop" : "mic"} size={22} color={isRecording ? Theme.colors.danger : Theme.colors.text.secondary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={sendMessage}
                            style={[styles.sendButtonPremium, (!inputText.trim() && !loading) && { opacity: 0.5 }]}
                            disabled={loading || !inputText.trim()}
                        >
                            <Ionicons name="arrow-up" size={24} color={Theme.colors.surface} />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Theme.colors.background,
    },
    headerGlass: {
        backgroundColor: 'rgba(255,255,255,0.8)',
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: Theme.colors.border,
    },
    tabContainer: {
        flexDirection: 'row',
        padding: 4,
        marginHorizontal: 20,
        marginTop: 10,
        backgroundColor: Theme.colors.background,
        borderRadius: Theme.borderRadius.lg,
    },
    tabButton: {
        flex: 1,
        flexDirection: 'row',
        paddingVertical: 10,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: Theme.borderRadius.md,
    },
    tabActive: {
        backgroundColor: Theme.colors.surface,
        ...Theme.shadows.soft,
    },
    tabText: {
        ...Typography.label,
        color: Theme.colors.text.muted,
    },
    tabTextActive: {
        color: Theme.colors.primary,
    },
    listContent: {
        padding: 20,
        paddingTop: 10,
        paddingBottom: 40,
    },
    aiWelcomeCard: {
        alignItems: 'center',
        padding: 30,
        backgroundColor: Theme.colors.surface,
        borderRadius: Theme.borderRadius.xl,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: Theme.colors.border,
        ...Theme.shadows.soft,
    },
    aiWelcomeIcon: {
        width: 64,
        height: 64,
        borderRadius: Theme.borderRadius.xl,
        backgroundColor: Theme.colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
        ...Theme.shadows.medium,
    },
    aiWelcomeTitle: {
        ...Typography.h3,
        textAlign: 'center',
    },
    aiWelcomeSubtitle: {
        ...Typography.bodySmall,
        textAlign: 'center',
        marginTop: 8,
        paddingHorizontal: 20,
    },
    bubbleContainer: {
        flexDirection: 'row',
        marginBottom: 16,
        alignItems: 'flex-end',
    },
    userContainer: {
        justifyContent: 'flex-end',
    },
    aiContainer: {
        justifyContent: 'flex-start',
    },
    bubble: {
        maxWidth: '85%',
        padding: 16,
        borderRadius: Theme.borderRadius.xl,
    },
    userBubble: {
        backgroundColor: Theme.colors.primary,
        borderBottomRightRadius: 4,
        ...Theme.shadows.medium,
    },
    aiBubble: {
        backgroundColor: Theme.colors.surface,
        borderBottomLeftRadius: 4,
        borderWidth: 1,
        borderColor: Theme.colors.border,
        ...Theme.shadows.soft,
    },
    messageText: {
        ...Typography.body,
    },
    userText: {
        color: Theme.colors.text.inverse,
    },
    aiText: {
        color: Theme.colors.text.primary,
    },
    timestamp: {
        ...Typography.micro,
        marginTop: 6,
        opacity: 0.8,
    },
    userTimestamp: {
        color: 'rgba(255,255,255,0.7)',
        alignSelf: 'flex-end',
    },
    aiTimestamp: {
        color: Theme.colors.text.muted,
        alignSelf: 'flex-start',
    },
    teamAvatar: {
        width: 36,
        height: 36,
        borderRadius: 14,
        backgroundColor: Theme.colors.background,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: Theme.colors.border,
    },
    teamAvatarInitial: {
        ...Typography.bodySmall,
        fontWeight: '900',
        color: Theme.colors.primary,
    },
    senderName: {
        ...Typography.caption,
        color: Theme.colors.primary,
        marginBottom: 4,
    },
    loadingWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 24,
        marginBottom: 16,
        gap: 8,
    },
    loadingText: {
        ...Typography.caption,
        color: Theme.colors.primary,
    },
    footer: {
        padding: 16,
        paddingBottom: 24,
        backgroundColor: Theme.colors.surface,
        borderTopWidth: 1,
        borderTopColor: Theme.colors.border,
    },
    inputAreaPremium: {
        flexDirection: 'row',
        backgroundColor: Theme.colors.background,
        borderRadius: Theme.borderRadius.xl,
        padding: 8,
        paddingLeft: 20,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Theme.colors.border,
    },
    inputPremium: {
        flex: 1,
        ...Typography.body,
        maxHeight: 120,
        paddingVertical: 8,
    },
    inputActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    actionButton: {
        padding: 10,
    },
    micActive: {
        backgroundColor: Theme.colors.auth.background,
        borderRadius: Theme.borderRadius.md,
    },
    sendButtonPremium: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: Theme.colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        ...Theme.shadows.medium,
    }
});

import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, Alert, TouchableOpacity, TextInput, SafeAreaView, StatusBar, ScrollView, ActivityIndicator, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import * as Location from 'expo-location'; // Added import
import Constants from 'expo-constants';
import { startGeofencing, stopGeofencing, syncOfflineEvents, startBackgroundTracking, stopBackgroundTracking, syncRoutePoints } from './services/LocationService';
import { supabase } from './lib/supabase';
import { API_URL } from './lib/api';
import { Session } from '@supabase/supabase-js';
import { Ionicons } from '@expo/vector-icons';
import HistoryScreen from './screens/HistoryScreen';
import ChatScreen from './screens/ChatScreen';
import JustificationModal from './components/JustificationModal';

import { Theme } from './lib/Theme';
import BiometricAuthScreen from './screens/BiometricAuthScreen';
import OfflineBanner from './components/OfflineBanner';
import ErrorBoundary from './components/ErrorBoundary';

type WorkStatus = 'STOPPED' | 'WORKING' | 'BREAK';


export default function AppWrapper() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<WorkStatus>('STOPPED');
  const [currentScreen, setCurrentScreen] = useState<'home' | 'chat' | 'history'>('home');
  const [loadingAction, setLoadingAction] = useState(false);
  const [fullName, setFullName] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Biometric Auth State
  const [isBiometricAuth, setIsBiometricAuth] = useState(false);
  const [pendingAction, setPendingAction] = useState<'start' | 'pause' | 'resume' | 'stop' | null>(null);

  // Login State
  const [textEmail, setTextEmail] = useState('');
  const [textPassword, setTextPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Justification State
  const [showJustificationModal, setShowJustificationModal] = useState(false);
  const [companySettings, setCompanySettings] = useState<any>(null);

  useEffect(() => {
    fetchCompanySettings();
    // Update clock every second
    const clockInterval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(clockInterval);
  }, []);

  async function fetchCompanySettings() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Get Company ID from Profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();

      if (profile && profile.company_id) {
        // 2. Get Settings for that company
        const { data } = await supabase
          .from('companies')
          .select('*')
          .eq('id', profile.company_id)
          .single();

        if (data) setCompanySettings(data);
      }
    } catch (error) {
      console.log('Error fetching settings:', error);
    }
  }

  const checkLateArrival = () => {
    if (!companySettings || !companySettings.work_start_time) return;

    const now = new Date();
    const [hours, minutes] = companySettings.work_start_time.split(':').map(Number);

    const startTime = new Date(now);
    startTime.setHours(hours, minutes, 0, 0);

    const tolerance = companySettings.tolerance_minutes || 15;
    const limitTime = new Date(startTime.getTime() + tolerance * 60000);

    // If now is after limit time, it's a late arrival
    if (now > limitTime) {
      setShowJustificationModal(true);
    }
  };

  async function fetchUserProfile(userId: string) {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', userId)
        .single();
      if (data?.full_name) setFullName(data.full_name);
    } catch (e) {
      // ignore
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        restoreStatus();
        syncOfflineEvents();
        syncRoutePoints();
        registerForPushNotifications(session.user.id);
        fetchUserProfile(session.user.id);
      }
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        restoreStatus();
        registerForPushNotifications(session.user.id);
        fetchUserProfile(session.user.id);
      } else {
        setFullName(null);
      }
    });
  }, []);

  async function registerForPushNotifications(userId: string) {
    // Check if running in Expo Go - SDK 53+ removed support for push notifications in Expo Go
    const isExpoGo = Constants.executionEnvironment === 'storeClient'; // 'storeClient' corresponds to Expo Go

    if (isExpoGo || Constants.appOwnership === 'expo') {
      console.log('⚠️ Expo Go detectado: Push Notifications desativadas para evitar erros (Requer Development Build)');
      return;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return;
    }

    try {
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: '4b43fe65-b208-440d-b9f9-509c51480600'
      });
      const token = tokenData.data;

      // Send to Supabase directly
      await supabase.from('device_tokens').upsert({
        user_id: userId,
        token: token,
        platform: Platform.OS,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id, token' });

      console.log('✅ Push token registered:', token);
    } catch (error) {
      console.log('❌ Error getting push token:', error);
    }
  }

  const restoreStatus = async () => {
    const saved = await SecureStore.getItemAsync('work_status');
    if (saved === 'WORKING' || saved === 'BREAK') {
      setStatus(saved as WorkStatus);
      if (saved === 'WORKING') startGeofencing();
    }
  };

  const updateStatus = async (newStatus: WorkStatus) => {
    setStatus(newStatus);
    await SecureStore.setItemAsync('work_status', newStatus);
  };

  const handleBiometricSuccess = () => {
    setIsBiometricAuth(false);
    if (pendingAction) {
      executeClockAction(pendingAction);
      setPendingAction(null);
    }
  };

  const handleBiometricCancel = () => {
    setIsBiometricAuth(false);
    setPendingAction(null);
  };

  const handleClockAction = async (action: 'start' | 'pause' | 'resume' | 'stop') => {
    if (action === 'start') {
      // Check if Facial Recognition is required by company settings
      const requiresFaceAuth = companySettings?.require_facial_recognition ?? false; // Default false - admin must opt-in

      if (requiresFaceAuth) {
        setPendingAction(action);
        setIsBiometricAuth(true);
        return;
      }
    }
    await executeClockAction(action);
  };

  const executeClockAction = async (action: 'start' | 'pause' | 'resume' | 'stop') => {
    setLoadingAction(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const timestamp = new Date().toISOString();
    let eventType = '';
    let locationStr = '';

    try {
      // Get current location for the event to ensure Valid POINT format
      const { status: permStatus } = await Location.requestForegroundPermissionsAsync();
      if (permStatus === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        locationStr = `(${loc.coords.longitude},${loc.coords.latitude})`;
      } else {
        locationStr = '(0,0)';
      }

      if (action === 'start') {
        eventType = 'clock_in';
        // Start Geofencing & Tracking
        const geoStarted = await startGeofencing();
        const trackStarted = await startBackgroundTracking();
        if (geoStarted) console.log('Geofencing Service Started');
        if (trackStarted) console.log('Location Tracking Service Started');
        await updateStatus('WORKING');
        // Alert moved to AFTER success
        checkLateArrival();
      }
      else if (action === 'pause') {
        eventType = 'break_start';
        await stopGeofencing(); // Stop tracking during break (privacy)
        await updateStatus('BREAK');
      }
      else if (action === 'resume') {
        eventType = 'break_end';
        await startGeofencing();
        await updateStatus('WORKING');
      }
      else if (action === 'stop') {
        eventType = 'clock_out';
        // Stop Geofencing & Tracking
        await stopGeofencing();
        await stopBackgroundTracking();
        await updateStatus('STOPPED');
      }


      if (eventType) {
        // CHANGED: Use API instead of direct insert to trigger Anomaly Detection
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;

        const response = await fetch(`${API_URL}/api/points`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            eventType,
            location: locationStr, // "(lon,lat)"
            timestamp
          })
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Failed to register point via API');
        }

        console.log('✅ Point registered via API:', result);

        // Profile update is now handled by API to ensure consistency
        // But we still update local state if needed.
        const ps = action === 'start' || action === 'resume' ? 'working' : action === 'pause' ? 'break' : 'out';
        await updateStatus(ps === 'working' ? 'WORKING' : ps === 'break' ? 'BREAK' : 'STOPPED');
      }
    } catch (error: any) {
      Alert.alert("Erro", "Falha ao registrar ponto: " + error.message);
    } finally {
      setLoadingAction(false);
    }
  };

  const handleLogin = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: textEmail,
      password: textPassword,
    });
    setLoading(false);
    if (error) Alert.alert("Erro", error.message);
  };

  if (isBiometricAuth) {
    return <BiometricAuthScreen onSuccess={handleBiometricSuccess} onCancel={handleBiometricCancel} />;
  }

  if ((currentScreen === 'chat' || currentScreen === 'history') && session) {
    const isChat = currentScreen === 'chat';
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.screenHeader}>
          <TouchableOpacity onPress={() => setCurrentScreen('home')} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={Theme.colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.screenHeaderTitle}>{isChat ? 'Concierge IA' : 'Histórico'}</Text>
          <View style={{ width: 40 }} />
        </View>
        {isChat ? <ChatScreen user={session.user} /> : <HistoryScreen user={session.user} />}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, !session && { backgroundColor: Theme.colors.auth.background }]}>
      <StatusBar barStyle={session ? "dark-content" : "light-content"} />

      {!session ? (
        <View style={styles.authContainer}>
          <View style={styles.logoContainer}>
            <View style={styles.logoPremiumBox}>
              <View style={styles.logoBackground}>
                <Text style={styles.logoInitial}>G3</Text>
              </View>
              <View style={styles.logoStatusDot} />
            </View>
            <Text style={styles.logoText}>PontoG3</Text>
            <Text style={styles.logoSubtitle}>Inteligência Artificial & Gestão de Ponto</Text>
          </View>

          <View style={styles.formContainer}>
            <View style={styles.inputWrapper}>
              <Text style={styles.label}>Email Corporativo</Text>
              <TextInput
                style={styles.input}
                value={textEmail}
                onChangeText={setTextEmail}
                placeholder="nome@empresa.com"
                placeholderTextColor={Theme.colors.text.muted}
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputWrapper}>
              <Text style={styles.label}>Senha</Text>
              <TextInput
                style={styles.input}
                value={textPassword}
                onChangeText={setTextPassword}
                placeholder="••••••••"
                placeholderTextColor={Theme.colors.text.muted}
                secureTextEntry
              />
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              <Text style={styles.primaryButtonText}>{loading ? "Verificando..." : "Entrar no Sistema"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.dashboardContainer}>
          <View style={styles.dashboardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.greeting}>Bem-vindo,</Text>
              <Text style={styles.username} numberOfLines={1}>
                {fullName || session.user.email?.split('@')[0]}
              </Text>
            </View>
            <View style={styles.headerRight}>
              <View style={styles.clockContainer}>
                <Text style={styles.clockTime}>
                  {currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </Text>
                <Text style={styles.clockDate}>
                  {currentTime.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}
                </Text>
              </View>
              <TouchableOpacity onPress={() => supabase.auth.signOut()} style={styles.logoutButton}>
                <Ionicons name="power-outline" size={22} color={Theme.colors.danger} />
              </TouchableOpacity>
            </View>
          </View>

          <OfflineBanner />

          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.statusCard}>
              <View style={styles.statusHeader}>
                <View>
                  <Text style={styles.statusLabel}>Status Operacional</Text>
                  <Text style={styles.statusSubLabel}>
                    {currentTime.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </Text>
                </View>
                <View style={[styles.statusBadge,
                status === 'WORKING' ? styles.badgeActive :
                  status === 'BREAK' ? styles.badgeWarning : styles.badgeInactive]}>
                  <View style={[styles.statusDot,
                  status === 'WORKING' ? { backgroundColor: Theme.colors.success } :
                    status === 'BREAK' ? { backgroundColor: Theme.colors.warning } : { backgroundColor: Theme.colors.text.muted }]} />
                  <Text style={[styles.statusText,
                  status === 'WORKING' ? styles.textActive :
                    status === 'BREAK' ? styles.textWarning : styles.textInactive]}>
                    {status === 'WORKING' ? 'ATIVO' : status === 'BREAK' ? 'PAUSA' : 'OFFLINE'}
                  </Text>
                </View>
              </View>
              <Text style={styles.statusDescription}>
                {status === 'WORKING' ? '✅ Sua jornada está sendo contabilizada e geolocalizada.' :
                  status === 'BREAK' ? '☕ Aproveite seu descanso. Retorne quando estiver pronto.' :
                    '📋 Inicie seu expediente para começar o registro.'}
              </Text>
            </View>

            {loadingAction ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Theme.colors.primary} />
                <Text style={styles.loadingText}>Sincronizando com a nuvem...</Text>
              </View>
            ) : (
              <View style={styles.actionsGrid}>
                <TouchableOpacity
                  style={[styles.gridActionButton, status !== 'STOPPED' && styles.actionDisabled]}
                  onPress={() => status === 'STOPPED' && handleClockAction('start')}
                  disabled={status !== 'STOPPED'}
                >
                  <View style={[styles.iconBox, { backgroundColor: Theme.colors.success }]}>
                    <Ionicons name="play" size={28} color="#FFF" />
                  </View>
                  <Text style={styles.gridActionText}>Bater Ponto</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.gridActionButton, status !== 'WORKING' && styles.actionDisabled]}
                  onPress={() => status === 'WORKING' && handleClockAction('pause')}
                  disabled={status !== 'WORKING'}
                >
                  <View style={[styles.iconBox, { backgroundColor: Theme.colors.warning }]}>
                    <Ionicons name="cafe" size={28} color="#FFF" />
                  </View>
                  <Text style={styles.gridActionText}>Pausa</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.gridActionButton, status !== 'BREAK' && styles.actionDisabled]}
                  onPress={() => status === 'BREAK' && handleClockAction('resume')}
                  disabled={status !== 'BREAK'}
                >
                  <View style={[styles.iconBox, { backgroundColor: Theme.colors.primary }]}>
                    <Ionicons name="refresh" size={28} color="#FFF" />
                  </View>
                  <Text style={styles.gridActionText}>Retornar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.gridActionButton, status === 'STOPPED' && styles.actionDisabled]}
                  onPress={() => status !== 'STOPPED' && handleClockAction('stop')}
                  disabled={status === 'STOPPED'}
                >
                  <View style={[styles.iconBox, { backgroundColor: Theme.colors.danger }]}>
                    <Ionicons name="stop" size={28} color="#FFF" />
                  </View>
                  <Text style={styles.gridActionText}>Encerrar</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.quickActions}>
              <TouchableOpacity style={styles.quickButton} onPress={() => setCurrentScreen('chat')}>
                <View style={[styles.quickIconCircle, { backgroundColor: '#eef2ff' }]}>
                  <Ionicons name="sparkles" size={22} color={Theme.colors.primary} />
                </View>
                <Text style={styles.quickLabel}>Concierge IA</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.quickButton} onPress={() => setCurrentScreen('history')}>
                <View style={[styles.quickIconCircle, { backgroundColor: '#f5f3ff' }]}>
                  <Ionicons name="calendar" size={22} color="#8b5cf6" />
                </View>
                <Text style={styles.quickLabel}>Histórico</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.quickButton} onPress={() => setShowJustificationModal(true)}>
                <View style={[styles.quickIconCircle, { backgroundColor: '#fff7ed' }]}>
                  <Ionicons name="document-attach" size={22} color="#f97316" />
                </View>
                <Text style={styles.quickLabel}>Justificar</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      )}

      {session?.user && (
        <JustificationModal
          visible={showJustificationModal}
          onClose={() => setShowJustificationModal(false)}
          userId={session.user.id}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  // Screen Header (History/Chat)
  screenHeader: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: Theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border,
  },
  screenHeaderTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Theme.colors.text.primary,
    letterSpacing: -0.5,
  },
  backButton: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: Theme.colors.background,
  },
  // Auth Styles
  authContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 32,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 56,
  },
  logoPremiumBox: {
    width: 90,
    height: 90,
    marginBottom: 20,
    position: 'relative',
  },
  logoBackground: {
    width: 90,
    height: 90,
    borderRadius: 24,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 15,
    elevation: 10,
  },
  logoInitial: {
    fontSize: 42,
    fontWeight: '900',
    color: '#FFFFFF',
    fontStyle: 'italic',
  },
  logoStatusDot: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#10B981',
    borderWidth: 4,
    borderColor: '#0F172A',
  },
  logoText: {
    fontSize: 36,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -1.5,
  },
  logoSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 8,
    textAlign: 'center',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  formContainer: { gap: 20 },
  inputWrapper: { gap: 8 },
  label: {
    color: Theme.colors.text.secondary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  input: {
    backgroundColor: Theme.colors.auth.surface,
    color: Theme.colors.text.inverse,
    padding: 18,
    borderRadius: Theme.borderRadius.lg,
    fontSize: 16,
    borderWidth: 1,
    borderColor: Theme.colors.auth.border,
  },
  primaryButton: {
    backgroundColor: Theme.colors.primary,
    padding: 18,
    borderRadius: Theme.borderRadius.lg,
    alignItems: 'center',
    marginTop: 10,
    ...Theme.shadows.medium,
  },
  buttonDisabled: { opacity: 0.5 },
  primaryButtonText: {
    color: Theme.colors.text.inverse,
    fontSize: 16,
    fontWeight: '800',
  },
  // Dashboard Styles
  dashboardContainer: { flex: 1 },
  dashboardHeader: {
    padding: 20,
    paddingTop: Platform.OS === 'android' ? 40 : 16,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 12,
  },
  headerRight: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 12,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  clockContainer: {
    alignItems: 'flex-end',
  },
  clockTime: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1E293B',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  clockDate: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
    textTransform: 'capitalize',
    marginTop: 1,
  },
  greeting: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600'
  },
  username: {
    fontSize: 24,
    fontWeight: '900',
    color: '#1E293B',
    letterSpacing: -0.6
  },
  logoutButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFF1F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40
  },
  statusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  statusSubLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
    marginTop: 2,
    textTransform: 'capitalize',
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 1.2
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  badgeActive: { backgroundColor: '#ECFDF5' },
  badgeInactive: { backgroundColor: '#F8FAFC' },
  badgeWarning: { backgroundColor: '#FFFBEB' },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 11, fontWeight: '900' },
  textActive: { color: '#059669' },
  textInactive: { color: '#64748B' },
  textWarning: { color: '#D97706' },
  statusDescription: {
    color: '#475569',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500'
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 32,
  },
  gridActionButton: {
    width: '48.2%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  actionDisabled: { opacity: 0.35 },
  iconBox: {
    width: 60,
    height: 60,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  gridActionText: {
    color: '#1E293B',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.3
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    gap: 16
  },
  loadingText: {
    color: '#4F46E5',
    fontSize: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12
  },
  quickButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingVertical: 20,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  quickIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quickLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#475569',
    textAlign: 'center'
  },
});

import { supabaseAdmin } from './auth-server'

/**
 * Push Notification Utility for PontoG3
 * Uses Expo Push API to send free notifications to mobile devices.
 */

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export async function sendPushNotification(
    userId: string,
    title: string,
    body: string,
    data: any = {}
) {
    try {
        // 1. Get user's device tokens
        const { data: tokens, error: tokensError } = await supabaseAdmin
            .from('device_tokens')
            .select('token')
            .eq('user_id', userId);

        if (tokensError) throw tokensError;
        if (!tokens || tokens.length === 0) {
            console.log(`[Push] No tokens found for user ${userId}. Skipping.`);
            return { success: false, reason: 'no_tokens' };
        }

        const pushTokens = tokens.map(t => t.token);
        console.log(`[Push] Sending to ${pushTokens.length} devices for user ${userId}`);

        // 2. Prepare messages for Expo
        // Expo allows sending up to 100 messages at once
        const messages = pushTokens.map(token => ({
            to: token,
            sound: 'default',
            title,
            body,
            data,
            priority: 'high',
        }));

        // 3. Send to Expo API
        const response = await fetch(EXPO_PUSH_URL, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Accept-Encoding': 'gzip, deflate',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(messages),
        });

        const result = await response.json();

        if (response.ok) {
            console.log('[Push] Messages sent to Expo successfully');
            return { success: true, result };
        } else {
            console.error('[Push] Expo API Error:', result);
            return { success: false, error: result };
        }
    } catch (error: any) {
        console.error('[Push] Critical Error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Specific helper for point registration notifications
 */
export async function sendPointPush(
    userId: string,
    firstName: string,
    eventType: string,
    timestamp: string
) {
    const eventTypeLabels: Record<string, string> = {
        clock_in: 'INÍCIO TRABALHO',
        clock_out: 'FIM TRABALHO',
        break_start: 'INÍCIO INTERVALO',
        break_end: 'RETORNO INTERVALO',
    };

    const label = eventTypeLabels[eventType] || eventType.toUpperCase();
    const timeStr = new Date(timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const dateStr = new Date(timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

    const title = 'Ponto Registrado! ✅';
    const body = `Olá ${firstName}, seu ponto de ${label} foi registrado às ${timeStr} em ${dateStr}.`;

    return sendPushNotification(userId, title, body, { eventType, timestamp });
}

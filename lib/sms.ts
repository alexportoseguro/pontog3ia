
/**
 * SMS Utility for PontoG3
 * Handles sending notifications for point registrations.
 * Built with Twilio as the primary transport.
 */

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

const eventTypeLabels: Record<string, string> = {
    clock_in: 'INÍCIO TRABALHO',
    clock_out: 'FIM TRABALHO',
    break_start: 'INÍCIO INTERVALO',
    break_end: 'RETORNO INTERVALO',
};

export async function sendPointSms(
    to: string,
    firstName: string,
    eventType: string,
    timestamp: string
) {
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
        console.warn('[SMS] Credentials missing. Skipping SMS send.');
        return { success: false, error: 'Credentials missing' };
    }

    if (!to) {
        console.warn('[SMS] No phone number provided. Skipping.');
        return { success: false, error: 'No phone number' };
    }

    // Format phone number (remove spaces, dashes)
    const formattedPhone = to.startsWith('+') ? to : `+55${to.replace(/\D/g, '')}`;
    const label = eventTypeLabels[eventType] || eventType.toUpperCase();
    const timeStr = new Date(timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const dateStr = new Date(timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

    const message = `Olá ${firstName}, seu ponto de ${label} foi registrado às ${timeStr} em ${dateStr}. PontoG3`;

    try {
        console.log(`[SMS] Sending to ${formattedPhone}: ${message}`);

        const res = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
            {
                method: 'POST',
                headers: {
                    'Authorization': 'Basic ' + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64'),
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    From: TWILIO_PHONE_NUMBER,
                    To: formattedPhone,
                    Body: message,
                }),
            }
        );

        const data = await res.json();

        if (res.ok) {
            console.log(`[SMS] Success! SID: ${data.sid}`);
            return { success: true, sid: data.sid };
        } else {
            console.error(`[SMS] Twilio Error:`, data);
            return { success: false, error: data.message };
        }
    } catch (error: any) {
        console.error('[SMS] Critical Error:', error);
        return { success: false, error: error.message };
    }
}

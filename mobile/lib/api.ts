import Constants from 'expo-constants';

export const getApiUrl = () => {
    // 1. Production URL from Env (set in eas.json per profile)
    if (process.env.EXPO_PUBLIC_API_URL) {
        return process.env.EXPO_PUBLIC_API_URL;
    }

    // 2. URL from app.json extras (fallback for builds)
    const extraApiUrl = Constants.expoConfig?.extra?.apiUrl;
    if (extraApiUrl) {
        return extraApiUrl;
    }

    // 3. Dynamic Development URL (from Expo Go / Metro)
    const hostUri = Constants.expoConfig?.hostUri;
    if (hostUri) {
        const ip = hostUri.split(':')[0];
        return `http://${ip}:3000`;
    }

    // 4. Fallback for Simulator/Emulator
    if (!__DEV__) {
        console.warn('⚠️ WARNING: App is running in production mode but using localhost/fallback API URL. Features may not work on physical devices.');
    }
    return 'http://localhost:3000';
};

export const API_URL = getApiUrl();

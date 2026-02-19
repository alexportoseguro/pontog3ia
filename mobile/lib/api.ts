import Constants from 'expo-constants';

export const getApiUrl = () => {
    // 1. Production URL from Env
    if (process.env.EXPO_PUBLIC_API_URL) {
        return process.env.EXPO_PUBLIC_API_URL;
    }

    // 2. Dynamic Development URL (from Expo Go / Metro)
    const hostUri = Constants.expoConfig?.hostUri;
    if (hostUri) {
        const ip = hostUri.split(':')[0];
        return `http://${ip}:3000`;
    }

    // 3. Fallback for Simulator/Emulator
    if (!__DEV__) {
        console.warn('⚠️ WARNING: App is running in production mode but using localhost/fallback API URL. Features may not work on physical devices.');
    }
    return 'http://localhost:3000';
};

export const API_URL = getApiUrl();

export const Theme = {
    colors: {
        primary: '#4f46e5', // Indigo Premium
        success: '#10b981', // Emerald Premium
        warning: '#f59e0b', // Amber
        danger: '#ef4444',  // Rose
        background: '#f8fafc',
        surface: '#ffffff',
        text: {
            primary: '#0f172a',
            secondary: '#64748b',
            muted: '#94a3b8',
            inverse: '#ffffff',
        },
        border: '#e2e8f0',
        auth: {
            background: '#020617', // Dark profundo
            surface: '#0f172a',
            border: '#1e293b',
        }
    },
    shadows: {
        soft: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 15,
            elevation: 2,
        },
        medium: {
            shadowColor: '#4f46e5',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.1,
            shadowRadius: 20,
            elevation: 5,
        }
    },
    borderRadius: {
        sm: 8,
        md: 12,
        lg: 16,
        xl: 24,
        full: 9999,
    }
};

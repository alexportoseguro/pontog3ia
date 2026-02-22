import { StyleSheet } from 'react-native';
import { Theme } from './Theme';

export const Typography = StyleSheet.create({
    h1: {
        fontSize: 36,
        fontWeight: '900',
        color: Theme.colors.text.primary,
        letterSpacing: -1.5,
    },
    h2: {
        fontSize: 24,
        fontWeight: '900',
        color: Theme.colors.text.primary,
        letterSpacing: -0.6,
    },
    h3: {
        fontSize: 20,
        fontWeight: '900',
        color: Theme.colors.text.primary,
        letterSpacing: -0.5,
    },
    h4: {
        fontSize: 18,
        fontWeight: '800',
        color: Theme.colors.text.primary,
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 14,
        fontWeight: '600',
        color: Theme.colors.text.secondary,
        letterSpacing: 0.5,
    },
    body: {
        fontSize: 15,
        fontWeight: '500',
        color: Theme.colors.text.primary,
        lineHeight: 22,
    },
    bodySmall: {
        fontSize: 13,
        fontWeight: '500',
        color: Theme.colors.text.secondary,
    },
    caption: {
        fontSize: 11,
        fontWeight: '800',
        color: Theme.colors.text.muted,
        textTransform: 'uppercase',
        letterSpacing: 1.2,
    },
    micro: {
        fontSize: 10,
        fontWeight: '600',
        color: Theme.colors.text.muted,
    },
    label: {
        fontSize: 12,
        fontWeight: '700',
        color: Theme.colors.text.secondary,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    buttonText: {
        fontSize: 16,
        fontWeight: '800',
        color: Theme.colors.text.inverse,
    },
});

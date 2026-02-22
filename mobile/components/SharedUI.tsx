import React from 'react';
import { TouchableOpacity, Text, View, StyleSheet, TouchableOpacityProps, StyleProp, ViewStyle, TextStyle, ActivityIndicator, TextInput, TextInputProps } from 'react-native';
import { Theme } from '../lib/Theme';
import { Typography } from '../lib/Typography';

/* --- Cards --- */
interface CardProps {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
}

export const Card = ({ children, style }: CardProps) => (
    <View style={[styles.card, style]}>
        {children}
    </View>
);

/* --- Buttons --- */
interface ButtonProps extends TouchableOpacityProps {
    title: string;
    loading?: boolean;
    variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'warning' | 'ghost';
    textStyle?: StyleProp<TextStyle>;
}

export const Button = ({ title, loading, variant = 'primary', style, textStyle, disabled, ...props }: ButtonProps) => {
    const getBackgroundColor = () => {
        switch (variant) {
            case 'primary': return Theme.colors.primary;
            case 'secondary': return Theme.colors.surface;
            case 'danger': return Theme.colors.danger;
            case 'success': return Theme.colors.success;
            case 'warning': return Theme.colors.warning;
            case 'ghost': return 'transparent';
            default: return Theme.colors.primary;
        }
    };

    const getTextColor = () => {
        if (variant === 'primary' || variant === 'danger' || variant === 'success' || variant === 'warning') return Theme.colors.text.inverse;
        if (variant === 'secondary') return Theme.colors.text.primary;
        if (variant === 'ghost') return Theme.colors.text.secondary;
        return Theme.colors.text.inverse;
    };

    return (
        <TouchableOpacity
            style={[
                styles.buttonBase,
                { backgroundColor: getBackgroundColor() },
                (variant === 'primary' || variant === 'danger' || variant === 'success') ? Theme.shadows.medium : {},
                (disabled || loading) && styles.buttonDisabled,
                style
            ]}
            disabled={disabled || loading}
            {...props}
        >
            {loading ? (
                <ActivityIndicator color={getTextColor()} />
            ) : (
                <Text style={[Typography.buttonText, { color: getTextColor() }, textStyle]}>
                    {title}
                </Text>
            )}
        </TouchableOpacity>
    );
};

/* --- Text Inputs --- */
interface InputFieldProps extends TextInputProps {
    label?: string;
    wrapperStyle?: StyleProp<ViewStyle>;
}

export const InputField = ({ label, style, wrapperStyle, ...props }: InputFieldProps) => (
    <View style={[styles.inputWrapper, wrapperStyle]}>
        {label && <Text style={Typography.label}>{label}</Text>}
        <TextInput
            style={[styles.input, style]}
            placeholderTextColor={Theme.colors.text.muted}
            {...props}
        />
    </View>
);

const styles = StyleSheet.create({
    card: {
        backgroundColor: Theme.colors.surface,
        borderRadius: Theme.borderRadius.xl,
        padding: 24,
        shadowColor: Theme.shadows.soft.shadowColor,
        shadowOffset: Theme.shadows.soft.shadowOffset,
        shadowOpacity: Theme.shadows.soft.shadowOpacity,
        shadowRadius: Theme.shadows.soft.shadowRadius,
        elevation: Theme.shadows.soft.elevation,
        borderWidth: 1,
        borderColor: Theme.colors.border,
    },
    buttonBase: {
        padding: 18,
        borderRadius: Theme.borderRadius.lg,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
    },
    buttonDisabled: {
        opacity: 0.5,
    },
    inputWrapper: {
        gap: 8,
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
});

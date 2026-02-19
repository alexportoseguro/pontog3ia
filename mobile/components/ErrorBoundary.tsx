
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Theme } from '../lib/Theme';
import { Ionicons } from '@expo/vector-icons';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
    }

    handleRestart = () => {
        // This is a soft restart - it just resets the error state
        // For a hard restart, we'd need expo-updates or similar
        this.setState({ hasError: false, error: null });
    };

    public render() {
        if (this.state.hasError) {
            return (
                <View style={styles.container}>
                    <View style={styles.card}>
                        <Ionicons name="alert-circle" size={48} color={Theme.colors.danger} />
                        <Text style={styles.title}>Ops! Algo deu errado.</Text>
                        <Text style={styles.message}>
                            Ocorreu um erro inesperado. Tente recarregar a tela.
                        </Text>
                        <Text style={styles.errorDetails}>
                            {this.state.error?.toString()}
                        </Text>

                        <TouchableOpacity style={styles.button} onPress={this.handleRestart}>
                            <Text style={styles.buttonText}>Tentar Novamente</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            );
        }

        return this.props.children;
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 32,
        alignItems: 'center',
        width: '100%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 5,
    },
    title: {
        fontSize: 20,
        fontWeight: '800',
        color: '#0f172a',
        marginTop: 16,
        marginBottom: 8,
    },
    message: {
        textAlign: 'center',
        color: '#64748b',
        fontSize: 14,
        marginBottom: 24,
    },
    errorDetails: {
        fontSize: 10,
        color: '#94a3b8',
        marginBottom: 20,
        textAlign: 'center',
    },
    button: {
        backgroundColor: Theme.colors.primary,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 12,
    },
    buttonText: {
        color: '#fff',
        fontWeight: '700',
    },
});

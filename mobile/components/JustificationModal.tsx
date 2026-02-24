import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { supabase } from '../lib/supabase';
import { Theme } from '../lib/Theme';
import { Typography } from '../lib/Typography';
import { Card, Button, InputField } from './SharedUI';

type Props = {
    visible: boolean;
    onClose: () => void;
    userId: string;
};

export default function JustificationModal({ visible, onClose, userId }: Props) {
    const [type, setType] = useState('late_arrival');
    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        if (!description.trim()) {
            Alert.alert('Erro', 'Por favor, descreva o motivo.');
            return;
        }

        setLoading(true);
        try {
            const { error } = await supabase.from('justifications').insert({
                user_id: userId,
                type,
                description: description, // Send as description to match DB
                status: 'pending' // pending approval
            });

            if (error) throw error;

            Alert.alert('Sucesso', 'Justificativa enviada para aprovação.');
            setDescription('');
            onClose();
        } catch (error: any) {
            Alert.alert('Erro', error.message || 'Falha ao enviar.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
                <Card style={styles.cardContainer}>
                    <Text style={[Typography.h3, styles.title]}>Nova Justificativa</Text>

                    <Text style={Typography.label}>Tipo de Ocorrência:</Text>
                    <View style={styles.typeRow}>
                        {['late_arrival', 'absence', 'medical'].map((t) => (
                            <TouchableOpacity
                                key={t}
                                style={[styles.typeButton, type === t && styles.typeButtonActive]}
                                onPress={() => setType(t)}
                            >
                                <Text style={[styles.typeText, type === t && styles.typeTextActive]}>
                                    {t === 'late_arrival' ? 'Atraso' : t === 'absence' ? 'Falta' : 'Médico'}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <InputField
                        label="Descrição:"
                        multiline
                        numberOfLines={4}
                        placeholder="Explique o motivo..."
                        value={description}
                        onChangeText={setDescription}
                        style={styles.textArea}
                    />

                    <View style={styles.actions}>
                        <Button variant="ghost" title="Cancelar" onPress={onClose} disabled={loading} style={styles.cancelButton} />
                        <Button variant="success" title="Enviar" onPress={handleSubmit} loading={loading} style={styles.submitButton} />
                    </View>
                </Card>
            </TouchableOpacity>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        padding: 20
    },
    cardContainer: {
        padding: 20,
    },
    title: {
        marginBottom: 20,
        textAlign: 'center',
    },
    typeRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 20,
        marginTop: 8,
    },
    typeButton: {
        flex: 1,
        padding: 10,
        borderRadius: Theme.borderRadius.sm,
        borderWidth: 1,
        borderColor: Theme.colors.border,
        alignItems: 'center'
    },
    typeButtonActive: {
        backgroundColor: Theme.colors.success,
        borderColor: Theme.colors.success
    },
    typeText: {
        ...Typography.bodySmall,
    },
    typeTextActive: {
        color: Theme.colors.text.inverse,
        fontWeight: 'bold',
    },
    textArea: {
        height: 100,
        textAlignVertical: 'top',
        backgroundColor: Theme.colors.background,
        color: Theme.colors.text.primary,
        borderColor: Theme.colors.border,
    },
    actions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12,
        marginTop: 10,
    },
    cancelButton: {
        paddingVertical: 10,
        paddingHorizontal: 16
    },
    submitButton: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        backgroundColor: Theme.colors.success,
    },
});

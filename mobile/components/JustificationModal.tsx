import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { supabase } from '../lib/supabase';

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
                reason: description,
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
                <TouchableOpacity activeOpacity={1} onPress={() => { }} style={styles.container}>
                    <Text style={styles.title}>Nova Justificativa</Text>

                    <Text style={styles.label}>Tipo de Ocorrência:</Text>
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

                    <Text style={styles.label}>Descrição:</Text>
                    <TextInput
                        style={styles.input}
                        multiline
                        numberOfLines={4}
                        placeholder="Explique o motivo..."
                        value={description}
                        onChangeText={setDescription}
                    />

                    <View style={styles.actions}>
                        <TouchableOpacity onPress={onClose} style={styles.cancelButton} disabled={loading}>
                            <Text style={styles.cancelText}>Cancelar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleSubmit} style={styles.submitButton} disabled={loading}>
                            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Enviar</Text>}
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
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
    container: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 20,
        elevation: 5
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 20,
        textAlign: 'center',
        color: '#1f2937'
    },
    label: {
        fontSize: 14,
        color: '#4b5563',
        marginBottom: 8,
        fontWeight: '600'
    },
    typeRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 20
    },
    typeButton: {
        flex: 1,
        padding: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        alignItems: 'center'
    },
    typeButtonActive: {
        backgroundColor: '#059669', // Emerald 600
        borderColor: '#059669'
    },
    typeText: {
        fontSize: 13,
        color: '#4b5563'
    },
    typeTextActive: {
        color: '#fff',
        fontWeight: 'bold'
    },
    input: {
        borderWidth: 1,
        borderColor: '#d1d5db',
        borderRadius: 8,
        padding: 10,
        height: 100,
        textAlignVertical: 'top',
        marginBottom: 20,
        fontSize: 16
    },
    actions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12
    },
    cancelButton: {
        paddingVertical: 10,
        paddingHorizontal: 16
    },
    cancelText: {
        color: '#6b7280',
        fontSize: 16
    },
    submitButton: {
        backgroundColor: '#059669',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
        opacity: 1
    },
    submitText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold'
    }
});


import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import * as FaceDetector from 'expo-face-detector';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '../lib/Theme';

interface BiometricAuthScreenProps {
    onSuccess: (updatedLocation?: string) => void;
    onCancel: () => void;
}

export default function BiometricAuthScreen({ onSuccess, onCancel }: BiometricAuthScreenProps) {
    const [permission, requestPermission] = useCameraPermissions();
    const [facing, setFacing] = useState<CameraType>('front');
    const [detecting, setDetecting] = useState(false);
    const [faceDetected, setFaceDetected] = useState(false);
    const cameraRef = useRef<CameraView>(null);

    useEffect(() => {
        if (!permission?.granted) {
            requestPermission();
        }
    }, [permission]);

    // Snapshot-based detection loop
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (permission?.granted && !faceDetected && !detecting) {
            interval = setInterval(async () => {
                // Return if component unmounted or state changed (safe check)
                if (!cameraRef.current) return;

                try {
                    // Take low-quality snapshot for detection
                    const photo = await cameraRef.current.takePictureAsync({ quality: 0.3, skipProcessing: true });
                    if (photo?.uri) {
                        // Detect faces in the snapshot
                        const options = { mode: FaceDetector.FaceDetectorMode.fast };
                        const { faces } = await FaceDetector.detectFacesAsync(photo.uri, options);

                        if (faces.length > 0) {
                            setFaceDetected(true);
                            clearInterval(interval);
                            // Auto-capture success sequence
                            handleSuccess();
                        }
                    }
                } catch (e) {
                    // Silent fail for loop
                }
            }, 1500); // Check every 1.5 seconds
        }
        return () => clearInterval(interval);
    }, [permission, faceDetected, detecting]);

    if (!permission) {
        return <View style={styles.container} />;
    }

    if (!permission.granted) {
        return (
            <View style={styles.container}>
                <Text style={styles.message}>Precisamos de permissão para usar a câmera.</Text>
                <TouchableOpacity onPress={requestPermission} style={styles.button}>
                    <Text style={styles.text}>Dar Permissão</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={onCancel} style={styles.cancelLink}>
                    <Text style={styles.textCancel}>Cancelar</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const handleSuccess = () => {
        setDetecting(true);
        // Simulate processing / visual feedback
        setTimeout(() => {
            onSuccess();
        }, 800);
    };

    const manualCapture = async () => {
        if (cameraRef.current) {
            setDetecting(true);
            try {
                const photo = await cameraRef.current.takePictureAsync({ quality: 0.5 });
                if (photo?.uri) {
                    const { faces } = await FaceDetector.detectFacesAsync(photo.uri);
                    if (faces.length > 0) {
                        handleSuccess();
                    } else {
                        Alert.alert("Erro", "Nenhum rosto detectado. Tente novamente.");
                        setDetecting(false);
                    }
                }
            } catch (e) {
                Alert.alert("Erro", "Falha ao capturar.");
                setDetecting(false);
            }
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Reconhecimento Facial</Text>
                <Text style={styles.subtitle}>Posicione seu rosto na câmera</Text>
            </View>

            <View style={styles.cameraContainer}>
                <CameraView
                    style={styles.camera}
                    facing={facing}
                    ref={cameraRef}
                >
                    <View style={styles.overlay}>
                        <View style={[styles.faceFrame, faceDetected ? styles.frameActive : styles.frameInactive]} />
                        {detecting && <ActivityIndicator size="large" color="#10b981" style={{ position: 'absolute' }} />}
                    </View>
                </CameraView>
            </View>

            <View style={styles.controls}>
                <Text style={styles.statusText}>
                    {faceDetected ? "Identidade Confirmada" : detecting ? "Validando..." : "Buscando Face..."}
                </Text>

                {/* Manual button as fallback or if auto fails/is slow */}
                {!detecting && (
                    <TouchableOpacity
                        style={styles.captureButton}
                        onPress={manualCapture}
                    >
                        <Ionicons name="camera" size={32} color="white" />
                    </TouchableOpacity>
                )}

                <TouchableOpacity onPress={onCancel} style={styles.cancelLink}>
                    <Text style={styles.textCancel}>Cancelar</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0F172A', // Dark background for scanning
        justifyContent: 'center',
    },
    message: {
        textAlign: 'center',
        color: '#94A3B8',
        paddingBottom: 20,
    },
    header: {
        padding: 20,
        alignItems: 'center',
        paddingTop: 60,
    },
    title: {
        fontSize: 24,
        fontWeight: '900',
        color: '#FFFFFF',
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 16,
        color: '#94A3B8',
        marginTop: 8,
    },
    cameraContainer: {
        flex: 1,
        margin: 20,
        borderRadius: 40,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        backgroundColor: '#000',
    },
    camera: {
        flex: 1,
    },
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.4)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    faceFrame: {
        width: 260,
        height: 360,
        borderWidth: 2,
        borderRadius: 130, // Oval shape
    },
    frameActive: {
        borderColor: '#10B981',
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 10,
    },
    frameInactive: {
        borderColor: 'rgba(255,255,255,0.5)',
        borderStyle: 'dashed',
    },
    controls: {
        height: 180,
        justifyContent: 'center',
        alignItems: 'center',
        paddingBottom: 30,
    },
    statusText: {
        textAlign: 'center',
        color: '#FFFFFF',
        marginBottom: 24,
        fontSize: 14,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 2,
    },
    button: {
        backgroundColor: '#4F46E5',
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: 16,
        marginTop: 10,
    },
    text: {
        fontSize: 16,
        fontWeight: '800',
        color: 'white',
    },
    textCancel: {
        fontSize: 15,
        color: '#94A3B8',
        fontWeight: '600',
    },
    captureButton: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: '#4F46E5',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#4F46E5',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
        elevation: 6,
    },
    cancelLink: {
        marginTop: 24,
    }
});

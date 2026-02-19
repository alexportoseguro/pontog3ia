'use client'
import { QRCodeSVG } from 'qrcode.react'

export default function MobileQRPage() {
    // Hardcoded IP based on ipconfig result. 
    // In a real scenario, this would be dynamic or environmental.
    const expoUrl = "exp://192.168.1.8:8081"

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
            <div className="bg-white p-8 rounded-xl shadow-lg text-center">
                <h1 className="text-2xl font-bold mb-4 text-gray-800">Conectar App Mobile</h1>
                <p className="text-gray-600 mb-6">Escaneie com o app Expo Go (Android/iOS)</p>

                <div className="bg-white p-4 rounded-lg border-2 border-gray-200 inline-block">
                    <QRCodeSVG value={expoUrl} size={256} level="H" />
                </div>

                <p className="mt-6 text-sm text-gray-500 font-mono bg-gray-100 p-2 rounded">
                    {expoUrl}
                </p>

                <div className="mt-8 text-left text-sm text-gray-600 max-w-md">
                    <p className="font-bold">Instruções:</p>
                    <ol className="list-decimal list-inside space-y-1 mt-2">
                        <li>Certifique-se de que o celular está no <strong>mesmo Wi-Fi</strong>.</li>
                        <li>Abra o app <strong>Expo Go</strong>.</li>
                        <li>Toque em "Scan QR Code" (Android) ou use a Câmera (iOS).</li>
                    </ol>
                </div>
            </div>
        </div>
    )
}

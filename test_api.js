async function testApi() {
    try {
        console.log('Testing API...');
        // Testing with the LAN IP to simulate Mobile connection
        const response = await fetch('http://192.168.1.8:3000/api/ai-concierge', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: 'f955daf7-b3e1-4099-9ec6-c3ceabd19424', // Use a real-looking UUID
                message: 'Estou com muita dor de cabeça vou no médico'
            })
        });

        console.log('Status:', response.status);
        const text = await response.text();
        console.log('Body:', text);
    } catch (error) {
        console.error('Error:', error);
    }
}

testApi();

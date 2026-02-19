const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config({ path: '.env.local' });

async function testGemini() {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
        console.error("❌ No GEMINI_API_KEY found in .env.local");
        return;
    }
    console.log("Using Key ending in:", key.slice(-4));

    const genAI = new GoogleGenerativeAI(key);

    const candidates = [
        "gemini-1.5-flash",
        "gemini-1.5-flash-latest",
        "gemini-1.5-flash-001",
        "gemini-pro",
        "gemini-1.0-pro"
    ];

    for (const modelName of candidates) {
        console.log(`\nTesting model: ${modelName}...`);
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent("Hello!");
            const response = await result.response;
            console.log(`✅ SUCCESS with ${modelName}! Response: ${response.text()}`);
            return;
        } catch (e) {
            // Log only the first line of error to keep it clean
            const msg = e.message ? e.message.split('\n')[0] : String(e);
            console.log(`❌ Failed ${modelName}: ${msg}`);
        }
    }
    console.log("\n❌ All models failed. Check API Key permissions or region.");
}

testGemini();

const fs = require('fs');
const path = require('path');

// Configuration
const PROJECT_REF = 'imdwscrltdbvgltxiciq';
const ACCESS_TOKEN = 'sbp_5efbbb84b9e798d7f04e417c1a4812aa9c92326a'; // User provided token

const SQL_FILES = [
    'create_notifications_table.sql',
    'create_holidays_table.sql',
    'create_device_tokens_table.sql'
];

async function runMigrations() {
    console.log('🚀 Starting migrations via Supabase Management API...');

    // Check for global fetch (Node 18+)
    if (typeof fetch === 'undefined') {
        console.error('❌ Global fetch not found. Please use Node.js 18+');
        process.exit(1);
    }

    for (const file of SQL_FILES) {
        const filePath = path.join(__dirname, '..', file);
        if (!fs.existsSync(filePath)) {
            console.error(`❌ File not found: ${file}`);
            continue;
        }

        const sql = fs.readFileSync(filePath, 'utf8');
        console.log(`\n📄 Executing ${file}...`);

        try {
            const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${ACCESS_TOKEN}`
                },
                body: JSON.stringify({ query: sql })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorText}`);
            }

            const result = await response.json();
            console.log(`✅ Success!`);
        } catch (error) {
            console.error(`❌ Error executing ${file}:`, error.message);
        }
    }

    console.log('\n✨ Migrations completed!');
}

runMigrations();

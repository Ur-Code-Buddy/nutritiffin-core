const { Client } = require('pg');
require('dotenv').config();

async function clearDB() {
    const isProd = process.env.NODE_ENV === 'production' || (process.env.DB_HOST && process.env.DB_HOST.includes('prod'));
    if (isProd) {
        console.error('ERROR: Cannot clear database in a production environment!');
        process.exit(1);
    }

    console.log('Connecting to DB to clear data...');
    const client = new Client({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
    });

    try {
        await client.connect();
        console.log('Connected. Finding all tables in public schema...');

        const res = await client.query(`
            SELECT tablename 
            FROM pg_tables 
            WHERE schemaname = 'public';
        `);

        const tables = res.rows.map(r => r.tablename);

        if (tables.length > 0) {
            console.log(`Found ${tables.length} tables. Truncating...`);
            const truncateQuery = `TRUNCATE TABLE ${tables.map(t => `"${t}"`).join(', ')} CASCADE;`;
            await client.query(truncateQuery);
            console.log('All tables truncated successfully.');
        } else {
            console.log('No tables found in public schema.');
        }
    } catch (error) {
        console.error('Error clearing DB:', error);
        process.exit(1);
    } finally {
        await client.end();
    }
}

clearDB();

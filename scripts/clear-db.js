const { Client } = require('pg');
require('dotenv').config();

async function clearDB() {
    console.log('Connecting to DB to clear data...');
    const client = new Client({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('Connected. Truncating tables...');
        await client.query('TRUNCATE TABLE users CASCADE;');
        console.log('Database cleared (users and dependencies truncated).');
    } catch (error) {
        console.error('Error clearing DB:', error);
        process.exit(1);
    } finally {
        await client.end();
    }
}

clearDB();

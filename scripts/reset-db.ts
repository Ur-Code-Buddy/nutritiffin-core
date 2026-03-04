import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Try to load dotenv if available, otherwise manual parsing logic or rely on env vars
try {
  dotenv.config();
} catch (e) {
  // ignore
}

async function resetDb() {
  // If dotenv didn't work or file not found, we might need to rely on what's passed or parse manually
  // Let's parse manually just in case
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath).toString();
    envConfig.split('\n').forEach((line) => {
      const parts = line.split('=');
      if (parts.length >= 2 && !line.startsWith('#')) {
        const key = parts[0].trim();
        const value = parts.slice(1).join('=').trim();
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    });
  }

  const client = new Client({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  try {
    const isProd =
      process.env.NODE_ENV === 'production' ||
      (process.env.DB_HOST && process.env.DB_HOST.includes('prod'));
    if (isProd) {
      console.error(
        'ERROR: Cannot reset database in a production environment!',
      );
      process.exit(1);
    }

    await client.connect();
    console.log('Connected to database.');

    console.log('Dropping schema public...');
    await client.query('DROP SCHEMA IF EXISTS public CASCADE;');
    console.log('Schema public dropped.');

    console.log('Creating schema public...');
    await client.query('CREATE SCHEMA public;');
    console.log('Schema public created.');

    console.log('Granting privileges on schema public...');
    await client.query('GRANT ALL ON SCHEMA public TO public;');
    console.log('Privileges granted.');

    console.log('Creating uuid-ossp extension...');
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
    console.log('Extension created.');

    console.log('Database reset complete.');
  } catch (err) {
    console.error('Error resetting database:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

resetDb();

import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;

// Use DATABASE_URL if available (Railway, etc.)
// For local development, construct from individual vars if DATABASE_URL is not set, 
// or require DATABASE_URL to be set in .env
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' && process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Prevent unhandled errors from crashing the process
pool.on('error', (err) => {
  console.error('[Pool Error] Unexpected error on idle client:', err);
});

export const query = (text, params) => pool.query(text, params);
export const getClient = () => pool.connect();
export default pool;

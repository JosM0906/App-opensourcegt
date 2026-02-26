import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
dotenv.config();
import pool from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data');

async function createTables() {
  const client = await pool.connect();
  try {
    console.log('Creating tables if they do not exist...');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        price NUMERIC NOT NULL,
        category TEXT NOT NULL,
        stock INTEGER NOT NULL,
        image_url TEXT
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        timestamp TIMESTAMP NOT NULL,
        customer_name TEXT NOT NULL,
        items JSONB NOT NULL,
        total NUMERIC NOT NULL,
        status TEXT NOT NULL
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS campaigns (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        message TEXT NOT NULL,
        media_url TEXT,
        is_custom BOOLEAN DEFAULT FALSE,
        scheduled_at TIMESTAMP,
        delay_ms INTEGER,
        numbers JSONB NOT NULL,
        status TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL,
        updated_at TIMESTAMP NOT NULL,
        last_attempt_at TIMESTAMP,
        attempts INTEGER DEFAULT 0,
        stats_sent INTEGER DEFAULT 0,
        stats_failed INTEGER DEFAULT 0
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS logs (
        id SERIAL PRIMARY KEY,
        phone TEXT,
        number TEXT,
        name TEXT,
        message TEXT,
        role TEXT,
        timestamp TIMESTAMP NOT NULL,
        text_in TEXT,
        text_out TEXT
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY,
        type TEXT NOT NULL,
        timestamp TIMESTAMP NOT NULL,
        metadata JSONB
      );
    `);
    
    console.log('Tables created successfully.');
  } finally {
    client.release();
  }
}

async function migrateData() {
  const client = await pool.connect();
  try {
    console.log('Starting data migration from JSON to PostgreSQL...');

    // 1. Migrate Products
    const catalogPath = path.join(DATA_DIR, 'catalog.json');
    if (fs.existsSync(catalogPath)) {
      const products = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
      for (const p of products) {
        await client.query(
          `INSERT INTO products (id, name, price, category, stock, image_url)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (id) DO NOTHING`,
          [p.id, p.name, p.price, p.category, p.stock, p.imageUrl]
        );
      }
      console.log(`Migrated ${products.length} products.`);
    }

    // 2. Migrate Orders
    const ordersPath = path.join(DATA_DIR, 'orders.json');
    if (fs.existsSync(ordersPath)) {
      const orders = JSON.parse(fs.readFileSync(ordersPath, 'utf8'));
      for (const o of orders) {
        await client.query(
          `INSERT INTO orders (id, timestamp, customer_name, items, total, status)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (id) DO NOTHING`,
          [o.id, o.timestamp, o.customerName, JSON.stringify(o.items), o.total, o.status]
        );
      }
      console.log(`Migrated ${orders.length} orders.`);
    }

    // 3. Migrate Campaigns
    const campaignsPath = path.join(DATA_DIR, 'campaigns.json');
    if (fs.existsSync(campaignsPath)) {
      let campaigns = JSON.parse(fs.readFileSync(campaignsPath, 'utf8'));
      if (campaigns && campaigns.campaigns && Array.isArray(campaigns.campaigns)) {
        campaigns = campaigns.campaigns;
      }
      for (const c of campaigns) {
        await client.query(
          `INSERT INTO campaigns (id, name, message, media_url, is_custom, scheduled_at, delay_ms, numbers, status, created_at, updated_at, last_attempt_at, attempts, stats_sent, stats_failed)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
           ON CONFLICT (id) DO NOTHING`,
          [
            c.id, c.name, c.message, c.mediaUrl, c.isCustom, 
            c.scheduledAt ? new Date(c.scheduledAt) : null, c.delayMs, JSON.stringify(c.numbers || []), c.status, 
            c.createdAt ? new Date(c.createdAt) : new Date(), c.updatedAt ? new Date(c.updatedAt) : new Date(), 
            c.lastAttemptAt ? new Date(c.lastAttemptAt) : null, c.attempts || 0, 
            c.stats?.sent || 0, c.stats?.failed || 0
          ]
        );
      }
      console.log(`Migrated ${campaigns.length} campaigns.`);
    }

    // 4. Migrate Logs
    const logsPath = path.join(__dirname, 'logs.json');
    if (fs.existsSync(logsPath)) {
      let logs = JSON.parse(fs.readFileSync(logsPath, 'utf8'));
      if (logs && !Array.isArray(logs)) {
        logs = logs.logs || Object.values(logs).find(Array.isArray) || [];
      }
      for (const l of logs) {
        await client.query(
          `INSERT INTO logs (phone, number, name, message, role, timestamp, text_in, text_out)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [l.phone, l.number, l.name, l.message, l.role, new Date(l.at || l.timestamp || Date.now()), l.text_in, l.text_out]
        );
      }
      console.log(`Migrated ${logs.length} logs.`);
    }

    // 5. Migrate Events
    const eventsPath = path.join(DATA_DIR, 'events.json');
    if (fs.existsSync(eventsPath)) {
      let events = JSON.parse(fs.readFileSync(eventsPath, 'utf8'));
      if (events && !Array.isArray(events)) {
        events = events.events || Object.values(events).find(Array.isArray) || [];
      }
      for (const e of events) {
        await client.query(
          `INSERT INTO events (type, timestamp, metadata)
           VALUES ($1, $2, $3)`,
          [e.type, new Date(e.timestamp), JSON.stringify(e.metadata || {})]
        );
      }
      console.log(`Migrated ${events.length} events.`);
    }

    console.log('Migration completed successfully.');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    client.release();
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.warn('DATABASE_URL is not set. Please set it in your .env file to run migrations.');
    process.exit(1);
  }
  
  await createTables();
  await migrateData();
  process.exit(0);
}

main();

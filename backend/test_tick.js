import dotenv from 'dotenv';
dotenv.config();
import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  await pool.query("UPDATE campaigns SET status = 'scheduled' WHERE id = 'cmp_8b0e1d5b13d7e_1772077374708'");
  console.log('Update complete, fetching tick...');
  const res = await fetch('http://localhost:4000/cron/tick');
  const body = await res.text();
  console.log('Tick response:', res.status, body);
  process.exit(0);
}
run();

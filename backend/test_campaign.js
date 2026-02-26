import dotenv from 'dotenv';
dotenv.config();
import { pool } from './db.js';

async function runTest() {
  const url = process.env.BUILDERBOT_BROADCAST_URL || "";
  const apiKey = process.env.BUILDERBOT_API_KEY || "";
  const headers = { 
    "Content-Type": "application/json",
    "x-api-builderbot": apiKey
  };
  
  // This matches what BuilderBot expects for a single push
  const payload = {
    number: "50250177374",
    messages: {
       content: "test", 
    }
  };

  try {
    const r = await fetch(url, { method: "POST", headers, body: JSON.stringify(payload) });
    const txt = await r.text();
    console.log("Response:", r.status, txt);
  } catch(e) { console.error(e); }
  
  process.exit(0);
}
runTest();

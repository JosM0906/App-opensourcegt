
import dotenv from "dotenv";
dotenv.config();

const URL = process.env.BUILDERBOT_BROADCAST_URL;
const KEY = process.env.BUILDERBOT_API_KEY;

if (!URL || !KEY) {
  console.error("Missing URL or KEY in .env");
  process.exit(1);
}

async function testAuth(name, headers, urlOverride) {
  const targetUrl = urlOverride || URL;
  console.log(`\n--- Testing ${name} ---`);
  
  try {
    const r = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({
        number: "50212345678",
        message: "Auth Test"
      })
    });
    
    const text = await r.text();
    console.log(`Status: ${r.status}`);
    console.log(`Response: ${text.slice(0, 300)}`);
  } catch (e) {
    console.error("Error:", e.message);
  }
}

async function run() {
  await testAuth("Header: token", { "token": KEY });
  await testAuth("Header: x-token", { "x-token": KEY });
  await testAuth("Header: Authorization (Raw)", { "Authorization": KEY });
}

run();

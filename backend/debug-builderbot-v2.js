
import dotenv from "dotenv";
dotenv.config();

const URL = process.env.BUILDERBOT_BROADCAST_URL;
const KEY = process.env.BUILDERBOT_API_KEY;

if (!URL || !KEY) {
  console.error("Missing URL or KEY in .env");
  process.exit(1);
}

async function testAuth(name, body) {
  console.log(`\n--- Testing ${name} ---`);
  
  try {
    const r = await fetch(URL, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "x-api-builderbot": KEY 
      },
      body: JSON.stringify(body)
    });
    
    const text = await r.text();
    console.log(`Status: ${r.status}`);
    console.log(`Response: ${text}`); 
  } catch (e) {
    console.error("Error:", e.message);
  }
}

async function run() {
  const number = "50212345678"; 
  
  // Try: messages object
  await testAuth("Messages Object", { 
    number, 
    messages: { content: "Test content" } 
  });

  // Try: message object (singular)
  await testAuth("Message Object", { 
     number, 
     message: { content: "Test content" } 
  });
}

run();

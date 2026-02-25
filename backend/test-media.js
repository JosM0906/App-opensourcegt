import dotenv from "dotenv";
import fetch from "node-fetch";
import fs from "fs";

dotenv.config();

const URL = process.env.BUILDERBOT_BROADCAST_URL;
const KEY = process.env.BUILDERBOT_API_KEY;

const results = [];
const TEST_IMAGE = "https://osposgt.com/Catalogos/Antiadherente/page-0005.jpg";
const TEST_NUMBER = "50240035884"; // Using the number from previous tests

async function test(name, payload) {
  console.log(`Testing ${name}...`);
  try {
    const r = await fetch(URL, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "x-api-builderbot": KEY 
      },
      body: JSON.stringify(payload)
    });
    const text = await r.text();
    results.push({ 
      name, 
      status: r.status, 
      response: text,
      payload 
    });
    console.log(`Status: ${r.status}`);
  } catch (e) {
    results.push({ name, error: e.message, payload });
    console.log(`Error: ${e.message}`);
  }
}

async function run() {
  if (!URL || !KEY) {
    console.error("Missing URL or KEY in .env");
    return;
  }

  // 1. Current Attempt (media)
  await test("Current (media)", {
    number: TEST_NUMBER,
    messages: {
      content: "Test Media Key",
      media: TEST_IMAGE
    }
  });

  // 2. mediaUrl
  await test("mediaUrl", {
    number: TEST_NUMBER,
    messages: {
      content: "Test mediaUrl Key",
      mediaUrl: TEST_IMAGE
    }
  });

  // 3. url
  await test("url", {
    number: TEST_NUMBER,
    messages: {
      content: "Test url Key",
      url: TEST_IMAGE
    }
  });

  // 4. attachment
  await test("attachment", {
    number: TEST_NUMBER,
    messages: {
      content: "Test attachment Key",
      attachment: TEST_IMAGE
    }
  });

  fs.writeFileSync("test_media_results.json", JSON.stringify(results, null, 2));
  console.log("Done. Results in test_media_results.json");
}

run();

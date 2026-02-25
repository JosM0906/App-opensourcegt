import fetch from "node-fetch";

const URL = "http://localhost:4000/mensaje";

async function test() {
  console.log("Sending 'hola' to /mensaje...");
  try {
    const res = await fetch(URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: "hola",
        history: []
      })
    });
    
    console.log(`Status: ${res.status}`);
    const data = await res.json();
    console.log("Response Data:", JSON.stringify(data, null, 2));
    
    if (data.error) {
      console.error("FAILED with error:", data.error);
    } else {
      console.log("SUCCESS! Reply:", data.reply);
    }
  } catch (e) {
    console.error("Request failed:", e.message);
  }
}

test();


import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env") });

const API_KEY = process.env.API_KEY || process.env.GEMINI_API_KEY;

if (!API_KEY) {
  console.error("Missing API_KEY");
  process.exit(1);
}

async function test() {
  const model = "gemini-3-flash-preview"; 
  // also try "gemini-1.5-flash" if 3 fails, but let's stick to what works for now
  
  console.log(`\nTesting model: ${model}...`);
  const ai = new GoogleGenAI({ apiKey: API_KEY });

  try {
    const result = await ai.models.generateContent({
      model: model,
      contents: [{ role: "user", parts: [{ text: "Hello" }] }],
    });
    console.log(`SUCCESS with ${model}`);
    
    // Dump everything to file
    const fs = await import("fs/promises");
    await fs.default.writeFile("debug-output.json", JSON.stringify(result, null, 2));
    console.log("Wrote debug-output.json");

  } catch (e) {
    console.error(`FAILED ${model}:`, e);
  }
}

test();

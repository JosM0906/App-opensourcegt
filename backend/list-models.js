import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
dotenv.config();

const API_KEY = process.env.API_KEY || process.env.GEMINI_API_KEY || "";

async function listModels() {
  console.log("Using API Key:", API_KEY.slice(0, 10) + "...");
  const genAI = new GoogleGenerativeAI(API_KEY);
  try {
    // Note: listModels is not directly on genAI in most versions, 
    // it's a separate fetch or part of the SDK's internal client.
    // In @google/generative-ai, there isn't a simple listModels() on the main class.
    // We can try to just fetch it manually.
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`);
    const data = await res.json();
    console.log("Models:", JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("Failed to list models:", e.message);
  }
}

listModels();

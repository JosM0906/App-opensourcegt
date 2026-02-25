
import { createRequire } from "module";
const require = createRequire(import.meta.url);

async function test() {
  console.log("--- REQUIRE ---");
  try {
    const required = require("pdf-parse");
    console.log("Type of required:", typeof required);
    console.log("Is required a function?", typeof required === "function");
    if (typeof required === "object") {
      console.log("Keys of required:", Object.keys(required));
    }
  } catch (e) {
    console.log("Require failed:", e.message);
  }

  console.log("\n--- IMPORT ---");
  try {
    const imported = await import("pdf-parse");
    console.log("Type of imported:", typeof imported);
    console.log("Keys of imported:", Object.keys(imported));
    console.log("Type of imported.default:", typeof imported.default);
  } catch (e) {
    console.log("Import failed:", e.message);
  }
}

test();

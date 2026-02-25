
import { createRequire } from "module";
const require = createRequire(import.meta.url);

async function test() {
  try {
    const mod = await import("pdf-parse");
    console.log("Imported mod:", mod);
    console.log("mod.default:", mod.default);
    console.log("Type of mod.default:", typeof mod.default);
  } catch (e) {
    console.log("Import failed:", e);
  }
}

test();

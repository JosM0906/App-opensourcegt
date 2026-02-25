
import { createRequire } from "module";
const require = createRequire(import.meta.url);

const pdfParse = require("pdf-parse");
const fs = require("fs");

async function test() {
  console.log("pdfParse type:", typeof pdfParse);

  if (typeof pdfParse !== "function") {
    console.error("pdfParse is not a function!");
    return;
  }

  // Create a minimal valid PDF (empty)
  const minimalPdf = Buffer.from("%PDF-1.0\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 3 3]>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000010 00000 n\n0000000060 00000 n\n0000000111 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n178\n%%EOF");

  try {
    const data = await pdfParse(minimalPdf);
    console.log("PDF Parsed OK. Text length:", data.text.length);
    console.log("Text content:", data.text);
  } catch (e) {
    console.error("PDF Parse Error:", e);
  }
}

test();

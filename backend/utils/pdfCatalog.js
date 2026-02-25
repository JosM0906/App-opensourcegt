import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

function cleanLine(s = "") {
  return String(s)
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function parsePdfPages(buffer) {
  const pages = [];
  
  // Custom pagerender to capture text per page
  async function pagerender(pageData) {
    const textContent = await pageData.getTextContent();
    let lastY, text = '';
    for (let item of textContent.items) {
      if (lastY == item.transform[5] || !lastY){
        text += item.str;
      } else {
        text += '\n' + item.str;
      }
      lastY = item.transform[5];
    }
    // Normalized text
    const cleanText = text.split("\n").map(cleanLine).filter(Boolean).join("\n");
    pages.push(cleanText);
    return text;
  }

  await pdfParse(buffer, { pagerender });
  return pages;
}

// Legacy regex extractor (optional)
export function extractItemsRegex(text) {
  const items = [];

  // --- Strategy 1: ABxxxx Blocks + Prices (Zip) ---
  // Detects blocks starting with "AB..." and maps them to prices found in the text (often at the bottom)
  // This handles columnar layouts where text streams separate descriptions and prices.
  const abBlocks = text.split(/(?:^|\n)(?=AB\d+)/).filter(s => s.trim().startsWith("AB"));
  // Find all prices in the text
  const allPrices = [...text.matchAll(/(?:^|\s)Q\s?(\d+(?:\.\d{1,2})?)/g)].map(m => Number(m[1]));

  if (abBlocks.length > 0 && abBlocks.length === allPrices.length) {
      // High confidence: map 1 to 1
      for (let i = 0; i < abBlocks.length; i++) {
          const block = abBlocks[i];
          const lines = block.split("\n").map(l => l.trim()).filter(Boolean);
          
          // Line 0 is Code (AB...)
          // Line 1 is usually Product Name
          const code = lines[0];
          let name = lines[1] || "Producto sin nombre";
          
          // Append Line 2 if Name is short (heuristic for multi-line names)
          if (lines[2] && name.length < 25) {
              name += " " + lines[2];
          }

          items.push({
              name: name,
              price: allPrices[i],
              code: code,
              category: "General",
              stock: 0,
              raw: `Code: ${code}`
          });
      }
      return items;
  }

  // --- Strategy 2: Line-by-line (Classic Fallback) ---
  // detecting "Name ... Q123" on a single line
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const priceMatch = line.match(/(?:^|\s)Q\s?(\d+(?:\.\d{1,2})?)/);
    if (!priceMatch) continue;
    
    const price = Number(priceMatch[1]);
    let name = line.replace(/(?:^|\s)Q\s?\d+(?:\.\d{1,2})?.*/, "").trim();
    
    // Clean code from start if present
    name = name.replace(/^AB\d+\s*/, "");

    if (name.length < 3) continue;

    items.push({ name, price, raw: line });
  }
  return items;
}

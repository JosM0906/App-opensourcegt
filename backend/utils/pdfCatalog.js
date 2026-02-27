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
  
  // Debug log per extraction attempt (internal)
  try {
     const fs = require("fs");
     const path = require("path");
     const debugPath = path.join(process.cwd(), "backend", "data", "pdf_debug_text.txt");
     fs.appendFileSync(debugPath, `\n--- NEW PAGE EXTRACTION (${new Date().toISOString()}) ---\n${text}\n`);
  } catch(e) {}

  // --- Strategy 1: ABxxxx Blocks + Prices (Zip) ---
  const abBlocks = text.split(/(?:^|\n)(?=AB\d+)/).filter(s => s.trim().startsWith("AB"));
  // Flexible price match: Q123.00 or just 123.00 at the end of a line/section
  const allPrices = [...text.matchAll(/(?:^|\s)Q?\s?(\d+(?:\.\d{1,2})?)(?:\s|$)/g)].map(m => Number(m[1]));

  if (abBlocks.length > 0 && abBlocks.length === allPrices.length) {
      for (let i = 0; i < abBlocks.length; i++) {
          const block = abBlocks[i];
          const lines = block.split("\n").map(l => l.trim()).filter(Boolean);
          const code = lines[0];
          let name = lines[1] || "Producto sin nombre";
          
          if (lines[2] && name.length < 30) {
              name += " " + lines[2];
          }

          items.push({
              name: name,
              price: allPrices[i],
              code: code,
              category: "General",
              stock: 0,
              raw: `Code: ${code} (Strat 1)`
          });
      }
      if (items.length > 0) return items;
  }

  // --- Strategy 2: Line-by-line (Classic Fallback) ---
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Match optional Q followed by numbers, potentially at the end
    const priceMatch = line.match(/(?:^|\s)Q?\s?(\d+(?:\.\d{1,2})?)(?:\s|$)/);
    if (!priceMatch) continue;
    
    const price = Number(priceMatch[1]);
    let name = line.replace(/(?:^|\s)Q?\s?\d+(?:\.\d{1,2})?.*/, "").trim();
    name = name.replace(/^AB\d+\s*/, "");

    if (name.length < 3) {
       // Look up one line if current name is empty/short
       if (i > 0 && lines[i-1].length > 5) {
          name = lines[i-1].trim();
       } else continue;
    }

    items.push({ name, price, category: "General", stock: 0, raw: line + " (Strat 2)" });
  }

  // --- Strategy 3: Greedy extraction ---
  // If still empty, try to just find ALL numbers that look like prices and match them with nearby text
  if (items.length === 0) {
     const priceRegex = /\d+\.\d{2}/g;
     let match;
     while ((match = priceRegex.exec(text)) !== null) {
        const price = Number(match[0]);
        const pos = match.index;
        const chunk = text.slice(Math.max(0, pos - 50), pos).split("\n").pop().trim();
        if (chunk.length > 3) {
           items.push({ name: chunk, price, category: "General", stock: 0, raw: "Chunk: " + chunk });
        }
     }
  }

  return items;
}

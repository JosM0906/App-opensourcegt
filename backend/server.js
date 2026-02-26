import dotenv from "dotenv";
dotenv.config();
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import fs from "fs";
import fsp from "fs/promises";
import pool from "./db.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import multer from "multer";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { parsePdfPages, extractItemsRegex } from "./utils/pdfCatalog.js";

// ============================
// PDF PARSE (CommonJS)
// ============================
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");
const { PDFDocument, PDFName, PDFRawStream } = require("pdf-lib");

async function extractImagesFromPdf(buffer) {
  const images = [];
  const logPath = path.join(__dirname, "data", "image_debug.log");
  try {
     fs.writeFileSync(logPath, "Starting Extraction in Server...\n");
  } catch(e) {}

  try {
    const doc = await PDFDocument.load(buffer);
    const enumeratedIndirectObjects = doc.context.enumerateIndirectObjects();
    
    let imgCount = 0;

    for (const [ref, pdfObject] of enumeratedIndirectObjects) {
      if (!(pdfObject instanceof PDFRawStream)) continue;
      
      const { dict } = pdfObject;
      const subtype = dict.get(PDFName.of("Subtype"));
      if (subtype !== PDFName.of("Image")) continue;

      const filter = dict.get(PDFName.of("Filter"));
      const width = dict.get(PDFName.of("Width"));
      const height = dict.get(PDFName.of("Height"));
      
      const wVal = Number(width?.value);
      const hVal = Number(height?.value);

      try { fs.appendFileSync(logPath, `Found: W=${wVal}, H=${hVal}\n`); } catch(e) {}

      // Simple heuristic: ignore small icons (less than 50px to be safe, user images looked big)
      if (wVal < 50 || hVal < 50) continue;

      let suffix = "bin";
      if (filter === PDFName.of("DCTDecode")) suffix = "jpg";
      else if (filter === PDFName.of("JPXDecode")) suffix = "jp2";
      else continue; 

      const data = pdfObject.contents;
      const filename = `img_${Date.now()}_${imgCount}.${suffix}`;
      const filepath = path.join(__dirname, "data", "images", filename);
      
      // Ensure dir exists
      if (!fs.existsSync(path.dirname(filepath))) {
          fs.mkdirSync(path.dirname(filepath), { recursive: true });
      }

      fs.writeFileSync(filepath, data);
      images.push(`/images/${filename}`);
      imgCount++;
    }
  } catch (e) {
    console.error("Error extracting images:", e);
    try { fs.appendFileSync(logPath, `ERROR: ${e.message}\n`); } catch(ez) {}
  }
  return images;
}

// multer: memoria (usado en PDFs)
const upload = multer({ storage: multer.memoryStorage() });

// multer: disco (usado en imágenes de campañas)
const storageDisk = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, "data", "images");
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname) || "";
    cb(null, "camp_" + uniqueSuffix + ext);
  }
});
const uploadDisk = multer({ storage: storageDisk });

// ============================
//  __dirname + ENV
// ============================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, ".env") });

// ============================
//  APP
// ============================
const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" })); // Increase limit for PDF uploads
app.use("/images", express.static(path.join(__dirname, "data", "images")));

// ============================
//  Helpers: PDF -> Catalog
// ============================
function cleanLine(s = "") {
  return String(s).replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim();
}

// ============================
//  Config
// ============================
const PORT = process.env.PORT || 4000;
const API_KEY = process.env.API_KEY || process.env.GEMINI_API_KEY || "";

if (!API_KEY) {
  console.error("Falta API_KEY o GEMINI_API_KEY en tu backend/.env");
  process.exit(1);
}

const ai = new GoogleGenerativeAI(API_KEY); // Note: default is usually fine, but let's be explicit if needed.
// Actually, let's try to pass the version if the SDK allows it in this version.
// Many versions of the SDK for node don't have the 2nd param for version easily.
// Let's try to change the model name to a more specific one first.


// ============================
//  Persistencia (Data Dir)
// ============================
const DATA_DIR = path.join(__dirname, "data");
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ============================
//  Logs persistentes
// ============================
let logs = [];
async function loadLogs() {
  try {
    const res = await pool.query('SELECT * FROM logs ORDER BY timestamp DESC LIMIT 1000');
    
    function cleanNum(str) {
      if (typeof str !== 'string') return str;
      return str.replace(/[{}"']/g, '');
    }
    
    logs = res.rows.map(r => ({
      at: r.timestamp ? r.timestamp.toISOString() : null,
      phone: cleanNum(r.phone),
      number: cleanNum(r.number),
      name: r.name,
      type: (r.text_in || r.role === 'user') ? 'in' : 'out',
      role: r.role,
      text_in: r.text_in,
      text_out: r.text_out,
      message: r.message
    }));
    return logs;
  } catch(e) { console.error(e); logs = []; return []; }
}
async function saveLogs() {
  try {
    // Only insert the most recent log (the first one added to unshift) to avoid huge rewrites
    // Or simpler: do a targeted insert in the routes, but to keep the drop-in replacement:
    if (logs.length > 0) {
      const log = logs[0];
      await pool.query(
        'INSERT INTO logs (phone, number, name, message, role, timestamp, text_in, text_out) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [log.phone || log.number || '', log.number || log.phone || '', log.name || '', log.message || '', log.type === 'in' ? 'user' : 'bot', new Date(log.at || Date.now()), log.text_in || '', log.text_out || '']
      );
    }
  } catch(e) { console.error("Error saving log:", e); }
}

// ============================
//  Events Persistence (Admin Metrics)
// ============================
const EVENTS_PATH = path.join(__dirname, "data", "events.json");

async function loadEvents() {
  try {
    const res = await pool.query('SELECT * FROM events ORDER BY timestamp ASC LIMIT 1000');
    return res.rows.map(r => ({ ...r, metadata: typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata }));
  } catch(e) { return []; }
}
async function saveEvents(events) {
  // Instead of rewriting all events, we just insert the last one to simulate append
  try {
    if (events.length > 0) {
      const e = events[events.length - 1];
      await pool.query('INSERT INTO events (type, timestamp, metadata) VALUES ($1, $2, $3)', [e.type, new Date(e.timestamp), JSON.stringify(e.metadata)]);
    }
  } catch(e) { console.error("Error saving event:", e); }
}

async function trackEvent(type, metadata = {}) {
  try {
    const events = await loadEvents();
    const newEvent = {
      id: randomUUID(),
      type,
      timestamp: new Date().toISOString(),
      ...metadata
    };
    events.push(newEvent);
    // Keep last 1000 events
    if (events.length > 1000) events.shift();
    await saveEvents(events);
    console.log(`[Event] ${type}`, metadata);
  } catch (e) {
    console.error("Error tracking event:", e);
  }
}
await loadLogs();

// ============================
//  Tools declarations
// ============================
const searchCatalogFunction = {
  name: "searchCatalog",
  parameters: {
    type: "OBJECT",
    description: "Search for a product in the catalog by name or keyword.",
    properties: {
      query: {
        type: "STRING",
        description: "The product name or category to search for.",
      },
    },
    required: ["query"],
  },
};

const recordOrderFunction = {
  name: "recordOrder",
  parameters: {
    type: "OBJECT",
    description: "Records a new order in the internal database.",
    properties: {
      customerName: { type: "STRING" },
      items: { type: "ARRAY", items: { type: "STRING" } },
      total: { type: "NUMBER" },
    },
    required: ["customerName", "items", "total"],
  },
};

// ============================
//  Tool implementations
// ============================
function handleSearchCatalog({ query }, catalog = []) {
  const q = String(query || "").toLowerCase().trim();
  if (!q) return { results: [], message: "Empty query." };

  const results = (catalog || [])
    .filter((p) => {
      const name = String(p?.name ?? p?.nombre_producto ?? "").toLowerCase();
      const code = String(p?.code ?? p?.id_producto ?? "").toLowerCase();
      const category = String(p?.category ?? p?.categoria ?? "").toLowerCase();
      return name.includes(q) || code.includes(q) || category.includes(q);
    })
    .slice(0, 10)
    .map((p) => ({
      code: p.code ?? p.id_producto ?? "",
      name: p.name ?? p.nombre_producto ?? "",
      price: p.price ?? p.precio ?? p.precio_unitario ?? null,
    }));

  return { results };
}

// ============================
//  Orders persistence (Local + Sheets)
// ============================
const ORDERS_PATH = path.join(DATA_DIR, "orders.json");

async function loadOrders() {
  try {
    const res = await pool.query('SELECT * FROM orders ORDER BY created_at DESC');
    return res.rows.map(r => ({
      ...r,
      customerName: r.customer_name,
      createdAt: r.created_at,
      items: typeof r.items === 'string' ? JSON.parse(r.items) : r.items
    }));
  } catch(e) { return []; }
}
async function saveOrders(orders) {
  try {
    for (const o of orders) {
      await pool.query(
        'INSERT INTO orders (id, timestamp, customer_name, items, total, status, created_at, phone, address) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status',
        [o.id, new Date(o.timestamp), o.customerName, JSON.stringify(o.items), o.total, o.status, new Date(o.createdAt), o.phone||'', o.address||'']
      );
    }
  } catch(e) { console.error(e); }
}

async function handleRecordOrder(args) {
  try {
    // Map incoming args to internal structure
    // Incoming might be: { name, numero, nombre_cliente, direccion_envio, subtotal, productos_json }
    // OR wrapped in "pedido": { pedido: { ... } } or { pedido: "..." }
    
    let source = args;
    if (args.pedido) {
      if (typeof args.pedido === 'string') {
        try {
          source = JSON.parse(args.pedido);
        } catch (e) {
          console.warn("Could not parse args.pedido:", e);
        }
      } else if (typeof args.pedido === 'object') {
        source = args.pedido;
      }
    }

    // Support extraction if the source is still wrapped (e.g. source.pedido inside source)
    if (source.pedido && typeof source.pedido === 'object') source = source.pedido;

    const customerName = source.customerName || source.nombre_cliente || source.name || args.customerName || "Anónimo";
    const phone = source.phone || source.numero || source.number || args.phone || "";
    const address = source.address || source.direccion_envio || args.address || "Ciudad";
    const total = Number(source.total || source.subtotal || args.total || 0);
    
    let items = source.items || source.productos_json || args.items || [];
    
    console.log("[handleRecordOrder] Extracted:", { customerName, total });

    // Normalize items to array of strings for internal storage
    if (typeof items === 'string') {
      items = items.split(',').map(i => i.trim());
    } else if (Array.isArray(items)) {
      // If it's an array of objects (user's structure), map to string
      if (items.length > 0 && typeof items[0] === 'object') {
        items = items.map(p => {
            if (typeof p === 'string') return p;
            return `${p.cantidad || 1}x ${p.nombre_producto || p.name || 'Producto'} (${p.precio_unitario || 0})`;
        });
      }
    } else {
      items = [];
    }

    const orders = await loadOrders();
    
    // Create new order object
    const newOrder = {
      id: randomUUID(),
      customerName,
      items,
      total,
      phone,
      address,
      status: "Pending",
      timestamp: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    // Prevent duplicates (same client, total, items within 60s)
    const isDuplicate = orders.some(o => 
      o.customerName === newOrder.customerName &&
      o.total === newOrder.total &&
      JSON.stringify(o.items) === JSON.stringify(newOrder.items) &&
      (new Date(newOrder.createdAt) - new Date(o.createdAt) < 60000)
    );

    if (isDuplicate) {
      console.warn("[handleRecordOrder] Duplicate detected, skipping save:", newOrder.id);
      return { ok: true, recorded: newOrder, duplicate: true };
    }
    
    // 1. Save locally
    orders.push(newOrder);
    await saveOrders(orders);
    
    // 2. Send to Google Sheets (if configured)
    const sheetsUrl = process.env.SHEETS_WEBAPP_URL;
    if (sheetsUrl) {
      // Format payload for Google Apps Script
      // Script expects: { action: "createOrder", data: { ... } } or similar
      const payload = {
        action: "createOrder",
        data: {
          orderId: newOrder.id,
          date: new Date().toLocaleString("es-GT"),
          name: newOrder.customerName,
          phone: newOrder.phone,
          address: newOrder.address,
          total: newOrder.total,
          items: newOrder.items.join(", ")
        }
      };
      
      fetch(sheetsUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }).catch(err => console.error("Error sending to Sheets:", err));
    }

    return { ok: true, recorded: newOrder };
  } catch (e) {
    console.error("Error saving order:", e);
    return { ok: false, error: String(e) };
  }
}

// POST /api/chat-log (For BuilderBot Cloud Leads/Conversations)
// POST /api/chat-log (For BuilderBot Cloud Leads/Conversations)
app.post("/api/chat-log", async (req, res) => {
  try {
    // Support two modes:
    // 1. Single role (legacy): { phone, name, message, role }
    // 2. Dual (combined): { phone, name, question, answer } 
    const { phone, name, message, role, question, answer } = req.body;
    
    // Mode 2: Combined (User + Bot in one go)
    if (question && answer) {
        const now = Date.now();
        // Log IN (User) - artificially 2 seconds ago to simulate delay/order
        logs.unshift({
            at: new Date(now - 2000).toISOString(),
            phone: phone || "",
            name: name || "",
            type: 'in',
            text_in: question,
            text_out: "",
            number: phone
        });

        // Log OUT (Bot) - now
        logs.unshift({
            at: new Date(now).toISOString(),
            phone: phone || "",
            name: name || "",
            type: 'out',
            text_in: "",
            text_out: answer,
            number: phone
        });
    } 
    // Mode 1: Single entry
    else {
        // Simple log object compatible with metrics
        const newLog = {
          at: new Date().toISOString(),
          phone: phone || "",
          name: name || "",
          type: role === 'user' ? 'in' : 'out', // 'in' is important for metrics
          text_in: role === 'user' ? message : "",
          text_out: role !== 'user' ? message : "",
          number: phone // metrics logic uses 'number' or 'phone'
        };
        logs.unshift(newLog);
    }

    if (logs.length > 500) logs.pop();
    await saveLogs();

    res.json({ ok: true });
  } catch(e) {
    console.error("Error in /api/chat-log:", e);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/orders (Proxy Endpoint)
app.post("/api/orders", async (req, res) => {
    const result = await handleRecordOrder(req.body);
    if (!result.ok) return res.status(500).json(result);
    res.json(result);
});

app.get("/api/metrics", async (_req, res) => {
  try {
    const orders = await loadOrders();
    const allLogs = logs; // in-memory logs

    // 1. Totals
    const totalOrders = orders.length;
    const revenue = orders.reduce((acc, o) => acc + (Number(o.total) || 0), 0);
    
    // Estimate conversations by unique numbers in logs (if available) or just total interactions
    // Simple heuristic: Count unique "from" numbers in logs where type is "in" (incoming)
    // Note: logs structure might change, assuming { type: 'in' | 'out', number: '...', ... }
    const uniqueNumbers = new Set(allLogs.filter(l => l.type === 'in' && l.number).map(l => l.number));
    const totalConversations = uniqueNumbers.size || allLogs.length; // Fallback to total logs if extraction fails

    // 2. Avg Reply Time (Real Calculation)
    let totalReplyTimeMs = 0;
    let replyCount = 0;
    
    // Sort logs by time to ensure correct order
    const sortedLogs = [...allLogs].sort((a, b) => {
        const t1 = new Date(a.at || a.timestamp).getTime();
        const t2 = new Date(b.at || b.timestamp).getTime();
        return t1 - t2;
    });

    for (let i = 0; i < sortedLogs.length - 1; i++) {
        const current = sortedLogs[i];
        const next = sortedLogs[i+1];
        
        // Find pattern: User Msg (in) -> Bot Msg (out)
        // Check if strictly adjacent or if we need to filter by same phone number? 
        // For simplicity now: strict adjacency in global log might fail if concurrent users.
        // Better: Check same phone number.
        if (current.type === 'in' && next.type === 'out' && current.number === next.number) {
            const t1 = new Date(current.at || current.timestamp).getTime();
            const t2 = new Date(next.at || next.timestamp).getTime();
            const diff = t2 - t1;
            
            // Filter: Valid diff and less than 1 hour (ignore overnight delays)
            if (diff > 0 && diff < 60 * 60 * 1000) {
                totalReplyTimeMs += diff;
                replyCount++;
            }
        }
    }
    
    const avgReplyMin = replyCount > 0 
        ? Math.round((totalReplyTimeMs / replyCount / 60000) * 10) / 10 
        : 0;

    // 3. Charts Data (Last 7 days)
    // Fix: Use local date to avoid timezone shifts (UTC vs Local)
    const days = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    const today = new Date();
    
    // Helper: format date as YYYY-MM-DD in local time
    // We rely on the system's local time, but force it to return YYYY-MM-DD string
    const getLocalDate = (d) => {
      return d.toLocaleDateString('sv-SE'); // sv-SE is ISO 8601 format (YYYY-MM-DD)
    };

    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(today.getDate() - (6 - i));
      return { 
        date: getLocalDate(d),
        dayName: days[d.getDay()] 
      };
    });

    // Chart: Orders per day
    const chartBars = last7Days.map(d => {
      // Check if createdAt strings (UTC) roughly match the local date
      // This is imperfect but better than raw string comparison if offsets differ heavily
      // For simplicity in this context, we'll convert order time to local YYYY-MM-DD
      const dayOrders = orders.filter(o => {
         if (!o.createdAt) return false;
         const orderDate = new Date(o.createdAt);
         return getLocalDate(orderDate) === d.date;
      });
      return { day: d.dayName, orders: dayOrders.length };
    });

    // Chart: Leads/Conversations per day
    const chartLine = last7Days.map(d => {
      const dayLogs = allLogs.filter(l => {
         const time = l.at || l.timestamp; 
         if (!time) return false;
         const logDate = new Date(time);
         return getLocalDate(logDate) === d.date;
      });
      const dayUnique = new Set(dayLogs.map(l => l.number || l.phone || "unknown"));
      return { day: d.dayName, leads: dayUnique.size };
    });

    // 4. Admin Interactions (Events)
    const events = await loadEvents();
    
    // Simple aggregations
    const interactions = {
        manual_messages: events.filter(e => e.type === "manual_message_sent").length,
        catalog_updates: events.filter(e => e.type === "catalog_create" || e.type === "catalog_update").length,
        pdf_uploads: events.filter(e => e.type === "pdf_upload").length,
        campaigns_created: events.filter(e => e.type === "campaign_create").length,
        recent: events.slice(-5).reverse() // Include a few recent ones for the UI list
    };

    res.json({
      totalConversations,
      totalOrders,
      revenue,
      avgReplyMin,
      chartBars,
      chartLine,
      interactions
    });

  } catch (e) {
    console.error("Error generating metrics:", e);
    res.status(500).json({ error: "Error calculating metrics" });
  }
});


// ============================
//  Debug (para confirmar pdfParse)
// ============================
app.get("/debug/pdfparse", (_req, res) => {
  res.json({
    ok: true,
    type: typeof pdfParse,
    isFunction: typeof pdfParse === "function",
  });
});

// ============================
//  Health + Logs
// ============================
// Removed root handler to allow frontend to serve at /
app.get("/logs", (_req, res) => {
  res.json({ logs });
});

// ============================
//  System instruction DKALUMA
// ============================
// ============================
//  System instruction (Dynamic from file)
// ============================
const PROMPT_PATH = path.join(DATA_DIR, "prompt.txt");

async function loadSystemPrompt() {
  try {
    ensureDataDir();
    if (!fs.existsSync(PROMPT_PATH)) {
       // Create default if not exists
       const defaultPrompt = `Eres un asistente virtual de ventas de ALMACÉN EL TESORO / DKALUMA S.A... (default)`;
       await fsp.writeFile(PROMPT_PATH, defaultPrompt, "utf-8");
       return defaultPrompt;
    }
    return await fsp.readFile(PROMPT_PATH, "utf-8");
  } catch (e) {
    console.error("Error reading prompt:", e);
    return "Eres un asistente útil."; // Fallback
  }
}

app.get("/admin/prompt", async (_req, res) => {
  const prompt = await loadSystemPrompt();
  res.json({ prompt });
});

app.post("/admin/prompt", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (typeof prompt !== "string") return res.status(400).json({ error: "Invalid prompt format" });
    
    await ensureDataDir();
    await fsp.writeFile(PROMPT_PATH, prompt, "utf-8");
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/admin/prompt/sync", async (req, res) => {
  try {
    const assistantId = process.env.BUILDERBOT_ASSISTANT_ID;
    if (!assistantId) return res.status(400).json({ error: "Falta BUILDERBOT_ASSISTANT_ID en .env" });

    // Use hardcoded projectId since getting it from env is complex and error prone for this quick fix
    const projectId = "ccffa427-dba4-4b14-a64f-3c1cc08e8fef"; 
    
    const url = `https://app.builderbot.cloud/api/v2/${projectId}/answer/${assistantId}/plugin/assistant`;
    console.log("[Sync] Fetching from:", url);

    const resp = await fetch(url, {
        headers: {
            "x-api-builderbot": process.env.BUILDERBOT_API_KEY
        }
    });

    if (!resp.ok) {
        const txt = await resp.text();
        console.error("[Sync] Error:", txt);
        return res.status(resp.status).json({ error: "BuilderBot API Error: " + txt });
    }

    const data = await resp.json();
    // Verify JSON structure from curl output: {"data":{"instructions":"..."}}
    const instructions = data?.data?.instructions;

    if (!instructions) {
        return res.status(400).json({ error: "No se encontraron instrucciones en la respuesta de BuilderBot" });
    }

    await ensureDataDir();
    await fsp.writeFile(PROMPT_PATH, instructions, "utf-8");
    console.log("[Sync] Prompt updated successfully via Cloud Sync");
    
    res.json({ ok: true, prompt: instructions });

  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// ============================
//  POST /mensaje
// ============================
app.post("/mensaje", async (req, res) => {
  try {
    let text = String(req.body?.text ?? "").trim();
    if (!text) return res.status(400).json({ error: "Falta 'text' en el body" });

    if (text.includes("]:")) {
      text = text.split("]:").pop().trim();
    }

    const history = Array.isArray(req.body?.history) ? req.body.history : [];
    let catalog = Array.isArray(req.body?.catalog) ? req.body.catalog : [];

    if (!catalog.length) {
      const persisted = await readCatalog();
      catalog = Array.isArray(persisted) ? persisted : [];
    }

    const formattedHistory = history.map(h => ({
      role: h.role === "user" ? "user" : "model",
      parts: [{ text: h.text || "" }]
    }));

    const aiCatalog = catalog
      .filter(p => p.name && !p.name.startsWith("Precio:") && p.price > 0)
      .map(p => ({
        id: p.id,
        name: p.name,
        price: p.price,
        category: p.category,
        stock: p.stock
      }));

    console.log(`[POST /mensaje] Received text: "${text}"`);
    console.log(`[POST /mensaje] Context Catalog Size: ${aiCatalog.length} items`);
    // Log simple para confirmar que la petición llega
    try { fs.appendFileSync(path.join(DATA_DIR, "ai_debug.log"), `[${new Date().toISOString()}] Incoming /mensaje: "${text.slice(0,30)}..."\n`); } catch(e) {}

    const modelPriorities = [
      process.env.GEMINI_MODEL || "gemini-1.5-flash",
      "gemini-1.5-flash-latest",
      "gemini-2.0-flash",
      "gemini-pro"
    ];

    let session = null;
    let lastError = null;

    const tryModel = async (name) => {
      try {
        console.log(`[POST /mensaje] Intentando modelo: ${name}`);
        const m = ai.getGenerativeModel({
          model: name,
          systemInstruction: await loadSystemPrompt()
        });
        
        // Temporariamente desactivamos tools si sospechamos que rompen la respuesta
        const chat = m.startChat({
          history: formattedHistory
          // tools: [{ functionDeclarations: [searchCatalogFunction, recordOrderFunction] }]
        });
        
        const result = await chat.sendMessage(text);
        return { model: m, chat, result };
      } catch (e) {
        console.warn(`[POST /mensaje] El modelo ${name} falló:`, e.message);
        lastError = e;
        
        try { 
          fs.appendFileSync(path.join(DATA_DIR, "ai_debug.log"), 
          `[${new Date().toISOString()}] Modelo ${name} Error: ${e.message}\n`
          ); 
        } catch(ez) {}
        
        return { error: e };
      }
    };

    for (const modelName of modelPriorities) {
      const resTry = await tryModel(modelName);
      if (resTry.model) {
        session = resTry;
        break;
      } else {
        // Si es un error de cuota (429), no sigas intentando otros modelos
        if (String(lastError?.message).includes("429") || String(lastError?.message).includes("quota")) {
          break;
        }
      }
    }

    if (!session) {
      const errorMsg = String(lastError?.message || "Desconocido");
      let userFriendlyError = "Lo siento, mi servicio de IA está experimentando problemas.";
      
      if (errorMsg.includes("429") || errorMsg.includes("quota")) {
        userFriendlyError = "❌ ERROR DE CUOTA: Se han agotado las peticiones gratuitas diarias de Gemini. Por favor, revisa tu plan en Google AI Studio.";
      } else if (errorMsg.includes("403")) {
        userFriendlyError = "❌ ERROR DE ACCESO: El API Key de Gemini es inválida o no tiene permisos.";
      }
      
      // Devolvemos 200 OK con el error como 'reply' para que el bot responda el error en lugar de quedar en silencio
      return res.json({ reply: userFriendlyError, text: userFriendlyError, error: errorMsg });
    }

    const { model, result } = session;
    let response = result.response;
    
    // Extraer texto de forma segura
    let out = "No se recibió una respuesta legible.";
    try {
        out = response.text().trim();
    } catch (e) {
        console.warn("[POST /mensaje] Error al extraer texto (posiblemente una función):", e.message);
        // Si no hay texto, buscamos si hay una llamada a función aunque las hayamos desactivado arriba (por si acaso)
        const parts = response.candidates?.[0]?.content?.parts || [];
        const textPart = parts.find(p => p.text);
        if (textPart) out = textPart.text.trim();
    }

    logs.unshift({
      at: new Date().toISOString(),
      text_in: text,
      text_out: out,
    });
    if (logs.length > 200) logs.pop();
    await saveLogs();

    return res.json({ reply: out, text: out });
  } catch (err) {
    console.error("Error crítico en /mensaje:", err);
    try { fs.appendFileSync(path.join(DATA_DIR, "ai_debug.log"), `[${new Date().toISOString()}] Error crítico: ${err.message}\n`); } catch(e) {}
    // Siempre 200 OK para evitar que el bot muera en el middleware
    return res.json({ reply: "Error interno: " + err.message, text: "Error" });
  }
});

// ============================
// Campaigns (persistentes)
// ============================
const CAMPAIGNS_PATH = path.join(DATA_DIR, "campaigns.json");

function nowIso() {
  return new Date().toISOString();
}

function normalizeGtNumber(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return null;

  if (digits.length === 11 && digits.startsWith("502")) return digits;
  if (digits.length === 8) return `502${digits}`;
  if (digits.length >= 11 && digits.startsWith("502")) return digits.slice(0, 11);

  return null;
}

function parseNumbersRaw(raw) {
  const tokens = String(raw || "")
    .split(/[\n,;]+/g)
    .map((x) => x.trim())
    .filter(Boolean);

  const out = [];
  const invalid = [];
  const seen = new Set();

  let duplicatesRemoved = 0;

  for (const t of tokens) {
    const n = normalizeGtNumber(t);
    if (!n) {
      invalid.push(t);
      continue;
    }
    if (seen.has(n)) {
      duplicatesRemoved++;
      continue;
    }
    seen.add(n);
    out.push(n);
  }

  return { numbers: out, invalid, duplicatesRemoved };
}

async function loadCampaigns() {
  try {
    const res = await pool.query('SELECT * FROM campaigns ORDER BY created_at DESC');
    return res.rows.map(r => ({
      id: r.id,
      name: r.name,
      message: r.message,
      status: r.status,
      attempts: r.attempts,
      mediaUrl: r.media_url,
      isCustom: r.is_custom,
      scheduledAt: r.scheduled_at ? r.scheduled_at.toISOString() : null,
      delayMs: r.delay_ms,
      createdAt: r.created_at ? r.created_at.toISOString() : null,
      updatedAt: r.updated_at ? r.updated_at.toISOString() : null,
      lastAttemptAt: r.last_attempt_at ? r.last_attempt_at.toISOString() : null,
      stats: { sent: r.stats_sent, failed: r.stats_failed },
      numbers: typeof r.numbers === 'string' ? JSON.parse(r.numbers) : r.numbers
    }));
  } catch(e) { return []; }
}
async function saveCampaigns(campaigns) {
  try {
    for (const c of campaigns) {
      await pool.query(
        `INSERT INTO campaigns (id, name, message, media_url, is_custom, scheduled_at, delay_ms, numbers, status, created_at, updated_at, last_attempt_at, attempts, stats_sent, stats_failed)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         ON CONFLICT (id) DO UPDATE SET 
          name=EXCLUDED.name, message=EXCLUDED.message, media_url=EXCLUDED.media_url, is_custom=EXCLUDED.is_custom, scheduled_at=EXCLUDED.scheduled_at, delay_ms=EXCLUDED.delay_ms, numbers=EXCLUDED.numbers, status=EXCLUDED.status, updated_at=EXCLUDED.updated_at, last_attempt_at=EXCLUDED.last_attempt_at, attempts=EXCLUDED.attempts, stats_sent=EXCLUDED.stats_sent, stats_failed=EXCLUDED.stats_failed`,
        [c.id, c.name, c.message, c.mediaUrl, c.isCustom, c.scheduledAt ? new Date(c.scheduledAt) : null, c.delayMs, JSON.stringify(c.numbers||[]), c.status, c.createdAt ? new Date(c.createdAt) : new Date(), c.updatedAt ? new Date(c.updatedAt) : new Date(), c.lastAttemptAt ? new Date(c.lastAttemptAt) : null, c.attempts || 0, c.stats?.sent || 0, c.stats?.failed || 0]
      );
    }
  } catch(e) { console.error(e); }
}

function newId() {
  return `cmp_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

app.post("/api/send-message", async (req, res) => {
  try {
    const { number, message, mediaUrl } = req.body;
    if (!number) return res.status(400).json({ error: "Falta el número" });
    if (!message && !mediaUrl) return res.status(400).json({ error: "Falta mensaje o mediaUrl" });

    // Normalize number
    const cleanNumber = normalizeGtNumber(number);
    if (!cleanNumber) return res.status(400).json({ error: "Número inválido (guatemalteco)" });

    console.log(`[POST /api/send-message] Sending to normalized number: ${cleanNumber}`);

    const result = await builderBotBroadcast({
      campaignId: "direct-send",
      message: message || " ", 
      numbers: [cleanNumber],
      delayMs: 0,
      mediaUrl
    });

    // builderBotBroadcast returns { sent, failedCount }
    if (result.failedCount > 0) {
      return res.status(500).json({ error: "Error enviando mensaje al proveedor" });
    }

    res.json({ ok: true, sent: result.sent });
  } catch (e) {
    console.error("Error in /api/send-message:", e);
    res.status(500).json({ error: e.message });
  }
});

async function builderBotBroadcast({ campaignId, message, numbers, delayMs, mediaUrl }) {
  const url = process.env.BUILDERBOT_BROADCAST_URL || "";
  if (!url) throw new Error("Falta BUILDERBOT_BROADCAST_URL en backend/.env");

  const apiKey = process.env.BUILDERBOT_API_KEY || "";
  // Header key based on BuilderBot Cloud V2
  const headers = { 
    "Content-Type": "application/json",
    "x-api-builderbot": apiKey
  };

  let sent = 0;
  let failedCount = 0;

  for (const number of numbers) {
    try {
      // Structure attempt for BuilderBot Cloud V2:
      // Try multiple potential keys since docs are unavailable
      // Structure attempt: BuilderBot V2 (Final Guess)
      // Error said "messages.content" is required.
      
      const payload = {
        number,
        messages: {
           content: message || " ", 
           mediaUrl: mediaUrl || undefined
        }
      };
      
      // BuilderBot V2 expects 'messages' as an OBJECT for single send, 
      // but some documentation suggests 'message' or arrays. 
      // Our diagnostic test 200 OK'd { messages: { content } }.
      
      if (!number) {
        console.error(`[BuilderBot] Empty number in broadcast for campaign ${campaignId}`);
        failedCount++;
        continue;
      }

      console.log(`[BuilderBot] Sending to ${number} (Campaign: ${campaignId}):`, JSON.stringify(payload, null, 2));

      const r = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      trackEvent("manual_message_sent", { number, campaignId, hasMedia: !!mediaUrl });

      const txt = await r.text().catch(() => "");
      console.log(`[BuilderBot] Response from ${number}: ${r.status} ${txt}`);

      if (!r.ok) {
        console.error(`[BuilderBot] Error sending to ${number}: ${r.status} ${txt}`);
        failedCount++;
      } else {
        sent++;
      }
    } catch (e) {
      console.error(`[BuilderBot] Exception sending to ${number} for campaign ${campaignId}:`, e);
      failedCount++;
    }

    if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  return { sent, failedCount };
}

app.post("/campaigns/parse", async (req, res) => {
  const raw = req.body?.raw ?? "";
  const { numbers, invalid, duplicatesRemoved } = parseNumbersRaw(raw);
  res.json({ numbers, valid: numbers.length, invalid: invalid.length, duplicatesRemoved });
});

app.get("/campaigns", async (_req, res) => {
  const campaigns = await loadCampaigns();
  res.json({ campaigns });
});

// ============================
// Upload Media
// ============================
app.post("/upload-media", uploadDisk.single("file"), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: "No file uploaded" });
    
    // Create absolute URL based on the incoming request connection
    const proto = req.headers["x-forwarded-proto"] || req.protocol;
    const host = req.headers["x-forwarded-host"] || req.get("host");
    const baseUrl = process.env.VITE_BACKEND_URL || `${proto}://${host}`;
    
    const mediaUrl = `${baseUrl}/images/${req.file.filename}`;
    res.json({ ok: true, mediaUrl });
  } catch (e) {
    console.error("Error uploading media:", e);
    res.status(500).json({ ok: false, error: "Error uploading media" });
  }
});

app.post("/campaigns", async (req, res) => {
  const campaigns = await loadCampaigns();
  const id = newId();
  const createdAt = nowIso();
  const payload = req.body || {};
  const isCustom = !!payload.isCustom;
  const message = String(payload.message || "");
  const name = String(payload.name || "Campaña");
  const mediaUrl = String(payload.mediaUrl || "");
  const delayMs = Number(payload.delayMs ?? 2500);

  let finalNumbers = [];
  if (isCustom) {
    const rawNums = Array.isArray(payload.numbers) ? payload.numbers : [];
    // Frontend manda array de { phone, scheduledAtLocal }
    finalNumbers = rawNums
      .map(n => ({
        phone: normalizeGtNumber(n.phone),
        scheduledAt: String(n.scheduledAt || n.scheduledAtLocal || ""),
        status: "scheduled",
        attempts: 0
      }))
      .filter(n => n.phone);
  } else {
    const nums = Array.isArray(payload.numbers) ? payload.numbers : [];
    const parsed = parseNumbersRaw(nums.join("\n"));
    finalNumbers = parsed.numbers;
  }

  const c = {
    id,
    name,
    message,
    mediaUrl,
    isCustom,
    scheduledAt: isCustom ? undefined : String(payload.scheduledAt || ""),
    delayMs,
    numbers: finalNumbers,
    status: "scheduled",
    createdAt,
    updatedAt: createdAt,
    attempts: 0,
  };

  campaigns.push(c);
  await saveCampaigns(campaigns);

  trackEvent("campaign_create", { name: c.name, recipients: c.numbers.length, custom: isCustom });

  res.json({ ok: true, campaign: c });
});

app.put("/campaigns/:id", async (req, res) => {
  const campaigns = await loadCampaigns();
  const id = String(req.params.id);
  const idx = campaigns.findIndex((x) => x.id === id);
  if (idx < 0) return res.status(404).json({ ok: false, error: "Not found" });

  const payload = req.body || {};
  const isCustom = campaigns[idx].isCustom || !!payload.isCustom;
  const message = String(payload.message || campaigns[idx].message);
  const name = String(payload.name || campaigns[idx].name);
  const mediaUrl = payload.mediaUrl !== undefined ? payload.mediaUrl : campaigns[idx].mediaUrl;
  const delayMs = Number(payload.delayMs ?? campaigns[idx].delayMs ?? 2500);

  let finalNumbers = [];
  if (isCustom) {
    const rawNums = Array.isArray(payload.numbers) ? payload.numbers : campaigns[idx].numbers || [];
    finalNumbers = rawNums
      .map(n => ({
        phone: normalizeGtNumber(n.phone || n),
        scheduledAt: String(n.scheduledAtLocal || n.scheduledAt || ""),
        status: n.status || "scheduled",
        attempts: n.attempts || 0
      }))
      .filter(n => n.phone);
  } else {
    const nums = Array.isArray(payload.numbers) ? payload.numbers : campaigns[idx].numbers || [];
    const parsed = parseNumbersRaw(nums.join("\n"));
    finalNumbers = parsed.numbers;
  }

  campaigns[idx] = {
    ...campaigns[idx],
    name,
    message,
    mediaUrl,
    delayMs,
    isCustom,
    scheduledAt: isCustom ? undefined : String(payload.scheduledAt || campaigns[idx].scheduledAt),
    numbers: finalNumbers,
    updatedAt: nowIso(),
  };

  await saveCampaigns(campaigns);
  res.json({ ok: true, campaign: campaigns[idx] });
});

app.delete("/campaigns/:id", async (req, res) => {
  try {
    await pool.query('DELETE FROM campaigns WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post("/campaigns/:id/toggle-pause", async (req, res) => {
  const campaigns = await loadCampaigns();
  const id = String(req.params.id);
  const c = campaigns.find((x) => x.id === id);
  if (!c) return res.status(404).json({ ok: false, error: "Not found" });

  if (c.status === "scheduled") {
    c.status = "paused";
  } else if (c.status === "paused") {
    c.status = "scheduled";
  } else {
    return res.status(400).json({ ok: false, error: "Cannot pause/resume a campaign in status: " + c.status });
  }

  c.updatedAt = nowIso();
  await saveCampaigns(campaigns);
  res.json({ ok: true, campaign: c });
});

app.post("/campaigns/:id/run", async (req, res) => {
  const campaigns = await loadCampaigns();
  const id = String(req.params.id);
  const c = campaigns.find((x) => x.id === id);
  if (!c) return res.status(404).json({ ok: false, error: "Not found" });

  try {
    c.status = "processing";
    c.lastAttemptAt = nowIso();
    c.attempts = Number(c.attempts || 0) + 1;
    await saveCampaigns(campaigns);

    let numsToBroadcast = [];
    const now = Date.now();

    if (c.isCustom) {
      // Respect schedules even when manually triggered
      const dueNumbers = (c.numbers || []).filter(n => 
        n.status !== "sent" && 
        n.status !== "failed" && 
        n.scheduledAt && 
        new Date(n.scheduledAt).getTime() <= now
      );
      
      if (dueNumbers.length === 0) {
        return res.json({ ok: true, message: "No hay números programados para este momento." });
      }
      
      numsToBroadcast = dueNumbers.map(n => n.phone);
      
      const result = await builderBotBroadcast({
        campaignId: c.id,
        message: c.message,
        numbers: numsToBroadcast,
        delayMs: c.delayMs,
        mediaUrl: c.mediaUrl
      });

      dueNumbers.forEach(n => { 
        n.status = "sent"; 
        n.attempts = (n.attempts || 0) + 1; 
        n.lastAttemptAt = nowIso();
      });

      c.stats = c.stats || { sent: 0, failed: 0 };
      c.stats.sent = (c.stats.sent || 0) + (result?.sent || 0);
      c.stats.failed = (c.stats.failed || 0) + (result?.failedCount || 0);

      if (c.numbers.every(n => n.status === "sent" || n.status === "failed")) {
        c.status = "sent";
      }
      
      c.updatedAt = nowIso();
      await saveCampaigns(campaigns);
      return res.json({ ok: true, result });
    } else {
      // Standard campaign behavior...
      numsToBroadcast = c.numbers;
      const result = await builderBotBroadcast({
        campaignId: c.id,
        message: c.message,
        numbers: numsToBroadcast,
        delayMs: c.delayMs,
        mediaUrl: c.mediaUrl
      });

      c.status = "sent";
      c.stats = { sent: result?.sent ?? undefined, failed: result?.failedCount ?? undefined };
      c.updatedAt = nowIso();
      await saveCampaigns(campaigns);
      return res.json({ ok: true, result });
    }
  } catch (e) {
    c.status = "failed";
    if (c.isCustom) {
      c.numbers.forEach(n => { n.status = "failed"; n.attempts = (n.attempts || 0) + 1; });
    }
    c.updatedAt = nowIso();
    await saveCampaigns(campaigns);
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

async function runCampaignsTick() {
  const campaigns = await loadCampaigns();
  const now = Date.now();
  let processed = 0;

  for (const c of campaigns) {
    // Both standard and custom campaigns stay "scheduled" until fully sent
    if (c.status !== "scheduled" && c.status !== "processing") continue;

    if (c.isCustom) {
      const dueNumbers = c.numbers.filter(n => n.status !== "sent" && n.status !== "failed" && n.scheduledAt && new Date(n.scheduledAt).getTime() <= now);
      if (dueNumbers.length > 0) {
        try {
          const numsToBroadcast = dueNumbers.map(n => n.phone);
          console.log(`[Campaign Custom] Executing ${c.id} - ${c.name} for ${numsToBroadcast.length} numbers`);
          
          c.lastAttemptAt = nowIso();
          c.updatedAt = nowIso();
          await saveCampaigns(campaigns);

          const result = await builderBotBroadcast({
            campaignId: c.id,
            message: c.message,
            numbers: numsToBroadcast,
            delayMs: c.delayMs,
            mediaUrl: c.mediaUrl
          });

          dueNumbers.forEach(n => {
             n.status = "sent";
             n.attempts = (n.attempts || 0) + 1;
             n.lastAttemptAt = nowIso();
          });

          c.stats = c.stats || { sent: 0, failed: 0 };
          c.stats.sent = (c.stats.sent || 0) + (result?.sent || 0);
          c.stats.failed = (c.stats.failed || 0) + (result?.failedCount || 0);
          
          if (c.numbers.every(n => n.status === "sent" || n.status === "failed")) {
            c.status = "sent";
          }
          console.log(`[Campaign Custom] Finished ${c.id}: sent ${result?.sent}, failed ${result?.failedCount}`);
          c.updatedAt = nowIso();
          processed++;
          await saveCampaigns(campaigns);
        } catch (e) {
          console.error(`[Campaign Custom] Critical Failure ${c.id}:`, e);
          dueNumbers.forEach(n => {
             n.status = "failed";
             n.attempts = (n.attempts || 0) + 1;
             n.lastError = e.message;
          });
          if (c.numbers.every(n => n.status === "sent" || n.status === "failed")) {
            c.status = "failed";
          }
          c.updatedAt = nowIso();
          await saveCampaigns(campaigns);
        }
      }
    } else {
      const t = new Date(c.scheduledAt).getTime();
      if (!t || t > now) continue;

      try {
        console.log(`[Campaign] Executing ${c.id} - ${c.name}`);
        c.status = "processing";
        c.lastAttemptAt = nowIso();
        c.attempts = Number(c.attempts || 0) + 1;
        c.updatedAt = nowIso();
        await saveCampaigns(campaigns);

        const result = await builderBotBroadcast({
          campaignId: c.id,
          message: c.message,
          numbers: c.numbers,
          delayMs: c.delayMs,
          mediaUrl: c.mediaUrl
        });

        c.status = "sent";
        c.stats = { sent: result?.sent ?? undefined, failed: result?.failedCount ?? undefined };
        c.updatedAt = nowIso();
        processed++;
        await saveCampaigns(campaigns);
      } catch (e) {
        console.error(`[Campaign] Failed ${c.id}:`, e);
        c.status = "failed";
        c.updatedAt = nowIso();
        await saveCampaigns(campaigns);
      }
    }
  }
  return processed;
}

app.get("/cron/tick", async (_req, res) => {
  const processed = await runCampaignsTick();
  res.json({ ok: true, processed });
});

// Auto-run every 60s
setInterval(() => {
  runCampaignsTick().catch(err => console.error("[Cron] Error in auto-tick:", err));
}, 60 * 1000);

// Sheets Config
app.get("/sheets/test", async (_req, res) => {
  const url = process.env.SHEETS_WEBAPP_URL || "";
  if (!url) return res.json({ ok: false, error: "Falta SHEETS_WEBAPP_URL en backend/.env" });
  
  // Try to ping it with a simple GET or just return OK
  // Google Apps Script Web Apps often redirect or need specific params
  res.json({ ok: true, urlConfigured: true, url }); 
});

app.get("/api/config/builderbot", async (_req, res) => {
  res.json({ 
    ok: true, 
    configured: !!process.env.BUILDERBOT_API_KEY,
    // We don't send the key itself for security, just that it's there
    // but the UI might need to know the broadcast URL if it sends directly.
    // However, we want it to go THROUGH the backend.
  });
});

app.post("/api/config/sheets", async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "Falta url" });

    // 1. Update in memory env
    process.env.SHEETS_WEBAPP_URL = url;

    // 2. Update .env file
    const envPath = path.join(__dirname, ".env");
    let envContent = "";
    if (fs.existsSync(envPath)) {
      envContent = await fsp.readFile(envPath, "utf-8");
    }

    if (envContent.includes("SHEETS_WEBAPP_URL=")) {
      // Replace existing
      envContent = envContent.replace(/SHEETS_WEBAPP_URL=.*/g, `SHEETS_WEBAPP_URL=${url}`);
    } else {
      // Append
      envContent += `\nSHEETS_WEBAPP_URL=${url}\n`;
    }

    await fsp.writeFile(envPath, envContent, "utf-8");
    
    res.json({ ok: true });
  } catch (e) {
    console.error("Error saving sheets config:", e);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/sheets/numbers (Fetch numbers from Google Sheets)
app.get("/api/sheets/numbers", async (req, res) => {
  try {
    const url = process.env.SHEETS_WEBAPP_URL;
    if (!url) return res.status(400).json({ error: "Falta SHEETS_WEBAPP_URL en backend/.env" });

    // Assuming the GAS script has a doGet handling ?action=getNumbers or similar
    // We will pass action=getNumbers just in case the App Script expects it
    const reqUrl = new URL(url);
    reqUrl.searchParams.append("action", "getNumbers");
    
    const axios = (await import("axios")).default;
    const response = await axios.get(reqUrl.toString());
    
    // Attempt to parse out numbers from response data
    // Assuming the GAS returns an array of strings or { numbers: [...] }
    let numbers = [];
    if (Array.isArray(response.data)) {
      numbers = response.data;
    } else if (response.data && Array.isArray(response.data.numbers)) {
      numbers = response.data.numbers;
    } else if (response.data && response.data.data && Array.isArray(response.data.data)) {
        numbers = response.data.data;
    } else {
        // Just take whatever we got if it's not clear, though it might break
        numbers = response.data;
    }

    res.json({ ok: true, numbers });
  } catch (e) {
    console.error("Error fetching sheets numbers:", e);
    // Google scripts sometimes return HTML (e.g., login page) if not 'Anyone'
    res.status(500).json({ error: "Error de red al intentar obtener números desde Google Sheets. Verifica permisos 'Anyone' del Web App." });
  }
});

// ============================
// CATALOGO (persistente)
// ============================
const CATALOG_DIR = path.join(__dirname, "data");
const CATALOG_PATH = path.join(CATALOG_DIR, "catalog.json");

async function ensureCatalogDir() {
  await fsp.mkdir(CATALOG_DIR, { recursive: true });
}

async function readCatalog() {
  try {
    const res = await pool.query('SELECT * FROM products ORDER BY name ASC');
    return res.rows.map(r => ({
      ...r,
      imageUrl: r.image_url
    }));
  } catch(e) { return []; }
}
async function saveCatalog(items) {
  try {
    for (const p of items) {
      await pool.query(
        'INSERT INTO products (id, name, price, category, stock, image_url) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, price=EXCLUDED.price, category=EXCLUDED.category, stock=EXCLUDED.stock, image_url=EXCLUDED.image_url',
        [p.id, p.name, p.price, p.category, p.stock, p.imageUrl]
      );
    }
  } catch(e) { console.error(e); }
}

// GET catalog
app.get("/catalog", async (_req, res) => {
  const items = await readCatalog();
  res.json(items);
});

// POST catalog (create)
app.post("/catalog", async (req, res) => {
  try {
    const { name, price, category, stock, imageUrl } = req.body || {};
    if (!name) return res.status(400).json({ ok: false, error: "Missing name" });

    const newItem = {
      id: randomUUID(),
      name: String(name).trim(),
      price: Number(price) || 0,
      category: String(category || "General").trim(),
      stock: Number(stock) || 0,
      imageUrl: imageUrl || "https://alise-flawless-gallingly.ngrok-free.dev",
      raw: "Manual Entry"
    };

    const items = await readCatalog();
    items.push(newItem);
    await saveCatalog(items);
    
    trackEvent("catalog_create", { name: newItem.name });

    res.status(201).json({ ok: true, item: newItem });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// PUT catalog/:id (update)
app.put("/catalog/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, price, category, stock, imageUrl } = req.body || {};

    const items = await readCatalog();
    const idx = items.findIndex(p => p.id === id);
    if (idx === -1) return res.status(404).json({ ok: false, error: "Not found" });

    const updates = {
      name: name !== undefined ? String(name).trim() : items[idx].name,
      price: price !== undefined ? Number(price) : items[idx].price,
      category: category !== undefined ? String(category).trim() : items[idx].category,
      stock: stock !== undefined ? Number(stock) : items[idx].stock,
      imageUrl: imageUrl !== undefined ? imageUrl : items[idx].imageUrl,
    };
    items[idx] = { ...items[idx], ...updates };
    await saveCatalog(items);

    trackEvent("catalog_update", { name: items[idx].name, id });

    res.json({ ok: true, item: items[idx] });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// DELETE catalog/:id
app.delete("/catalog/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const items = await readCatalog();
    const newItems = items.filter(p => p.id !== id);
    
    if (newItems.length === items.length) {
      return res.status(404).json({ ok: false, error: "Not found" });
    }

    await saveCatalog(newItems);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// POST upload PDF (file|pdf)
app.post(
  "/catalog/upload",
  upload.fields([
    { name: "file", maxCount: 1 },
    { name: "pdf", maxCount: 1 },
    { name: "archivo", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const file =
        req.files?.file?.[0] ||
        req.files?.pdf?.[0] ||
        req.files?.archivo?.[0];

      if (!file) {
        return res.status(400).json({
          ok: false,
          error: "No se ha subido ningún archivo. Usa campo 'file', 'archivo' o 'pdf'.",
        });
      }

      // 1. Parse PDF per page (Hosted Images Logic)
      const pages = await parsePdfPages(file.buffer);
      console.log(`[Upload] Processing ${pages.length} pages...`);
      
      // 1.1 Extract Images (Now Active)
      let images = [];
      try {
        console.log("[Upload] Extracting images...");
        images = await extractImagesFromPdf(file.buffer);
        console.log(`[Upload] Extracted ${images.length} images.`);
      } catch (e) {
        console.error("[Upload] Image extraction failed:", e);
      }

      const { folderName } = req.body;
      const newItems = [];
      
      // 2. Sequential Processing (Regex Mode + Image Linking)
      for (let i = 0; i < pages.length; i++) {
        const text = pages[i];
        console.log(`[Upload] Page ${i + 1} text preview:`, text.slice(0, 500)); 
        const extracted = extractItemsRegex(text); 
        
        // Image assignment: osposgt.com vs PDF Extraction
        let pageImage;
        if (folderName) {
           // Pattern: https://osposgt.com/Catalogos/[CARPETA]/page-[PAGINA_4_DIGITOS].jpg
           const folderClean = folderName.trim();
           const pagePadded = String(i + 1).padStart(4, "0");
           pageImage = `https://osposgt.com/Catalogos/${folderClean}/page-${pagePadded}.jpg`;
        } else {
           pageImage = images[i] ? `${process.env.PUBLIC_URL || ""}${images[i]}` : "https://placehold.co/400?text=Sin+Imagen";
        }

        // Enrich items
        const enriched = extracted.map((item, idx) => ({
             id: randomUUID(),
             name: item.name,
             price: item.price,
             category: "General",
             stock: 0,
             imageUrl: pageImage, 
             code: item.code,
             raw: item.raw || "Regex Extracted"
        }));
        
        newItems.push(...enriched);
      }
      
      console.log(`[Upload] Extracted ${newItems.length} items total.`);

      // Read existing
      const existingItems = await readCatalog();
      
      // Merge unique
      const uniqueItems = [...newItems];
      const seen = new Set(newItems.map(it => `${it.name}-${it.price}`));

      for (const old of existingItems) {
        if (!seen.has(`${old.name}-${old.price}`)) {
           uniqueItems.push(old);
        }
      }

      await saveCatalog(uniqueItems);
      
      trackEvent("pdf_upload", { pages: pages.length, items: newItems.length });

      return res.json({ 
        ok: true, 
        count: uniqueItems.length, 
        added: newItems.length, 
        sample: uniqueItems.slice(0, 5) 
      });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e?.message || String(e) });
    }
  }
);


// POST /api/send-message (Manual Send from Catalog)
app.post("/api/send-message", async (req, res) => {
  try {
    let { number, message, mediaUrl } = req.body;
    if (!number || !message) return res.status(400).json({ error: "Faltan datos" });

    // Fix localhost -> public URL
    const publicUrl = process.env.PUBLIC_URL;
    if (publicUrl && mediaUrl) {
      try {
          if (mediaUrl.startsWith("/")) {
              // Relative path: prepend public URL
              mediaUrl = publicUrl.replace(/\/$/, "") + mediaUrl;
          } else if (mediaUrl.includes("localhost") || mediaUrl.includes("127.0.0.1")) {
              // Localhost URL: replace origin with public URL
              const u = new URL(mediaUrl);
              mediaUrl = publicUrl.replace(/\/$/, "") + u.pathname + u.search; // Retain query params if any
          }
      } catch (e) {
          console.error("Error formatting mediaUrl:", e);
      }
    }

    // Re-use builderBotBroadcast for single message
    // It accepts: { message, numbers: [], mediaUrl? }
    const result = await builderBotBroadcast({
      message,
      numbers: [number], // wrap in array
      mediaUrl: mediaUrl || undefined
    });

    res.json({ ok: true, result });
  } catch (e) {
    console.error("Error /api/send-message:", e?.response?.data || e);
    
    // Fallback: Try Text Only if image failed and it's a media error
    if (String(e?.message).includes("400") && mediaUrl) {
      console.log("[BuilderBot] Retrying without image due to error...");
      try {
        await builderBotBroadcast({ message: message + "\n(Imagen no disponible por error de red)", numbers: [number] });
        res.json({ ok: true, warned: "Image failed, sent text only" });
        return;
      } catch (e2) {
        console.error("Retry failed too:", e2);
      }
    }

    res.status(500).json({ error: e.message });
  }
});

app.post("/api/orders", async (req, res) => {
  try {
    console.log("[POST /api/orders] Incoming body:", JSON.stringify(req.body, null, 2));

    // Adapter for BuilderBot payload
    // If BuilderBot sends { customerName, ... } directly, great.
    // If it behaves differently, we might need to map it.
    // user's guide says: { customerName: "{{name}}", ... } so it matches handleRecordOrder args.

    const result = await handleRecordOrder(req.body);
    if (!result.ok) {
      console.error("[POST /api/orders] Error recording:", result.error);
      return res.status(500).json(result);
    }
    console.log("[POST /api/orders] Success:", result.recorded);
    res.json(result);
  } catch (e) {
    console.error("Error in /api/orders:", e);
    res.status(500).json({ error: e.message });
  }
});

// ============================
//  Serve Frontend in Production
// ============================
const distPath = path.join(__dirname, "..", "dist");
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}


app.listen(PORT, () => {
  console.log(`Backend listo en http://localhost:${PORT}`);
});

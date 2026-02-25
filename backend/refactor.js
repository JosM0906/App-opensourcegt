import fs from 'fs';

let content = fs.readFileSync('server.js', 'utf8');

// 1. Appends pool import
if (!content.includes("import pool from")) {
    content = content.replace('import fsp from "fs/promises";', 'import fsp from "fs/promises";\nimport pool from "./db.js";');
}

// 2. LOGS
content = content.replace(
`let logs = [];

async function loadLogs() {
  try {
    const raw = await fsp.readFile(LOGS_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    logs = Array.isArray(parsed?.logs) ? parsed.logs : Array.isArray(parsed) ? parsed : [];
  } catch {
    logs = [];
  }
}
async function saveLogs() {
  try {
    await fsp.writeFile(LOGS_PATH, JSON.stringify({ logs }, null, 2), "utf-8");
  } catch (e) {
    console.error("Error guardando logs:", e?.message || e);
  }
}`,
`let logs = [];

async function loadLogs() {
  try {
    const res = await pool.query('SELECT * FROM logs ORDER BY timestamp DESC LIMIT 500');
    logs = res.rows.map(r => ({
      at: r.timestamp.toISOString(),
      phone: r.phone,
      number: r.number || r.phone,
      name: r.name,
      message: r.message,
      role: r.role,
      type: r.role === 'user' ? 'in' : 'out',
      text_in: r.text_in,
      text_out: r.text_out
    }));
  } catch(e) {
    console.error("Error loadLogs:", e);
    logs = [];
  }
}
async function saveLogs() { 
  // No-op, inserts are handled individually now 
}
async function insertLog(l) {
  try {
    await pool.query(
      \`INSERT INTO logs (phone, number, name, message, role, timestamp, text_in, text_out)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)\`,
      [l.phone, l.number || l.phone, l.name, l.message, l.role, new Date(l.at || l.timestamp || Date.now()), l.text_in, l.text_out]
    );
    await loadLogs(); // Re-sync memory cache for metrics/logs view
  } catch(e) {
    console.error("Error inserting log:", e);
  }
}`
);

// Updates to logs.unshift => insertLog
// In /api/chat-log mode 2:
content = content.replace(
`        logs.unshift({
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
        });`,
`        await insertLog({
            at: new Date(now - 2000).toISOString(),
            phone: phone || "",
            name: name || "",
            role: 'user',
            text_in: question,
            text_out: "",
            number: phone
        });

        await insertLog({
            at: new Date(now).toISOString(),
            phone: phone || "",
            name: name || "",
            role: 'model',
            text_in: "",
            text_out: answer,
            number: phone
        });`
);

content = content.replace(
`        const newLog = {
          at: new Date().toISOString(),
          phone: phone || "",
          name: name || "",
          type: role === 'user' ? 'in' : 'out', // 'in' is important for metrics
          text_in: role === 'user' ? message : "",
          text_out: role !== 'user' ? message : "",
          number: phone // metrics logic uses 'number' or 'phone'
        };
        logs.unshift(newLog);`,
`        const newLog = {
          at: new Date().toISOString(),
          phone: phone || "",
          name: name || "",
          role: role,
          text_in: role === 'user' ? message : "",
          text_out: role !== 'user' ? message : "",
          number: phone
        };
        await insertLog(newLog);`
);

content = content.replace(
`    logs.unshift({
      at: new Date().toISOString(),
      text_in: text,
      text_out: out,
    });`,
`    await insertLog({
      at: new Date().toISOString(),
      role: 'model', // Assuming this is AI response
      text_in: text,
      text_out: out,
    });`
);


// 3. EVENTS
content = content.replace(
`async function loadEvents() {
  try {
    ensureDataDir();
    const raw = await fsp.readFile(EVENTS_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function saveEvents(events) {
  ensureDataDir();
  await fsp.writeFile(EVENTS_PATH, JSON.stringify(events, null, 2), "utf-8");
}`,
`async function loadEvents() {
  try {
    const res = await pool.query('SELECT * FROM events ORDER BY timestamp ASC');
    return res.rows.map(r => ({
      id: r.id,
      type: r.type,
      timestamp: r.timestamp.toISOString(),
      metadata: r.metadata
    }));
  } catch {
    return [];
  }
}

async function saveEvents(events) {}`
);

content = content.replace(
`    events.push(newEvent);
    // Keep last 1000 events
    if (events.length > 1000) events.shift();
    await saveEvents(events);`,
`    await pool.query('INSERT INTO events (type, timestamp, metadata) VALUES ($1, $2, $3)', [type, new Date(), JSON.stringify(metadata)]);`
);


// 4. ORDERS
content = content.replace(
`async function loadOrders() {
  try {
    ensureDataDir();
    if (!fs.existsSync(ORDERS_PATH)) return [];
    const raw = await fsp.readFile(ORDERS_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveOrders(orders) {
  ensureDataDir();
  await fsp.writeFile(ORDERS_PATH, JSON.stringify(orders, null, 2), "utf-8");
}`,
`async function loadOrders() {
  try {
    const res = await pool.query('SELECT * FROM orders ORDER BY timestamp ASC');
    return res.rows.map(r => ({
      id: r.id,
      timestamp: r.timestamp.toISOString(),
      createdAt: r.timestamp.toISOString(),
      customerName: r.customer_name,
      items: r.items,
      total: Number(r.total),
      status: r.status
    }));
  } catch {
    return [];
  }
}

async function saveOrders(orders) {}`
);

content = content.replace(
`    // 1. Save locally
    orders.push(newOrder);
    await saveOrders(orders);`,
`    // 1. Save to DB
    await pool.query(
      'INSERT INTO orders (id, timestamp, customer_name, items, total, status) VALUES ($1, $2, $3, $4, $5, $6)',
      [newOrder.id, new Date(newOrder.timestamp), newOrder.customerName, JSON.stringify(newOrder.items), newOrder.total, newOrder.status]
    );`
);


// 5. CATALOG
content = content.replace(
`async function readCatalog() {
  try {
    const raw = await fsp.readFile(CATALOG_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveCatalog(items) {
  await ensureCatalogDir();
  await fsp.writeFile(CATALOG_PATH, JSON.stringify(items, null, 2), "utf-8");
}`,
`async function readCatalog() {
  try {
    const res = await pool.query('SELECT * FROM products');
    return res.rows.map(r => ({
      id: r.id,
      name: r.name,
      price: Number(r.price),
      category: r.category,
      stock: r.stock,
      imageUrl: r.image_url
    }));
  } catch {
    return [];
  }
}

async function saveCatalog(items) {
  // Sync the whole array (not ideal for huge catalogs, but matches old behavior)
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM products');
    for (const p of items) {
       await client.query(
         'INSERT INTO products (id, name, price, category, stock, image_url) VALUES ($1, $2, $3, $4, $5, $6)',
         [p.id, p.name, p.price, p.category, p.stock, p.imageUrl]
       );
    }
    await client.query('COMMIT');
  } catch(e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}`
);


// 6. CAMPAIGNS
content = content.replace(
`async function loadCampaigns() {
  try {
    ensureDataDir();
    const raw = await fsp.readFile(CAMPAIGNS_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.campaigns) ? parsed.campaigns : Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveCampaigns(campaigns) {
  ensureDataDir();
  await fsp.writeFile(CAMPAIGNS_PATH, JSON.stringify({ campaigns }, null, 2), "utf-8");
}`,
`async function loadCampaigns() {
  try {
    const res = await pool.query('SELECT * FROM campaigns ORDER BY created_at DESC');
    return res.rows.map(r => ({
      id: r.id,
      name: r.name,
      message: r.message,
      mediaUrl: r.media_url,
      isCustom: r.is_custom,
      scheduledAt: r.scheduled_at ? r.scheduled_at.toISOString() : undefined,
      delayMs: r.delay_ms,
      numbers: r.numbers,
      status: r.status,
      createdAt: r.created_at.toISOString(),
      updatedAt: r.updated_at.toISOString(),
      lastAttemptAt: r.last_attempt_at ? r.last_attempt_at.toISOString() : undefined,
      attempts: r.attempts,
      stats: { sent: r.stats_sent, failed: r.stats_failed }
    }));
  } catch(e) {
    console.error("loadCampaigns Error", e);
    return [];
  }
}

async function saveCampaigns(campaigns) {
  // Overwriting entire DB for simplicity, matching original JSON behavior
  // For production with concurrent access this should be changed to targeted updates
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM campaigns');
    for (const c of campaigns) {
       await client.query(
         \`INSERT INTO campaigns (id, name, message, media_url, is_custom, scheduled_at, delay_ms, numbers, status, created_at, updated_at, last_attempt_at, attempts, stats_sent, stats_failed)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)\`,
         [
           c.id, c.name, c.message, c.mediaUrl, c.isCustom, 
           c.scheduledAt ? new Date(c.scheduledAt) : null, c.delayMs, JSON.stringify(c.numbers || []), c.status, 
           c.createdAt ? new Date(c.createdAt) : new Date(), c.updatedAt ? new Date(c.updatedAt) : new Date(), 
           c.lastAttemptAt ? new Date(c.lastAttemptAt) : null, c.attempts || 0, 
           c.stats?.sent || 0, c.stats?.failed || 0
         ]
       );
    }
    await client.query('COMMIT');
  } catch(e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}`
);

// 7. Render Frontend for Production
content = content.replace(
`app.listen(PORT, () => {
  console.log(\`Backend listo en http://localhost:\${PORT}\`);
});`,
`// Serve static frontend in production
app.use(express.static(path.join(__dirname, '../dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

app.listen(PORT, () => {
  console.log(\`Backend listo en http://localhost:\${PORT}\`);
});`
);

fs.writeFileSync('server.js', content, 'utf8');

console.log("Rewrite complete!");

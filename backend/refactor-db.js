import fs from 'fs';

let content = fs.readFileSync('server.js', 'utf8');

// 1. Remove JSON persistence paths & variables
content = content.replace(/const LOGS_PATH.*\nlet logs.*\n/g, '');
content = content.replace(/const EVENTS_PATH.*\n/g, '');
content = content.replace(/const ORDERS_PATH.*\n/g, '');
content = content.replace(/const CAMPAIGNS_PATH.*\n/g, '');
content = content.replace(/const CATALOG_PATH.*\n/g, '');
content = content.replace(/const CATALOG_DIR.*\nconst CATALOG_PATH.*\n/g, '');

// 2. Replace Logs functions
content = content.replace(/async function loadLogs\(\) \{[\s\S]*?async function saveLogs\(\) \{[\s\S]*?\n\}/g, 
`let logs = [];
async function loadLogs() {
  try {
    const res = await pool.query('SELECT * FROM logs ORDER BY timestamp DESC LIMIT 1000');
    logs = res.rows.map(r => ({
      at: r.timestamp.toISOString(),
      phone: r.phone,
      number: r.number,
      name: r.name,
      type: r.role === 'user' ? 'in' : 'out',
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
}`);

// 3. Replace Events functions
content = content.replace(/async function loadEvents\(\) \{[\s\S]*?async function saveEvents\(events\) \{[\s\S]*?\n\}/g, 
`async function loadEvents() {
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
}`);

// 4. Replace Orders
content = content.replace(/async function loadOrders\(\) \{[\s\S]*?async function saveOrders\(orders\) \{[\s\S]*?\n\}/g, 
`async function loadOrders() {
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
}`);

// 5. Replace Campaigns
content = content.replace(/async function loadCampaigns\(\) \{[\s\S]*?async function saveCampaigns\(campaigns\) \{[\s\S]*?\n\}/g, 
`async function loadCampaigns() {
  try {
    const res = await pool.query('SELECT * FROM campaigns ORDER BY created_at DESC');
    return res.rows.map(r => ({
      ...r,
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
        \`INSERT INTO campaigns (id, name, message, media_url, is_custom, scheduled_at, delay_ms, numbers, status, created_at, updated_at, last_attempt_at, attempts, stats_sent, stats_failed)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         ON CONFLICT (id) DO UPDATE SET 
          name=EXCLUDED.name, message=EXCLUDED.message, media_url=EXCLUDED.media_url, is_custom=EXCLUDED.is_custom, scheduled_at=EXCLUDED.scheduled_at, delay_ms=EXCLUDED.delay_ms, numbers=EXCLUDED.numbers, status=EXCLUDED.status, updated_at=EXCLUDED.updated_at, last_attempt_at=EXCLUDED.last_attempt_at, attempts=EXCLUDED.attempts, stats_sent=EXCLUDED.stats_sent, stats_failed=EXCLUDED.stats_failed\`,
        [c.id, c.name, c.message, c.mediaUrl, c.isCustom, c.scheduledAt ? new Date(c.scheduledAt) : null, c.delayMs, JSON.stringify(c.numbers||[]), c.status, c.createdAt ? new Date(c.createdAt) : new Date(), c.updatedAt ? new Date(c.updatedAt) : new Date(), c.lastAttemptAt ? new Date(c.lastAttemptAt) : null, c.attempts || 0, c.stats?.sent || 0, c.stats?.failed || 0]
      );
    }
  } catch(e) { console.error(e); }
}`);

// 6. Replace Catalog
content = content.replace(/async function readCatalog\(\) \{[\s\S]*?async function saveCatalog\(items\) \{[\s\S]*?\n\}/g, 
`async function readCatalog() {
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
}`);

// Delete functions also need DB operations
content = content.replace(/app\.delete\("\/api\/catalog\/:id", async \(req, res\) => \{[\s\S]*?\}\);/,
`app.delete("/api/catalog/:id", async (req, res) => {
  try {
    await pool.query('DELETE FROM products WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});`);

content = content.replace(/app\.delete\("\/campaigns\/:id", async \(req, res\) => \{[\s\S]*?\}\);/,
`app.delete("/campaigns/:id", async (req, res) => {
  try {
    await pool.query('DELETE FROM campaigns WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});`);

content = content.replace(/app\.delete\("\/api\/orders\/:id", async \(req, res\) => \{[\s\S]*?\}\);/,
`app.delete("/api/orders/:id", async (req, res) => {
  try {
    await pool.query('DELETE FROM orders WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});`);

fs.writeFileSync('server.js', content);
console.log("server.js updated!");

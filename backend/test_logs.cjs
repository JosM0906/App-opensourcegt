require('dotenv').config();
const {Pool} = require('pg');
const pool = new Pool({connectionString: process.env.DATABASE_URL});
pool.query('SELECT * FROM logs ORDER BY timestamp DESC LIMIT 10').then(res => {
  console.log(res.rows.map(r => ({
    number: r.number,
    role: r.role,
    type: r.role === 'user' ? 'in' : 'out',
    at: r.timestamp
  })));
}).finally(() => pool.end());

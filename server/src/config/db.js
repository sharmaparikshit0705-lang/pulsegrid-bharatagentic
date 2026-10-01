import pg from 'pg';

const pool = new pg.Pool({
  host: process.env.PGHOST || 'localhost',
  port: +(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || 'pulsegrid',
  user: process.env.PGUSER || 'pulsegrid',
  password: process.env.PGPASSWORD,
  max: 10,
  idleTimeoutMillis: 30_000,
});

pool.on('error', (err) => {
  console.error('[pg] unexpected pool error:', err.message);
});

/** Thin query helper: q(text, params) -> rows */
export const q = async (text, params) => (await pool.query(text, params)).rows;
export default pool;

/**
 * One-shot schema initializer: reads db/init.sql and applies it.
 * Usage: npm run db:init   (requires the database to exist and be PostGIS-ready:
 *   CREATE DATABASE pulsegrid;  -- postgis extension is created by init.sql)
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pool from '../config/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sqlPath = path.resolve(__dirname, '../../db/init.sql');

try {
  const sql = fs.readFileSync(sqlPath, 'utf8');
  await pool.query(sql);
  console.info('✅ PulseGrid schema applied (PostGIS tables, triggers, seed data).');
  await pool.end();
} catch (err) {
  console.error('❌ Schema init failed:', err.message);
  process.exit(1);
}

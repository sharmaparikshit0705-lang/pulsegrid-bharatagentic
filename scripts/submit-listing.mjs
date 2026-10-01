#!/usr/bin/env node
/**
 * Submits the aiKart marketplace listing (BharatAgentic Method 2).
 *
 * The aiKart "API Endpoints Listing" walkthrough describes submitting an agent
 * to the marketplace programmatically: prepare the agent information (product
 * details, description, category, target industries, pricing, team, media URLs)
 * and POST it to the agent-listing endpoint, which returns an agent_id and a
 * listing URL.
 *
 * DRY RUN BY DEFAULT — it prints exactly what it would send and the equivalent
 * curl command, and sends nothing. Add --send to actually POST.
 *
 * Required for --send:
 *   AIKART_API_URL   the agent-listing endpoint (from your aiKart dashboard/API docs)
 *   AIKART_API_KEY   your seller API token
 *
 * Placeholders in aikart-listing.json ({{AGENT_ENDPOINT}}, {{REPO_URL}}, ...)
 * are substituted from the environment, so no secrets or URLs live in the file.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const listingPath = path.join(root, 'aikart-listing.json');
const send = process.argv.includes('--send');

/* ------------------------- substitute {{PLACEHOLDERS}} ------------------------- */
const MAP = {
  AGENT_ENDPOINT: process.env.AGENT_ENDPOINT,
  DASHBOARD_URL: process.env.DASHBOARD_URL,
  REPO_URL: process.env.REPO_URL,
  VIDEO_URL: process.env.VIDEO_URL,
  LOGO_URL: process.env.LOGO_URL,
  COVER_URL: process.env.COVER_URL,
  TEAM_NAME: process.env.TEAM_NAME,
  TEAM_MEMBERS: process.env.TEAM_MEMBERS,
  CONTACT_EMAIL: process.env.CONTACT_EMAIL,
};

const raw = fs.readFileSync(listingPath, 'utf8');
const unresolved = new Set();
const filled = raw.replace(/\{\{([A-Z_]+)\}\}/g, (_m, key) => {
  const v = MAP[key];
  if (v == null || v === '') {
    unresolved.add(key);
    return `{{${key}}}`;
  }
  return v;
});

const payload = JSON.parse(filled);
delete payload._comment;

/* ------------------------------- report ------------------------------- */
const missingCritical = ['AGENT_ENDPOINT'].filter((k) => unresolved.has(k));

console.log('aiKart listing — Method 2 submission');
console.log('====================================');
console.log(`mode            : ${send ? 'SEND' : 'DRY RUN (nothing is sent)'}`);
console.log(`listing file    : ${path.relative(root, listingPath)}`);
console.log(`name            : ${payload.name}`);
console.log(`category        : ${payload.category}`);
console.log(`endpoint        : ${payload.agent_endpoint}`);
console.log(`target industries: ${payload.target_industries.length}`);
console.log(`capabilities    : ${payload.capabilities.length}`);
console.log('');

if (unresolved.size) {
  console.log('Placeholders still to fill (set them as environment variables):');
  [...unresolved].sort().forEach((k) => console.log(`  - ${k}`));
  console.log('');
}

if (missingCritical.length) {
  console.log(`❌ ${missingCritical.join(', ')} must be set — that is the hosted agent the marketplace will call.`);
  process.exit(1);
}

console.log('Payload to POST (JSON):');
console.log(JSON.stringify(payload, null, 2).slice(0, 1200) + '\n  … (truncated)\n');

console.log('Equivalent curl:');
console.log(`  curl -X POST "$AIKART_API_URL" \\`);
console.log(`    -H "Authorization: Bearer $AIKART_API_KEY" \\`);
console.log(`    -H "content-type: application/json" \\`);
console.log(`    -d @aikart-listing.json`);

if (!send) {
  console.log('\nDry run complete. Re-run with --send once your endpoint is live and your API key is set.');
  process.exit(0);
}

/* -------------------------------- send -------------------------------- */
const url = process.env.AIKART_API_URL;
const key = process.env.AIKART_API_KEY;
if (!url || !key) {
  console.log('\n❌ --send needs AIKART_API_URL and AIKART_API_KEY in the environment.');
  process.exit(1);
}

const res = await fetch(url, {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
  body: JSON.stringify(payload),
});

const text = await res.text();
console.log(`\nHTTP ${res.status}`);
try {
  const json = JSON.parse(text);
  console.log(JSON.stringify(json, null, 2));
  if (json.agent_id) console.log(`\n✅ Listing created — agent_id: ${json.agent_id}`);
  if (json.listing_url || json.url) console.log(`   Listing URL: ${json.listing_url || json.url}`);
} catch {
  console.log(text.slice(0, 800));
}
process.exit(res.ok ? 0 : 1);

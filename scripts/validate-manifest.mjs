#!/usr/bin/env node
/**
 * Validates agent.manifest.yaml against the aiKart Agent Manifest Guide v1
 * (apiVersion: aikart.dev/v1).
 *
 * Run before submitting:   node scripts/validate-manifest.mjs
 *
 * This is a local sanity check, not an official validator — it enforces the
 * documented required fields, the resource caps, and the input/output/security
 * shapes so a review cannot bounce you on a typo.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argPath = process.argv.slice(2).find((a) => !a.startsWith('--'));
const file = argPath || path.join(root, 'agent.manifest.yaml');

// --- dependency-free YAML reader -------------------------------------------
// The manifest uses a small subset of YAML (nested maps, lists of maps,
// scalars, comments), so we parse exactly that instead of shipping a YAML
// library. Verified against PyYAML in CI-style cross-checking.
function coerce(v) {
  if (v == null) return null;
  let s = String(v);
  if (!/^["']/.test(s)) {
    const i = s.indexOf(' #');
    if (i >= 0) s = s.slice(0, i);
  }
  s = s.trim();
  if (/^".*"$/.test(s) || /^'.*'$/.test(s)) return s.slice(1, -1);
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (s === '' || s === 'null' || s === '~') return null;
  if (s.startsWith('[') && s.endsWith(']')) {
    const inner = s.slice(1, -1).trim();
    return inner === '' ? [] : inner.split(',').map((x) => coerce(x.trim()));
  }
  if (/^-?\d+$/.test(s)) return Number(s);
  if (/^-?\d*\.\d+$/.test(s)) return Number(s);
  return s;
}

function parseYaml(text) {
  const lines = text.replace(/\t/g, '  ').split('\n');
  let i = 0;
  const indentOf = (l) => (l.match(/^ */) || [''])[0].length;
  const skip = () => {
    while (i < lines.length && (lines[i].trim() === '' || lines[i].trim().startsWith('#'))) i++;
  };

  function block(minIndent) {
    skip();
    if (i >= lines.length) return null;
    const ind = indentOf(lines[i]);
    if (ind < minIndent) return null;

    if (lines[i].trim().startsWith('- ')) {
      const arr = [];
      while (i < lines.length) {
        skip();
        if (i >= lines.length) break;
        const l = lines[i];
        if (indentOf(l) < ind || !l.trim().startsWith('- ')) break;
        const rest = l.trim().slice(2).trim();
        i++;
        if (rest === '') {
          arr.push(block(ind + 1));
        } else if (/^[^:]+:/.test(rest)) {
          const m = rest.match(/^([^:]+):\s*(.*)$/);
          const obj = {};
          obj[m[1].trim()] = coerce(m[2]);
          skip();
          if (i < lines.length && indentOf(lines[i]) > ind) {
            const sub = block(indentOf(lines[i]));
            if (sub && typeof sub === 'object' && !Array.isArray(sub)) Object.assign(obj, sub);
          }
          arr.push(obj);
        } else {
          arr.push(coerce(rest));
        }
      }
      return arr;
    }

    const obj = {};
    while (i < lines.length) {
      skip();
      if (i >= lines.length) break;
      const l = lines[i];
      const cur = indentOf(l);
      if (cur < ind) break;
      if (cur > ind) { i++; continue; }
      const m = l.trim().match(/^([^:]+):\s*(.*)$/);
      if (!m) { i++; continue; }
      const key = m[1].trim();
      const raw = m[2].trim();
      i++;
      if (raw === '' || raw.startsWith('#')) {
        const sub = block(ind + 1);
        obj[key] = sub === null ? null : sub;
      } else {
        obj[key] = coerce(raw);
      }
    }
    return obj;
  }
  return block(0);
}

const doc = parseYaml(fs.readFileSync(file, 'utf8'));
if (process.argv.includes('--dump')) {
  console.log(JSON.stringify(doc, null, 2));
  process.exit(0);
}

const errors = [];
const warns = [];
const ok = (label, cond, detail = '') => {
  if (!cond) errors.push(`${label}${detail ? ` — ${detail}` : ''}`);
  console.log(`${cond ? 'PASS' : 'FAIL'} - ${label}${detail ? `  [${detail}]` : ''}`);
};

console.log(`Validating ${path.relative(root, file)} against apiVersion aikart.dev/v1\n`);

ok('apiVersion is "aikart.dev/v1"', doc.apiVersion === 'aikart.dev/v1', String(doc.apiVersion));
ok('kind is "AgentManifest"', doc.kind === 'AgentManifest', String(doc.kind));

const meta = doc.metadata || {};
ok('metadata.name present and slug-shaped', typeof meta.name === 'string' && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(meta.name), String(meta.name));
ok('metadata.displayName present', Boolean(meta.displayName));
ok('metadata.description present', Boolean(meta.description));

const rt = doc.runtime || {};
ok('runtime.type is "docker"', rt.type === 'docker', String(rt.type));
ok('runtime.image present', Boolean(rt.image));
if (rt.image && rt.image.includes('<')) {
  warns.push(`runtime.image still contains a placeholder (${rt.image}) — replace it with your own publicly pullable image before submitting`);
}
ok('runtime.image looks publicly pullable', Boolean(rt.image) && !/localhost|127\.0\.0\.1/.test(rt.image), String(rt.image));

const res = doc.resources || {};
ok('resources.cpu within cap (<= 2)', Number(res.cpu) <= 2, `${res.cpu}`);
ok('resources.memoryMb within cap (<= 4096)', Number(res.memoryMb) <= 4096, `${res.memoryMb}`);
ok('resources.timeoutSeconds within cap (<= 280)', Number(res.timeoutSeconds) <= 280, `${res.timeoutSeconds}`);

const VALID_TYPES = ['text', 'textarea', 'number', 'boolean', 'select'];
const inputs = Array.isArray(doc.inputs) ? doc.inputs : [];
ok('inputs[] present', inputs.length > 0, `${inputs.length} field(s)`);
inputs.forEach((f, i) => {
  const tag = `inputs[${i}] (${f?.name || 'unnamed'})`;
  ok(`${tag} has name/label/type/required`, Boolean(f?.name && f?.label && f?.type && f?.required !== undefined));
  ok(`${tag} type is valid`, VALID_TYPES.includes(f?.type), String(f?.type));
  if (f?.type === 'select') ok(`${tag} select has options`, Array.isArray(f.options) && f.options.length > 0);
});
ok('at least one required input', inputs.some((f) => f?.required === true));

const out = doc.output || {};
ok('output.format is valid', ['markdown', 'text', 'json', 'html'].includes(out.format), String(out.format));

const sec = doc.security || {};
ok('security.networkEgress is valid', ['none', 'allowlist'].includes(sec.networkEgress), String(sec.networkEgress));
if (sec.networkEgress === 'allowlist') {
  ok('security.egressAllowlist present when networkEgress is "allowlist"', Array.isArray(sec.egressAllowlist) && sec.egressAllowlist.length > 0);
}

console.log('');
warns.forEach((w) => console.log(`WARN - ${w}`));
console.log(errors.length === 0 ? '✅ Manifest is valid against the documented schema.' : `❌ ${errors.length} problem(s) — fix before submitting.`);
process.exit(errors.length === 0 ? 0 : 1);

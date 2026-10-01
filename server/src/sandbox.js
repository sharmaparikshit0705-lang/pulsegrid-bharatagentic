#!/usr/bin/env node
/**
 * aiKart "Try Me Now" sandbox entrypoint.
 *
 * The aiKart sandbox does NOT call an HTTP endpoint. Per the aiKart Agent
 * Manifest Guide, it:
 *   1. starts a fresh isolated container from your published image
 *   2. writes the buyer's answers as JSON to  /aikart/input.json
 *      (also exposed as the env var AIKART_INPUT)
 *   3. waits for your process to exit
 *   4. reads the result from                  /aikart/output.json
 *      shaped exactly:  { "format": "markdown", "response": "<output>" }
 *   5. expects exit code 0. Any non-zero exit is treated as a failure.
 *
 * Storage is fully ephemeral — nothing persists between runs.
 *
 * This script implements that contract around the PulseGrid agent mesh.
 * Paths are overridable so the same code can be tested outside a container.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRuntime, LANGUAGES } from '../../client/src/agents/index.js';

const INPUT_FILE = process.env.AIKART_INPUT_FILE || '/aikart/input.json';
const OUTPUT_FILE = process.env.AIKART_OUTPUT_FILE || '/aikart/output.json';

/* ----------------------------- read input ----------------------------- */
function readInput() {
  // 1. env var (aiKart sets this too)
  if (process.env.AIKART_INPUT) {
    try {
      return JSON.parse(process.env.AIKART_INPUT);
    } catch (e) {
      throw new Error(`AIKART_INPUT is not valid JSON: ${e.message}`);
    }
  }
  // 2. the documented file path
  if (fs.existsSync(INPUT_FILE)) {
    return JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));
  }
  // 3. a JSON string or file path as argv[2] (handy for local testing)
  const arg = process.argv[2];
  if (arg) {
    if (fs.existsSync(arg)) return JSON.parse(fs.readFileSync(arg, 'utf8'));
    try {
      return JSON.parse(arg);
    } catch {
      return { request: arg }; // treat a bare string as the request
    }
  }
  throw new Error(`No input found. Expected ${INPUT_FILE} or the AIKART_INPUT env var.`);
}

/* ---------------------------- write output ---------------------------- */
function writeOutput(format, response) {
  const payload = { format, response };
  const dir = path.dirname(OUTPUT_FILE);
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {
    /* the directory may already exist and be read-only — the write below will tell us */
  }
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(payload, null, 2));
  // also echo to stdout so a human running it locally can see the result
  process.stdout.write(`\n${response}\n`);
}

/* ------------------------- render the markdown ------------------------ */
function renderReport(request, plan, run) {
  const L = [];
  L.push(`# PulseGrid — agent report`);
  L.push('');
  L.push(`**Request:** ${request}`);
  L.push('');
  if (plan) {
    L.push(`**GRIDMASTER plan** — intents: \`${plan.intents.map((i) => i.intent).join('`, `') || 'none'}\` · confidence **${Math.round((plan.confidence || 0) * 100)}%**`);
    L.push('');
    L.push(`> ${plan.rationale}`);
    if (plan.needsClarification) {
      L.push('>');
      L.push('> ⚠️ No intent matched confidently — the mesh fell back to its safety-first default.');
    }
    L.push('');
  }

  L.push(`## Reasoning trace (${run.steps.length} steps · ${run.toolCalls.length} tool calls)`);
  L.push('');
  let lastAgent = null;
  for (const s of run.steps) {
    if (s.agent !== lastAgent) {
      L.push(`### ${s.agent}`);
      L.push('');
      lastAgent = s.agent;
    }
    L.push(`- **${s.phase.toUpperCase()}** — ${s.title}`);
    L.push(`  - ${s.detail}`);
  }
  L.push('');

  L.push('## Actions taken');
  L.push('');
  const actions = run.toolCalls.filter((t) => t.ok);
  if (actions.length === 0) {
    L.push('_None — the mesh decided no action was required._');
  } else {
    L.push('| tool | simulated | result |');
    L.push('|---|---|---|');
    for (const t of actions) {
      L.push(`| \`${t.tool}\` | ${t.simulated ? 'yes' : 'no'} | ${t.ok ? 'ok' : 'error'} |`);
    }
  }
  L.push('');

  L.push('## Outcome');
  L.push('');
  for (const d of run.decisions) {
    L.push(`- **${d.agent}** — ${d.summary} _(confidence ${Math.round((d.confidence || 0) * 100)}%)_`);
  }
  L.push('');
  if (Object.keys(run.metrics || {}).length) {
    L.push('```json');
    L.push(JSON.stringify(run.metrics, null, 2));
    L.push('```');
    L.push('');
  }

  if (run.approvals.length) {
    L.push('## Human approval required');
    L.push('');
    for (const a of run.approvals) {
      L.push(`- **${a.id}** (${a.risk}) — ${a.reason} — status: \`${a.status}\``);
    }
    L.push('');
    L.push('_The mesh stopped rather than acting. A human decides._');
    L.push('');
  }

  const proofs = run.toolCalls.filter((t) => t.tool === 'anchor_proof').map((t) => t.result?.sha256?.slice(0, 16));
  if (proofs.length) {
    L.push(`**Evidence anchored:** \`${proofs.join('`, `')}\` — tamper-evident, recomputable from the original payload.`);
    L.push('');
  }

  L.push('---');
  L.push('');
  L.push(`_Status: **${run.status}** · ${run.agentResults.length} agent(s) dispatched · ${run.durationMs} ms._`);
  L.push('');
  L.push('_Tools that would call an external service (vision scoring, weather, ULIP, ledger) are deterministic simulators and are labelled `simulated` above. Routing, the shelf-life model, fatigue scoring, carbon maths and evidence hashing are real computation._');
  return L.join('\n');
}

/* ------------------------------- main --------------------------------- */
async function main() {
  const input = readInput();
  const request = input.request || input.problem || input.query;
  if (!request || typeof request !== 'string') {
    throw new Error('Input must include a `request` string (the problem to solve).');
  }

  // Map the declared form fields onto the agent's context.
  const context = {};
  if (input.driver_id) context.driverId = input.driver_id;
  if (input.driver_language && LANGUAGES.some((l) => l.code === input.driver_language)) {
    context.language = input.driver_language;
  }
  if (input.speed_kmh != null && input.speed_kmh !== '') context.speedKmh = Number(input.speed_kmh);
  if (input.shipment_id) context.shipment = { ...(context.shipment || {}), id: input.shipment_id };

  const runtime = createRuntime({ speed: 0 });
  const plan = runtime.planRequest(request, context);
  const run = await runtime.runRequest({ request, context });

  writeOutput('markdown', renderReport(request, plan, run));
  return 0;
}

main()
  .then((code) => process.exit(code ?? 0))
  .catch((err) => {
    // Non-zero exit = failure. The buyer only sees a generic error, so be
    // explicit on stderr for whoever is debugging the container.
    process.stderr.write(`[pulsegrid-sandbox] FAILED: ${err.message}\n`);
    try {
      writeOutput('markdown', `# PulseGrid — agent error\n\n\`${err.message}\``);
    } catch {
      /* nothing more we can do */
    }
    process.exit(1);
  });

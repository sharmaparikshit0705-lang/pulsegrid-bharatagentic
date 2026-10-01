/**
 * Agentic Control Plane API.
 *
 * The agent core is framework-agnostic and shared with the client
 * (client/src/agents) — one source of truth, no duplication. A single runtime
 * instance is kept per server process so runs and memory accumulate, exactly
 * as they do in the browser.
 */
import { createRuntime } from '../../../client/src/agents/index.js';
import asyncHandler from '../utils/asyncHandler.js';
import { httpError } from '../middleware/errorHandler.js';

const runtime = createRuntime({ speed: 0 }); // no animation delay on the server

/** GET /api/v1/agents/catalog — agents, scenarios and tools */
export const catalog = asyncHandler(async (_req, res) => {
  res.json({
    orchestrator: {
      id: 'gridmaster',
      name: 'GRIDMASTER',
      role: 'Decomposes goals, dispatches agents, feeds results forward, owns the approval policy, records replayable runs.',
    },
    agents: runtime.agentCatalog,
    scenarios: runtime.scenarioCatalog,
  });
});

/** POST /api/v1/agents/run  body: { scenarioId: 'A' | 'B' | 'C' } */
export const runScenario = asyncHandler(async (req, res) => {
  const { scenarioId } = req.body || {};
  if (!scenarioId) throw httpError(422, 'scenarioId is required (A, B or C)');
  const run = await runtime.runScenario(scenarioId);
  res.status(201).json({ run });
});

/** GET /api/v1/agents/runs */
export const listRuns = asyncHandler(async (_req, res) => {
  const runs = runtime.getRuns();
  res.json({ runs, count: runs.length });
});

/** GET /api/v1/agents/runs/:runId — full replayable trace */
export const getRun = asyncHandler(async (req, res) => {
  const run = runtime.getRuns().find((r) => r.id === req.params.runId);
  if (!run) throw httpError(404, `Unknown run ${req.params.runId}`);
  res.json({ run });
});

/** GET /api/v1/agents/approvals */
export const listApprovals = asyncHandler(async (_req, res) => {
  res.json({ approvals: runtime.getApprovals() });
});

/** POST /api/v1/agents/approvals/:id/resolve  body: { decision: 'approve'|'reject', note? } */
export const resolveApproval = asyncHandler(async (req, res) => {
  const { decision, note } = req.body || {};
  if (!['approve', 'reject'].includes(decision)) throw httpError(422, "decision must be 'approve' or 'reject'");
  const approval = runtime.resolveApproval(req.params.id, decision, note);
  if (!approval) throw httpError(404, `No pending approval ${req.params.id}`);
  res.json({ approval });
});

/**
 * POST /api/v1/agent — THE agent entry point (hosted-agent submission path).
 *
 * body: { request: string, context?: object }
 *   request  — free-form: what a dispatcher, officer or judge would type
 *   context  — optional overrides: shipment, position, telemetry, driverId,
 *              frame, junctions, language, elapsedH, etaMinutes, speedKmh …
 *
 * returns: the plan (intents + rationale + confidence), the full reasoning
 *          trace, every tool call, any human-approval gate, and the outcome.
 */
export const runAgent = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const { request } = body;
  if (!request || typeof request !== 'string') {
    throw httpError(422, 'A non-empty `request` string is required');
  }
  // Accept both calling conventions:
  //   { request, context: {...} }                      — our documented shape
  //   { request, driver_language, driver_id, ... }     — the flat aiKart-style shape
  const flat = {};
  if (body.driver_language) flat.language = body.driver_language;
  if (body.driver_id) flat.driverId = body.driver_id;
  if (body.speed_kmh != null && body.speed_kmh !== '') flat.speedKmh = Number(body.speed_kmh);
  if (body.shipment_id) flat.shipment = { id: body.shipment_id };
  const context = { ...flat, ...(body.context || {}) };
  const run = await runtime.runRequest({ request, context });
  res.status(201).json({
    request,
    plan: run.plan,
    run,
    outcome: {
      status: run.status,
      decisions: run.decisions,
      metrics: run.metrics,
      actionsTaken: run.toolCalls.filter((t) => t.ok).map((t) => t.tool),
      approvalsRequired: run.approvals.map((a) => ({ id: a.id, reason: a.reason, risk: a.risk, status: a.status })),
      evidence: run.toolCalls.filter((t) => t.tool === 'anchor_proof').map((t) => t.result?.sha256?.slice(0, 16)),
    },
    trace: {
      steps: run.steps.length,
      toolCalls: run.toolCalls.length,
      agents: run.agentResults.map((r) => ({ agent: r.agent, summary: r.summary, confidence: r.confidence })),
    },
  });
});

/** GET /api/v1/agent/intents — what the router understands */
export const agentIntents = asyncHandler(async (_req, res) => {
  res.json({ intents: runtime.intents, note: 'Deterministic rule-based router: no model call, fully reproducible.' });
});

/** GET /api/v1/agent/schema — the request/response contract */
export const agentSchema = asyncHandler(async (_req, res) => {
  res.json({
    endpoint: 'POST /api/v1/agent',
    contentType: 'application/json',
    request: {
      request: 'string (required) — free-form problem statement',
      context: {
        shipment: 'object — { id, commodity, tonnes, from, to } (defaults to S-4471)',
        position: 'object — { lat, lng }',
        telemetry: 'array — [{ minutes, tempC, doorOpen }] for cold-chain checks',
        driverId: 'string — e.g. "D-3310"',
        frame: 'object — { frameId, vehicleId, lat, lng, seed } for dashcam scans',
        junctions: 'array — signalised junctions for emergency pre-emption',
        language: 'string — BCP-47 driver language, e.g. "ta-IN"',
        elapsedH: 'number — hours already in transit',
        etaMinutes: 'number — remaining planned transit',
        speedKmh: 'number — must be < 60 for edge capture',
      },
    },
    response: {
      plan: '{ intents, rationale, confidence, needsClarification }',
      run: 'full replayable run — steps (perceive/fuse/reason/plan/act/verify/learn), toolCalls, decisions, approvals',
      outcome: '{ status, decisions, metrics, actionsTaken, approvalsRequired, evidence }',
      trace: '{ steps, toolCalls, agents }',
    },
    example: {
      request: 'A vaccine truck is heading to Kochi and there is a flood on NH-544',
      context: { driverId: 'D-3310', language: 'ml-IN' },
    },
  });
});

/** GET /api/v1/agents/memory — what the mesh has learned */
export const memory = asyncHandler(async (_req, res) => {
  res.json({ memory: runtime.getMemory() });
});

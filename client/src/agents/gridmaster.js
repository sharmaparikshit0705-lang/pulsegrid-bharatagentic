/**
 * PulseGrid agent core — GRIDMASTER orchestrator.
 *
 * Responsibilities:
 *  - decompose a goal into an ordered set of agent tasks
 *  - dispatch agents, feeding one agent's output into the next (e.g. a new
 *    ETA from Reroute is handed to ColdGuard for a shelf-life re-check)
 *  - own policy: decide when an action needs human approval
 *  - record every step and tool call into a replayable Run
 *  - carry episodic memory across runs (learn)
 *
 * Pure JS — runs in the browser and in Node.
 */
import { makeToolkit } from './tools.js';
import { AGENTS, AGENTS_BY_ID } from './agents.js';
import { SCENARIOS, SCENARIOS_BY_ID } from './scenarios.js';
import { planRequest, inputsFor, INTENTS } from './router.js';

export function createRuntime({ speed = 1, onEvent = () => {} } = {}) {
  const memory = new Map();
  const runs = [];
  const approvals = [];

  const sleep = (ms) => new Promise((r) => setTimeout(r, speed > 0 ? ms * speed : 0));

  function newRun(goal, scenarioId) {
    const run = {
      id: `RUN-${String(runs.length + 1).padStart(3, '0')}`,
      scenarioId,
      goal,
      status: 'running',
      startedAt: new Date().toISOString(),
      endedAt: null,
      durationMs: 0,
      steps: [],
      toolCalls: [],
      decisions: [],
      approvals: [],
      agentResults: [],
      metrics: {},
    };
    runs.unshift(run);
    return run;
  }

  async function executeAgent(agent, goal, run, scenario) {
    const toolCalls = [];
    const ctx = {
      tools: makeToolkit(toolCalls, { onEvent, latency: 0 }),
      memory,
      step: (phase, title, detail) => {
        const s = { phase, title, detail, at: new Date().toISOString(), agent: agent.id };
        run.steps.push(s);
        onEvent({ type: 'step', runId: run.id, agent: agent.id, step: s });
      },
      emit: onEvent,
    };

    onEvent({ type: 'agent_start', runId: run.id, agent: agent.id, agentName: agent.name });
    const t0 = Date.now();
    await sleep(180);
    const result = await agent.run(goal, ctx);
    const elapsedMs = Date.now() - t0;

    run.toolCalls.push(...toolCalls);
    run.decisions.push({ agent: agent.id, summary: result.summary, confidence: result.confidence, metrics: result.metrics || {} });
    const agentResult = { agent: agent.id, agentName: agent.name, ...result, elapsedMs, toolCallCount: toolCalls.length };
    run.agentResults.push(agentResult);
    onEvent({ type: 'agent_done', runId: run.id, agent: agent.id, agentName: agent.name, result: agentResult });
    await sleep(120);
    return agentResult;
  }

  /**
   * Orchestration policy: does this agent's proposal need a human gate?
   * (agent-declared, plus orchestrator policy on spend and public-facing actions)
   */
  function evaluateApproval(agentResult) {
    if (!agentResult.requiresApproval || !agentResult.approval) return null;
    return {
      id: `APR-${approvals.length + 1}`,
      runId: null,
      agentId: agentResult.agent,
      agentName: agentResult.agentName,
      reason: agentResult.approval.reason,
      risk: agentResult.approval.risk,
      status: 'pending',
      raisedAt: new Date().toISOString(),
      resolvedAt: null,
      resolution: null,
    };
  }

  /**
   * The shared executor: runs an ordered plan of agent tasks, feeding each
   * agent's output into the next, applying the approval policy, and recording
   * everything into a replayable run.
   */
  async function executePlan({ goal, tasks, inputs = {}, label = 'custom', request = null, plan = null }) {
    const run = newRun(goal, label);
    if (request) run.request = request;
    if (plan) run.plan = { intents: plan.intents, rationale: plan.rationale, confidence: plan.confidence, needsClarification: plan.needsClarification };
    onEvent({ type: 'run_start', runId: run.id, scenarioId: label, goal, request, plan, at: run.startedAt });

    let carry = { ...inputs };

    for (const task of tasks) {
      const agent = AGENTS_BY_ID[task.agent];
      if (!agent) continue;

      // Feed forward: merge the previous agent's result into this task's inputs.
      const goalForAgent = { ...carry, ...(typeof task.input === 'function' ? task.input(carry) : task.input || {}) };

      const result = await executeAgent(agent, goalForAgent, run);

      // Carry forward the values the next agent needs.
      if (result.metrics) carry = { ...carry, ...result.metrics };
      if (result.route) carry.route = result.route;

      // Policy: spend above the shipment threshold, or public-facing actions, need a human.
      const approval = evaluateApproval(result);
      const addedCost = result.metrics?.addedKm ? result.metrics.addedKm * 34 : 0; // ₹/km for a reefer
      const shipmentThreshold = carry.shipment?.requiresApprovalAboveInr ?? Infinity;

      if (approval) {
        approval.runId = run.id;
        approvals.unshift(approval);
        run.approvals.push(approval);
        onEvent({ type: 'approval_request', runId: run.id, approval });
      } else if (addedCost > shipmentThreshold) {
        const spendApproval = {
          id: `APR-${approvals.length + 1}`,
          runId: run.id,
          agentId: 'gridmaster',
          agentName: 'GRIDMASTER',
          reason: `Diversion adds ${Math.round(addedCost)} INR in fuel/time, above the ${shipmentThreshold} INR policy threshold`,
          risk: 'financial',
          status: 'pending',
          raisedAt: new Date().toISOString(),
          resolvedAt: null,
          resolution: null,
        };
        approvals.unshift(spendApproval);
        run.approvals.push(spendApproval);
        onEvent({ type: 'approval_request', runId: run.id, approval: spendApproval });
      }

      await sleep(140);
    }

    // Aggregate outcome metrics.
    run.metrics = run.agentResults.reduce((acc, r) => ({ ...acc, ...(r.metrics || {}) }), {});
    run.status = run.approvals.some((a) => a.status === 'pending') ? 'awaiting_approval' : 'completed';
    run.endedAt = new Date().toISOString();
    run.durationMs = new Date(run.endedAt) - new Date(run.startedAt);

    onEvent({ type: 'run_end', runId: run.id, status: run.status, run });
    return run;
  }

  async function runScenario(scenarioId) {
    const scenario = SCENARIOS_BY_ID[scenarioId];
    if (!scenario) throw new Error(`Unknown scenario ${scenarioId}`);
    return executePlan({ goal: scenario.goal, tasks: scenario.tasks, inputs: scenario.inputs, label: scenarioId });
  }

  /**
   * Run the mesh from a FREE-FORM request — the entry point an API caller uses.
   * The router classifies the request, picks the agents and orders them; the
   * executor then does the work and returns the full reasoning trace.
   */
  async function runRequest({ request, context = {} } = {}) {
    const text = request || context.request || '';
    if (!text) throw new Error('A `request` string is required');
    const plan = planRequest(text, context);
    return executePlan({
      goal: text,
      tasks: plan.tasks,
      inputs: { ...context },
      label: 'request',
      request: text,
      plan,
    });
  }

  function resolveApproval(approvalId, decision, note = '') {
    const a = approvals.find((x) => x.id === approvalId);
    if (!a || a.status !== 'pending') return null;
    a.status = decision === 'approve' ? 'approved' : 'rejected';
    a.resolution = note || (decision === 'approve' ? 'Approved by operator' : 'Rejected by operator');
    a.resolvedAt = new Date().toISOString();
    const run = runs.find((r) => r.id === a.runId);
    if (run && !run.approvals.some((x) => x.status === 'pending')) {
      run.status = decision === 'approve' ? 'completed' : 'completed_with_rejection';
    }
    onEvent({ type: 'approval_resolved', approval: a });
    return a;
  }

  return {
    runScenario,
    runRequest,
    planRequest,
    resolveApproval,
    getRuns: () => runs,
    getApprovals: () => approvals,
    getMemory: () => Object.fromEntries(memory),
    agentCatalog: AGENTS.map((a) => ({
      id: a.id,
      name: a.name,
      purpose: a.purpose,
      toolsUsed: a.toolsUsed,
      guardrails: a.guardrails,
    })),
    scenarioCatalog: SCENARIOS.map((s) => ({ id: s.id, title: s.title, goal: s.goal, blurb: s.blurb })),
    intents: INTENTS,
  };
}

export { SCENARIOS, AGENTS };

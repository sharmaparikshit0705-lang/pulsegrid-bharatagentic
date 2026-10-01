/**
 * PulseGrid — self-eval suite.
 *
 * Runs the three scenarios through the real agent core (no animation delay) and
 * asserts the OUTCOME of each decision, not the wording of it. This is the same
 * contract as `client/scripts/agent-test.mjs`, exposed so the dashboard can
 * prove itself in the browser — and so the same cases can be loaded as evals on
 * AgentFoundry (see agents/agentfoundry/evals/).
 *
 * A fresh runtime is used so a self-eval never pollutes the operator's run log.
 */
import { createRuntime } from './gridmaster.js';

const resultOf = (run, agent) => run.agentResults.find((r) => r.agent === agent);
const usedTool = (run, tool) => run.toolCalls.some((t) => t.tool === tool);

const SUITE = [
  /* ---- Scenario A — flood reroute ---- */
  {
    scenario: 'A',
    name: 'Reroute avoids the flood hazard',
    check: (run) => /NH-209|SH-21/.test(resultOf(run, 'reroute')?.metrics?.routeVia || ''),
  },
  {
    scenario: 'A',
    name: 'Diversion cost is quantified (+78 km, +110 min)',
    check: (run) => resultOf(run, 'reroute')?.metrics?.addedKm === 78 && resultOf(run, 'reroute')?.metrics?.addedMinutes === 110,
  },
  {
    scenario: 'A',
    name: 'Shelf life is re-checked against the NEW eta (feed-forward)',
    check: (run) => resultOf(run, 'coldguard')?.summary?.includes('healthy'),
  },
  {
    scenario: 'A',
    name: 'No false spoilage alarm on in-band cargo',
    check: (run) => (resultOf(run, 'coldguard')?.metrics?.risk ?? 1) < 0.1,
  },
  {
    scenario: 'A',
    name: 'Spend above policy stops at a human gate',
    check: (run) => run.approvals.length >= 1 && run.status === 'awaiting_approval',
  },
  {
    scenario: 'A',
    name: 'Driver notified in the driver’s language (ml-IN)',
    check: (run) => run.toolCalls.some((t) => t.tool === 'notify_party' && t.args.language === 'ml-IN'),
  },
  {
    scenario: 'A',
    name: 'Decision anchored as evidence',
    check: (run) => usedTool(run, 'anchor_proof'),
  },

  /* ---- Scenario B — spoilage prevention ---- */
  {
    scenario: 'B',
    name: 'Temperature excursion detected and quantified',
    check: (run) => (resultOf(run, 'coldguard')?.metrics?.risk ?? 0) > 0.2,
  },
  {
    scenario: 'B',
    name: 'Remaining shelf life recomputed',
    check: (run) => typeof resultOf(run, 'coldguard')?.metrics?.rslDays === 'number',
  },
  {
    scenario: 'B',
    name: 'Diverts to a pre-cooling node and books the slot',
    check: (run) => Boolean(resultOf(run, 'coldguard')?.metrics?.node) && usedTool(run, 'book_slot'),
  },
  {
    scenario: 'B',
    name: 'Contract clause executed for the buyer',
    check: (run) => usedTool(run, 'smart_contract_clause'),
  },
  {
    scenario: 'B',
    name: 'Cost below threshold → agent acts autonomously (no gate)',
    check: (run) => run.approvals.length === 0 && run.status === 'completed',
  },

  /* ---- Scenario C — safety loop ---- */
  {
    scenario: 'C',
    name: 'Defect detected and scored from the dashcam frame',
    check: (run) => (resultOf(run, 'corridorsense')?.metrics?.severity ?? 0) >= 3,
  },
  {
    scenario: 'C',
    name: 'Municipal ticket raised with an SLA',
    check: (run) => usedTool(run, 'open_sla_ticket'),
  },
  {
    scenario: 'C',
    name: 'Public hazard advisory gated for the ward engineer',
    check: (run) => run.approvals.some((a) => a.agentId === 'corridorsense'),
  },
  {
    scenario: 'C',
    name: 'Emergency pre-emption clears all 8 junctions',
    check: (run) => resultOf(run, 'safetysentinel')?.metrics?.junctionsCleared === 8,
  },
  {
    scenario: 'C',
    name: 'Response-time saving computed (440 s)',
    check: (run) => resultOf(run, 'safetysentinel')?.metrics?.savedSeconds === 440,
  },
];

/**
 * @returns {Promise<{results: Array, passed: number, total: number, durationMs: number}>}
 */
export async function runEvals() {
  const t0 = Date.now();
  const rt = createRuntime({ speed: 0 });
  const runs = {};
  for (const id of ['A', 'B', 'C']) {
    runs[id] = await rt.runScenario(id);
  }
  const results = SUITE.map((e) => {
    let passed = false;
    try {
      passed = Boolean(e.check(runs[e.scenario]));
    } catch {
      passed = false;
    }
    return { scenario: e.scenario, name: e.name, passed };
  });
  return {
    results,
    passed: results.filter((r) => r.passed).length,
    total: results.length,
    durationMs: Date.now() - t0,
  };
}

export const evalCount = SUITE.length;

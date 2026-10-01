/**
 * PulseGrid agent core — verification harness.
 * Runs all three scenarios with zero animation delay and asserts outcomes.
 */
import { createRuntime } from '../src/agents/index.js';

const rt = createRuntime({ speed: 0 });

const results = [];
let failures = 0;
function check(label, condition, detail = '') {
  const ok = Boolean(condition);
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'} - ${label}${detail ? `  [${detail}]` : ''}`);
}

/* ---------------- Scenario A — flood reroute ---------------- */
const A = await rt.runScenario('A');
const aAgents = A.agentResults.map((r) => r.agent);
const aReroute = A.agentResults.find((r) => r.agent === 'reroute');
const aCold = A.agentResults.find((r) => r.agent === 'coldguard');
check('A · all six agents ran', aAgents.length === 6, aAgents.join(','));
check('A · reroute chose the flood-free diversion', /NH-209|SH-21/.test(aReroute?.metrics?.routeVia || ''), aReroute?.metrics?.routeVia);
check('A · diversion adds 78 km', aReroute?.metrics?.addedKm === 78, `+${aReroute?.metrics?.addedKm} km`);
check('A · diversion adds ~110 min', aReroute?.metrics?.addedMinutes === 110, `+${aReroute?.metrics?.addedMinutes} min`);
check('A · cold chain re-checked against the new ETA (feed-forward)', aCold?.summary?.includes('healthy'), aCold?.summary);
check('A · cargo stayed in band (no false spoilage alarm)', aCold?.metrics?.risk < 0.1, `risk ${aCold?.metrics?.risk}`);
check('A · spend gate raised for approval', A.approvals.length >= 1 && A.status === 'awaiting_approval', `status=${A.status}, approvals=${A.approvals.length}`);
check('A · driver notified in Malayalam', A.toolCalls.some((t) => t.tool === 'notify_party' && t.args.language === 'ml-IN'));
check('A · evidence anchored', A.toolCalls.some((t) => t.tool === 'anchor_proof'));
check('A · every step has a phase', A.steps.every((s) => ['perceive', 'fuse', 'reason', 'plan', 'act', 'verify', 'learn'].includes(s.phase)));
check('A · reasoning trace is substantial', A.steps.length >= 25, `${A.steps.length} steps, ${A.toolCalls.length} tool calls`);

/* ---------------- Scenario B — spoilage prevented ---------------- */
const B = await rt.runScenario('B');
const bCold = B.agentResults.find((r) => r.agent === 'coldguard');
check('B · ColdGuard detected the breach', bCold?.metrics?.risk > 0.2, `rejection risk ${bCold?.metrics?.risk}`);
check('B · shelf life recomputed', typeof bCold?.metrics?.rslDays === 'number', `RSL ${bCold?.metrics?.rslDays} d`);
check('B · diversion to a pre-cooling node chosen', Boolean(bCold?.metrics?.node), bCold?.metrics?.node);
check('B · pre-cooling slot booked', B.toolCalls.some((t) => t.tool === 'book_slot'));
check('B · buyer notified', B.toolCalls.some((t) => t.tool === 'notify_party' && t.args.party.includes('consignee') === false));
check('B · contract clause executed', B.toolCalls.some((t) => t.tool === 'smart_contract_clause'));
check('B · exposure quantified in INR', bCold?.metrics?.exposureInr > 100000, `₹${bCold?.metrics?.exposureInr?.toLocaleString('en-IN')}`);
check('B · cost below policy threshold → no human gate', B.approvals.length === 0 && B.status === 'completed', `status=${B.status}`);

/* ---------------- Scenario C — defect SLA + emergency corridor ---------------- */
const C = await rt.runScenario('C');
const cSense = C.agentResults.find((r) => r.agent === 'corridorsense');
const cSent = C.agentResults.find((r) => r.agent === 'safetysentinel');
check('C · defect detected and scored', cSense?.metrics?.severity >= 3, `severity ${cSense?.metrics?.severity}`);
check('C · municipal ticket raised with SLA', C.toolCalls.some((t) => t.tool === 'open_sla_ticket'), cSense?.summary);
check('C · hazard advisory gated for ward engineer', C.approvals.some((a) => a.agentId === 'corridorsense'), `approvals=${C.approvals.length}`);
check('C · emergency pre-emption cleared 8 junctions', cSent?.metrics?.junctionsCleared === 8, `${cSent?.metrics?.junctionsCleared} junctions`);
check('C · response-time saving computed', cSent?.metrics?.savedSeconds === 440, `${cSent?.metrics?.savedSeconds}s saved`);

/* ---------------- Cross-cutting ---------------- */
const C2 = await rt.runScenario('C');
const c2Sense = C2.agentResults.find((r) => r.agent === 'corridorsense');
check('determinism · same seed → same severity', c2Sense?.metrics?.severity === cSense?.metrics?.severity, `${cSense?.metrics?.severity} vs ${c2Sense?.metrics?.severity}`);
check('memory · defect prior accumulated across runs', rt.getMemory().defect_prior >= 2, `defect_prior=${rt.getMemory().defect_prior}`);
check('memory · door-event halt learned', rt.getMemory().door_event_halt >= 1, `door_event_halt=${rt.getMemory().door_event_halt}`);
check('catalog · 8 agents exposed', rt.agentCatalog.length === 8);
check('catalog · 3 scenarios exposed', rt.scenarioCatalog.length === 3);
check('runs · all four runs recorded', rt.getRuns().length === 4);

/* ---------------- Approval resolution ---------------- */
const pending = rt.getApprovals().find((a) => a.status === 'pending');
const resolved = rt.resolveApproval(pending.id, 'approve', 'Approved by demo operator');
check('approval · resolves and records the decision', resolved?.status === 'approved' && resolved.resolution.includes('demo operator'));
check('approval · run status updates after resolution', rt.getRuns().find((r) => r.id === pending.runId).status === 'completed');

/* ---------------- Summary ---------------- */
console.log('\n--- run summary ---');
for (const r of rt.getRuns()) {
  console.log(`${r.id} [${r.scenarioId}] ${r.status} · ${r.agentResults.length} agents · ${r.steps.length} steps · ${r.toolCalls.length} tool calls · ${r.approvals.length} approvals`);
}
console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'}`);
process.exit(failures === 0 ? 0 : 1);

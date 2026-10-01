/**
 * PulseGrid agent core — request router.
 *
 * Turns a free-form request (what a dispatcher, a municipal officer or a judge
 * would type) into an execution plan: which specialist agents to run, in what
 * order, and with what inputs.
 *
 * This is a deterministic, inspectable rule-based router — no model call, so it
 * is reproducible, auditable and free to run. It reports its own confidence and
 * says so when it cannot tell what is being asked, rather than guessing.
 */
import { SHIPMENTS, CORRIDOR_JUNCTIONS, DRIVERS } from './corridor.js';

/* Intent signals. Each intent maps to the agents that can act on it. */
const SIGNALS = [
  {
    intent: 'road_defect',
    label: 'Road surface defect / pothole / crack',
    agents: ['corridorsense'],
    keywords: ['pothole', 'crack', 'road damage', 'surface', 'defect', 'sink', 'broken road', 'crater'],
  },
  {
    intent: 'spoilage',
    label: 'Cold-chain / spoilage risk',
    agents: ['coldguard'],
    keywords: ['spoil', 'temperature', 'reefer', 'cold', 'shelf life', 'vaccine', 'pharma', 'perishable', 'milk', 'dairy', 'vegetable', 'fruit', 'chilled', 'frozen'],
  },
  {
    intent: 'reroute',
    label: 'Disruption / reroute',
    agents: ['reroute'],
    keywords: ['flood', 'waterlog', 'closure', 'blocked', 'reroute', 'divert', 'strike', 'accident ahead', 'traffic', 'congestion', 'landslide', 'storm'],
  },
  {
    intent: 'emergency',
    label: 'Emergency response / corridor clearance',
    agents: ['safetysentinel'],
    keywords: ['ambulance', 'emergency', '108', 'fire', 'police', 'clear the road', 'green corridor', 'hospital', 'casualty'],
  },
  {
    intent: 'driver_welfare',
    label: 'Driver fatigue / welfare',
    agents: ['saarthi'],
    keywords: ['fatigue', 'tired', 'driver', 'rest', 'break', 'duty hours', 'welfare', 'sleep', 'exhausted'],
  },
  {
    intent: 'carbon',
    label: 'Emissions / greener mode',
    agents: ['greenlane'],
    keywords: ['carbon', 'emission', 'green', 'co2', 'sustainability', 'fuel', 'rail instead', 'modal'],
  },
  {
    intent: 'multimodal',
    label: 'Multimodal handover / port',
    agents: ['hubsync'],
    keywords: ['port', 'rail', 'multimodal', 'yard', 'container', 'handover', 'dock', 'terminal', 'rake'],
  },
];

/* Execution order: produce information before consuming it.
   reroute changes the ETA, so it must precede coldguard. */
const RANK = {
  corridorsense: 1,
  reroute: 1,
  safetysentinel: 2,
  coldguard: 2,
  saarthi: 2,
  greenlane: 3,
  hubsync: 3,
  trustledger: 4,
};

/** Default inputs per agent, overridable by the caller's `context`. */
export function inputsFor(agentId, context) {
  const shipment = context.shipment || SHIPMENTS['S-4471'];
  const position = context.position || { lat: 10.9, lng: 76.7 };
  const driverId = context.driverId || 'D-3310';
  const map = {
    corridorsense: {
      frame: context.frame || {
        frameId: 'REQ-FRAME-01',
        vehicleId: context.vehicleId || 'TN-37-BUS-2214',
        lat: context.lat ?? 11.0168,
        lng: context.lng ?? 76.9558,
        seed: context.seed ?? 11,
      },
      speedKmh: context.speedKmh ?? 52,
    },
    reroute: { shipment, driverId, language: context.language || DRIVERS[driverId]?.language || 'en-IN' },
    coldguard: {
      shipment,
      telemetry: context.telemetry || [
        { minutes: 5, tempC: 5.2, doorOpen: false },
        { minutes: 5, tempC: 5.1, doorOpen: false },
        { minutes: 5, tempC: 5.4, doorOpen: false },
        { minutes: 5, tempC: 5.0, doorOpen: false },
        { minutes: 5, tempC: 5.3, doorOpen: false },
      ],
      elapsedH: context.elapsedH ?? 3.3,
      etaMinutes: context.etaMinutes ?? 210,
      ambientC: context.ambientC ?? 33,
      position,
    },
    safetysentinel: {
      mode: 'emergency',
      ambulance: context.ambulance || { id: 'AMB-108-04', destination: 'KMCH Junction', corridorId: 'CBE-AVINASHI' },
      junctions: context.junctions || CORRIDOR_JUNCTIONS.slice(0, 8),
    },
    saarthi: { driverId, position },
    greenlane: { shipment, distanceKm: context.distanceKm ?? 190 },
    hubsync: { shipment },
    trustledger: {
      subjectType: context.subjectType || 'agent_decision',
      subjectId: shipment.id,
      payload: { request: context.request || null },
      contractId: shipment.contractId,
      clause: 'service_notice',
    },
  };
  // Return only the inputs the requested agent needs — not the whole map.
  return map[agentId] || {};
}

/**
 * Classify a free-form request and produce an execution plan.
 * @returns {{intents: Array, tasks: Array, rationale: string, confidence: number, needsClarification: boolean}}
 */
export function planRequest(request, context = {}) {
  const text = String(request || '').toLowerCase();
  const matched = SIGNALS.filter((s) => s.keywords.some((k) => text.includes(k)));

  const intents = matched.map((m) => ({ intent: m.intent, label: m.label, agents: m.agents }));

  // Collect the union of agents, then order them by dependency rank.
  const wanted = new Set(matched.flatMap((m) => m.agents));
  // Nothing matched: fall back to the safety-first default rather than doing nothing.
  if (wanted.size === 0) wanted.add('corridorsense');
  // Evidence anchoring is worth doing whenever the plan takes more than one action.
  if (wanted.size >= 2) wanted.add('trustledger');

  const tasks = [...wanted]
    .sort((a, b) => (RANK[a] ?? 9) - (RANK[b] ?? 9))
    .map((agentId) => ({ agent: agentId, input: (carry) => inputsFor(agentId, { ...context, ...carry, request }) }));

  const confidence = matched.length === 0 ? 0.25 : Math.min(0.95, 0.5 + matched.length * 0.15);

  const rationale = matched.length
    ? `Matched ${matched.length} intent${matched.length > 1 ? 's' : ''} (${matched.map((m) => m.intent).join(', ')}) → dispatching ${tasks.length} agent${tasks.length > 1 ? 's' : ''} in dependency order.`
    : 'No intent matched confidently. Falling back to the safety-first default (CorridorSense) and asking for clarification.';

  return {
    intents,
    tasks,
    rationale,
    confidence,
    needsClarification: matched.length === 0,
    matchedKeywords: matched.flatMap((m) => m.keywords.filter((k) => text.includes(k))),
  };
}

/** The catalogue of intents, so the API can document what it understands. */
export const INTENTS = SIGNALS.map((s) => ({ intent: s.intent, label: s.label, agents: s.agents, keywords: s.keywords }));

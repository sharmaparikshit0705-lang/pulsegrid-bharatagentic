/**
 * PulseGrid agent core — demo scenarios.
 *
 * Three end-to-end runs that exercise the whole mesh. Each scenario declares
 * its inputs and the ordered agent tasks; GRIDMASTER feeds each agent's output
 * into the next (e.g. Reroute's new ETA is handed to ColdGuard).
 */
import { SHIPMENTS, CORRIDOR_JUNCTIONS } from './corridor.js';

/* ---- Scenario A — pharma reefer vs flash flood ------------------------ */
const A_TELEMETRY = [
  { minutes: 5, tempC: 5.2, doorOpen: false },
  { minutes: 5, tempC: 5.1, doorOpen: false },
  { minutes: 5, tempC: 5.4, doorOpen: false },
  { minutes: 5, tempC: 5.0, doorOpen: false },
  { minutes: 5, tempC: 5.3, doorOpen: false },
  { minutes: 5, tempC: 5.1, doorOpen: false },
];

const scenarioA = {
  id: 'A',
  title: 'A · Pharma reefer vs flash flood',
  blurb: 'A vaccine load heads for Kochi; IMD flags a flash flood on NH-544 near Thrissur. Reroute, shelf-life re-check, driver welfare, carbon and evidence all fire in sequence.',
  goal: 'Deliver shipment S-4471 (8 t vaccines, 2–8 °C) to Kochi safely and in-band, despite the NH-544 flood.',
  inputs: {
    shipment: SHIPMENTS['S-4471'],
    driverId: 'D-3310',
    language: 'ml-IN',
    position: { lat: 10.9, lng: 76.7 }, // approaching Palakkad
    telemetry: A_TELEMETRY,
    elapsedH: 3.33,
    etaMinutes: 210,
    ambientC: 34,
  },
  tasks: [
    { agent: 'reroute', input: (c) => ({ shipment: c.shipment, driverId: c.driverId, language: c.language }) },
    {
      agent: 'coldguard',
      // Feed-forward: the diversion's new ETA is what shelf life must be checked against.
      input: (c) => ({
        shipment: c.shipment,
        telemetry: c.telemetry,
        elapsedH: c.elapsedH,
        etaMinutes: c.route?.driveMinutes ?? c.etaMinutes,
        ambientC: c.ambientC,
        position: c.position,
      }),
    },
    { agent: 'saarthi', input: (c) => ({ driverId: c.driverId, position: c.position }) },
    { agent: 'greenlane', input: (c) => ({ shipment: c.shipment, distanceKm: c.route?.distanceKm ?? 190 }) },
    { agent: 'hubsync', input: (c) => ({ shipment: c.shipment }) },
    {
      agent: 'trustledger',
      input: (c) => ({
        subjectType: 'diversion_decision',
        subjectId: c.shipment.id,
        payload: { route: c.route, reason: 'flood-thrissur', driverId: c.driverId },
        contractId: c.shipment.contractId,
        clause: 'route_change_notice',
      }),
    },
  ],
};

/* ---- Scenario B — stopping spoilage mid-journey ----------------------- */
const B_TELEMETRY = [
  { minutes: 5, tempC: 5.8, doorOpen: false },
  { minutes: 5, tempC: 6.2, doorOpen: false },
  { minutes: 5, tempC: 7.1, doorOpen: false },
  { minutes: 5, tempC: 9.4, doorOpen: false },
  { minutes: 6, tempC: 12.6, doorOpen: true }, // door left ajar at a mid-route halt
  { minutes: 6, tempC: 11.8, doorOpen: false },
  { minutes: 5, tempC: 10.9, doorOpen: false },
  { minutes: 4, tempC: 9.8, doorOpen: false },
];

const scenarioB = {
  id: 'B',
  title: 'B · Spoilage stopped mid-journey',
  blurb: 'A hill-vegetable export load drifts out of its temperature band. ColdGuard attributes the cause, costs the risk, diverts to a pre-cooling node and proves it to the buyer.',
  goal: 'Save shipment S-5510 (6 t export vegetables) from spoilage before the export cut-off.',
  inputs: {
    shipment: SHIPMENTS['S-5510'],
    position: { lat: 10.45, lng: 76.4 }, // approaching Chalakudy
    telemetry: B_TELEMETRY,
    elapsedH: 13,
    etaMinutes: 190,
    ambientC: 33,
  },
  tasks: [
    {
      agent: 'coldguard',
      input: (c) => ({
        shipment: c.shipment,
        telemetry: c.telemetry,
        elapsedH: c.elapsedH,
        etaMinutes: c.etaMinutes,
        ambientC: c.ambientC,
        position: c.position,
      }),
    },
    { agent: 'hubsync', input: (c) => ({ shipment: c.shipment }) },
    { agent: 'greenlane', input: (c) => ({ shipment: c.shipment, distanceKm: 190 }) },
    {
      agent: 'trustledger',
      input: (c) => ({
        subjectType: 'cold_chain_excursion',
        subjectId: c.shipment.id,
        payload: { node: c.node, exposureInr: c.exposureInr, breach: c.breachMinutes },
        contractId: c.shipment.contractId,
        clause: 'temperature_excursion_notice',
      }),
    },
  ],
};

/* ---- Scenario C — safety loop + emergency corridor -------------------- */
const scenarioC = {
  id: 'C',
  title: 'C · Defect → SLA, then emergency corridor',
  blurb: 'A bus dashcam catches a 4/5 defect next to a school crossing and raises a municipal ticket. Nine minutes later an ambulance needs the corridor cleared.',
  goal: 'Log the new road defect with a municipal SLA, then clear the corridor for an inbound ambulance.',
  inputs: {
    frame: { frameId: 'EDG-07-2211', vehicleId: 'TN-37-BUS-2214', lat: 11.0168, lng: 76.9558, seed: 11 },
    speedKmh: 52,
    junctions: CORRIDOR_JUNCTIONS.slice(0, 8),
    ambulance: {
      id: 'AMB-108-04',
      destination: 'KMCH Junction',
      corridorId: 'CBE-AVINASHI',
    },
  },
  tasks: [
    { agent: 'corridorsense', input: (c) => ({ frame: c.frame, speedKmh: c.speedKmh }) },
    {
      agent: 'safetysentinel',
      input: (c) => ({ mode: 'emergency', ambulance: c.ambulance, junctions: c.junctions }),
    },
  ],
};

export const SCENARIOS = [scenarioA, scenarioB, scenarioC];
export const SCENARIOS_BY_ID = Object.fromEntries(SCENARIOS.map((s) => [s.id, s]));

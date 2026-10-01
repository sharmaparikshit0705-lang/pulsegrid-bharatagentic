/**
 * PulseGrid API client with an in-browser mock transport.
 *
 * Every function here mirrors a real endpoint on the Express server in
 * /server. When VITE_USE_MOCKS=false the same functions issue real fetch()
 * calls against VITE_API_BASE — the calling components never change.
 *
 * Mock transport simulates network latency and logs the request/response
 * payloads to the browser console so the payload exchange is inspectable.
 */

const API_BASE = import.meta.env.VITE_API_BASE || '/api/v1';
const USE_MOCKS = (import.meta.env.VITE_USE_MOCKS ?? 'true') !== 'false';

/* ------------------------------ helpers ------------------------------ */

const rand = (min, max) => Math.random() * (max - min) + min;
const randInt = (min, max) => Math.floor(rand(min, max + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const HOUR = 3_600_000;
const MIN = 60_000;

const CORRIDOR_SPOTS = [
  { label: 'Avinashi Rd · Hope College Junction', lat: 11.0126, lng: 76.9643 },
  { label: 'Avinashi Rd · Peelamedu (PSG Tech gate)', lat: 11.0168, lng: 76.9558 },
  { label: 'Avinashi Rd · Codissia Junction', lat: 11.0256, lng: 76.9467 },
  { label: 'Avinashi Rd · KMCH Junction', lat: 11.0311, lng: 76.9386 },
  { label: 'Avinashi Rd · Neelambur (PSG iTech)', lat: 11.0523, lng: 76.9204 },
  { label: 'Saravanampatti Rd · Kalapatti Junction', lat: 11.0462, lng: 76.9855 },
  { label: 'Saravanampatti Rd · KGISPT IT Park', lat: 11.0868, lng: 76.9989 },
  { label: 'Saravanampatti · 4-Roads Junction', lat: 11.0965, lng: 77.0013 },
];

const DAMAGE_TYPES = [
  'Pothole',
  'Alligator Cracking',
  'Longitudinal Cracking',
  'Edge Break',
  'Rutting',
  'Patched Surface Failure',
];

const RECOMMENDED_ACTIONS = {
  1: 'Log only — monitor across next edge scans.',
  2: 'Queue for routine maintenance within the monthly cycle.',
  3: 'Cold-mix patch within SLA (24h). Notify CCMC ward engineer.',
  4: 'Hot-mix patch within SLA. Cone off lane; prioritise repair crew.',
  5: 'Immediate hazard. Dispatch crew now + traffic diversion (cc: traffic police).',
};

/* ------------------------- mock Vision AI analysis ------------------------- */

function mockVisionAnalysis(overrides = {}) {
  const hasPothole = overrides.hasPothole ?? Math.random() > 0.12;
  if (!hasPothole) {
    return {
      hasPothole: false,
      severityScore: 1,
      damageType: 'No significant defect detected',
      recommendedAction: 'No action required. Surface within tolerance.',
      confidence: +rand(0.86, 0.97).toFixed(2),
      model: 'pulsegrid-vision-v1',
    };
  }
  const severityScore = overrides.severityScore ?? randInt(2, 5);
  return {
    hasPothole: true,
    severityScore,
    damageType: overrides.damageType ?? pick(DAMAGE_TYPES),
    recommendedAction: RECOMMENDED_ACTIONS[severityScore],
    estimatedSizeCm: overrides.sizeCm ?? randInt(15, 90),
    confidence: +rand(0.83, 0.98).toFixed(2),
    model: 'pulsegrid-vision-v1',
  };
}

/* ----------------------------- mock stores ----------------------------- */

let idSeq = 1000;
const nextId = () => ++idSeq;

function seedDiagnostics() {
  const t = Date.now();
  const mk = (hoursAgo, severity, source, status, spot) => ({
    id: nextId(),
    ...spot,
    severity_score: severity,
    image_url: `s3://pulsegrid-media/diagnostics/${source.toLowerCase()}-${nextId()}.jpg`,
    source_type: source,
    status,
    created_at: new Date(t - hoursAgo * HOUR).toISOString(),
    sla_due_at: new Date(t - hoursAgo * HOUR + 24 * HOUR).toISOString(),
    dispatch_ticket: status !== 'PENDING' ? `CCMC-WRD-${randInt(4000, 5999)}` : null,
    size_cm: randInt(20, 85),
    ai_confidence: +rand(0.85, 0.97).toFixed(2),
  });
  return [
    mk(0.2, 4, 'BUS_DASHCAM', 'DISPATCHED', CORRIDOR_SPOTS[1]),
    mk(1.4, 3, 'CITIZEN_UPLOAD', 'PENDING', CORRIDOR_SPOTS[5]),
    mk(3.1, 2, 'BUS_DASHCAM', 'REPAIRED', CORRIDOR_SPOTS[0]),
    mk(9.6, 4, 'CITIZEN_UPLOAD', 'DISPATCHED', CORRIDOR_SPOTS[3]),
    mk(22.8, 5, 'BUS_DASHCAM', 'REPAIRED', CORRIDOR_SPOTS[6]),
    mk(30.2, 3, 'CITIZEN_UPLOAD', 'REPAIRED', CORRIDOR_SPOTS[2]),
  ];
}

function seedSignals() {
  const t = Date.now();
  const junctions = [
    { signal_id: 'J-HOPE', junction_name: 'Hope College Junction', corridor: 'Avinashi Rd', lat: 11.0126, lng: 76.9643 },
    { signal_id: 'J-PEEL', junction_name: 'Peelamedu (PSG Tech)', corridor: 'Avinashi Rd', lat: 11.0168, lng: 76.9558 },
    { signal_id: 'J-CODI', junction_name: 'Codissia Junction', corridor: 'Avinashi Rd', lat: 11.0256, lng: 76.9467 },
    { signal_id: 'J-KMCH', junction_name: 'KMCH Junction', corridor: 'Avinashi Rd', lat: 11.0311, lng: 76.9386 },
    { signal_id: 'J-NEEL', junction_name: 'Neelambur Junction', corridor: 'Avinashi Rd', lat: 11.0523, lng: 76.9204 },
    { signal_id: 'J-KALA', junction_name: 'Kalapatti Junction', corridor: 'Saravanampatti Rd', lat: 11.0462, lng: 76.9855 },
    { signal_id: 'J-KGIS', junction_name: 'KGISPT IT Park', corridor: 'Saravanampatti Rd', lat: 11.0868, lng: 76.9989 },
    { signal_id: 'J-SARA', junction_name: 'Saravanampatti 4-Roads', corridor: 'Saravanampatti Rd', lat: 11.0965, lng: 77.0013 },
  ];
  return junctions.map((j, i) => ({
    ...j,
    current_phase: 'GREEN_WAVE',
    vehicle_count: randInt(24, 88),
    avg_speed_kmh: +rand(14, 38).toFixed(1),
    updated_at: new Date(t).toISOString(),
    green_wave_offset_s: i * 12, // corridor progression offset
    phase_ends_in_s: randInt(6, 40),
    green_extension_s: 0,
    priority_bus_approaching: false,
  }));
}

function seedFleet() {
  const college = [
    { bus_id: 'PG-CB-101', route_code: 'PSG-AVN', serve: 'PSG College of Technology' },
    { bus_id: 'PG-CB-102', route_code: 'CIT-AVN', serve: 'Coimbatore Institute of Technology' },
    { bus_id: 'PG-CB-103', route_code: 'PSGI-SVP', serve: 'PSG iTech (Neelambur)' },
    { bus_id: 'PG-CB-104', route_code: 'KG-SVP', serve: 'KG College / KGISPT staff' },
    { bus_id: 'PG-CB-105', route_code: 'SCH-TRIP', serve: 'Saravanampatti school cluster' },
    { bus_id: 'PG-CB-106', route_code: 'PSGI-SVP', serve: 'PSG iTech (evening run)' },
  ].map((b, i) => ({
    ...b,
    bus_type: 'COLLEGE_BUS',
    current_lat: +(11.01 + rand(-0.08, 0.08)).toFixed(4),
    current_lng: +(76.95 + rand(-0.05, 0.05)).toFixed(4),
    occupancy_percentage: randInt(35, 95),
    is_green_lane_authorized: true,
    status: ['EN ROUTE', 'AT CAMPUS', 'AT DEPOT', 'EN ROUTE', 'AT DEPOT', 'EN ROUTE'][i],
    camera_side_l: true,
    camera_side_r: true,
    next_departure: new Date(Date.now() + randInt(4, 55) * MIN).toISOString(),
  }));

  const evs = [
    { bus_id: 'PG-EV-201', current_lat: 11.0311, current_lng: 76.9386 },
    { bus_id: 'PG-EV-202', current_lat: 11.0168, current_lng: 76.9558 },
    { bus_id: 'PG-EV-203', current_lat: 11.0462, current_lng: 76.9855 },
    { bus_id: 'PG-EV-204', current_lat: 11.0868, current_lng: 76.9989 },
    { bus_id: 'PG-EV-205', current_lat: 11.0126, current_lng: 76.9643 },
    { bus_id: 'PG-EV-206', current_lat: 11.0965, current_lng: 77.0013 },
  ].map((b) => ({
    ...b,
    route_code: 'PG-EV-LOOP',
    bus_type: 'PUBLIC_EV',
    occupancy_percentage: randInt(20, 85),
    is_green_lane_authorized: false,
    battery_pct: randInt(45, 98),
    eta_next_stop_min: randInt(2, 11),
  }));
  return [...college, ...evs];
}

function seedViolations() {
  const t = Date.now();
  const mk = (minsAgo, spot) => ({
    id: nextId(),
    vehicle_reg: `TN 37 ${pick(['B', 'C', 'J'])} ${randInt(1000, 9999)}`,
    vehicle_type: pick(['Private car', 'Auto rickshaw', 'Two-wheeler', 'Commercial van']),
    camera_id: `CAM-GL-0${randInt(1, 6)} · side-mounted`,
    ...spot,
    detected_at: new Date(t - minsAgo * MIN).toISOString(),
    lane: 'GREEN LANE',
    fine_amount: 2000,
    status: 'NOTICE ISSUED',
    evidence_clip: `s3://pulsegrid-media/violations/gl-${nextId()}.mp4`,
  });
  return [
    mk(6, CORRIDOR_SPOTS[7]),
    mk(14, CORRIDOR_SPOTS[5]),
    mk(27, CORRIDOR_SPOTS[1]),
    mk(38, CORRIDOR_SPOTS[6]),
    mk(52, CORRIDOR_SPOTS[3]),
    mk(77, CORRIDOR_SPOTS[0]),
  ];
}

const db = {
  diagnostics: [],
  signals: [],
  fleet: [],
  violations: [],
  waitingAtHubs: [
    { hub: 'KGISPT IT Park gate', waiting: 23 },
    { hub: 'Saravanampatti 4-Roads', waiting: 31 },
    { hub: 'Peelamedu (PSG Tech)', waiting: 18 },
    { hub: 'Hope College Junction', waiting: 12 },
  ],
  emergency: { active: false, reason: null, activated_at: null },
};

export function resetMockStores() {
  db.diagnostics = seedDiagnostics();
  db.signals = seedSignals();
  db.fleet = seedFleet();
  db.violations = seedViolations();
  db.emergency = { active: false, reason: null, activated_at: null };
}
resetMockStores();

/* --------------------------- mock transport ---------------------------- */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function mockTransport(method, path, body) {
  const latency = randInt(220, 700);
  console.info(
    `%c→ ${method} ${path}`,
    'color:#00F0FF;font-weight:bold',
    body ? { request: body } : ''
  );
  await sleep(latency);
  const result = routeMock(method, path, body);
  console.info(
    `%c← 200 ${path}`,
    'color:#00FF66;font-weight:bold',
    { response: result }
  );
  return structuredClone(result);
}

async function httpTransport(method, path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
  return json;
}

function request(method, path, body) {
  return USE_MOCKS
    ? mockTransport(method, path, body)
    : httpTransport(method, path, body);
}

function findSignal(junctionId) {
  const s = db.signals.find((x) => x.signal_id === junctionId);
  if (!s) throw new Error(`Unknown junction: ${junctionId}`);
  return s;
}

/** Advance signal phases based on elapsed wall-clock time, drift counts. */
function tickSignals() {
  for (const s of db.signals) {
    if (s.current_phase === 'EMERGENCY_OVERRIDE') continue;
    s.phase_ends_in_s -= 1;
    s.vehicle_count = clamp(s.vehicle_count + randInt(-3, 4), 8, 140);
    s.avg_speed_kmh = +clamp(s.avg_speed_kmh + rand(-1.4, 1.2), 9, 52).toFixed(1);
    s.updated_at = new Date().toISOString();
    if (s.phase_ends_in_s <= 0) {
      if (s.current_phase === 'GREEN_WAVE') {
        s.current_phase = 'TRANSIT_PRIORITY';
        s.phase_ends_in_s = randInt(12, 25);
      } else {
        s.current_phase = 'GREEN_WAVE';
        s.phase_ends_in_s = randInt(30, 48);
      }
    }
  }
}

function routeMock(method, path, body) {
  const P = (re) => re.exec(path);

  /* ---------- diagnostics ---------- */
  if (method === 'GET' && path === '/diagnostics') {
    tickSignals();
    return { diagnostics: db.diagnostics, count: db.diagnostics.length };
  }

  if (method === 'POST' && path === '/diagnostics/citizen-report') {
    const vision = mockVisionAnalysis({
      damageType: body.damageTypeHint,
      hasPothole: body.hasPhoto ? undefined : Math.random() > 0.2,
    });
    const spot = CORRIDOR_SPOTS.find((s) => Math.abs(s.lat - body.lat) < 0.01) ||
      { label: `Geotagged @ ${body.lat.toFixed(4)}, ${body.lng.toFixed(4)}`, lat: body.lat, lng: body.lng };
    const diag = {
      id: nextId(),
      ...spot,
      severity_score: vision.hasPothole ? vision.severityScore : 1,
      image_url: `s3://pulsegrid-media/diagnostics/citizen-${nextId()}.jpg`,
      source_type: 'CITIZEN_UPLOAD',
      status: 'PENDING',
      created_at: new Date().toISOString(),
      sla_due_at: new Date(Date.now() + 24 * HOUR).toISOString(),
      dispatch_ticket: null,
      size_cm: vision.estimatedSizeCm ?? randInt(15, 70),
      ai_confidence: vision.confidence,
    };
    db.diagnostics.unshift(diag);
    return { diagnostic: diag, vision_analysis: vision };
  }

  if (method === 'POST' && path === '/diagnostics/edge-scan') {
    if (body.speed_kmh >= 60) {
      const err = new Error('Frame rejected: capture is only valid below 60 km/h');
      err.status = 422;
      throw err;
    }
    const vision = mockVisionAnalysis();
    const diag = {
      id: nextId(),
      label: `${body.camera_id ?? 'EDGE-CAM'} · ${body.lat.toFixed(4)}, ${body.lng.toFixed(4)}`,
      lat: body.lat,
      lng: body.lng,
      severity_score: vision.hasPothole ? vision.severityScore : 1,
      image_url: `s3://pulsegrid-media/diagnostics/edge-${nextId()}.jpg`,
      source_type: 'BUS_DASHCAM',
      status: vision.hasPothole && vision.severityScore >= 3 ? 'DISPATCHED' : 'PENDING',
      created_at: new Date().toISOString(),
      sla_due_at: new Date(Date.now() + 24 * HOUR).toISOString(),
      dispatch_ticket: vision.hasPothole && vision.severityScore >= 3 ? `CCMC-WRD-${randInt(4000, 5999)}` : null,
      size_cm: vision.estimatedSizeCm ?? randInt(15, 70),
      ai_confidence: vision.confidence,
    };
    if (diag.status === 'DISPATCHED') {
      diag.auto_dispatch = { repair_crew: 'CCMC Ward-32 road crew', eta_min: randInt(45, 180) };
    }
    db.diagnostics.unshift(diag);
    return { diagnostic: diag, vision_analysis: vision };
  }

  const mDiag = P(/^\/diagnostics\/(\d+)\/status$/);
  if (method === 'PATCH' && mDiag) {
    const diag = db.diagnostics.find((d) => d.id === +mDiag[1]);
    if (!diag) throw new Error('Diagnostic not found');
    diag.status = body.status;
    if (body.status === 'REPAIRED') diag.repaired_at = new Date().toISOString();
    return { diagnostic: diag };
  }

  /* ---------- signals ---------- */
  if (method === 'GET' && path === '/signals') {
    tickSignals();
    return { signals: db.signals };
  }

  const mSig = P(/^\/signals\/adaptive-status\/([A-Za-z0-9-]+)$/);
  if (method === 'GET' && mSig) {
    tickSignals();
    const s = findSignal(mSig[1]);
    const recommendedExtension = Math.min(
      30,
      Math.max(0, Math.floor(s.vehicle_count / 4) * 5 + (s.avg_speed_kmh < 18 ? 8 : 0))
    );
    return {
      signal: s,
      density: { vehicles: s.vehicle_count, queue_m: s.vehicle_count * 6.2, avg_speed_kmh: s.avg_speed_kmh },
      recommendation: {
        recommended_green_extension_s: recommendedExtension,
        rationale:
          s.avg_speed_kmh < 18
            ? 'Approach speed below free-flow threshold; transit priority advised.'
            : 'Density within green-wave envelope; hold coordinated offset.',
      },
    };
  }

  const mExt = P(/^\/signals\/([A-Za-z0-9-]+)\/extend-green$/);
  if (method === 'POST' && mExt) {
    const s = findSignal(mExt[1]);
    s.green_extension_s += body.seconds ?? 10;
    s.phase_ends_in_s += body.seconds ?? 10;
    s.current_phase = 'TRANSIT_PRIORITY';
    s.updated_at = new Date().toISOString();
    return { signal: s, applied_extension_s: body.seconds ?? 10 };
  }

  const mCyc = P(/^\/signals\/([A-Za-z0-9-]+)\/cycle-phase$/);
  if (method === 'POST' && mCyc) {
    const s = findSignal(mCyc[1]);
    s.current_phase = s.current_phase === 'GREEN_WAVE' ? 'TRANSIT_PRIORITY' : 'GREEN_WAVE';
    s.phase_ends_in_s = s.current_phase === 'GREEN_WAVE' ? randInt(30, 48) : randInt(12, 25);
    s.updated_at = new Date().toISOString();
    return { signal: s };
  }

  if (method === 'POST' && path === '/signals/emergency-override') {
    const activate = body.active !== false;
    db.emergency = {
      active: activate,
      reason: activate ? body.reason || 'Operator initiated' : null,
      activated_at: activate ? new Date().toISOString() : null,
    };
    for (const s of db.signals) {
      if (activate) {
        s._previous_phase = s.current_phase;
        s.current_phase = 'EMERGENCY_OVERRIDE';
      } else {
        s.current_phase = s._previous_phase || 'GREEN_WAVE';
      }
      s.updated_at = new Date().toISOString();
    }
    return {
      emergency: db.emergency,
      affected_signals: db.signals.length,
      override_window_s: 120,
    };
  }

  /* ---------- transit / green lane ---------- */
  if (method === 'GET' && path === '/transit/green-lane-violations') {
    return {
      violations: [...db.violations].sort((a, b) => new Date(b.detected_at) - new Date(a.detected_at)),
      fines_issued_today: db.violations.length,
      total_fine_amount: db.violations.length * 2000,
    };
  }

  if (method === 'POST' && path === '/transit/green-lane-sweep') {
    const added = [];
    const n = randInt(1, 2);
    for (let i = 0; i < n; i++) {
      const v = {
        id: nextId(),
        vehicle_reg: `TN 37 ${pick(['B', 'C', 'J'])} ${randInt(1000, 9999)}`,
        vehicle_type: pick(['Private car', 'Auto rickshaw', 'Two-wheeler', 'Commercial van']),
        camera_id: `CAM-GL-0${randInt(1, 6)} · side-mounted`,
        ...pick(CORRIDOR_SPOTS),
        detected_at: new Date().toISOString(),
        lane: 'GREEN LANE',
        fine_amount: 2000,
        status: 'NOTICE ISSUED',
        evidence_clip: `s3://pulsegrid-media/violations/gl-${nextId()}.mp4`,
      };
      db.violations.unshift(v);
      added.push(v);
    }
    return { new_violations: added, total_fines_today: db.violations.length * 2000 };
  }

  if (method === 'GET' && path === '/transit/fleet') {
    return { fleet: db.fleet, waiting_at_hubs: db.waitingAtHubs };
  }

  const mCap = P(/^\/transit\/fleet\/([A-Za-z0-9-]+)\/recalculate-capacity$/);
  if (method === 'POST' && mCap) {
    const affected = db.fleet.filter((b) => b.bus_type === 'PUBLIC_EV');
    for (const bus of affected) {
      bus.occupancy_percentage = clamp(bus.occupancy_percentage + randInt(-12, 26), 5, 100);
      bus.eta_next_stop_min = randInt(2, 11);
    }
    let absorbed = 0;
    for (const hub of db.waitingAtHubs) {
      const take = Math.min(hub.waiting, randInt(0, 14));
      hub.waiting -= take;
      absorbed += take;
    }
    return {
      route_code: 'PG-EV-LOOP',
      buses: affected,
      passengers_absorbed: absorbed,
      waiting_at_hubs: db.waitingAtHubs,
      recommendation:
        absorbed > 40
          ? 'Surge detected on Saravanampatti corridor — dispatch reserve EV bus PG-EV-207 from Ukkadam depot.'
          : 'Capacity sufficient. No reserve bus required this cycle.',
      computed_at: new Date().toISOString(),
    };
  }

  const mDisp = P(/^\/transit\/fleet\/([A-Za-z0-9-]+)\/dispatch$/);
  if (method === 'POST' && mDisp) {
    const bus = db.fleet.find((b) => b.bus_id === mDisp[1]);
    if (!bus) throw new Error('Bus not found');
    bus.status = 'EN ROUTE';
    bus.next_departure = new Date(Date.now() + 1 * MIN).toISOString();
    bus.occupancy_percentage = clamp(bus.occupancy_percentage + randInt(10, 30), 10, 100);
    return { bus, dispatched: true };
  }

  throw new Error(`No mock route: ${method} ${path}`);
}

/* ---------------------------- public API ------------------------------ */

export const api = {
  resetAll: () => resetMockStores(),

  /* Module 1 — Germany PMS */
  getDiagnostics: () => request('GET', '/diagnostics'),
  citizenReport: (payload) => request('POST', '/diagnostics/citizen-report', payload),
  edgeScan: (payload) => request('POST', '/diagnostics/edge-scan', payload),
  updateDiagnosticStatus: (id, status) =>
    request('PATCH', `/diagnostics/${id}/status`, { status }),

  /* Module 2 — USA ITS */
  getSignals: () => request('GET', '/signals'),
  getAdaptiveStatus: (junctionId) => request('GET', `/signals/adaptive-status/${junctionId}`),
  extendGreen: (junctionId, seconds = 10) =>
    request('POST', `/signals/${junctionId}/extend-green`, { seconds }),
  cyclePhase: (junctionId) => request('POST', `/signals/${junctionId}/cycle-phase`),
  emergencyOverride: (payload) => request('POST', '/signals/emergency-override', payload),

  getGreenLaneViolations: () => request('GET', '/transit/green-lane-violations'),
  sweepGreenLane: () => request('POST', '/transit/green-lane-sweep', {}),

  /* Module 3 — UK DRT */
  getFleet: () => request('GET', '/transit/fleet'),
  recalculateCapacity: (routeCode = 'PG-EV-LOOP') =>
    request('POST', `/transit/fleet/${routeCode}/recalculate-capacity`, { route_code: routeCode }),
  dispatchBus: (busId) => request('POST', `/transit/fleet/${busId}/dispatch`, {}),
};

export const isGreenLaneWindow = (date = new Date()) => {
  const h = date.getHours();
  return (h >= 7 && h < 10) || (h >= 14 && h < 17);
};

export default api;

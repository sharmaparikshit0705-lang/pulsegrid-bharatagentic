/**
 * PulseGrid agent core — corridor world model.
 *
 * Static, deterministic data describing the Coimbatore–Kochi freight/mobility
 * corridor: the road graph, cold-chain facilities, rest facilities, commodities,
 * signalised junctions, drivers and known crash hotspots.
 *
 * Everything here is simulated data for the prototype. Nothing in this file
 * depends on the DOM, so it runs identically in the browser and in Node.
 */

/* ----------------------------- seeded RNG ----------------------------- */
/** Deterministic PRNG (mulberry32) so every agent run is reproducible. */
export function makeRng(seed = 42) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------ road graph ---------------------------- */
/** Nodes on the Coimbatore → Kochi corridor (approximate coordinates). */
export const NODES = {
  CBE: { id: 'CBE', name: 'Coimbatore (origin hub)', lat: 11.0168, lng: 76.9558 },
  PALAKKAD: { id: 'PALAKKAD', name: 'Palakkad', lat: 10.7867, lng: 76.6548 },
  THRISSUR: { id: 'THRISSUR', name: 'Thrissur', lat: 10.5276, lng: 76.2144 },
  POLLACHI: { id: 'POLLACHI', name: 'Pollachi', lat: 10.6580, lng: 77.0080 },
  CHALAKUDY: { id: 'CHALAKUDY', name: 'Chalakudy', lat: 10.3061, lng: 76.3320 },
  KOCHI: { id: 'KOCHI', name: 'Kochi (port / destination)', lat: 9.9312, lng: 76.2673 },
};

/** Directed edges: distance, free-flow drive time, toll, and which hazard it crosses. */
export const EDGES = [
  { from: 'CBE', to: 'PALAKKAD', via: 'NH-544', distanceKm: 55, driveMinutes: 65, tollInr: 0, crosses: ['flood-thrissur'] },
  { from: 'PALAKKAD', to: 'THRISSUR', via: 'NH-544', distanceKm: 75, driveMinutes: 80, tollInr: 90, crosses: ['flood-thrissur'] },
  { from: 'THRISSUR', to: 'KOCHI', via: 'NH-544', distanceKm: 60, driveMinutes: 65, tollInr: 85, crosses: [] },
  { from: 'CBE', to: 'POLLACHI', via: 'NH-209', distanceKm: 48, driveMinutes: 65, tollInr: 0, crosses: [] },
  { from: 'POLLACHI', to: 'CHALAKUDY', via: 'SH-21', distanceKm: 165, driveMinutes: 200, tollInr: 0, crosses: [] },
  { from: 'CHALAKUDY', to: 'KOCHI', via: 'NH-544', distanceKm: 55, driveMinutes: 55, tollInr: 70, crosses: [] },
];

export const HAZARDS = {
  'flood-thrissur': {
    id: 'flood-thrissur',
    type: 'flood',
    label: 'Flash flood — NH-544 near Thrissur',
    severity: 'high',
    validHours: 4,
    source: 'IMD alert feed (simulated)',
    polygon: { centre: NODES.THRISSUR, radiusKm: 18 },
  },
};

/* --------------------------- cold-chain assets ------------------------- */
export const PRECOOLING_NODES = [
  { id: 'PC-CHALAKUDY-02', name: 'Chalakudy pre-cooling unit', lat: 10.3061, lng: 76.3320, preCoolMinutes: 18, capacityFreeTonnes: 40, costInr: 6800 },
  { id: 'PC-ALUVA-01', name: 'Aluva cold store', lat: 10.1076, lng: 76.3516, preCoolMinutes: 22, capacityFreeTonnes: 25, costInr: 8100 },
  { id: 'PC-PALAKKAD-03', name: 'Palakkad ripening + cold hub', lat: 10.7867, lng: 76.6548, preCoolMinutes: 15, capacityFreeTonnes: 55, costInr: 5900 },
];

export const REST_FACILITIES = [
  { id: 'RF-ANNUR-01', name: 'Annur truckers plaza', lat: 11.0936, lng: 77.1003, kmFromCorridor: 2.1, amenities: ['showers', 'meals', 'parking', 'clinic'] },
  { id: 'RF-WALAYAR-02', name: 'Walayar check-post rest stop', lat: 10.8562, lng: 76.8550, kmFromCorridor: 0.8, amenities: ['meals', 'parking', 'toilets'] },
  { id: 'RF-ANGAMALY-03', name: 'Angamaly driver facility', lat: 10.1960, lng: 76.3860, kmFromCorridor: 1.4, amenities: ['meals', 'parking', 'showers'] },
];

/* ------------------------------ commodities ---------------------------- */
export const COMMODITIES = {
  vaccines: {
    id: 'vaccines',
    label: 'Temperature-sensitive vaccines',
    toleranceC: [2, 8],
    baseShelfLifeHours: 96,
    valuePerTonneInr: 9_000_000,
    decayPerDegreeAboveBand: 0.35, // fractional shelf-life penalty per °C-hour out of band
    hazmat: false,
  },
  hill_vegetables: {
    id: 'hill_vegetables',
    label: 'Hill vegetables (export grade)',
    toleranceC: [2, 10],
    baseShelfLifeHours: 96,
    valuePerTonneInr: 153_000,
    decayPerDegreeAboveBand: 0.22,
    hazmat: false,
  },
  dairy: {
    id: 'dairy',
    label: 'Chilled dairy',
    toleranceC: [2, 6],
    baseShelfLifeHours: 120,
    valuePerTonneInr: 420_000,
    decayPerDegreeAboveBand: 0.4,
    hazmat: false,
  },
};

/* ------------------------------- shipments ----------------------------- */
export const SHIPMENTS = {
  'S-4471': {
    id: 'S-4471',
    commodity: 'vaccines',
    tonnes: 8,
    from: 'CBE',
    to: 'KOCHI',
    consignor: 'Coimbatore vaccine depot',
    consignee: 'Kochi cold-chain consignee',
    deliveryWindow: 'by 20:00 today',
    contractId: 'CTR-8841',
    requiresApprovalAboveInr: 0, // consignee policy: every cost change needs sign-off
  },
  'S-5510': {
    id: 'S-5510',
    commodity: 'hill_vegetables',
    tonnes: 6,
    from: 'CBE', // standing in for Ooty consolidation, already en route
    to: 'KOCHI',
    consignor: 'Nilgiris FPO consolidation centre',
    consignee: 'Kochi export house',
    deliveryWindow: 'export cut-off 20:00 today',
    contractId: 'CTR-9022',
    requiresApprovalAboveInr: 25_000,
  },
};

/* --------------------------- signalised junctions ---------------------- */
export const CORRIDOR_JUNCTIONS = [
  { id: 'J-HOPE', name: 'Hope College Junction', lat: 11.0126, lng: 76.9643, density: 62 },
  { id: 'J-PEEL', name: 'Peelamedu (PSG Tech)', lat: 11.0168, lng: 76.9558, density: 88 },
  { id: 'J-CODI', name: 'Codissia Junction', lat: 11.0256, lng: 76.9467, density: 47 },
  { id: 'J-KMCH', name: 'KMCH Junction', lat: 11.0311, lng: 76.9386, density: 53 },
  { id: 'J-NEEL', name: 'Neelambur Junction', lat: 11.0523, lng: 76.9204, density: 39 },
  { id: 'J-KALA', name: 'Kalapatti Junction', lat: 11.0462, lng: 76.9855, density: 71 },
  { id: 'J-KGIS', name: 'KGISPT IT Park', lat: 11.0868, lng: 76.9989, density: 44 },
  { id: 'J-SARA', name: 'Saravanampatti 4-Roads', lat: 11.0965, lng: 77.0013, density: 84 },
];

/* ---------------------------- known hotspots --------------------------- */
export const HOTSPOTS = [
  { id: 'HS-AVINASHI-01', label: 'Avinashi Rd · Peelamedu stretch', lat: 11.0168, lng: 76.9558, crashCluster: true, schoolNearby: true, recentDefects: 4, fatalCrashes12m: 7 },
  { id: 'HS-SARA-02', label: 'Saravanampatti 4-Roads', lat: 11.0965, lng: 77.0013, crashCluster: true, schoolNearby: false, recentDefects: 2, fatalCrashes12m: 11 },
  { id: 'HS-KALA-03', label: 'Kalapatti junction approach', lat: 11.0462, lng: 76.9855, crashCluster: true, schoolNearby: true, recentDefects: 3, fatalCrashes12m: 5 },
];

/* -------------------------------- drivers ------------------------------ */
export const DRIVERS = {
  'D-2201': { id: 'D-2201', name: 'Driver #2201', vehicleId: 'TN-37-EV-2214', continuousHours: 8.4, restTakenH: 0.5, shiftCapHours: 10, language: 'ta-IN' },
  'D-3310': { id: 'D-3310', name: 'Driver #3310', vehicleId: 'KL-07-REE-8890', continuousHours: 6.1, restTakenH: 1.0, shiftCapHours: 10, language: 'ml-IN' },
};

/* ------------------------------- helpers ------------------------------- */
export function pathBetween(edges, from, to) {
  // Small graph — exhaustive simple-path search is fine at this scale.
  const paths = [];
  const walk = (node, acc, visited) => {
    if (node === to) {
      paths.push([...acc]);
      return;
    }
    for (const e of edges) {
      if (e.from === node && !visited.has(e.to)) {
        visited.add(e.to);
        walk(e.to, [...acc, e], visited);
        visited.delete(e.to);
      }
    }
  };
  walk(from, [], new Set([from]));
  return paths;
}

export function summarisePath(path) {
  return {
    nodes: [path[0].from, ...path.map((e) => e.to)],
    via: path.map((e) => e.via).join(' → '),
    distanceKm: path.reduce((a, e) => a + e.distanceKm, 0),
    driveMinutes: path.reduce((a, e) => a + e.driveMinutes, 0),
    tollInr: path.reduce((a, e) => a + e.tollInr, 0),
    hazardsCrossed: [...new Set(path.flatMap((e) => e.crosses))],
  };
}

export function haversineKm(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return +(2 * R * Math.asin(Math.sqrt(s))).toFixed(1);
}

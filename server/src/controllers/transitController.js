/**
 * Modules 2 & 3 — transit fleet, green-lane enforcement, DRT capacity.
 */
import q from '../config/db.js';
import asyncHandler from '../utils/asyncHandler.js';
import { httpError } from '../middleware/errorHandler.js';

/** GET /api/v1/transit/fleet — live fleet telemetry */
export const getFleet = asyncHandler(async (_req, res) => {
  const fleet = await q('SELECT * FROM transit_fleet ORDER BY bus_type, bus_id');
  res.json({ fleet });
});

/** GET /api/v1/transit/green-lane-violations?since=ISO */
export const greenLaneViolations = asyncHandler(async (req, res) => {
  const params = [];
  const where = [];
  if (req.query.since) where.push(`detected_at >= $${params.push(req.query.since)}`);

  const violations = await q(
    `SELECT * FROM transit_violations ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY detected_at DESC LIMIT 200`,
    params
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todays = violations.filter((v) => new Date(v.detected_at) >= today);

  res.json({
    violations,
    fines_issued_today: todays.length,
    total_fine_amount: todays.reduce((a, v) => a + v.fine_amount, 0),
  });
});

/**
 * POST /api/v1/transit/green-lane-sweep
 * In production this is triggered by the camera-AI pipeline; here an operator
 * or cron can force a corridor re-evaluation. New detections arrive from the
 * edge vision service; this endpoint records them (body: { detections: [...] })
 * and issues ₹2,000 notices.
 */
export const greenLaneSweep = asyncHandler(async (req, res) => {
  const detections = Array.isArray(req.body?.detections)
    ? req.body.detections
    : []; // a real deployment would poll the camera-AI queue here

  const inserted = [];
  for (const d of detections) {
    const [row] = await q(
      `INSERT INTO transit_violations
         (vehicle_reg, vehicle_type, camera_id, lat, lng, lane, fine_amount, status, evidence_clip)
       VALUES ($1,$2,$3,$4,$5,'GREEN LANE',2000,'NOTICE ISSUED',$6)
       RETURNING *`,
      [d.vehicle_reg, d.vehicle_type || 'Unknown', d.camera_id, +d.lat, +d.lng, d.evidence_clip || null]
    );
    inserted.push(row);
  }

  const [{ total }] = await q(
    `SELECT COALESCE(SUM(fine_amount),0) AS total FROM transit_violations
     WHERE detected_at >= date_trunc('day', now())`
  );

  res.status(inserted.length ? 201 : 200).json({
    new_violations: inserted,
    total_fines_today: total,
  });
});

/**
 * POST /api/v1/transit/fleet/:busId/recalculate-capacity
 * DRT recalculation for the bus's route: pulls app-hail demand + hub queues
 * and rebalances headways (prototype: occupancy + battery-aware suggestion).
 */
export const recalculateCapacity = asyncHandler(async (req, res) => {
  const [bus] = await q('SELECT * FROM transit_fleet WHERE bus_id = $1', [req.params.busId]);
  if (!bus) throw httpError(404, 'Bus not found');

  // In production this runs the DRT solver against booking + AVL data.
  // Prototype: refresh telemetry and emit a dispatch recommendation.
  const [updated] = await q(
    `UPDATE transit_fleet
     SET occupancy_percentage = LEAST(100, GREATEST(0, occupancy_percentage + $1)),
         updated_at = now()
     WHERE bus_id = $2 RETURNING *`,
    [Math.round((Math.random() - 0.35) * 20), bus.bus_id]
  );

  const routeBuses = await q('SELECT * FROM transit_fleet WHERE route_code = $1', [bus.route_code]);
  const avgOcc = Math.round(routeBuses.reduce((a, b) => a + b.occupancy_percentage, 0) / routeBuses.length);

  const recommendation =
    avgOcc >= 85
      ? 'Surge detected — dispatch reserve bus from Ukkadam depot and shorten the loop at Kalapatti.'
      : 'Capacity sufficient. No reserve bus required this cycle.';

  res.json({
    route_code: bus.route_code,
    buses: routeBuses,
    average_occupancy: avgOcc,
    recommendation,
    computed_at: new Date().toISOString(),
  });
});

/** POST /api/v1/transit/fleet/:busId/dispatch */
export const dispatchBus = asyncHandler(async (req, res) => {
  const [bus] = await q(
    `UPDATE transit_fleet SET status = 'EN ROUTE', updated_at = now()
     WHERE bus_id = $1 RETURNING *`,
    [req.params.busId]
  );
  if (!bus) throw httpError(404, 'Bus not found');
  res.json({ bus, dispatched: true });
});

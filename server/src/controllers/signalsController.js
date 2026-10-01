/**
 * Module 2 — adaptive traffic signals (USA ITS model).
 * Density-aware green extensions, corridor green-wave coordination,
 * and the global EMERGENCY_OVERRIDE.
 */
import q from '../config/db.js';
import asyncHandler from '../utils/asyncHandler.js';
import { httpError } from '../middleware/errorHandler.js';

/** GET /api/v1/signals — all corridor controllers */
export const listSignals = asyncHandler(async (_req, res) => {
  const rows = await q('SELECT * FROM traffic_signals ORDER BY corridor, junction_name');
  res.json({ signals: rows });
});

/**
 * GET /api/v1/signals/adaptive-status/:junctionId
 * Real-time density + the computed green-light phase extension.
 */
export const adaptiveStatus = asyncHandler(async (req, res) => {
  const [signal] = await q('SELECT * FROM traffic_signals WHERE signal_id = $1', [req.params.junctionId]);
  if (!signal) throw httpError(404, `Unknown junction: ${req.params.junctionId}`);

  // Adaptive control law (prototype): one extra second per 4 queued vehicles,
  // plus an 8 s boost when approach speed collapses under 18 km/h.
  const recommendedExtension = Math.min(
    30,
    Math.max(0, Math.floor(signal.vehicle_count / 4) * 5 + (signal.avg_speed_kmh < 18 ? 8 : 0))
  );

  res.json({
    signal,
    density: {
      vehicles: signal.vehicle_count,
      queue_m: Math.round(signal.vehicle_count * 6.2),
      avg_speed_kmh: signal.avg_speed_kmh,
    },
    recommendation: {
      recommended_green_extension_s: recommendedExtension,
      phase: recommendedExtension > 0 ? 'TRANSIT_PRIORITY' : 'GREEN_WAVE',
      rationale:
        signal.avg_speed_kmh < 18
          ? 'Approach speed below free-flow threshold; transit priority advised.'
          : 'Density within green-wave envelope; hold coordinated offset.',
    },
  });
});

/** POST /api/v1/signals/:junctionId/extend-green  body: { seconds } */
export const extendGreen = asyncHandler(async (req, res) => {
  const seconds = Math.min(30, Math.max(1, +(req.body?.seconds || 10)));
  const [signal] = await q(
    `UPDATE traffic_signals
     SET current_phase = 'TRANSIT_PRIORITY',
         green_extension_s = green_extension_s + $1
     WHERE signal_id = $2 RETURNING *`,
    [seconds, req.params.junctionId]
  );
  if (!signal) throw httpError(404, 'Unknown junction');
  res.json({ signal, applied_extension_s: seconds });
});

/** POST /api/v1/signals/:junctionId/cycle-phase */
export const cyclePhase = asyncHandler(async (req, res) => {
  const [current] = await q('SELECT current_phase FROM traffic_signals WHERE signal_id = $1', [
    req.params.junctionId,
  ]);
  if (!current) throw httpError(404, 'Unknown junction');

  const next =
    current.current_phase === 'EMERGENCY_OVERRIDE'
      ? 'GREEN_WAVE'
      : current.current_phase === 'GREEN_WAVE'
      ? 'TRANSIT_PRIORITY'
      : 'GREEN_WAVE';

  const [signal] = await q(
    `UPDATE traffic_signals SET current_phase = $1 WHERE signal_id = $2 RETURNING *`,
    [next, req.params.junctionId]
  );
  res.json({ signal });
});

/**
 * POST /api/v1/signals/emergency-override
 * body: { junctionIds: string[] | 'ALL', reason, active? }
 */
export const emergencyOverride = asyncHandler(async (req, res) => {
  const { junctionIds = 'ALL', reason = 'Operator initiated', active = true } = req.body;

  const affected = await q(
    active
      ? `UPDATE traffic_signals SET current_phase = 'EMERGENCY_OVERRIDE' RETURNING signal_id`
      : `UPDATE traffic_signals SET current_phase = 'GREEN_WAVE' RETURNING signal_id`,
    []
  );

  const touched =
    junctionIds === 'ALL' ? affected : affected.filter((s) => junctionIds.includes(s.signal_id));

  await q(
    `INSERT INTO emergency_overrides (signal_ids, reason, activated_by, stood_down_at)
     VALUES ($1, $2, 'operator', $3)`,
    [touched.map((s) => s.signal_id), reason, active ? null : new Date()]
  );

  res.json({
    emergency: { active, reason },
    affected_signals: touched.length,
    override_window_s: 120,
  });
});

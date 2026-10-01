/**
 * Vision service — provider-agnostic road-damage analysis.
 *
 * analyzeRoadDamage(imageBuffer, mimeType) returns a strictly-validated verdict:
 *   { hasPothole, severityScore (1–5), damageType, recommendedAction,
 *     estimatedSizeCm, confidence, model }
 *
 * Configuration (all optional):
 *   VISION_API_URL — a JSON endpoint that accepts { mimeType, image } (base64)
 *                    and returns the verdict object above.
 *   VISION_API_KEY — bearer token for that endpoint.
 *
 * With no endpoint configured the service falls back to a deterministic
 * heuristic, clearly labelled in the response, so the prototype never
 * hard-fails and nothing is misrepresented as a live model call.
 */

const MODEL_NAME = process.env.VISION_MODEL || 'pulsegrid-vision-v1';

/** Validate/normalise whatever the vision endpoint returned. */
function coerceVerdict(raw, source) {
  const v = typeof raw === 'string' ? JSON.parse(raw) : raw;
  return {
    hasPothole: Boolean(v.hasPothole),
    severityScore: Math.min(5, Math.max(1, Math.round(Number(v.severityScore) || 1))),
    damageType: String(v.damageType || 'Unknown'),
    recommendedAction: String(v.recommendedAction || 'Manual inspection required.'),
    estimatedSizeCm: Math.max(1, Math.round(Number(v.estimatedSizeCm) || 20)),
    confidence: Math.min(1, Math.max(0, Number(v.confidence) || 0.8)),
    model: source,
  };
}

/** Offline fallback — keeps the prototype usable with no endpoint configured. */
function heuristicVerdict(imageBuffer) {
  const seed = (imageBuffer?.length || 0) % 10;
  const hasPothole = seed > 2;
  const severityScore = hasPothole ? (seed >= 8 ? 5 : seed >= 6 ? 4 : seed >= 4 ? 3 : 2) : 1;
  const types = ['Pothole', 'Alligator Cracking', 'Longitudinal Cracking', 'Edge Break', 'Rutting'];
  const actions = {
    1: 'Log only — monitor across next edge scans.',
    2: 'Queue for routine maintenance within the monthly cycle.',
    3: 'Cold-mix patch within SLA (24h). Notify CCMC ward engineer.',
    4: 'Hot-mix patch within SLA. Cone off lane; prioritise repair crew.',
    5: 'Immediate hazard. Dispatch crew now + traffic diversion (cc: traffic police).',
  };
  return {
    hasPothole,
    severityScore,
    damageType: hasPothole ? types[seed % types.length] : 'No significant defect detected',
    recommendedAction: actions[severityScore],
    estimatedSizeCm: 15 + seed * 7,
    confidence: 0.62,
    model: 'heuristic-fallback (VISION_API_URL not set)',
  };
}

/**
 * @param {Buffer} imageBuffer raw JPEG/PNG bytes
 * @param {string} mimeType   image/jpeg | image/png | image/webp
 * @returns {Promise<object>} validated verdict
 */
export async function analyzeRoadDamage(imageBuffer, mimeType = 'image/jpeg') {
  const url = process.env.VISION_API_URL;
  const key = process.env.VISION_API_KEY;

  if (!url) {
    console.warn('[vision] VISION_API_URL not set — using the deterministic fallback');
    return heuristicVerdict(imageBuffer);
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(key ? { authorization: `Bearer ${key}` } : {}),
    },
    body: JSON.stringify({
      model: MODEL_NAME,
      mimeType,
      image: imageBuffer.toString('base64'),
      task: 'road_damage_assessment',
    }),
  });

  if (!res.ok) throw new Error(`Vision endpoint returned ${res.status}`);
  const json = await res.json();
  return coerceVerdict(json.verdict ?? json, MODEL_NAME);
}

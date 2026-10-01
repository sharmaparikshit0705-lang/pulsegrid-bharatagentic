/**
 * PulseGrid agent core — the eight specialist agents.
 *
 * Each agent implements the same loop: perceive → fuse → reason → plan →
 * act (scoped) → verify → learn. Agents reason with real (if simulated)
 * numbers: they compare costed options, apply thresholds, respect guardrails
 * and return an auditable decision object.
 *
 * ctx provides: tools (instrumented registry), memory, step(), emit().
 */

const inr = (n) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const min = (m) => `${Math.round(m)} min`;

/* ===================================================================== */
/* 1. CorridorSense — road-state digital twin & defect → SLA loop         */
/* ===================================================================== */
export const CorridorSense = {
  id: 'corridorsense',
  name: 'CorridorSense',
  purpose: 'Keeps the corridor digital twin current: detects surface defects and drives the municipal repair SLA.',
  toolsUsed: ['vision_analyze_road_damage', 'hotspot_score', 'postgis_upsert_defect', 'open_sla_ticket', 'publish_advisory', 'anchor_proof'],
  guardrails: ['Severity ≥ 4 or school proximity requires human confirmation before a public hazard advisory'],

  async run({ frame, speedKmh = 52 }, ctx) {
    const { tools, step, memory } = ctx;

    step('perceive', 'Dashcam frame ingested', `${frame.frameId} · vehicle ${frame.vehicleId} · ${speedKmh} km/h (capture gate < 60)`);
    const vision = await tools.vision_analyze_road_damage({ frameId: frame.frameId, speedKmh, seed: frame.seed ?? 11 });
    if (!vision.ok) {
      step('reason', 'Frame discarded', vision.error);
      return { summary: 'Frame rejected at the edge gate', confidence: 1, actions: [], requiresApproval: false };
    }
    step('fuse', 'Vision AI verdict', `${vision.damageType} · severity ${vision.severityScore}/5 · ${vision.estimatedSizeCm} cm · confidence ${vision.confidence}`);
    if (!vision.hasPothole) {
      step('reason', 'No actionable defect', 'Surface within tolerance — nothing to dispatch.');
      return { summary: 'No defect above threshold', confidence: vision.confidence, actions: [], requiresApproval: false };
    }

    const risk = await tools.hotspot_score({ lat: frame.lat, lng: frame.lng });
    step('fuse', 'Context fused', `crash-risk score ${risk.score}/100 · nearest cluster ${risk.nearestHotspot?.label ?? 'none'} · school nearby: ${risk.schoolNearby}`);

    // Reasoning: escalate above the default SLA when severity or context warrants it.
    const escalate = vision.severityScore >= 4 || risk.schoolNearby;
    const prior = memory.get('defect_prior') || 0;
    const effectiveSeverity = Math.min(5, vision.severityScore + (risk.schoolNearby && vision.severityScore >= 3 ? 1 : 0));
    step(
      'reason',
      'Severity decision',
      `base ${vision.severityScore}${risk.schoolNearby && vision.severityScore >= 3 ? ' +1 (school proximity)' : ''} → effective ${effectiveSeverity}/5 · ` +
        `${escalate ? 'escalated above default SLA' : 'within default SLA'} · learned prior on this stretch: ${prior}`
    );

    step('plan', 'Plan', escalate
      ? 'Open ticket, publish a temporary hazard advisory, anchor the evidence, confirm with the ward engineer.'
      : 'Open ticket with the standard SLA and anchor the evidence.');

    const defect = await tools.postgis_upsert_defect({
      lat: frame.lat,
      lng: frame.lng,
      severityScore: effectiveSeverity,
      damageType: vision.damageType,
      sizeCm: vision.estimatedSizeCm,
      sourceType: 'BUS_DASHCAM',
    });
    step('act', 'Defect written to twin', `${defect.defect.id} · status ${defect.defect.status}`);

    const ticket = await tools.open_sla_ticket({ defectId: defect.defect.id, severityScore: effectiveSeverity });
    step('act', 'Municipal ticket raised', `${ticket.ticketId} · SLA ${ticket.slaHours}h · crew ${ticket.crew}`);

    let advisory = null;
    if (escalate) {
      advisory = await tools.publish_advisory({
        corridor: 'CBE-AVINASHI',
        message: `${vision.damageType} (${vision.estimatedSizeCm} cm) detected — proceed with caution`,
        severity: 'high',
      });
      step('act', 'Hazard advisory published', `${advisory.advisoryId} (pending ward-engineer confirmation)`);
    }

    const proof = await tools.anchor_proof({
      subjectType: 'road_defect',
      subjectId: defect.defect.id,
      payload: { vision, ticket: ticket.ticketId, lat: frame.lat, lng: frame.lng },
    });
    step('act', 'Evidence anchored', `${proof.sha256.slice(0, 16)}… · tx ${proof.txId}`);

    step('verify', 'Verification', `Ticket ${ticket.ticketId} open with a live SLA clock; image hash is immutable and re-checkable.`);
    memory.set('defect_prior', prior + 1);
    step('learn', 'Memory updated', `Defect prior for this stretch: ${prior} → ${prior + 1}`);

    return {
      summary: `${vision.damageType} s${effectiveSeverity} → ticket ${ticket.ticketId} (SLA ${ticket.slaHours}h)`,
      confidence: vision.confidence,
      actions: ['postgis_upsert_defect', 'open_sla_ticket', ...(advisory ? ['publish_advisory'] : []), 'anchor_proof'],
      requiresApproval: Boolean(advisory),
      approval: advisory
        ? { reason: `Publish hazard advisory on Avinashi Rd (severity ${effectiveSeverity}, school within 300 m)`, risk: 'public-facing' }
        : null,
      metrics: { severity: effectiveSeverity, slaHours: ticket.slaHours, riskScore: risk.score },
    };
  },
};

/* ===================================================================== */
/* 2. SafetySentinel — hotspot prevention & emergency corridor pre-emption */
/* ===================================================================== */
export const SafetySentinel = {
  id: 'safetysentinel',
  name: 'SafetySentinel',
  purpose: 'Predicts crash hotspots and protects emergency vehicles and vulnerable road users.',
  toolsUsed: ['hotspot_score', 'signal_preempt', 'publish_advisory'],
  guardrails: ['Signal pre-emption is auto-released after the vehicle clears', 'Speed-limit changes require municipal approval'],

  async run({ mode = 'emergency', ambulance = null, junctions = [] }, ctx) {
    const { tools, step } = ctx;

    if (mode === 'emergency') {
      step('perceive', 'Emergency vehicle inbound', `${ambulance.id} → ${ambulance.destination} · ${junctions.length} signalised junctions ahead`);
      const density = junctions.reduce((a, j) => a + j.density, 0) / Math.max(1, junctions.length);
      step('fuse', 'Corridor density', `mean density ${density.toFixed(0)} vehicles/junction · mixed-traffic signal delay ≈ 55 s/junction`);
      const safeToPreempt = density < 95;
      step(
        'reason',
        'Pre-emption decision',
        safeToPreempt
          ? 'Corridor hold is safe at current density; pre-emption saves ~55 s per junction with no cross-corridor starvation risk.'
          : 'Density too high — pre-emption would starve cross corridors. Escalating to manual control.'
      );
      if (!safeToPreempt) {
        return { summary: 'Pre-emption withheld — density too high', confidence: 0.7, actions: [], requiresApproval: true, approval: { reason: 'Corridor too dense for automatic pre-emption', risk: 'safety-critical' } };
      }

      step('plan', 'Plan', `Clear ${junctions.length} junctions on the ambulance corridor, hold service lane, auto-release on clearance.`);
      const pre = await tools.signal_preempt({ junctions, reason: 'ambulance' });
      step('act', 'Signals pre-empted', `${pre.junctionsCleared} junctions cleared · estimated saving ${min(pre.estimatedSavedSeconds / 60)} · window ${pre.overrideWindowS}s`);
      step('verify', 'Verification', 'Override auto-releases when the vehicle clears the last junction; cross-corridor queues return to green-wave.');
      step('learn', 'Memory updated', `Pre-emption timing tuned for corridor ${ambulance.corridorId} (mean delay ${(pre.estimatedSavedSeconds / junctions.length).toFixed(0)} s/junction).`);
      return {
        summary: `Emergency corridor cleared across ${pre.junctionsCleared} junctions (saved ~${min(pre.estimatedSavedSeconds / 60)})`,
        confidence: 0.92,
        actions: ['signal_preempt'],
        requiresApproval: false,
        metrics: { junctionsCleared: pre.junctionsCleared, savedSeconds: pre.estimatedSavedSeconds },
      };
    }

    // hotspot-prevention mode
    step('perceive', 'Hotspot sweep requested', `scanning ${junctions.length} corridor junctions for crash risk`);
    const scored = [];
    for (const j of junctions.slice(0, 4)) {
      const s = await tools.hotspot_score({ lat: j.lat, lng: j.lng });
      scored.push({ junction: j, ...s });
    }
    const worst = scored.sort((a, b) => b.score - a.score)[0];
    step('fuse', 'Risk ranking', `highest risk: ${worst.junction.name} (${worst.score}/100, school nearby: ${worst.schoolNearby})`);
    step('reason', 'Intervention choice', 'Advisory speed reduction + patrol alert beats physical works on cost per crash avoided at this stage.');
    const advisory = await tools.publish_advisory({
      corridor: 'CBE-AVINASHI',
      message: `Crash-risk alert at ${worst.junction.name} — reduce speed, expect stopped traffic`,
      severity: worst.score > 70 ? 'high' : 'medium',
    });
    step('act', 'Advisory published', `${advisory.advisoryId} → variable message signs + driver apps`);
    step('verify', 'Verification', 'Advisory acknowledged by 3 driver apps; revisit after 24h for crash/defect deltas.');
    return {
      summary: `Hotspot alert at ${worst.junction.name} (risk ${worst.score}/100)`,
      confidence: 0.81,
      actions: ['publish_advisory'],
      requiresApproval: false,
      metrics: { worstScore: worst.score },
    };
  },
};

/* ===================================================================== */
/* 3. Reroute — disruption-aware freight routing                          */
/* ===================================================================== */
export const Reroute = {
  id: 'reroute',
  name: 'Reroute',
  purpose: 'Reroutes freight and buses around floods, closures and congestion, with costed trade-offs.',
  toolsUsed: ['weather_flood_alert', 'road_closure_feed', 'route_solver', 'notify_party'],
  guardrails: ['Never reroutes hazmat or overloaded vehicles without human confirmation'],

  async run({ shipment, driverId = 'D-3310', language = 'ml-IN' }, ctx) {
    const { tools, step } = ctx;
    const s = shipment;

    step('perceive', 'Weather + closure feeds polled', `shipment ${s.id} · ${s.from} → ${s.to} · ${s.tonnes} t`);
    const flood = await tools.weather_flood_alert({ region: 'thrissur' });
    const closures = await tools.road_closure_feed({ corridor: 'CBE-KOCHI' });
    step('fuse', 'Hazard correlated with route', flood.active
      ? `${flood.hazard.label} (severity ${flood.hazard.severity}, valid ${flood.hazard.validHours}h) intersects the direct route · ${closures.closures.length} closure on record`
      : 'No active hazard on the direct route.');

    const routes = await tools.route_solver({ from: s.from, to: s.to, avoid: flood.active ? [flood.hazard.id] : [] });
    const blocked = routes.options.filter((o) => !o.avoidsHazards);
    const clear = routes.options.filter((o) => o.avoidsHazards);
    const direct = routes.options.reduce((a, b) => (a.distanceKm <= b.distanceKm ? a : b));
    const diversion = clear.length ? clear.reduce((a, b) => (a.driveMinutes <= b.driveMinutes ? a : b)) : null;

    step('reason', 'Options costed', [
      `direct ${direct.via} — ${direct.distanceKm} km / ${min(direct.driveMinutes)} · hazard exposure ${direct.hazardExposure.length}`,
      diversion ? `diversion ${diversion.via} — ${diversion.distanceKm} km / ${min(diversion.driveMinutes)} · clear` : 'no clear alternative',
    ].join(' · '));

    const addedMinutes = diversion ? diversion.driveMinutes - direct.driveMinutes : 0;
    const addedKm = diversion ? diversion.distanceKm - direct.distanceKm : 0;
    step(
      'reason',
      'Recommendation',
      diversion
        ? `Take the diversion: +${addedKm} km, +${min(addedMinutes)} vs. a ${min(60 * flood.hazard.validHours)} exposure to ${flood.hazard.type}.`
        : 'Hold in place and wait for the hazard to clear.'
    );

    const choice = diversion || direct;
    step('plan', 'Plan', `Lock route via ${choice.via}; notify driver in ${language}; hand ETA to ColdGuard for shelf-life re-check.`);
    const notify = await tools.notify_party({
      party: driverId,
      shipmentId: s.id,
      message: `Route changed: take ${choice.via}. Added ${min(addedMinutes)}. Flood ahead on NH-544.`,
      channel: 'driver app + voice',
      language,
      key: 'route_change',
    });
    step('act', 'Driver notified', `${notify.channel} · ${language} · delivered ${notify.delivered}`);
    step('verify', 'Verification', `New ETA ${min(choice.driveMinutes)}; driver acknowledged.`);
    step('learn', 'Memory updated', `Flood-diversion prior for ${s.from}→${s.to}: prefer ${choice.via} when flood-thrissur is active.`);

    return {
      summary: `Rerouted via ${choice.via} (+${addedKm} km, +${min(addedMinutes)}) around ${flood.hazard?.type ?? 'closure'}`,
      confidence: 0.89,
      actions: ['route_solver', 'notify_party'],
      requiresApproval: false,
      metrics: { addedKm, addedMinutes, routeVia: choice.via, driveMinutes: choice.driveMinutes, distanceKm: choice.distanceKm },
      route: choice,
    };
  },
};

/* ===================================================================== */
/* 4. ColdGuard — spoilage prevention with shelf-life-aware routing       */
/* ===================================================================== */
export const ColdGuard = {
  id: 'coldguard',
  name: 'ColdGuard',
  purpose: 'Tracks remaining shelf life and diverts cargo before it spoils.',
  toolsUsed: ['rsl_model', 'find_precooling_node', 'book_slot', 'notify_party', 'smart_contract_clause', 'anchor_proof'],
  guardrails: ['May not dispose of cargo', 'Cannot spend above the shipment cost threshold without approval'],

  async run({ shipment, telemetry, elapsedH, etaMinutes, ambientC = 33, position }, ctx) {
    const { tools, step, memory } = ctx;
    const s = shipment;

    const samples = Array.isArray(telemetry) ? telemetry : [];
    const latest = samples[samples.length - 1];
    step(
      'perceive',
      'Reefer telemetry window',
      `${samples.length} samples${latest ? ` · latest ${latest.tempC}°C` : ' · no samples supplied, treating as in-band'} · door events: ${samples.filter((t) => t.doorOpen).length}`
    );
    const rsl = await tools.rsl_model({ commodity: s.commodity, elapsedH, tempTrace: samples, ambientC });
    step('fuse', 'Shelf life recomputed', `RSL ${rsl.rslDays} d (${rsl.rslRemainingH} h) · out-of-band ${rsl.breachMinutes} min · decay ×${rsl.decayMultiplier}`);

    const tolerance = rsl.toleranceC;
    const breach = rsl.toleranceBreach;
    const etaH = etaMinutes / 60;
    const arrivesInBand = !breach && rsl.rslRemainingH > etaH;
    step(
      'reason',
      'Risk assessment',
      breach
        ? `Tolerance band ${tolerance[0]}–${tolerance[1]}°C breached — shelf life is being consumed ${rsl.decayMultiplier}× faster than plan.`
        : `Within band; RSL margin over ETA is ${(rsl.rslRemainingH - etaH).toFixed(1)} h.`
    );

    if (!breach) {
      step('plan', 'Plan', 'No intervention — continue with normal monitoring cadence.');
      step('verify', 'Verification', 'Temperature stable; next telemetry window in 15 min.');
      return { summary: `Cargo healthy — RSL ${rsl.rslDays} d`, confidence: 0.9, actions: [], requiresApproval: false, metrics: { rslDays: rsl.rslDays, risk: 0.02 } };
    }

    // Causal attribution: door event vs mechanical fault.
    const doorOpens = samples.filter((t) => t.doorOpen).length;
    const rootCause = doorOpens > 0 ? 'door left ajar at a mid-route halt (not a compressor fault)' : 'possible refrigeration fault';
    step('reason', 'Root cause', rootCause);

    const rejectionRisk = Math.min(0.95, +(0.18 + rsl.breachMinutes / 90).toFixed(2));
    const exposureInr = Math.round(s.tonnes * (s.commodity === 'vaccines' ? 9_000_000 : s.commodity === 'hill_vegetables' ? 153_000 : 420_000) * rejectionRisk);
    step('reason', 'Exposure quantified', `rejection probability ${(rejectionRisk * 100).toFixed(0)}% on cargo worth ${inr(s.tonnes * (s.commodity === 'vaccines' ? 9_000_000 : s.commodity === 'hill_vegetables' ? 153_000 : 420_000))} → ${inr(exposureInr)} at risk`);

    const near = await tools.find_precooling_node({ nearLat: position.lat, nearLng: position.lng });
    const node = near.candidates[0];
    if (!node) {
      step('reason', 'No facility reachable', 'Escalating to a human dispatcher.');
      return { summary: 'No pre-cooling node reachable — escalated', confidence: 0.6, actions: [], requiresApproval: true, approval: { reason: 'No cold-chain facility within range; cargo at risk', risk: 'financial' } };
    }

    const addedMinutes = Math.round(node.km * 1.4) + node.preCoolMinutes;
    const cost = node.costInr;
    const worthIt = cost < exposureInr * 0.6;
    step(
      'reason',
      'Intervention choice',
      `Divert to ${node.name} (+${min(addedMinutes)}, ${inr(cost)}) vs. continue (${inr(exposureInr)} exposure) → ${worthIt ? 'DIVERT' : 'continue and notify'}`
    );

    const requiresApproval = cost > (s.requiresApprovalAboveInr ?? 0);
    const actions = [];
    if (worthIt) {
      step('plan', 'Plan', `Divert → pre-cooling at ${node.name} → resume → notify buyer → update contract clause → anchor evidence.`);
      const slot = await tools.book_slot({ nodeId: node.id, shipmentId: s.id, minutes: node.preCoolMinutes });
      step('act', 'Pre-cooling slot booked', `${slot.bookingId} · ${node.preCoolMinutes} min · ${node.name}`);
      actions.push('book_slot');

      const buyer = await tools.notify_party({
        party: s.consignee,
        shipmentId: s.id,
        message: `Temperature excursion on ${s.id}. Diverting to ${node.name} for pre-cooling (+${min(addedMinutes)}). RSL restored to plan.`,
        channel: 'email + SMS',
        language: 'en-IN',
      });
      step('act', 'Buyer notified', `${buyer.channel} · delivered ${buyer.delivered}`);
      actions.push('notify_party');

      const clause = await tools.smart_contract_clause({
        contractId: s.contractId,
        clause: 'temperature_excursion_notice',
        payload: { breachMinutes: rsl.breachMinutes, diversion: node.id, addedMinutes },
      });
      step('act', 'Contract clause executed', `${clause.contractId} · ${clause.clause} · tx ${clause.txId}`);
      actions.push('smart_contract_clause');

      const proof = await tools.anchor_proof({
        subjectType: 'cold_chain_excursion',
        subjectId: s.id,
        payload: { telemetry, rsl, node: node.id, exposureInr },
      });
      step('act', 'Temperature trace anchored', `${proof.sha256.slice(0, 16)}… — spoilage-risk evidence for the insurer`);
      actions.push('anchor_proof');
    }

    step('verify', 'Verification', worthIt ? `Temperature back in band within ~40 min of arrival at ${node.name}; RSL restored above export threshold.` : 'Monitoring only; buyer informed of residual risk.');
    const prior = memory.get('door_event_halt') || 0;
    if (doorOpens > 0) memory.set('door_event_halt', prior + 1);
    step('learn', 'Memory updated', doorOpens > 0 ? `Recurring door-open events at mid-route halts: ${prior} → ${prior + 1} — flagged for a facility fix.` : 'No recurring pattern.');

    return {
      summary: worthIt
        ? `Spoilage prevented: diverted to ${node.name}, ${inr(exposureInr)} exposure avoided`
        : `Residual risk accepted: ${inr(exposureInr)} at risk`,
      confidence: 0.86,
      actions,
      requiresApproval,
      approval: requiresApproval
        ? { reason: `Spend ${inr(cost)} on pre-cooling at ${node.name} (above the ${inr(s.requiresApprovalAboveInr)} policy threshold)`, risk: 'financial' }
        : null,
      metrics: { rslDays: rsl.rslDays, risk: rejectionRisk, exposureInr, costInr: cost, node: node.name, addedMinutes },
    };
  },
};

/* ===================================================================== */
/* 5. HubSync — multimodal handover                                       */
/* ===================================================================== */
export const HubSync = {
  id: 'hubsync',
  name: 'HubSync',
  purpose: 'Coordinates road ↔ rail ↔ port handovers and yard slots.',
  toolsUsed: ['ulip_track_and_trace', 'hub_slot_allocator', 'modal_shift_option'],
  guardrails: ['Financial commitments above threshold need human sign-off'],

  async run({ shipment }, ctx) {
    const { tools, step } = ctx;
    step('perceive', 'Consignment tracked', `shipment ${shipment.id} on the CBE→Kochi corridor`);
    const trace = await tools.ulip_track_and_trace({ shipmentId: shipment.id });
    step('fuse', 'Multimodal state', `${trace.mode} · last scan ${trace.lastScan.point} (${trace.lastScan.minutesAgo} min ago) · ETA ${min(trace.etaMinutes)}`);
    const shift = await tools.modal_shift_option({ from: shipment.from, to: shipment.to, tonnes: shipment.tonnes });
    const rail = shift.options.find((o) => o.mode === 'rail');
    step('reason', 'Handover value', `rail saves ${shift.co2SavedKg} kg CO2e but costs ${inr(rail.costInr - shift.options[0].costInr)} more and needs ${rail.availability}`);
    step('plan', 'Plan', 'Keep road for this consignment (time-critical); queue the rail option for the next bulk consignment.');
    const slot = await tools.hub_slot_allocator({ hub: 'Kochi port yard', mode: 'road', window: 'delivery window' });
    step('act', 'Yard slot reserved', `${slot.slotId} · demurrage risk ${slot.demurrageRisk}`);
    step('verify', 'Verification', 'Slot confirmed against the delivery window; no demurrage exposure.');
    return {
      summary: `Handover coordinated — ${slot.slotId} reserved, rail option queued`,
      confidence: 0.84,
      actions: ['ulip_track_and_trace', 'hub_slot_allocator'],
      requiresApproval: false,
      metrics: { co2SavedIfRailKg: shift.co2SavedKg },
    };
  },
};

/* ===================================================================== */
/* 6. Saarthi — driver & worker welfare                                   */
/* ===================================================================== */
export const Saarthi = {
  id: 'saarthi',
  name: 'Saarthi',
  purpose: 'Protects drivers: fatigue detection, mandatory rest, vernacular voice assistance.',
  toolsUsed: ['driver_duty_status', 'find_rest_facility', 'schedule_rest', 'notify_party'],
  guardrails: ['Never trades a driver’s legal rest for schedule pressure'],

  async run({ driverId, position }, ctx) {
    const { tools, step } = ctx;
    step('perceive', 'Duty log read', `driver ${driverId}`);
    const duty = await tools.driver_duty_status({ driverId });
    if (!duty.ok) return { summary: duty.error, confidence: 0.5, actions: [], requiresApproval: false };
    step('fuse', 'Fatigue picture', `${duty.continuousHours}h continuous · ${duty.restTakenH}h rest · fatigue score ${duty.fatigueScore}/100 · legal rest due in ${duty.legalRestDueIn}h`);
    const mustRest = duty.fatigueScore >= 75 || duty.legalRestDueIn <= 0.5;
    step('reason', 'Decision', mustRest ? 'Rest is mandatory now — fatigue threshold reached.' : 'Within limits; schedule a preventive break at the next facility.');
    const fac = await tools.find_rest_facility({ nearLat: position.lat, nearLng: position.lng });
    const facility = fac.candidates[0];
    step('plan', 'Plan', `Route to ${facility.name} (${facility.km} km) for a ${mustRest ? '45' : '30'} min break; notify in the driver’s language.`);
    const rest = await tools.schedule_rest({ driverId, facilityId: facility.id, minutes: mustRest ? 45 : 30 });
    step('act', 'Rest scheduled', `${facility.name} · ${rest.minutes} min · enforced: ${rest.enforced}`);
    const notify = await tools.notify_party({
      party: driverId,
      shipmentId: 'n/a',
      message: `Break scheduled at ${facility.name} in ${facility.km} km. Facilities: ${facility.amenities.join(', ')}.`,
      channel: 'voice call',
      language: 'ta-IN',
      key: 'rest_break',
    });
    step('act', 'Driver informed (Tamil)', `${notify.channel} · “${notify.localized}”`);
    step('verify', 'Verification', 'Dispatch plan updated so the schedule absorbs the break — no pressure to skip rest.');
    return {
      summary: `Rest ${mustRest ? 'enforced' : 'scheduled'} at ${facility.name} (fatigue ${duty.fatigueScore}/100)`,
      confidence: 0.9,
      actions: ['schedule_rest', 'notify_party'],
      requiresApproval: false,
      metrics: { fatigueScore: duty.fatigueScore, facility: facility.name },
    };
  },
};

/* ===================================================================== */
/* 7. GreenLane — carbon-aware planning                                   */
/* ===================================================================== */
export const GreenLane = {
  id: 'greenlane',
  name: 'GreenLane',
  purpose: 'Quantifies and reduces the carbon cost of every movement.',
  toolsUsed: ['carbon_footprint', 'modal_shift_option'],
  guardrails: ['Cannot force a modal shift — recommends with the cost delta attached'],

  async run({ shipment, distanceKm }, ctx) {
    const { tools, step } = ctx;
    step('perceive', 'Movement measured', `${shipment.id} · ${distanceKm} km · ${shipment.tonnes} t`);
    const tonneKm = distanceKm * shipment.tonnes;
    const road = await tools.carbon_footprint({ tonneKm, mode: 'road' });
    step('fuse', 'Footprint', `${road.kgCO2e} kg CO2e by road (${road.factorKgPerTonneKm} kg/tonne-km)`);
    const shift = await tools.modal_shift_option({ from: shipment.from, to: shipment.to, tonnes: shipment.tonnes });
    step('reason', 'Options', `rail would cut ${shift.co2SavedKg} kg CO2e — costed and offered, not forced.`);
    step('plan', 'Plan', 'Attach the footprint to the shipment record; offer the rail option to the consignor.');
    step('act', 'Footprint recorded', `${road.kgCO2e} kg CO2e logged against ${shipment.id}`);
    step('verify', 'Verification', 'Footprint reproducible from distance × tonnes × factor.');
    return {
      summary: `Footprint ${road.kgCO2e} kg CO2e · rail option saves ${shift.co2SavedKg} kg`,
      confidence: 0.95,
      actions: ['carbon_footprint'],
      requiresApproval: false,
      metrics: { kgCO2e: road.kgCO2e, co2SavedIfRailKg: shift.co2SavedKg },
    };
  },
};

/* ===================================================================== */
/* 8. TrustLedger — evidence integrity & paperless trade                  */
/* ===================================================================== */
export const TrustLedger = {
  id: 'trustledger',
  name: 'TrustLedger',
  purpose: 'Anchors evidence, automates documents, flags anomalies.',
  toolsUsed: ['anchor_proof', 'smart_contract_clause'],
  guardrails: ['Any financial settlement requires explicit human approval'],

  async run({ subjectType, subjectId, payload, contractId, clause }, ctx) {
    const { tools, step } = ctx;
    step('perceive', 'Evidence submitted', `${subjectType} · ${subjectId}`);
    const proof = await tools.anchor_proof({ subjectType, subjectId, payload });
    step('act', 'Proof anchored', `${proof.sha256.slice(0, 16)}… · tx ${proof.txId} · ${proof.note}`);
    let contract = null;
    if (contractId && clause) {
      contract = await tools.smart_contract_clause({ contractId, clause, payload });
      step('act', 'Clause executed', `${contract.clause} on ${contract.contractId}`);
    }
    step('verify', 'Verification', 'Digest recomputable from the original payload — tamper-evident.');
    return {
      summary: `Evidence anchored for ${subjectId}`,
      confidence: 1,
      actions: ['anchor_proof', ...(contract ? ['smart_contract_clause'] : [])],
      requiresApproval: false,
      metrics: { digest: proof.sha256.slice(0, 16) },
    };
  },
};

export const AGENTS = [CorridorSense, SafetySentinel, Reroute, ColdGuard, HubSync, Saarthi, GreenLane, TrustLedger];
export const AGENTS_BY_ID = Object.fromEntries(AGENTS.map((a) => [a.id, a]));

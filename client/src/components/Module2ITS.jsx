import React, { useEffect, useMemo, useState } from 'react';
import { api, isGreenLaneWindow } from '../api/mockApi.js';
import { GlassCard, SectionHeader, Badge, StatusBadge, Stat, ProgressBar, formatTime, timeAgo } from './shared.jsx';

/* ==================================================================== */
/*  MODULE 2 — USA ITS (Intelligent Transportation Systems)              */
/*  Virtual green lanes for college buses, adaptive signals, side-mounted */
/*  camera enforcement with ₹2,000 fines, and a dispatch board.           */
/* ==================================================================== */

/* --------------------------- Green lane strip -------------------------- */

function nextWindowLabel(now = new Date()) {
  const h = now.getHours();
  if (h < 7) return 'opens 07:00 today';
  if (h < 10) return 'closes 10:00';
  if (h < 14) return 'opens 14:00 today';
  if (h < 17) return 'closes 17:00';
  return 'opens 07:00 tomorrow';
}

function GreenLaneStrip({ active }) {
  const [lanes, setLanes] = useState(3);
  // Green lanes sit on the OUTER (corner) lanes, never in the middle.
  const greenIndexes = lanes === 3 ? [0, 2] : [0, 3];
  const laneH = 100 / lanes;

  const traffic = {
    3: [
      { lane: 0, glyph: '🚌', dur: 9, delay: '0s', green: true },
      { lane: 1, glyph: '🚗', dur: 7, delay: '1.2s', green: false },
      { lane: 2, glyph: '🚌', dur: 10, delay: '3.4s', green: true },
    ],
    4: [
      { lane: 0, glyph: '🚌', dur: 9, delay: '0s', green: true },
      { lane: 1, glyph: '🚗', dur: 7, delay: '1.1s', green: false },
      { lane: 2, glyph: '🏍️', dur: 6, delay: '2.3s', green: false },
      { lane: 3, glyph: '🚌', dur: 11, delay: '3.8s', green: true },
    ],
  }[lanes];

  return (
    <div>
      {/* layout + status controls */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="label-mono">corridor layout</span>
        {[3, 4].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setLanes(n)}
            className={`rounded-md border px-2 py-0.5 font-mono text-[10px] transition ${
              lanes === n
                ? 'border-cyan-400/60 bg-cyan-400/15 text-cyan-200'
                : 'border-white/10 text-slate-400 hover:text-slate-200'
            }`}
          >
            {n} lanes
          </button>
        ))}
        <span
          className={`ml-auto rounded-lg border px-2.5 py-1 font-mono text-[10px] font-bold tracking-wider ${
            active
              ? 'border-emerald-400/50 bg-emerald-400/10 text-emerald-300 animate-pulse'
              : 'border-white/15 bg-black/40 text-slate-400'
          }`}
        >
          {active ? '● GREEN LANE ACTIVE' : '○ GREEN LANE STANDBY'}
        </span>
      </div>

      {/* the road */}
      <div className="relative h-44 overflow-hidden rounded-xl border border-white/10">
        {/* asphalt */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0f1c] via-[#0d1526] to-[#0a0f1c]" />

        {/* lanes */}
        {Array.from({ length: lanes }).map((_, i) => {
          const isGreen = greenIndexes.includes(i);
          const top = i * laneH;
          return (
            <div key={i} className="absolute inset-x-0 overflow-hidden" style={{ top: `${top}%`, height: `${laneH}%` }}>
              {isGreen && (
                <>
                  <div
                    className={`absolute inset-0 transition-all duration-500 ${
                      active
                        ? 'bg-gradient-to-r from-emerald-400/30 via-emerald-400/10 to-emerald-400/30'
                        : 'bg-emerald-400/[0.07]'
                    }`}
                  />
                  <div
                    className="absolute inset-0"
                    style={{
                      backgroundImage:
                        'repeating-linear-gradient(75deg, rgba(0,255,102,0.20) 0 14px, transparent 14px 44px)',
                      animation: active ? 'lane-flow 2.4s linear infinite' : 'none',
                      opacity: active ? 1 : 0.35,
                    }}
                  />
                  <div
                    className={`absolute inset-x-0 top-0 h-[3px] ${
                      active ? 'bg-emerald-400 shadow-[0_0_14px_rgba(0,255,102,0.9)]' : 'bg-emerald-400/30'
                    }`}
                  />
                  <div
                    className={`absolute inset-x-0 bottom-0 h-[3px] ${
                      active ? 'bg-emerald-400 shadow-[0_0_14px_rgba(0,255,102,0.9)]' : 'bg-emerald-400/30'
                    }`}
                  />
                </>
              )}

              {/* lane label */}
              <span
                className={`absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-sm bg-black/40 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest backdrop-blur-sm transition-colors duration-500 ${
                  isGreen
                    ? active
                      ? 'neon-text-green shadow-[0_0_16px_rgba(0,255,102,0.35)]'
                      : 'text-emerald-400/90'
                    : 'font-normal text-slate-500'
                }`}
              >
                Lane {i + 1} · {isGreen ? `GREEN LANE — ${active ? 'buses only' : 'standby'}` : 'mixed traffic'}
              </span>
            </div>
          );
        })}

        {/* dashed lane dividers between lanes */}
        {Array.from({ length: lanes - 1 }).map((_, i) => (
          <div
            key={`div-${i}`}
            className="absolute inset-x-0 h-px"
            style={{
              top: `${(i + 1) * laneH}%`,
              background:
                'repeating-linear-gradient(90deg, rgba(148,163,184,0.30) 0 26px, transparent 26px 46px)',
            }}
          />
        ))}

        {/* traffic on every lane — buses only ever on the green lanes */}
        {traffic.map((v, i) => (
          <div
            key={`v-${i}`}
            className="absolute left-[-46px] flex items-center"
            style={{
              top: `${v.lane * laneH}%`,
              height: `${laneH}%`,
              animation: `lane-drive ${v.dur}s linear infinite`,
              animationDelay: v.delay,
            }}
          >
            <span
              className={`text-xl ${
                v.green
                  ? active
                    ? 'drop-shadow-[0_0_10px_rgba(0,255,102,0.65)]'
                    : 'opacity-45'
                  : 'opacity-60'
              }`}
            >
              {v.glyph}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* --------------------------- Signal head ------------------------------ */

function SignalHead({ phase }) {
  const isGreen = phase === 'GREEN_WAVE';
  const isAmber = phase === 'TRANSIT_PRIORITY';
  const isRed = phase === 'EMERGENCY_OVERRIDE';
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-xl border border-white/10 bg-black/50 p-2">
      <span
        className={`h-5 w-5 rounded-full border ${
          isRed ? 'bg-rose-500 shadow-[0_0_14px_rgba(255,51,102,0.9)] animate-pulse' : 'border-white/10 bg-white/5'
        }`}
      />
      <span
        className={`h-5 w-5 rounded-full border ${
          isAmber ? 'bg-amber-400 shadow-[0_0_14px_rgba(251,191,36,0.9)] animate-pulse' : 'border-white/10 bg-white/5'
        }`}
      />
      <span
        className={`h-5 w-5 rounded-full border ${
          isGreen ? 'bg-emerald-400 shadow-[0_0_14px_rgba(0,255,102,0.9)]' : 'border-white/10 bg-white/5'
        }`}
      />
    </div>
  );
}

function SignalCard({ s, onExtend, onCycle, busy }) {
  const [remaining, setRemaining] = useState(s.phase_ends_in_s);
  useEffect(() => setRemaining(s.phase_ends_in_s), [s.phase_ends_in_s]);
  useEffect(() => {
    const id = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="glass-inset flex gap-3 p-3">
      <SignalHead phase={s.current_phase} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-xs font-bold text-slate-100">{s.junction_name}</p>
          <StatusBadge status={s.current_phase} />
        </div>
        <p className="mt-0.5 font-mono text-[10px] text-slate-500">
          {s.signal_id} · {s.corridor} · offset +{s.green_wave_offset_s}s
        </p>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center font-mono text-[10px]">
          <div className="rounded bg-black/40 py-1">
            <span className="block text-sm font-bold text-cyan-300">{s.vehicle_count}</span>vehicles
          </div>
          <div className="rounded bg-black/40 py-1">
            <span className="block text-sm font-bold text-emerald-300">{s.avg_speed_kmh}</span>km/h avg
          </div>
          <div className="rounded bg-black/40 py-1">
            <span className={`block text-sm font-bold ${remaining < 10 ? 'text-rose-300 animate-pulse' : 'text-amber-300'}`}>
              {remaining}
            </span>
            phase s
          </div>
        </div>
        {s.green_extension_s > 0 && (
          <p className="mt-1 font-mono text-[10px] text-emerald-300">
            +{s.green_extension_s}s adaptive extension applied
          </p>
        )}
        <div className="mt-2 flex gap-1.5">
          <button type="button" disabled={busy} onClick={() => onExtend(s.signal_id, 10)} className="btn-green">
            Extend Green +10s
          </button>
          <button type="button" disabled={busy} onClick={() => onCycle(s.signal_id)} className="btn-cyan">
            Cycle Phase
          </button>
        </div>
      </div>
    </div>
  );
}

/* --------------------------- Live feed tile --------------------------- */

function LiveFeedTile({ label = 'CAM-SIDE-L · 720p', accent = 'cyan' }) {
  const [ts, setTs] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTs(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="feed-shimmer feed-scanlines relative aspect-video overflow-hidden rounded-lg border border-white/10 bg-gradient-to-b from-[#0b1220] to-[#182136]">
      {/* moving road stripes */}
      <div
        className="absolute inset-x-0 bottom-0 h-1/2 opacity-70"
        style={{
          background:
            'repeating-linear-gradient(90deg, transparent 0 46px, rgba(148,163,184,0.28) 46px 60px)',
          animation: 'feed-road 1.1s linear infinite',
        }}
      />
      <style>{`@keyframes feed-road { from { background-position-x: 0; } to { background-position-x: -60px; } }`}</style>
      <div className="absolute left-2 top-2 flex items-center gap-1.5 font-mono text-[9px] text-cyan-200">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />
        {label}
      </div>
      <div className="absolute bottom-2 right-2 font-mono text-[9px] text-cyan-200/80">
        {formatTime(ts.toISOString())} IST
      </div>
    </div>
  );
}

/* ---------------------------- School bus ------------------------------ */

function CollegeBusSVG({ label }) {
  return (
    <svg viewBox="0 0 300 110" className="w-full">
      {/* shadow */}
      <ellipse cx="150" cy="102" rx="128" ry="6" fill="rgba(0,0,0,0.45)" />
      {/* body */}
      <rect x="12" y="16" width="276" height="66" rx="10" fill="#F6B800" stroke="#8a6a00" strokeWidth="1.5" />
      <rect x="12" y="46" width="276" height="7" fill="#151515" />
      <rect x="12" y="57" width="276" height="4" fill="#151515" />
      {/* windows */}
      {[0, 1, 2, 3, 4].map((i) => (
        <rect key={i} x={34 + i * 48} y="24" width="36" height="18" rx="3" fill="#123047" stroke="#0a1a28" />
      ))}
      {/* door */}
      <rect x="252" y="24" width="22" height="50" rx="3" fill="#1b3a55" stroke="#0a1a28" />
      <line x1="263" y1="24" x2="263" y2="74" stroke="#0a1a28" strokeWidth="1.5" />
      {/* rooftop beacon */}
      <rect x="140" y="10" width="18" height="7" rx="2" fill="#334155" />
      <circle cx="149" cy="13" r="2.6" fill="#00F0FF">
        <animate attributeName="opacity" values="1;0.2;1" dur="1.4s" repeatCount="indefinite" />
      </circle>
      {/* side-mounted camera pods (front + rear) with FOV fans */}
      <g>
        <rect x="52" y="52" width="12" height="9" rx="2" fill="#0e1626" stroke="#00F0FF" strokeWidth="1" />
        <path d="M64 56 L96 46 M64 56 L96 68" stroke="#00F0FF" strokeWidth="0.8" opacity="0.55" />
        <rect x="236" y="52" width="12" height="9" rx="2" fill="#0e1626" stroke="#00F0FF" strokeWidth="1" />
        <path d="M236 56 L204 46 M236 56 L204 68" stroke="#00F0FF" strokeWidth="0.8" opacity="0.55" />
      </g>
      {/* wheels */}
      <g>
        <circle cx="72" cy="86" r="13" fill="#0c0c0c" stroke="#2b2b2b" strokeWidth="2" />
        <circle cx="72" cy="86" r="5" fill="#5b5b5b" />
        <circle cx="228" cy="86" r="13" fill="#0c0c0c" stroke="#2b2b2b" strokeWidth="2" />
        <circle cx="228" cy="86" r="5" fill="#5b5b5b" />
      </g>
      {/* livery text */}
      <text x="150" y="68" textAnchor="middle" fontSize="9" fontWeight="700" fill="#1a1a1a" fontFamily="Arial">
        {label}
      </text>
    </svg>
  );
}

/* ------------------------------- Module ------------------------------- */

export default function Module2ITS({ onToast }) {
  const [signals, setSignals] = useState([]);
  const [violations, setViolations] = useState([]);
  const [fleet, setFleet] = useState([]);
  const [laneActive, setLaneActive] = useState(isGreenLaneWindow());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.getSignals().then((r) => setSignals(r.signals));
    api.getGreenLaneViolations().then((r) => setViolations(r.violations));
    api.getFleet().then((r) => setFleet(r.fleet.filter((b) => b.bus_type === 'COLLEGE_BUS')));
    const laneTimer = setInterval(() => setLaneActive(isGreenLaneWindow()), 30_000);
    const poll = setInterval(() => api.getSignals().then((r) => setSignals(r.signals)), 5000);
    return () => {
      clearInterval(laneTimer);
      clearInterval(poll);
    };
  }, []);

  const withSignal = (junctionId, updated) =>
    setSignals((list) => list.map((s) => (s.signal_id === junctionId ? updated : s)));

  const extend = async (id, seconds) => {
    setBusy(true);
    try {
      const r = await api.extendGreen(id, seconds);
      withSignal(id, r.signal);
      onToast(`${id}: green extended +${r.applied_extension_s}s (transit priority)`, 'green');
    } catch (e) {
      onToast(e.message, 'red');
    } finally {
      setBusy(false);
    }
  };

  const cycle = async (id) => {
    setBusy(true);
    try {
      const r = await api.cyclePhase(id);
      withSignal(id, r.signal);
    } catch (e) {
      onToast(e.message, 'red');
    } finally {
      setBusy(false);
    }
  };

  const sweep = async () => {
    setBusy(true);
    try {
      const r = await api.sweepGreenLane();
      const list = await api.getGreenLaneViolations();
      setViolations(list.violations);
      onToast(`Lane check complete: ${r.new_violations.length} non-compliant vehicle${r.new_violations.length === 1 ? '' : 's'} flagged for review · ₹${r.total_fines_today.toLocaleString('en-IN')} in notices today`, 'red');
    } catch (e) {
      onToast(e.message, 'red');
    } finally {
      setBusy(false);
    }
  };

  const dispatch = async (busId) => {
    setBusy(true);
    try {
      const r = await api.dispatchBus(busId);
      setFleet((list) => list.map((b) => (b.bus_id === busId ? r.bus : b)));
      onToast(`${busId} dispatched — green lane authorization live`, 'green');
    } catch (e) {
      onToast(e.message, 'red');
    } finally {
      setBusy(false);
    }
  };

  const totalFines = violations.length * 2000;

  const corridorStats = useMemo(() => {
    if (!signals.length) return { vehicles: 0, speed: 0 };
    return {
      vehicles: signals.reduce((a, s) => a + s.vehicle_count, 0),
      speed: (signals.reduce((a, s) => a + s.avg_speed_kmh, 0) / signals.length).toFixed(1),
    };
  }, [signals]);

  return (
    <section className="space-y-4">
      <SectionHeader
        index={2}
        title="Intelligent Transportation Systems"
        subtitle="Virtual green lanes, adaptive signal control & camera-enforced bus priority"
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <GlassCard
          title="Virtual Green Lane — College & School Buses"
          subtitle={`Active windows 07:00–10:00 and 14:00–17:00 · ${nextWindowLabel()}`}
          accent="green"
          right={
            <Badge tone={laneActive ? 'green' : 'slate'}>
              {laneActive ? '● live now' : 'standby'}
            </Badge>
          }
        >
          <GreenLaneStrip active={laneActive} />
          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="authorized vehicles" value={fleet.length} tone="green" />
            <Stat label="lane length" value="11.2" unit="km" />
            <Stat label="avg bus gain" value="9.4" unit="min" tone="green" />
            <Stat label="lane compliance" value="97" unit="%" tone="green" />
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
            Between the two windows the lane reverts to mixed traffic automatically — the lane is{' '}
            <b className="text-emerald-300">virtual</b>, enforced by roadside AI cameras and bus-borne
            transponders rather than paint or barriers, so it can follow demand term-by-term.
          </p>
        </GlassCard>

        <GlassCard
          title="Green Lane Violations — Automated ₹2,000 Notices"
          subtitle="Side-mounted AI cameras match number plates against the authorization list"
          accent="red"
          right={
            <button type="button" onClick={sweep} disabled={busy} className="btn-red">
              {busy ? '⟳ scanning…' : 'Run AI Camera Sweep'}
            </button>
          }
        >
          <div className="mb-3 grid grid-cols-2 gap-3">
            <Stat label="fines issued today" value={violations.length} tone="red" />
            <Stat label="amount levied" value={`₹${totalFines.toLocaleString('en-IN')}`} tone="red" />
          </div>
          <div className="max-h-[240px] space-y-2 overflow-y-auto pr-1">
            {violations.slice(0, 8).map((v) => (
              <div key={v.id} className="glass-inset flex flex-wrap items-center gap-x-3 gap-y-1 p-2.5 text-[11px]">
                <span className="rounded bg-black/50 px-2 py-0.5 font-mono font-bold text-rose-300">{v.vehicle_reg}</span>
                <span className="text-slate-300">{v.vehicle_type}</span>
                <span className="text-slate-500">{v.label.split('·')[0]} · {v.camera_id}</span>
                <span className="ml-auto text-slate-500">{timeAgo(v.detected_at)}</span>
                <span className="font-mono font-bold text-amber-300">₹2,000</span>
                <Badge tone="red">{v.status}</Badge>
              </div>
            ))}
            {violations.length === 0 && (
              <p className="p-4 text-center text-xs text-slate-500">No violations — corridor is compliant.</p>
            )}
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
            Each notice stores the 12-second evidence clip and the plate match confidence. Owners
            can contest via the CCMC portal; clips are kept under the same 30-day custody chain as
            road-damage footage.
          </p>
        </GlassCard>
      </div>

      <GlassCard
        title="Adaptive Traffic Signals — Avinashi & Saravanampatti Corridors"
        subtitle="Green-wave coordination with transit-priority extension; click a junction to act on it"
        right={
          <div className="flex items-center gap-2">
            <Badge tone="cyan">corridor sync +12s offsets</Badge>
            <Badge tone="green">{corridorStats.vehicles} vehicles tracked</Badge>
          </div>
        }
      >
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
          {signals.map((s) => (
            <SignalCard key={s.signal_id} s={s} onExtend={extend} onCycle={cycle} busy={busy} />
          ))}
          {signals.length === 0 && (
            <p className="p-4 text-center text-xs text-slate-500">Syncing signal controllers…</p>
          )}
        </div>
      </GlassCard>

      <GlassCard
        title="College Bus Dispatch Board — Live Side-Camera Feeds"
        subtitle="Every authorized bus carries dual side-mounted cameras streaming to the corridor AI"
        accent="green"
      >
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {fleet.map((bus) => (
            <div key={bus.bus_id} className="glass-inset p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-bold text-slate-100">{bus.bus_id}</p>
                  <p className="font-mono text-[10px] text-slate-500">
                    {bus.route_code} · {bus.serve}
                  </p>
                </div>
                <Badge tone={bus.status === 'EN ROUTE' ? 'green' : bus.status === 'AT CAMPUS' ? 'cyan' : 'slate'}>
                  {bus.status}
                </Badge>
              </div>
              <CollegeBusSVG label="COLLEGE BUS" />
              <div className="mt-2 grid grid-cols-2 gap-2">
                <LiveFeedTile label={`${bus.bus_id} · CAM-SIDE-L`} />
                <LiveFeedTile label={`${bus.bus_id} · CAM-SIDE-R`} />
              </div>
              <div className="mt-2.5">
                <ProgressBar value={bus.occupancy_percentage} label="Occupancy" />
                <div className="mt-2 flex items-center justify-between">
                  <span className="font-mono text-[10px] text-slate-500">
                    GPS {bus.current_lat}, {bus.current_lng} · green-lane authorized
                  </span>
                  {bus.status !== 'EN ROUTE' && (
                    <button type="button" disabled={busy} onClick={() => dispatch(bus.bus_id)} className="btn-green">
                      Dispatch
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </GlassCard>
    </section>
  );
}

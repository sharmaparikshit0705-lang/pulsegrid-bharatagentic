import React, { useEffect, useState } from 'react';
import { api } from '../api/mockApi.js';
import { GlassCard, SectionHeader, Badge, Stat, ProgressBar, formatTime } from './shared.jsx';

/* ==================================================================== */
/*  MODULE 3 — UK DRT (Demand-Responsive Transit)                         */
/*  On-demand EV micro-fleet capacity, live recalculation, and the       */
/*  U-turn-first corridor safety policy (right turns every 2–5 km).     */
/* ==================================================================== */

const U_TURN_MARKERS = [
  { km: 0.8, from: 'Hope College' },
  { km: 3.1, from: 'Peelamedu' },
  { km: 5.6, from: 'Codissia' },
  { km: 8.2, from: 'KMCH' },
  { km: 10.9, from: 'Kalapatti' },
  { km: 13.4, from: 'KGISPT' },
  { km: 15.8, from: 'Saravanampatti 4-Roads' },
];

function RouteSafetyStrip() {
  return (
    <div className="glass-inset p-4">
      {/* route line */}
      <div className="relative h-20">
        <div className="absolute inset-x-0 top-9 h-1 rounded-full bg-gradient-to-r from-cyan-400/60 via-emerald-400/60 to-cyan-400/60" />

        {/* deprecated right-turn conflict points */}
        {[0.35, 0.5, 0.65].map((f, i) => (
          <div key={i} className="absolute top-[30px] -translate-x-1/2 text-center" style={{ left: `${f * 100}%` }}>
            <span className="block rounded-md border border-rose-500/40 bg-rose-500/10 px-1.5 py-0.5 font-mono text-[9px] text-rose-300 line-through">
              RIGHT
            </span>
          </div>
        ))}

        {/* U-turn markers every 2–5 km */}
        {U_TURN_MARKERS.map((m, i) => (
          <div
            key={m.km}
            className="marker-pulse absolute top-[34px] -translate-x-1/2"
            style={{ left: `${(m.km / 16) * 100}%` }}
            title={`U-turn at km ${m.km} (after ${m.from})`}
          >
            <span className="flex h-4 w-4 items-center justify-center rounded-full border border-emerald-400 bg-emerald-400/20 font-mono text-[8px] font-bold text-emerald-300">
              U
            </span>
            <span className="absolute left-1/2 top-5 -translate-x-1/2 whitespace-nowrap font-mono text-[8px] text-slate-500">
              km {m.km}
            </span>
          </div>
        ))}

        <span className="absolute -top-1 left-0 font-mono text-[9px] text-slate-500">AVINASHI RD (0 km)</span>
        <span className="absolute right-0 -top-1 font-mono text-[9px] text-slate-500">SARAVANAMPATTI (16 km)</span>
      </div>
    </div>
  );
}

function BusCapacityCard({ bus }) {
  return (
    <div className="glass-inset p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-bold text-slate-100">{bus.bus_id}</p>
          <p className="font-mono text-[10px] text-slate-500">
            {bus.route_code} · GPS {bus.current_lat}, {bus.current_lng}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge tone="green">⚡ EV {bus.battery_pct}%</Badge>
          <Badge tone="cyan">ETA {bus.eta_next_stop_min}m</Badge>
        </div>
      </div>
      <ProgressBar value={bus.occupancy_percentage} label="Onboard capacity" warn={85} />
      <div className="mt-2 flex justify-between font-mono text-[10px] text-slate-500">
        <span>seats + standing · 34 max</span>
        <span>{Math.round((bus.occupancy_percentage / 100) * 34)} aboard</span>
      </div>
    </div>
  );
}

export default function Module3DRT({ onToast }) {
  const [buses, setBuses] = useState([]);
  const [hubs, setHubs] = useState([]);
  const [recommendation, setRecommendation] = useState(null);
  const [recalculating, setRecalculating] = useState(false);
  const [lastComputedAt, setLastComputedAt] = useState(null);

  useEffect(() => {
    api.getFleet().then((r) => {
      setBuses(r.fleet.filter((b) => b.bus_type === 'PUBLIC_EV'));
      setHubs(r.waiting_at_hubs);
    });
  }, []);

  const recalculate = async () => {
    setRecalculating(true);
    setRecommendation(null);
    try {
      const r = await api.recalculateCapacity('PG-EV-LOOP');
      setBuses(r.buses);
      setHubs(r.waiting_at_hubs);
      setRecommendation({
        text: r.recommendation,
        absorbed: r.passengers_absorbed,
        at: formatTime(r.computed_at),
      });
      setLastComputedAt(r.computed_at);
      onToast(
        `Route capacity recalculated — ${r.passengers_absorbed} waiting passengers absorbed into the loop`,
        'green'
      );
    } catch (e) {
      onToast(`Recalculation failed: ${e.message}`, 'red');
    } finally {
      setRecalculating(false);
    }
  };

  const totalWaiting = hubs.reduce((a, h) => a + h.waiting, 0);
  const avgOccupancy = buses.length
    ? Math.round(buses.reduce((a, b) => a + b.occupancy_percentage, 0) / buses.length)
    : 0;

  return (
    <section className="space-y-4">
      <SectionHeader
        index={3}
        title="Demand-Responsive Transit"
        subtitle="On-demand EV micro-fleet, live capacity recalculation & U-turn-first safety policy"
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <GlassCard
          className="xl:col-span-2"
          title="On-Demand EV Fleet — PG-EV-LOOP"
          subtitle="App-hailed loop service: Saravanampatti IT parks ↔ Avinashi Rd ↔ city centre"
          right={
            <button
              type="button"
              onClick={recalculate}
              disabled={recalculating}
              className={recalculating ? 'btn-cyan animate-pulse' : 'btn-green'}
            >
              {recalculating ? '⟳ recalculating…' : '⟲ Recalculate Route Capacity'}
            </button>
          }
        >
          <div className="mb-3 grid grid-cols-3 gap-3">
            <Stat label="EV buses on loop" value={buses.length} tone="green" />
            <Stat label="avg occupancy" value={avgOccupancy} unit="%" tone={avgOccupancy > 80 ? 'red' : 'green'} />
            <Stat label="waiting at hubs" value={totalWaiting} tone={totalWaiting > 60 ? 'red' : 'cyan'} />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {buses.map((b) => (
              <BusCapacityCard key={b.bus_id} bus={b} />
            ))}
            {buses.length === 0 && (
              <p className="p-4 text-center text-xs text-slate-500">Loading fleet telemetry…</p>
            )}
          </div>

          {recommendation && (
            <div className="mt-3 rounded-xl border border-emerald-400/30 bg-emerald-400/[0.06] p-3 text-xs leading-relaxed text-emerald-100">
              <span className="label-mono mb-1 block text-emerald-300">Recalculated @ {recommendation.at}</span>
              {recommendation.text}
            </div>
          )}
          {lastComputedAt === null && (
            <p className="mt-3 text-[10px] text-slate-500">
              Recalculation pulls app-hail requests, hub queue counts and live GPS headway, then rebalances
              the loop — the same POST /transit/fleet/PG-EV-LOOP/recalculate-capacity call the backend exposes.
            </p>
          )}
        </GlassCard>

        <GlassCard
          title="Hub Waiting Queues"
          subtitle="Demand signals feeding the recalculation engine"
          accent="cyan"
        >
          <div className="space-y-3">
            {hubs.map((h) => (
              <div key={h.hub}>
                <ProgressBar
                  value={Math.min(100, h.waiting * 2.5)}
                  label={h.hub}
                  warn={80}
                  sub={`${h.waiting} waiting`}
                />
              </div>
            ))}
          </div>
          <div className="glass-inset mt-4 p-3 text-[11px] leading-relaxed text-slate-400">
            <p className="mb-1 font-bold text-slate-100">How DRT dispatch works</p>
            Riders book via app/call-centre (no fixed timetable). When a hub queue exceeds the
            surge threshold, the recalculation engine reshuffles the loop and, if needed, releases
            the reserve bus from the Ukkadam depot — the proven demand-responsive pattern, electrified.
          </div>
        </GlassCard>
      </div>

      <GlassCard
        title="U-Turn Safety Policy — Right Turns Replaced Every 2–5 km"
        subtitle="Indirect right-turn design with U-turns: fewer crossing conflicts, predictable headways"
        accent="green"
        right={<Badge tone="green">conflict points −64%</Badge>}
      >
        <RouteSafetyStrip />
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="avg U-turn interval" value="2.9" unit="km" tone="green" />
          <Stat label="right-turn exposure" value="−64" unit="%" tone="green" />
          <Stat label="corridor delay saved" value="18" unit="%" tone="green" />
          <Stat label="collisions avoided / yr (proj.)" value="31" tone="red" />
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
          Crossing right turns is the dominant fatal-crash mechanism on Indian arterial roads. PulseGrid
          physically replaces direct right turns with U-turns staggered every 2–5 km, and the same rule
          governs DRT routing: the loop only ever turns right via a U-turn pocket, which keeps EV
          headways predictable and removes unprotected crossings from every bus journey.
        </p>
      </GlassCard>
    </section>
  );
}

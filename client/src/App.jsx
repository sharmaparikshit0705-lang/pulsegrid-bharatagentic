import React, { useCallback, useState } from 'react';
import Header from './components/Header.jsx';
import AgenticPlane from './components/AgenticPlane.jsx';
import Module1PMS from './components/Module1PMS.jsx';
import Module2ITS from './components/Module2ITS.jsx';
import Module3DRT from './components/Module3DRT.jsx';
import Analytics from './components/Analytics.jsx';
import { api } from './api/mockApi.js';

/* Live context ticker — the problem statement, always on screen. */
const TICKER = [
  { k: 'ROAD SAFETY', v: '1,77,175 deaths on Indian roads in 2024', tone: 'red' },
  { k: 'AGENT MESH', v: '8 specialist agents · 23 instrumented tools', tone: 'cyan' },
  { k: 'COLD CHAIN', v: '6–15% of fruit & vegetables lost before sale', tone: 'amber' },
  { k: 'LOGISTICS', v: '7.97% of GDP — ₹24 lakh crore a year', tone: 'cyan' },
  { k: 'EMERGENCY', v: '20 road deaths every hour', tone: 'red' },
  { k: 'PUBLIC RAILS', v: 'ULIP: 142 APIs across 12 ministries', tone: 'green' },
  { k: 'SCENARIOS', v: 'flood reroute · spoilage save · emergency corridor', tone: 'cyan' },
  { k: 'OPEN SOURCE', v: 'MIT licensed · deployable by any municipality', tone: 'green' },
];

function Ticker() {
  const items = [...TICKER, ...TICKER];
  const toneCls = {
    cyan: 'text-cyan-300',
    green: 'text-emerald-300',
    red: 'text-rose-300',
    amber: 'text-amber-300',
  };
  return (
    <div className="relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] py-2 backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-[#070B14] to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-[#070B14] to-transparent" />
      <div className="ticker-track gap-8 px-6">
        {items.map((t, i) => (
          <span key={i} className="flex shrink-0 items-center gap-2 whitespace-nowrap text-[11px]">
            <span className={`font-mono text-[10px] font-bold tracking-wider ${toneCls[t.tone]}`}>{t.k}</span>
            <span className="text-slate-500">·</span>
            <span className="text-slate-300">{t.v}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [emergencyActive, setEmergencyActive] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((msg, tone = 'cyan') => {
    setToast({ msg, tone, at: Date.now() });
    setTimeout(() => setToast(null), 3800);
  }, []);

  const handleEmergencyOverride = useCallback(async () => {
    setBusy(true);
    try {
      if (!emergencyActive) {
        await api.emergencyOverride({ junctionIds: 'ALL', reason: 'Operator-initiated corridor override' });
        setEmergencyActive(true);
        showToast('EMERGENCY OVERRIDE engaged — all junctions flushed to corridor hold', 'red');
      } else {
        await api.emergencyOverride({ active: false });
        setEmergencyActive(false);
        showToast('Emergency override stood down — green wave restored', 'green');
      }
    } catch (e) {
      showToast(`Override failed: ${e.message}`, 'red');
    } finally {
      setBusy(false);
    }
  }, [emergencyActive, showToast]);

  const handleReset = useCallback(async () => {
    setBusy(true);
    try {
      api.resetAll();
      setEmergencyActive(false);
      setResetKey((k) => k + 1);
      showToast('Simulation reset — all modules restored to seed state', 'cyan');
    } finally {
      setBusy(false);
    }
  }, [showToast]);

  return (
    <div className="relative min-h-screen pb-16">
      {/* ---------- animated background ---------- */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-70" />
        <div className="aurora-blob left-[-10%] top-[-8%] h-[420px] w-[420px] bg-cyan-500/25" />
        <div className="aurora-blob right-[-8%] top-[18%] h-[380px] w-[380px] bg-emerald-500/20" style={{ animationDelay: '-7s' }} />
        <div className="aurora-blob left-[35%] bottom-[-12%] h-[440px] w-[440px] bg-violet-600/15" style={{ animationDelay: '-14s' }} />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#070B14]/40 to-[#070B14]" />
      </div>

      <Header
        aiOnline
        emergencyActive={emergencyActive}
        onEmergencyOverride={handleEmergencyOverride}
        onReset={handleReset}
        busy={busy}
      />

      {/* Emergency banner */}
      {emergencyActive && (
        <div className="fixed inset-x-0 top-[68px] z-40 border-y border-rose-500/40 bg-rose-500/10 backdrop-blur-md">
          <p className="py-1.5 text-center font-mono text-xs font-bold tracking-[0.3em] text-rose-300 animate-pulse">
            🚨 EMERGENCY OVERRIDE IN EFFECT · CORRIDOR JUNCTIONS HELD · PRIORITY & EMERGENCY VEHICLES ONLY 🚨
          </p>
        </div>
      )}

      <main className={`mx-auto max-w-[1500px] space-y-8 px-4 ${emergencyActive ? 'pt-32' : 'pt-24'}`}>
        <Ticker />
        <AgenticPlane key={`m0-${resetKey}`} onToast={showToast} />
        <Module1PMS key={`m1-${resetKey}`} onToast={showToast} />
        <Module2ITS key={`m2-${resetKey}`} onToast={showToast} />
        <Module3DRT key={`m3-${resetKey}`} onToast={showToast} />
        <Analytics key={`m4-${resetKey}`} />
      </main>

      <footer className="mx-auto mt-12 max-w-[1500px] px-4 text-center">
        <p className="text-[11px] leading-relaxed text-slate-500">
          PulseGrid · Agentic Mobility &amp; Logistics Intelligence for Bharat · Avinashi Road &amp;
          Saravanampatti IT/College corridors, Coimbatore · built for the{' '}
          <span className="text-cyan-400">Bharat Agentic-AI Hackathon 2026</span> · open source (MIT) ·
          every feed, detection, fine and agent action shown here is simulated and labelled as such.
        </p>
      </footer>

      {/* Toast */}
      {toast && (
        <div
          className={`glass fixed bottom-6 left-1/2 z-50 -translate-x-1/2 px-4 py-2.5 text-xs font-semibold ${
            toast.tone === 'red'
              ? 'border-rose-500/40 text-rose-200'
              : toast.tone === 'green'
              ? 'border-emerald-400/40 text-emerald-200'
              : 'border-cyan-400/40 text-cyan-200'
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}

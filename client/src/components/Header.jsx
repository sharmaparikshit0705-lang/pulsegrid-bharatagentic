import React from 'react';

/**
 * Fixed dashboard header.
 * - PULSEGRID wordmark (gradient shimmer) + pulsing agent-mesh status
 * - Bharat Agentic badge
 * - Global 🚨 Emergency Override (toggles the corridor-wide signal override)
 * - 🔄 Reset (restores every module to its seed state)
 */
export default function Header({ aiOnline, emergencyActive, onEmergencyOverride, onReset, busy }) {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#070B14]/85 backdrop-blur-2xl">
      {/* thin gradient hairline */}
      <div className="h-[2px] w-full bg-gradient-to-r from-cyan-400/0 via-cyan-400/70 to-emerald-400/0" />

      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-x-3 gap-y-2 px-3 py-2.5 sm:px-4 sm:py-3">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <svg viewBox="0 0 32 32" className="h-10 w-10 shrink-0 drop-shadow-[0_0_12px_rgba(0,240,255,0.45)]">
            <defs>
              <linearGradient id="pgLogo" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#00F0FF" />
                <stop offset="100%" stopColor="#00FF66" />
              </linearGradient>
            </defs>
            <rect width="32" height="32" rx="9" fill="rgba(0,240,255,0.07)" stroke="rgba(0,240,255,0.35)" />
            <path
              d="M5 16h5l3-7 4 14 3-7h7"
              fill="none"
              stroke="url(#pgLogo)"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="26" cy="8" r="2.4" fill="#00FF66" className="breathe" />
          </svg>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="shimmer-text text-lg font-extrabold tracking-[0.14em] sm:text-xl sm:tracking-[0.22em]">PULSEGRID</span>

              <span className="flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5">
                <span className="relative flex h-2 w-2">
                  <span className={`absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 ${aiOnline ? 'animate-ping' : ''}`} />
                  <span className={`relative inline-flex h-2 w-2 rounded-full ${aiOnline ? 'bg-emerald-400' : 'bg-rose-500'}`} />
                </span>
                <span className="text-[10px] font-bold tracking-wider text-emerald-300">
                  {aiOnline ? 'AGENT MESH ONLINE' : 'MESH OFFLINE'}
                </span>
              </span>
            </div>
            <p className="hidden text-[10px] tracking-wide text-slate-500 sm:block">
              AGENTIC MOBILITY & LOGISTICS INTELLIGENCE · COIMBATORE CORRIDORS
            </p>
          </div>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-lg border border-cyan-400/30 bg-gradient-to-r from-cyan-400/10 to-emerald-400/10 px-3 py-1.5 text-[10px] font-bold tracking-[0.16em] text-slate-200 md:inline-flex">
            <span className="text-cyan-300">◆</span> BHARAT AGENTIC-AI
            <span className="text-slate-500">·</span>
            <span className="neon-text-green">2026</span>
          </span>
          <button
            type="button"
            onClick={onEmergencyOverride}
            disabled={busy}
            className={`btn ${
              emergencyActive
                ? 'animate-pulse border-rose-500 bg-rose-500/20 text-rose-200 shadow-neon-red'
                : 'btn-red'
            }`}
            title="Force EMERGENCY_OVERRIDE on every corridor junction"
          >
            🚨 <span className="hidden sm:inline">{emergencyActive ? 'OVERRIDE ACTIVE — STAND DOWN' : 'Emergency Override'}</span>
            <span className="sm:hidden">{emergencyActive ? 'Stand down' : 'Override'}</span>
          </button>
          <button type="button" onClick={onReset} disabled={busy} className="btn-ghost" title="Reset all modules to seed state">
            🔄 <span className="hidden sm:inline">Reset</span>
          </button>
        </div>
      </div>
    </header>
  );
}

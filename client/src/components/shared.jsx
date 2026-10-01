import React, { useEffect, useState } from 'react';

/* Shared presentational primitives for the PulseGrid dashboard. */

export function GlassCard({ title, subtitle, accent = 'cyan', right, className = '', children }) {
  const ring =
    accent === 'green'
      ? 'hover:shadow-neon-green'
      : accent === 'red'
      ? 'hover:shadow-neon-red'
      : 'hover:shadow-neon-cyan';
  return (
    <section className={`glass p-4 transition-shadow duration-300 ${ring} ${className}`}>
      {(title || right) && (
        <header className="mb-3 flex items-start justify-between gap-3">
          <div>
            {title && <h3 className="text-sm font-bold tracking-wide text-slate-100">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
          </div>
          {right}
        </header>
      )}
      {children}
    </section>
  );
}

export function SectionHeader({ index, title, subtitle }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1 font-mono text-[11px] font-bold tracking-[0.22em] text-cyan-300">
        MODULE {index}
      </span>
      <div>
        <h2 className="text-lg font-extrabold tracking-tight text-white">{title}</h2>
        {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
      </div>
    </div>
  );
}

const BADGE_STYLES = {
  cyan: 'border-cyan-400/40 bg-cyan-400/10 text-cyan-300',
  green: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300',
  red: 'border-rose-500/50 bg-rose-500/10 text-rose-300',
  amber: 'border-amber-400/40 bg-amber-400/10 text-amber-300',
  slate: 'border-white/15 bg-white/5 text-slate-300',
};

export function Badge({ tone = 'slate', children, className = '' }) {
  return <span className={`chip ${BADGE_STYLES[tone]} ${className}`}>{children}</span>;
}

export function StatusBadge({ status }) {
  const tone =
    status === 'REPAIRED'
      ? 'green'
      : status === 'DISPATCHED'
      ? 'amber'
      : status === 'EMERGENCY_OVERRIDE'
      ? 'red'
      : 'cyan';
  return <Badge tone={tone}>{status.replace(/_/g, ' ')}</Badge>;
}

export function SeverityMeter({ score, compact = false }) {
  return (
    <span className="inline-flex items-center gap-1" title={`Severity ${score}/5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className={`block ${compact ? 'h-2 w-2' : 'h-2.5 w-2.5'} rounded-full ${
            n <= score
              ? score >= 4
                ? 'bg-rose-500 shadow-[0_0_8px_rgba(255,51,102,0.8)]'
                : score === 3
                ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)]'
                : 'bg-emerald-400'
              : 'bg-white/10'
          }`}
        />
      ))}
    </span>
  );
}

export function ProgressBar({ value, warn = 85, label, sub }) {
  const v = Math.round(value);
  const color =
    v >= warn ? 'bg-rose-500 shadow-[0_0_10px_rgba(255,51,102,0.6)]' : v >= 60 ? 'bg-amber-400' : 'bg-emerald-400 shadow-[0_0_10px_rgba(0,255,102,0.5)]';
  return (
    <div>
      {(label || sub) && (
        <div className="mb-1 flex items-baseline justify-between text-xs">
          <span className="text-slate-300">{label}</span>
          <span className={`font-mono font-bold ${v >= warn ? 'text-rose-300' : 'text-emerald-300'}`}>{sub ?? `${v}%`}</span>
        </div>
      )}
      <div className="h-2.5 w-full overflow-hidden rounded-full border border-white/10 bg-black/40">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}

export function Stat({ label, value, unit, tone = 'cyan' }) {
  const cls =
    tone === 'green' ? 'neon-text-green' : tone === 'red' ? 'neon-text-red' : 'neon-text-cyan';
  return (
    <div className="glass-inset px-3 py-2.5 text-center">
      <div className={`font-mono text-xl font-bold ${cls}`}>
        {value}
        {unit && <span className="ml-0.5 text-xs text-slate-400">{unit}</span>}
      </div>
      <div className="label-mono mt-1">{label}</div>
    </div>
  );
}

const pad = (n) => String(n).padStart(2, '0');

/** Live HH:MM:SS countdown toward an ISO deadline. */
export function CountdownTimer({ dueAt, breachedText = 'SLA BREACHED — ESCALATED' }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = new Date(dueAt).getTime() - now;
  if (remaining <= 0) {
    return <span className="font-mono text-[11px] font-bold text-rose-400 animate-pulse">{breachedText}</span>;
  }
  const h = Math.floor(remaining / 3_600_000);
  const m = Math.floor((remaining % 3_600_000) / 60_000);
  const s = Math.floor((remaining % 60_000) / 1000);
  const tone = h > 12 ? 'text-cyan-300' : h > 3 ? 'text-amber-300' : 'text-rose-400 animate-pulse';
  return (
    <span className={`font-mono text-[11px] font-bold ${tone}`}>
      {pad(h)}:{pad(m)}:{pad(s)}
    </span>
  );
}

export function formatTime(iso) {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function timeAgo(iso) {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

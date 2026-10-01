import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createSubscribableRuntime,
  LANGUAGES,
  VERNACULAR,
  runEvals,
  evalCount,
  speak,
  stopSpeaking,
  speechSupported,
} from '../agents/index.js';
import { GlassCard, Badge, Stat } from './shared.jsx';

/* ==================================================================== */
/*  AGENTIC CONTROL PLANE                                               */
/*  GRIDMASTER orchestrator + 8 specialist agents, live reasoning        */
/*  traces, human approval gates and replayable runs.                    */
/*  The dashboard is the human-oversight surface over a working mesh.    */
/* ==================================================================== */

const PHASES = {
  perceive: { label: 'PERCEIVE', tone: 'border-cyan-400/40 bg-cyan-400/10 text-cyan-300', node: 'bg-cyan-400' },
  fuse: { label: 'FUSE', tone: 'border-sky-400/40 bg-sky-400/10 text-sky-300', node: 'bg-sky-400' },
  reason: { label: 'REASON', tone: 'border-violet-400/40 bg-violet-400/10 text-violet-300', node: 'bg-violet-400' },
  plan: { label: 'PLAN', tone: 'border-amber-400/40 bg-amber-400/10 text-amber-300', node: 'bg-amber-400' },
  act: { label: 'ACT', tone: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300', node: 'bg-emerald-400' },
  verify: { label: 'VERIFY', tone: 'border-teal-400/40 bg-teal-400/10 text-teal-300', node: 'bg-teal-400' },
  learn: { label: 'LEARN', tone: 'border-fuchsia-400/40 bg-fuchsia-400/10 text-fuchsia-300', node: 'bg-fuchsia-400' },
};

/* Per-agent identity: icon + accent colour, so the mesh reads at a glance. */
const AGENT_META = {
  corridorsense: { icon: '🛣️', accent: 'cyan' },
  safetysentinel: { icon: '🛡️', accent: 'rose' },
  reroute: { icon: '🧭', accent: 'sky' },
  coldguard: { icon: '❄️', accent: 'teal' },
  hubsync: { icon: '🏗️', accent: 'amber' },
  saarthi: { icon: '🧑‍✈️', accent: 'violet' },
  greenlane: { icon: '🌱', accent: 'green' },
  trustledger: { icon: '🔗', accent: 'fuchsia' },
};

function PhaseChip({ phase }) {
  const p = PHASES[phase] || PHASES.reason;
  return <span className={`chip ${p.tone} shrink-0`}>{p.label}</span>;
}

/* ---------------------------- agent mesh ------------------------------ */

function AgentCard({ agent, status }) {
  const dot =
    status === 'running'
      ? 'bg-cyan-400 animate-pulse'
      : status === 'done'
      ? 'bg-emerald-400'
      : 'bg-slate-600';
  const meta = AGENT_META[agent.id] || { icon: '◆', accent: 'cyan' };
  const accent = {
    cyan: 'from-cyan-400/20 to-transparent text-cyan-300',
    green: 'from-emerald-400/20 to-transparent text-emerald-300',
    amber: 'from-amber-400/20 to-transparent text-amber-300',
    violet: 'from-violet-400/20 to-transparent text-violet-300',
    rose: 'from-rose-400/20 to-transparent text-rose-300',
    sky: 'from-sky-400/20 to-transparent text-sky-300',
    teal: 'from-teal-400/20 to-transparent text-teal-300',
    fuchsia: 'from-fuchsia-400/20 to-transparent text-fuchsia-300',
  }[meta.accent];

  return (
    <div
      className={`glass-inset relative overflow-hidden p-2.5 transition-all duration-300 ${
        status === 'running'
          ? 'border-cyan-400/60 shadow-neon-cyan'
          : status === 'done'
          ? 'border-emerald-400/40'
          : 'hover:border-white/25'
      }`}
    >
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b ${accent}`} />
      <div className="relative flex items-center gap-2">
        <span className={`agent-icon bg-black/50 ring-1 ring-white/10 ${accent.split(' ')[2]}`}>{meta.icon}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-bold text-slate-100">{agent.name}</p>
          <p className="font-mono text-[8px] uppercase tracking-wider text-slate-500">
            {status === 'running' ? 'reasoning…' : status === 'done' ? 'completed' : 'idle'}
          </p>
        </div>
        <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
      </div>
      <p className="relative mt-1.5 line-clamp-2 text-[9.5px] leading-snug text-slate-500">{agent.purpose}</p>
      <div className="relative mt-1.5 flex flex-wrap gap-1">
        {agent.toolsUsed.slice(0, 3).map((t) => (
          <span key={t} className="rounded bg-black/40 px-1 py-px font-mono text-[8px] text-slate-400">
            {t}
          </span>
        ))}
        {agent.toolsUsed.length > 3 && (
          <span className="rounded bg-black/40 px-1 py-px font-mono text-[8px] text-slate-500">
            +{agent.toolsUsed.length - 3}
          </span>
        )}
      </div>
    </div>
  );
}

/* ------------------------------ trace --------------------------------- */

function TraceEntry({ e }) {
  if (e.kind === 'agent_start') {
    return (
      <div className="mt-3 flex items-center gap-2 border-t border-white/10 pt-2">
        <span className="rounded bg-cyan-400/15 px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-wider text-cyan-300">
          ▶ {e.agentName}
        </span>
        <span className="h-px flex-1 bg-gradient-to-r from-cyan-400/40 to-transparent" />
      </div>
    );
  }
  if (e.kind === 'step') {
    const p = PHASES[e.step.phase] || PHASES.reason;
    return (
      <div className="flex items-start gap-2.5 py-1">
        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${p.node} shadow-[0_0_10px_rgba(0,240,255,0.45)]`} />
        <PhaseChip phase={e.step.phase} />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-slate-200">{e.step.title}</p>
          <p className="font-mono text-[10px] leading-snug text-slate-400">{e.step.detail}</p>
        </div>
      </div>
    );
  }
  if (e.kind === 'tool_call') {
    return (
      <div className="flex items-center gap-2 py-0.5 pl-1">
        <span className="font-mono text-[10px] text-slate-500">↳ tool</span>
        <span className="rounded border border-white/10 bg-black/40 px-1.5 py-px font-mono text-[10px] text-cyan-200">
          {e.tool}({Object.keys(e.args || {}).slice(0, 3).join(', ')})
        </span>
        {e.simulated && <span className="font-mono text-[8px] text-amber-400/80">simulated</span>}
      </div>
    );
  }
  if (e.kind === 'tool_result') {
    return (
      <div className="flex items-center gap-2 py-0.5 pl-1">
        <span className="font-mono text-[10px] text-slate-500">← {e.tool}</span>
        <span className={`font-mono text-[10px] ${e.result?.ok === false ? 'text-rose-300' : 'text-emerald-300'}`}>
          {e.result?.ok === false ? 'error' : 'ok'}
        </span>
        <span className="font-mono text-[9px] text-slate-600">{e.elapsedMs}ms</span>
      </div>
    );
  }
  if (e.kind === 'agent_done') {
    return (
      <div className="mt-1 rounded-lg border border-emerald-400/25 bg-emerald-400/[0.05] p-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[11px] font-semibold text-emerald-200">{e.result.summary}</p>
          <span className="shrink-0 font-mono text-[9px] text-emerald-300">
            conf {Math.round((e.result.confidence || 0) * 100)}%
          </span>
        </div>
        {e.result.metrics && Object.keys(e.result.metrics).length > 0 && (
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[9px] text-slate-400">
            {Object.entries(e.result.metrics).map(([k, v]) => (
              <span key={k}>
                {k}: <b className="text-slate-200">{typeof v === 'number' ? Math.round(v * 100) / 100 : String(v)}</b>
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }
  if (e.kind === 'approval') {
    return (
      <div className="my-1 rounded-lg border border-amber-400/40 bg-amber-400/[0.07] p-2">
        <p className="font-mono text-[10px] font-bold text-amber-300">⏸ HUMAN GATE · {e.approval.id}</p>
        <p className="mt-0.5 text-[10.5px] text-slate-300">{e.approval.reason}</p>
      </div>
    );
  }
  return null;
}

/* ---------------------------- approvals ------------------------------- */

function ApprovalCard({ a, onResolve }) {
  const resolved = a.status !== 'pending';
  return (
    <div
      className={`glass-inset p-2.5 ${
        a.status === 'approved'
          ? 'border-emerald-400/40'
          : a.status === 'rejected'
          ? 'border-rose-500/40'
          : 'border-amber-400/40'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] font-bold text-amber-300">{a.id}</span>
        <Badge tone={a.status === 'approved' ? 'green' : a.status === 'rejected' ? 'red' : 'amber'}>
          {a.status}
        </Badge>
      </div>
      <p className="mt-1 text-[11px] leading-snug text-slate-200">{a.reason}</p>
      <p className="mt-0.5 font-mono text-[9px] text-slate-500">
        from {a.agentName} · risk: {a.risk} · {a.runId}
      </p>
      {!resolved ? (
        <div className="mt-2 flex gap-1.5">
          <button type="button" className="btn-green" onClick={() => onResolve(a.id, 'approve')}>
            Approve
          </button>
          <button type="button" className="btn-red" onClick={() => onResolve(a.id, 'reject')}>
            Reject
          </button>
        </div>
      ) : (
        <p className="mt-1.5 font-mono text-[9px] text-slate-500">
          {a.resolution} · {a.resolvedAt ? new Date(a.resolvedAt).toLocaleTimeString('en-IN') : ''}
        </p>
      )}
    </div>
  );
}

/* ------------------------------ module -------------------------------- */

export default function AgenticPlane({ onToast }) {
  const [speed, setSpeed] = useState(0.4);
  const [runtime, setRuntime] = useState(() => createSubscribableRuntime({ speed: 0.4 }));
  const [trace, setTrace] = useState([]);
  const [run, setRun] = useState(null);
  const [runs, setRuns] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [memory, setMemory] = useState({});
  const [agentStatus, setAgentStatus] = useState({});
  const [alerts, setAlerts] = useState([]);
  const [previewLang, setPreviewLang] = useState('hi-IN');
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [evals, setEvals] = useState(null);
  const [evalRunning, setEvalRunning] = useState(false);
  const [askText, setAskText] = useState('');
  const [plan, setPlan] = useState(null);
  const [running, setRunning] = useState(false);
  const traceBoxRef = useRef(null);

  const catalog = useMemo(() => runtime.agentCatalog, [runtime]);
  const scenarios = useMemo(() => runtime.scenarioCatalog, [runtime]);

  useEffect(() => {
    const unsub = runtime.subscribe((e) => {
      switch (e.type) {
        case 'run_start':
          setTrace([]);
          setAgentStatus({});
          setAlerts([]);
          setPlan(e.plan || null);
          setRunning(true);
          setRun(null);
          break;
        case 'agent_start':
          setAgentStatus((s) => ({ ...s, [e.agent]: 'running' }));
          setTrace((t) => [...t, { kind: 'agent_start', agentName: e.agentName }]);
          break;
        case 'step':
          setTrace((t) => [...t, { kind: 'step', step: e.step }]);
          break;
        case 'tool_call':
          setTrace((t) => [...t, { kind: 'tool_call', tool: e.tool, args: e.args }]);
          break;
        case 'tool_result':
          setTrace((t) => [...t, { kind: 'tool_result', tool: e.tool, result: e.result, elapsedMs: e.elapsedMs }]);
          if (e.tool === 'notify_party' && e.result?.localized) {
            setAlerts((a) => [{ ...e.result, at: new Date().toISOString() }, ...a].slice(0, 4));
            if (autoSpeak && e.result.party && String(e.result.party).startsWith('D-')) {
              speak(e.result.localized, e.result.language);
            }
          }
          break;
        case 'agent_done':
          setAgentStatus((s) => ({ ...s, [e.agent]: 'done' }));
          setTrace((t) => [...t, { kind: 'agent_done', result: e.result }]);
          break;
        case 'approval_request':
          setApprovals((a) => [e.approval, ...a]);
          setTrace((t) => [...t, { kind: 'approval', approval: e.approval }]);
          break;
        case 'approval_resolved':
          setApprovals((a) => a.map((x) => (x.id === e.approval.id ? e.approval : x)));
          break;
        case 'run_end':
          setRun(e.run);
          setRuns(runtime.getRuns());
          setApprovals(runtime.getApprovals());
          setMemory(runtime.getMemory());
          setRunning(false);
          break;
        default:
          break;
      }
    });
    return unsub;
  }, [runtime, autoSpeak]);

  useEffect(() => {
    if (traceBoxRef.current) traceBoxRef.current.scrollTop = traceBoxRef.current.scrollHeight;
  }, [trace]);

  const changeSpeed = (v) => {
    setSpeed(v);
    setRuntime(createSubscribableRuntime({ speed: v }));
    setTrace([]);
    setRuns([]);
    setApprovals([]);
    setMemory({});
    setAgentStatus({});
    setRun(null);
  };

  const startScenario = useCallback(
    async (id) => {
      if (running) return;
      setApprovals([]);
      try {
        await runtime.runScenario(id);
      } catch (err) {
        onToast?.(`Run failed: ${err.message}`, 'red');
      }
    },
    [runtime, running, onToast]
  );

  const askMesh = useCallback(
    async (e) => {
      e.preventDefault();
      const text = askText.trim();
      if (!text || running) return;
      setApprovals([]);
      try {
        await runtime.runRequest({ request: text });
      } catch (err) {
        onToast?.(`Request failed: ${err.message}`, 'red');
      }
    },
    [askText, running, runtime, onToast]
  );

  const resolve = (id, decision) => {
    runtime.resolveApproval(id, decision);
    setApprovals(runtime.getApprovals());
    setRuns(runtime.getRuns());
    onToast?.(`${id} ${decision === 'approve' ? 'approved' : 'rejected'} — logged to the audit trail`, decision === 'approve' ? 'green' : 'red');
  };

  const pendingCount = approvals.filter((a) => a.status === 'pending').length;

  return (
    <section className="space-y-4">
      {/* hero strip */}
      <div className="conic-ring glass relative overflow-hidden p-4">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-cyan-400/[0.07] via-transparent to-emerald-400/[0.07]" />
        <div className="relative flex flex-wrap items-center gap-3">
          <span className="rounded-lg border border-cyan-400/40 bg-cyan-400/10 px-3 py-1 font-mono text-[11px] font-bold tracking-[0.22em] text-cyan-300">
            AGENTIC CONTROL PLANE
          </span>
          <Badge tone="cyan">GRIDMASTER orchestrator</Badge>
          <Badge tone="green">8 specialist agents</Badge>
          <Badge tone="amber">human approval gates</Badge>
          <Badge tone="slate">replayable runs</Badge>
          <span className="ml-auto flex items-center gap-2">
            <span className="label-mono">animation</span>
            {[
              { label: 'instant', v: 0 },
              { label: 'fast', v: 0.15 },
              { label: 'demo', v: 0.4 },
              { label: 'slow', v: 0.9 },
            ].map((o) => (
              <button
                key={o.label}
                type="button"
                onClick={() => changeSpeed(o.v)}
                className={`rounded-md border px-2 py-0.5 font-mono text-[10px] transition ${
                  speed === o.v ? 'border-cyan-400/60 bg-cyan-400/15 text-cyan-200' : 'border-white/10 text-slate-400 hover:text-slate-200'
                }`}
              >
                {o.label}
              </button>
            ))}
          </span>
        </div>
        <p className="relative mt-2 text-[11px] leading-relaxed text-slate-400">
          This is not a scripted animation. Each scenario dispatches real agents that call real tools
          (instrumented, logged and replayable), reason over costed options, respect guardrails, and stop
          at human gates before irreversible or public-facing actions. Tools that would call an external
          service are deterministic simulators and are labelled <span className="text-amber-300">simulated</span> in the trace.
        </p>
      </div>

      {/* free-form entry point — the agent's real input */}
      <form onSubmit={askMesh} className="glass p-3">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="label-mono">ask the mesh — describe your own problem</span>
          <Badge tone="cyan">POST /api/v1/agent</Badge>
          <span className="ml-auto font-mono text-[9px] text-slate-500">
            input → plan → reasoning → tools → outcome
          </span>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={askText}
            onChange={(e) => setAskText(e.target.value)}
            disabled={running}
            placeholder="e.g. A vaccine truck is heading to Kochi and there is a flood on NH-544"
            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-400/50 disabled:opacity-50"
          />
          <button type="submit" disabled={running || !askText.trim()} className="btn-green justify-center px-4">
            {running ? '⟳ reasoning…' : '▶ Run agent'}
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {[
            'There is a big pothole near the school gate on Avinashi Road',
            'The ambulance needs a clear corridor to KMCH',
            'The driver has been on duty too long and looks tired',
          ].map((ex) => (
            <button
              key={ex}
              type="button"
              disabled={running}
              onClick={() => setAskText(ex)}
              className="rounded-md border border-white/10 px-2 py-0.5 text-[10px] text-slate-400 transition hover:border-cyan-400/40 hover:text-slate-200 disabled:opacity-50"
            >
              {ex.length > 44 ? ex.slice(0, 44) + '…' : ex}
            </button>
          ))}
        </div>
        {plan && (
          <div className="mt-2 glass-inset border-cyan-400/25 p-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="label-mono">GRIDMASTER plan</span>
              {plan.intents.map((i) => (
                <Badge key={i.intent} tone="cyan">{i.intent}</Badge>
              ))}
              <span className="ml-auto font-mono text-[9px] text-slate-400">
                confidence {Math.round((plan.confidence || 0) * 100)}%
              </span>
            </div>
            <p className="mt-1.5 text-[10.5px] leading-snug text-slate-300">{plan.rationale}</p>
            {plan.needsClarification && (
              <p className="mt-1 font-mono text-[9px] text-amber-300">
                no intent matched confidently — fell back to the safety-first default
              </p>
            )}
          </div>
        )}
      </form>

      {/* scenario runner */}
      <div className="grid gap-3 md:grid-cols-3">
        {scenarios.map((s) => (
          <button
            key={s.id}
            type="button"
            disabled={running}
            onClick={() => startScenario(s.id)}
            className="glass group relative overflow-hidden p-3 text-left transition-all hover:border-cyan-400/50 hover:shadow-neon-cyan disabled:opacity-50"
          >
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-cyan-400/0 to-cyan-400/0 transition-all group-hover:from-cyan-400/[0.08] group-hover:to-emerald-400/[0.05]" />
            <div className="relative flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-100">{s.title}</span>
              <span className="flex items-center gap-1 rounded-md border border-cyan-400/40 px-1.5 py-0.5 font-mono text-[9px] text-cyan-300 transition group-hover:bg-cyan-400/15 group-hover:shadow-neon-cyan">
                {running ? '…' : '▶ RUN'}
              </span>
            </div>
            <p className="relative mt-1.5 text-[10.5px] leading-snug text-slate-400">{s.blurb}</p>
          </button>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        {/* left: mesh + trace */}
        <div className="space-y-4">
          <GlassCard
            title="Agent mesh"
            subtitle="Eight specialists under one orchestrator — each with scoped tools and guardrails"
            right={<Badge tone={running ? 'cyan' : 'slate'}>{running ? 'dispatching…' : 'idle'}</Badge>}
          >
            <div className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-4">
              {catalog.map((a) => (
                <AgentCard key={a.id} agent={a} status={agentStatus[a.id] || 'idle'} />
              ))}
            </div>
            <div className="mt-3 glass-inset border-cyan-400/20 p-2.5">
              <p className="text-[10.5px] leading-snug text-slate-400">
                <b className="text-cyan-300">GRIDMASTER</b> decomposes the goal, dispatches agents in order,
                feeds each result into the next (a new ETA from Reroute is handed to ColdGuard), owns the
                approval policy, and records every step and tool call for replay.
              </p>
            </div>
          </GlassCard>

          <GlassCard
            title="Live reasoning trace"
            subtitle={run ? `${run.id} · ${run.scenarioId} · ${run.status.replace(/_/g, ' ')}` : 'Run a scenario to stream the chain'}
            right={
              <div className="flex items-center gap-2">
                {running && <span className="font-mono text-[10px] text-cyan-300 animate-pulse">● streaming</span>}
                <Badge tone="slate">{trace.filter((t) => t.kind === 'step').length} steps</Badge>
                <Badge tone="slate">{trace.filter((t) => t.kind === 'tool_call').length} tool calls</Badge>
              </div>
            }
          >
            <div ref={traceBoxRef} className="max-h-[460px] min-h-[220px] overflow-y-auto rounded-xl border border-white/10 bg-black/30 p-3">
              {trace.length === 0 && (
                <p className="py-10 text-center text-[11px] text-slate-500">
                  The trace shows every perceive → fuse → reason → plan → act → verify → learn step,
                  with each tool call and its result.
                </p>
              )}
              {trace.map((e, i) => (
                <TraceEntry key={i} e={e} />
              ))}
            </div>
          </GlassCard>
        </div>

        {/* right: oversight */}
        <div className="space-y-4">
          <GlassCard
            title="Trust & evals"
            subtitle="The mesh proves itself — the same outcome assertions that run in CI, executed live"
            accent="cyan"
            right={
              evals ? (
                <Badge tone={evals.passed === evals.total ? 'green' : 'amber'}>
                  {evals.passed}/{evals.total}
                </Badge>
              ) : (
                <Badge tone="slate">{evalCount} checks</Badge>
              )
            }
          >
            <button
              type="button"
              disabled={evalRunning}
              onClick={async () => {
                setEvalRunning(true);
                setEvals(null);
                try {
                  setEvals(await runEvals());
                } finally {
                  setEvalRunning(false);
                }
              }}
              className={evalRunning ? 'btn-cyan w-full justify-center animate-pulse' : 'btn-cyan w-full justify-center'}
            >
              {evalRunning ? '⟳ running the suite…' : '▶ Run self-eval (3 scenarios, 17 assertions)'}
            </button>

            {evals && (
              <div className="mt-3">
                <div className="mb-2 flex items-center gap-2">
                  <div className="h-2 flex-1 overflow-hidden rounded-full border border-white/10 bg-black/40">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        evals.passed === evals.total ? 'bg-emerald-400' : 'bg-amber-400'
                      }`}
                      style={{ width: `${(evals.passed / evals.total) * 100}%` }}
                    />
                  </div>
                  <span className="font-mono text-[10px] text-slate-400">{evals.durationMs} ms</span>
                </div>
                <div className="max-h-[220px] space-y-1 overflow-y-auto pr-1">
                  {['A', 'B', 'C'].map((sc) => (
                    <div key={sc}>
                      <p className="label-mono mt-2 mb-1">scenario {sc}</p>
                      {evals.results
                        .filter((r) => r.scenario === sc)
                        .map((r, i) => (
                          <div key={i} className="flex items-start gap-2 py-0.5 text-[10.5px]">
                            <span className={r.passed ? 'text-emerald-400' : 'text-rose-400'}>
                              {r.passed ? '✓' : '✗'}
                            </span>
                            <span className={r.passed ? 'text-slate-300' : 'text-rose-200'}>{r.name}</span>
                          </div>
                        ))}
                    </div>
                  ))}
                </div>
                <p className="mt-2 font-mono text-[9px] leading-snug text-slate-500">
                  same contract as `npm run test:agents` · exported to AgentFoundry as evals/gridmaster.eval.json
                </p>
              </div>
            )}
          </GlassCard>

          <GlassCard
            title="Human oversight"
            subtitle="Nothing irreversible or public-facing happens without a human decision"
            accent="red"
            right={pendingCount > 0 ? <Badge tone="amber">{pendingCount} pending</Badge> : <Badge tone="slate">clear</Badge>}
          >
            <div className="space-y-2">
              {approvals.length === 0 && (
                <p className="py-6 text-center text-[11px] text-slate-500">
                  No gates raised yet. Scenario A (spend above policy) and Scenario C (public hazard
                  advisory) will stop here for your decision.
                </p>
              )}
              {approvals.slice(0, 4).map((a) => (
                <ApprovalCard key={a.id} a={a} onResolve={resolve} />
              ))}
            </div>
          </GlassCard>

          <GlassCard
            title="Vernacular driver alerts"
            subtitle="The mesh speaks the driver's language — all 22 Indian languages, not English by default"
            accent="green"
            right={<Badge tone="green">{LANGUAGES.length} languages</Badge>}
          >
            {/* pick any Indian language and read the same instruction in it */}
            <div className="mb-1.5 flex items-center gap-2">
              <p className="label-mono">preview a driver instruction in any Indian language</p>
              <button
                type="button"
                onClick={() => {
                  setAutoSpeak((v) => {
                    if (v) stopSpeaking();
                    return !v;
                  });
                }}
                className={`ml-auto rounded-md border px-2 py-0.5 font-mono text-[10px] transition ${
                  autoSpeak
                    ? 'border-emerald-400/60 bg-emerald-400/15 text-emerald-200'
                    : 'border-white/10 text-slate-400 hover:text-slate-200'
                }`}
                title="Read each new driver alert aloud automatically"
              >
                {autoSpeak ? '🔊 read aloud: on' : '🔇 read aloud: off'}
              </button>
            </div>
            <div className="mb-2 flex flex-wrap gap-1">
              {LANGUAGES.map((l) => (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => setPreviewLang(l.code)}
                  title={l.name}
                  className={`rounded-md border px-1.5 py-0.5 text-[11px] leading-tight transition ${
                    previewLang === l.code
                      ? 'border-emerald-400/60 bg-emerald-400/15 text-emerald-200'
                      : 'border-white/10 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {l.native}
                </button>
              ))}
            </div>
            <div className="glass-inset border-emerald-400/25 p-2.5">
              <div className="flex items-center gap-2">
                <Badge tone="green">
                  {LANGUAGES.find((l) => l.code === previewLang)?.name || previewLang}
                </Badge>
                <span className="font-mono text-[9px] text-slate-500">sample · route change</span>
                <span className="ml-auto flex items-center gap-2">
                  {speechSupported() && (
                    <button
                      type="button"
                      onClick={() => speak(VERNACULAR.route_change[previewLang], previewLang)}
                      className="rounded border border-emerald-400/40 px-1.5 py-0.5 font-mono text-[9px] text-emerald-300 hover:bg-emerald-400/10"
                      title="Read this alert aloud"
                    >
                      🔊 speak
                    </button>
                  )}
                  <span className="font-mono text-[9px] text-emerald-300">{previewLang}</span>
                </span>
              </div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-emerald-100">
                {VERNACULAR.route_change[previewLang]}
              </p>
              <p className="mt-1 font-mono text-[9px] text-slate-500">
                EN: {VERNACULAR.route_change['en-IN']}
              </p>
            </div>

            {/* what the mesh actually sent on the last run */}
            <p className="label-mono mb-1.5 mt-3">sent by the mesh on the last run</p>
            {alerts.length === 0 ? (
              <p className="py-3 text-center text-[11px] text-slate-500">
                Nothing yet. Run scenario A or B — when an agent notifies a driver, the message lands here
                in the driver's own script.
              </p>
            ) : (
              <div className="space-y-2">
                {alerts.map((a, i) => (
                  <div key={i} className="glass-inset border-emerald-400/25 p-2.5">
                    <div className="flex items-center gap-2">
                      <Badge tone="green">
                        {LANGUAGES.find((l) => l.code === a.language)?.native || a.languageLabel}
                      </Badge>
                      <span className="font-mono text-[9px] text-slate-500">
                        {a.channel} · {a.party}
                      </span>
                      <span className="ml-auto flex items-center gap-2">
                        {speechSupported() && (
                          <button
                            type="button"
                            onClick={() => speak(a.localized, a.language)}
                            className="rounded border border-emerald-400/40 px-1.5 py-0.5 font-mono text-[9px] text-emerald-300 hover:bg-emerald-400/10"
                            title="Read this alert aloud"
                          >
                            🔊
                          </button>
                        )}
                        <span className="font-mono text-[9px] text-emerald-300">delivered</span>
                      </span>
                    </div>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-emerald-100">{a.localized}</p>
                    <p className="mt-1 font-mono text-[9px] text-slate-500">EN: {a.message}</p>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>

          {run && (
            <GlassCard title="Run outcome" subtitle={`${run.id} · ${run.agentResults.length} agents · ${run.durationMs} ms`}>
              <div className="grid grid-cols-2 gap-2">
                <Stat label="agents dispatched" value={run.agentResults.length} />
                <Stat label="tool calls" value={run.toolCalls.length} />
                <Stat label="reasoning steps" value={run.steps.length} tone="green" />
                <Stat
                  label="gates raised"
                  value={run.approvals.length}
                  tone={run.approvals.length ? 'red' : 'cyan'}
                />
              </div>
              <div className="mt-3 space-y-1.5">
                {run.decisions.map((d, i) => (
                  <div key={i} className="flex items-start gap-2 text-[10.5px]">
                    <span className="w-[86px] shrink-0 font-mono text-[9px] uppercase text-slate-500">{d.agent}</span>
                    <span className="flex-1 text-slate-300">{d.summary}</span>
                    <span className="shrink-0 font-mono text-[9px] text-emerald-300">{Math.round(d.confidence * 100)}%</span>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}

          <GlassCard title="Episodic memory" subtitle="What the mesh learned from previous runs">
            {Object.keys(memory).length === 0 ? (
              <p className="py-4 text-center text-[11px] text-slate-500">
                Empty. Run a scenario — defect priors, flood-diversion preferences and recurring
                door-event patterns persist here and inform the next run.
              </p>
            ) : (
              <div className="space-y-1">
                {Object.entries(memory).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between rounded-lg bg-black/30 px-2.5 py-1.5">
                    <span className="font-mono text-[10px] text-slate-400">{k}</span>
                    <span className="font-mono text-[11px] font-bold text-cyan-300">{String(v)}</span>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>

          <GlassCard title="Run history" subtitle="Every run is replayable — steps, tools, decisions, approvals">
            {runs.length === 0 ? (
              <p className="py-4 text-center text-[11px] text-slate-500">No runs yet.</p>
            ) : (
              <div className="space-y-1.5">
                {runs.map((r) => (
                  <div key={r.id} className="glass-inset flex items-center gap-2 p-2 text-[10px]">
                    <span className="font-mono font-bold text-slate-300">{r.id}</span>
                    <span className="rounded bg-black/40 px-1.5 py-px font-mono text-[9px] text-cyan-300">
                      scenario {r.scenarioId}
                    </span>
                    <Badge tone={r.status === 'completed' ? 'green' : r.status === 'awaiting_approval' ? 'amber' : 'slate'}>
                      {r.status.replace(/_/g, ' ')}
                    </Badge>
                    <span className="ml-auto font-mono text-[9px] text-slate-500">
                      {r.steps.length}s · {r.toolCalls.length}t · {r.durationMs}ms
                    </span>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        </div>
      </div>
    </section>
  );
}

# AgentFoundry pack — import PulseGrid's agents

The hackathon builds on **AgentFoundry.me**, and there is a sponsor award for **Best Use of
AgentFoundry Agents**. This folder carries the mesh in a form that maps onto AgentFoundry's agent
lifecycle (prompts, tools, guardrails, evals, provenance), so the work is visible on the platform
rather than only in a custom repo.

## What's here

```
agents/agentfoundry/
├── manifest.json                  # slug, name, prompts, tools, guardrails, provenance
├── prompts/                       # one prompt per agent (gridmaster + the 8 specialists)
│   ├── gridmaster.md
│   ├── corridorsense.md  safetysentinel.md  reroute.md
│   ├── coldguard.md  hubsync.md  saarthi.md  greenlane.md  trustledger.md
└── evals/gridmaster.eval.json     # outcome-level evals, one per scenario
```

## Import (5 minutes)

1. Open the PulseGrid project in the AgentFoundry IDE.
2. **Agents → Describe → Build** for the orchestrator; name it `PulseGrid Agent Mesh`.
3. Paste `prompts/gridmaster.md` into the agent's prompt. Paste the eight specialist prompts into
   its sub-agents (the Advanced: build step by step path exposes sub-agents).
4. Register the 22 tools listed in `manifest.json`. In the prototype they live in
   `client/src/agents/tools.js` — each is a plain function with a JSON in/out contract, so they
   port directly into the Visual Tool Builder.
5. Paste the `guardrails` block from `manifest.json` into the guardrails panel. Note that the
   "human approval required" rules are enforced *in code* as well (`gridmaster.js` raises the
   approval; the UI resolves it), so this is a policy mirror, not decoration.
6. Load `evals/gridmaster.eval.json` and run the suite. The same assertions run locally with
   `cd client && npm run test:agents`.
7. Use **Live Replay** on a run — every step and tool call is already recorded, so the replay
   viewer shows the reasoning chain with no extra instrumentation.

## Why the two implementations stay in sync

The agent core in `client/src/agents/` is framework-agnostic, pure JavaScript: no DOM, no
framework, no vendor SDK. The same file that powers the dashboard also powers the Express API
(`server/src/controllers/agentsController.js` imports it directly). The AgentFoundry pack
describes that same behaviour in the platform's own vocabulary — prompts, tools, guardrails,
evals — so there is one design, expressed twice, with the code as the source of truth.

## Provenance note

`manifest.json` declares the data access honestly: synthetic demo data, with ULIP and Gati Shakti
adapters designed but no production keys held. Do not change that line to imply live government
data access — it is the first thing a technical judge will check.

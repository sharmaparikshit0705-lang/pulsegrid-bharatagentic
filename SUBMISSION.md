# Submission pack — Bharat Agentic-AI Hackathon 2026 ("Code for a Billion")

Everything you need to file the entry, in the order you need it. Copy-paste text is in the
boxes; the rest is checklist.

**Deadline: 15 November 2026.** Winners announced 5 December 2026. You have roughly six weeks.

---

## 0. The honest readiness scorecard

| Judging dimension | Status | Notes |
|---|---|---|
| Working, deployed code | **⚠️ code ready, not yet deployed** | Deploy the API (`render.yaml`/`Dockerfile`) and the dashboard (`vercel.json`). Deploying is a hard requirement — undeployed projects are not judged. |
| Open source | **✅ ready** | MIT `LICENSE` included. Push to the Code for India GitHub org. |
| Impact | **✅ strong** | Real baselines (1,77,175 road deaths in 2024; 6–15% post-harvest loss), modelled deltas with assumptions. |
| Technical quality | **✅ strong** | 8 agents, 23 instrumented tools, guardrails, human gates, replayable runs, a **live self-eval panel (17 assertions)**, voice output, and 33 automated assertions in CI. |
| Multi-agent orchestration | **✅ strong** | The exact pattern recent agentic hackathons reward. |
| Built in AgentFoundry | **⚠️ to do** | Import the manifests in `agents/agentfoundry/` (also the "Best Use of AgentFoundry Agents" award). |
| Demo video (2–3 min) | **❌ not made** | Script is in `DEMO.md`. This is the single biggest scoring risk. |
| Problem statement + size | **✅ ready** | Copy-paste text below. |

**Bottom line:** the system is competitive. What is missing is not features — it is the
*packaging*: deployment, the video, and the AgentFoundry import. Do those three before adding
anything else.

---

## 1. Registration

1. Register at `codeforindia.org/hackathon/register`.
2. Impact area: **Transportation Safety** (secondary: Waste Management, Clean Air).
3. Create the project in the **AgentFoundry.me** IDE and claim the 1M smart-code tokens.
4. Push the repo to the Code for India GitHub org, licence MIT.

---

## 2. Problem statement (copy-paste)

> **Problem:** India's freight and mobility corridors kill and waste at scale. 4,87,707 road
> accidents in 2024 killed 1,77,175 people — about 20 deaths every hour — with over-speeding
> behind 70.3% of deaths and potholes, curves and steep grades behind 13.8% of all accidents.
> In parallel, 6.02–15.05% of fruit and 4.87–11.61% of vegetables are lost before they reach a
> buyer, and transport is the single largest loss stage; 97.4% of that produce moves by road.
> Meanwhile logistics costs India ₹24 lakh crore a year (7.97% of GDP).
>
> **Solution:** PulseGrid is an open-source, agentic public-good layer for these corridors. Eight
> specialist agents — coordinated by an orchestrator — watch the road surface, reroute freight
> around floods and closures, recompute remaining shelf life and divert cargo before it spoils,
> protect driver rest, cost the carbon, and clear signalised corridors for ambulances. They act
> autonomously within guardrails and stop at human gates before public-facing or above-threshold
> actions. Every action is logged, replayable and tamper-evident.
>
> **Why it is different:** it needs no new infrastructure — it runs on the buses, trucks and
> phones India already has. It treats *remaining shelf life* as a first-class routing constraint,
> which is not a standard product feature anywhere. And it is a public good: MIT-licensed, and
> deployable by any municipal corporation or small fleet owner.

## 3. Size of the problem (copy-paste)

> **Scale:** 1,77,175 road deaths and 4,71,441 injuries in 2024 across 4,87,707 reported
> accidents; ~485 deaths per day. Two-wheelers are the largest fatality category; 66.1% of those
> killed are 18–45, and 83.3% are of working age. 31% of accidents occur on National Highways,
> which make up about 5% of road length.
>
> **Economic scale:** ₹24 lakh crore in annual logistics cost (7.97% of GDP, FY2023-24), of which
> roads are 41.7%. Post-harvest losses total roughly ₹926 billion a year; each tonne of spoiled
> fruit and vegetables releases about 1.5 t CO₂e.
>
> **Who it affects:** commercial drivers and two-wheeler riders (the people dying), farmers and
> FPOs (the people losing produce), exporters (the people losing contracts), and every municipal
> road authority carrying an unfunded repair backlog.

## 4. What is real and what is simulated (say this plainly)

Judges reward honesty. Put this table in your README and say it in the video.

| Component | Status |
|---|---|
| Agent orchestration, tools, guardrails, approvals, replay, memory | **Real, running code** |
| Road-graph routing, shelf-life model, fatigue scoring, carbon maths, evidence hashing | **Real computation** on modelled inputs |
| Vision scoring, IMD weather, ULIP track-and-trace, chain anchoring | **Deterministic simulators**, labelled `simulated` in every trace |
| Corridor geometry, shipments, telemetry | **Synthetic** data for the demo |
| ULIP / Gati Shakti data access | **Adapter interfaces designed; production keys not yet held** (access requires registration and use-case approval) |

---

## 5. Deploy (do this first — it is a hard requirement)

**API (agent mesh + REST):**

```bash
# Option A — Render: connect the repo, it reads render.yaml
# Option B — anywhere with Docker:
docker build -t pulsegrid-api .
docker run -p 4000:4000 pulsegrid-api
```

**Dashboard (static):**

```bash
cd client && npm ci && npm run build:static     # emits client/dist
# then deploy client/dist to Vercel (vercel.json is committed) or any static host
```

Verify before submitting:

```bash
curl https://<your-api>/health
curl https://<your-api>/api/v1/agents/catalog
curl -X POST https://<your-api>/api/v1/agents/run -H 'content-type: application/json' -d '{"scenarioId":"B"}'
```

---

## 6. Final checklist

- [ ] Registered with Code for India; project created on AgentFoundry.me; tokens claimed
- [ ] Impact area = Transportation Safety
- [ ] Repo public in the CFI GitHub org, `LICENSE` (MIT) present
- [ ] README covers problem → size → architecture → how to run → what is simulated
- [ ] **API deployed** and `/health` responds
- [ ] **Dashboard deployed** and loads
- [ ] AgentFoundry agents imported from `agents/agentfoundry/`
- [ ] **2–3 minute demo video recorded** (script in `DEMO.md`) against the *deployed* system
- [ ] Submission form filled: problem statement + size of problem (text above) + repo + video
- [ ] Filed before **15 November 2026**

---

## 7. Suggested next features (only after the three gaps are closed)

Ranked by impact-per-hour. Do not start these before deploying and recording.

1. **Live ULIP adapter behind a flag** — implement the real connector against the documented
   ULIP request/response contract, gated so it falls back to synthetic data without keys.
2. **Mobile pass** — judges will open the link on a phone; the header now adapts, the grids stack,
   but a full responsive audit is still worth an hour.
3. **A second corridor** — prove the model generalises (e.g. a second city) with the same code.
4. **Pilot letter of intent** — even one municipal corporation or FPO willing to pilot converts
   "prototype" into "deployable".

# PulseGrid — Agentic Mobility & Logistics Intelligence for Bharat

## Live now

| | |
|---|---|
| **Dashboard** | https://pulsegrid-bharatagentic.vercel.app |
| **Agent API** | https://pulsegrid-api-00w3.onrender.com |
| **API health** | https://pulsegrid-api-00w3.onrender.com/health |
| **API contract** | https://pulsegrid-api-00w3.onrender.com/api/v1/agent/schema |
| **Source** | this repository · MIT |

Run the agent in one call:

```bash
curl -X POST https://pulsegrid-api-00w3.onrender.com/api/v1/agent \
  -H 'content-type: application/json' \
  -d '{"request":"A vaccine truck is heading to Kochi and there is a flood on NH-544"}'
```

It returns the plan, the full reasoning trace, the tools each agent called, the outcome, any
approval gate it stopped at, and the evidence hashes.

**Built for the BharatAgentic Hackathon 2026** · Category: Logistics & Mobility · Coimbatore, Tamil Nadu (Avinashi Road & Saravanampatti IT/College corridors) · open source (MIT)

PulseGrid turns one corridor into a living, self-managing system: a mesh of AI agents that watch the road, reroute freight around disruptions, stop food from spoiling, protect drivers and clear the way for ambulances — all on the fleets and phones India already has.

### What is real, and what is simulated

Stated plainly, because it matters to how you read this repository:

**Real.** The reasoning, the routing, the dependency ordering, the tool orchestration, the guardrails
and the human-approval gates all run live. The dashboard runs the *same* agent core that serves the
deployed API above. The routing maths, the shelf-life model, the fatigue scoring, the carbon
accounting and the evidence hashing are real computation.

**Simulated, and labelled.** The inputs that would otherwise need an external service — the weather
feed, the vision scoring, the ULIP-shaped track-and-trace and the ledger — are deterministic
simulators. Every trace marks them `simulated`. Nothing here is misrepresented as a live integration.

### The three modules

| Module | What it does |
|---|---|
| **1 — Pavement Management System** | City buses become road inspectors: dashcams + pole-mounted LiDAR detect potholes/cracks below 60 km/h, citizens file geotagged photo reports, and every defect starts a 24-hour municipal (CCMC) repair SLA. |
| **2 — Intelligent Transportation Systems** | Virtual green lanes for college/school buses (07:00–10:00 & 14:00–17:00) enforced by side-mounted AI cameras (₹2,000 fine for non-compliant entry), adaptive green-wave traffic signals, and a college-bus dispatch board with live feeds. |
| **3 — Demand-Responsive Transit** | On-demand EV micro-fleet with live capacity recalculation and a U-turn-first safety policy that replaces direct right turns every 2–5 km. |

---

## Repository layout

```
pulsegrid/
├── LICENSE                       # MIT
├── agent.manifest.yaml           # aiKart Agent Manifest (BharatAgentic submission, Method 1)
├── Dockerfile · docker-compose.yml  # containerised agent, one-command run
├── SUBMISSION-BharatAgentic.md   # pack for the BharatAgentic (aiKart) hackathon
├── SUBMISSION.md                 # submission pack: problem statement, size, checklist
├── DEMO.md                       # 2–3 minute video script + click-by-click rehearsal
├── Dockerfile · render.yaml · vercel.json   # one-command deploys (API + dashboard)
├── pulsegrid-agentic.html       # Single-file zero-install build (v2, with the agent plane)
├── pulsegrid-codepen.html        # CodePen-ready single file (paste into the HTML panel)
├── agents/agentfoundry/          # AgentFoundry pack: manifest, prompts, evals
├── client/                       # React + Vite + Tailwind CSS 3 + Chart.js dashboard
│   ├── public/favicon.svg
│   ├── scripts/                  # build-static · assemble-codepen · agent-test
│   ├── dist/                     # Prebuilt static bundle (npm run build:static)
│   └── src/
│       ├── agents/               # ← the agent core (framework-agnostic, shared with the server)
│       │   ├── corridor.js       #   corridor world model: road graph, facilities, shipments
│       │   ├── tools.js          #   instrumented tool registry (23 tools)
│       │   ├── agents.js         #   the 8 specialist agents + guardrails
│       │   ├── router.js         #   free-form request → intent → execution plan
│       │   ├── gridmaster.js     #   orchestrator: dispatch, approvals, runs, memory
│       │   ├── evals.js          #   17 outcome assertions, runnable in the browser
│       │   ├── voice.js          #   speech output in the driver's language
│       │   ├── scenarios.js      #   3 end-to-end demo scenarios
│       │   └── index.js          #   public entry point
│       ├── api/mockApi.js        # API client + full in-browser mock transport
│       ├── components/
│       │   ├── Header.jsx        # PULSEGRID brand, pulsing mesh status, Bharat Agentic badge,
│       │   │                     #   🚨 Emergency Override, 🔄 Reset
│       │   ├── AgenticPlane.jsx # ← AGENTIC CONTROL PLANE (mesh, live traces, approvals)
│       │   ├── Module1PMS.jsx   # PMS          (dashcam canvas, laser scanBeam,
│       │   │                     #   citizen form, SLA ledger, footage custody chain)
│       │   ├── Module2ITS.jsx   # ITS          (green lane strip, adaptive signals,
│       │   │                     #   ₹2,000 violations, college bus dispatch + feeds)
│       │   ├── Module3DRT.jsx   # DRT          (EV fleet meters, recalculate capacity,
│       │   │                     #   U-turn safety strip)
│       │   ├── Analytics.jsx    # Chart.js line graph: baseline delay vs optimized
│       │   └── shared.jsx        # Glass cards, badges, severity meters, SLA countdowns
│       ├── App.jsx
│       └── index.css             # #070B14 base, glassmorphism + neon utilities
│
└── server/                       # Node.js + Express + PostgreSQL/PostGIS API
    ├── db/init.sql              # Full schema: 3 core tables + violations, footage
    │                             #   custody, audit logs, triggers, seed data
    └── src/
        ├── config/db.js         # pg pool
        ├── middleware/errorHandler.js
        ├── utils/asyncHandler.js
        ├── services/visionService.js    # analyzeRoadDamage(imageBuffer) → Vision AI
        ├── controllers/
        │   ├── diagnosticsController.js # citizen-report, edge-scan, SLA workflow
        │   ├── signalsController.js      # adaptive-status, emergency-override
        │   ├── transitController.js      # green-lane violations, DRT capacity
        │   └── agentsController.js       # ← /agents/* — runs the same mesh server-side
        ├── routes/               # /api/v1 routers (incl. agents.routes.js)
        └── scripts/initDb.js     # npm run db:init
```

## Agentic Control Plane (v2 — the headline)

PulseGrid v2 is not a dashboard with animations bolted on. The dashboard is the **human-oversight
surface** over a working multi-agent mesh.

**The mesh.** GRIDMASTER (orchestrator) decomposes a goal, dispatches specialist agents in order,
feeds each agent's output into the next (a new ETA from Reroute is handed to ColdGuard for a
shelf-life re-check), owns the approval policy, and records every step and tool call into a
replayable run. The eight specialists:

| Agent | Job |
|---|---|
| **CorridorSense** | Road-state digital twin: defect detection → municipal SLA → hazard advisory → evidence anchor |
| **SafetySentinel** | Crash-hotspot scoring and emergency corridor pre-emption |
| **Reroute** | Disruption-aware freight routing with costed trade-offs (flood, closure, congestion) |
| **ColdGuard** | Remaining-shelf-life model, spoilage risk, diversion to pre-cooling, buyer + contract actions |
| **HubSync** | Multimodal handovers, yard/dock slots, ULIP-shaped track-and-trace |
| **Saarthi** | Driver welfare: fatigue scoring, mandatory rest, vernacular voice notification |
| **GreenLane** | Carbon footprint per movement and the lower-carbon option |
| **TrustLedger** | Evidence anchoring and contract clauses (paperless, tamper-evident) |

**Every agent runs the same loop:** perceive → fuse → reason → plan → act (scoped) → verify → learn.
Agents call **23 instrumented tools**; each call is logged with its arguments, result and latency.
Tools that would call an external service (Vision AI, IMD, ULIP, a chain) are deterministic
simulators and are labelled `simulated` in the trace — nothing is misrepresented as a live integration.

**It reads the alert aloud.** Driver notifications can be spoken in the driver's language using
the browser's built-in speech synthesis — no external service, no key. A "read aloud" toggle makes
every new driver alert speak automatically.

**It proves itself.** A **Trust & evals** panel runs the three scenarios through the real agent core
in the browser and asserts **17 outcomes** (not wording) — the same contract as
`npm run test:agents`, and exported to AgentFoundry as `evals/gridmaster.eval.json`. A judge can
watch the system verify itself in ~100 ms.

**Vernacular by default.** Driver-facing notifications are delivered in the driver's own
language: English plus **all 22 Indian languages** the platform supports (Hindi, Bengali, Tamil,
Telugu, Marathi, Gujarati, Kannada, Malayalam, Punjabi, Odia, Assamese, Urdu, Nepali, Konkani,
Maithili, Dogri, Bodo, Manipuri, Sanskrit, Santali, Sindhi and Kashmiri). The translations were
produced by the platform translation service rather than hand-written. The dashboard carries a
language picker so you can read the same instruction in any of them.

**Guardrails and human gates.** Agents cannot act outside their scope (ColdGuard may not dispose of
cargo; Saarthi may not trade rest for schedule; Reroute may not move hazmat unattended). Actions that
are public-facing or above a spend threshold stop at a human gate in the UI, which the operator
approves or rejects; the decision is written to the audit trail.

**Three scenarios ship with the prototype:**

- **A · Pharma reefer vs flash flood** — 6 agents; Reroute picks the flood-free diversion, ColdGuard
  re-checks shelf life against the new ETA, Saarthi schedules a break, GreenLane costs the carbon,
  TrustLedger anchors the decision. Stops at a **spend gate** (diversion cost above policy).
- **B · Spoilage stopped mid-journey** — ColdGuard attributes a temperature excursion to a door left
  ajar, quantifies the exposure, diverts to a pre-cooling node, notifies the buyer and executes the
  contract clause. No gate needed (cost below threshold) — shows the agent acting autonomously.
- **C · Defect → SLA, then emergency corridor** — CorridorSense raises a municipal ticket with a 24 h
  SLA and stops at a **public-advisory gate**; SafetySentinel then clears 8 junctions for an ambulance.

**Verify it yourself** (no browser needed):

```bash
cd client
npm run test:agents      # runs all three scenarios and asserts 33 outcomes
```

## The agent entry point

One endpoint takes a free-form request and returns the plan, the full reasoning trace and the
outcome — this is the interface a judge, a dispatcher or a municipal officer calls:

```bash
curl -X POST https://pulsegrid-api-00w3.onrender.com/api/v1/agent \
  -H 'content-type: application/json' \
  -d '{"request":"A vaccine truck is heading to Kochi and there is a flood on NH-544"}'
```

*(Locally, the same endpoint is at `http://localhost:4000/api/v1/agent`.)*

The router classifies the request into intents (road defect · spoilage · reroute · emergency ·
driver welfare · carbon · multimodal), dispatches the relevant agents in dependency order, feeds
each result forward, and reports its own confidence — falling back to a safety-first default and
asking for clarification when it cannot tell what is being asked. `GET /api/v1/agent/schema`
documents the full contract; `GET /api/v1/agent/intents` lists what it understands.

Run it in one command:

```bash
docker compose up --build      # agent on :4000, health check at /health
```

## Quick start (frontend, zero backend needed)

**Already deployed:** the dashboard runs at https://pulsegrid-bharatagentic.vercel.app and the API
at https://pulsegrid-api-00w3.onrender.com. `render-native.yaml` and `vercel.json` are committed,
so redeploying is one click each. See `SUBMISSION.md` (checklist + copy-paste problem statement) and
`DEMO.md` (video script).

**Zero-install preview:** open `pulsegrid-agentic.html` (repo root) directly in any modern
browser — the entire dashboard, mock API and all, is bundled into that single file.

**CodePen:** copy the full contents of `pulsegrid-codepen.html` into the CodePen **HTML panel** —
the dashboard runs as-is (CDN React 18 + Chart.js 4 + Tailwind Play + Babel Standalone; readable,
unminified source). Regenerate it anytime with `node client/scripts/assemble-codepen.mjs`.

```bash
cd client
npm install
npm run dev            # http://localhost:5173
```

The dashboard boots in **mock mode**: every button performs a real state change and
exchanges a documented mock API payload (open the browser console — each request and
response is logged in colour). The dashcam canvas animates the Avinashi Road drive, the
laser scanBeam locks defects, SLA countdowns tick in real seconds, and the Chart.js
analytics panel is fully interactive.

### Production builds

- `npm run build` — standard Vite production build (`dist/`).
- `npm run build:static` — dependency-light alternative (`scripts/build-static.mjs`, uses only
  esbuild + Tailwind CLI) that additionally emits the single-file `pulsegrid-agentic.html`.
  Both build modes are verified: the bundle and CSS compile clean, serve correctly over HTTP,
  and the app mounts and renders all modules in a DOM environment.

## Full stack (PostgreSQL + PostGIS required)

```bash
# 1. Database
createdb pulsegrid
cd server && cp .env.example .env      # fill in PG credentials + VISION_API_KEY
npm install
npm run db:init                       # applies db/init.sql (schema + seed)

# 2. API
npm run dev                           # http://localhost:4000/api/v1

# 3. Frontend — switch off mocks
cd ../client
echo "VITE_USE_MOCKS=false" > .env.local
npm run dev
```

## API surface (v1)

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/v1/diagnostics/citizen-report` | Multipart photo upload; EXIF GPS extraction; logs entry; triggers Vision AI |
| POST | `/api/v1/diagnostics/edge-scan` | Bus dashcam telemetry ingest (< 60 km/h gate); flags defects; auto-dispatches repair tickets (severity ≥ 3) |
| GET | `/api/v1/diagnostics` | Defect ledger; filters: `status`, `source`, `near=lat,lng` (PostGIS `ST_DWithin`) |
| PATCH | `/api/v1/diagnostics/:id/status` | Municipal workflow: PENDING → DISPATCHED → REPAIRED |
| GET | `/api/v1/signals/adaptive-status/:junctionId` | Real-time density + computed green-light phase extension |
| POST | `/api/v1/signals/:junctionId/extend-green` | Extend green for transit priority |
| POST | `/api/v1/signals/emergency-override` | Corridor-wide override (all junctions or a list) |
| GET | `/api/v1/transit/green-lane-violations` | Non-compliant green-lane entries, ₹2,000 notices |
| POST | `/api/v1/transit/green-lane-sweep` | Force a camera-AI corridor sweep |
| POST | `/api/v1/transit/fleet/:busId/recalculate-capacity` | DRT route recalculation |
| POST | `/api/v1/transit/fleet/:busId/dispatch` | Dispatch a college/EV bus |
| GET | `/api/v1/agents/catalog` | The 8 agents, 3 scenarios and the orchestrator |
| POST | `/api/v1/agents/run` | Run a scenario server-side (`{ scenarioId: "A"|"B"|"C" }`) |
| GET | `/api/v1/agents/runs` · `/runs/:runId` | Run history and the full replayable trace |
| GET | `/api/v1/agents/approvals` | Pending human gates |
| POST | `/api/v1/agents/approvals/:id/resolve` | Approve / reject a gate |
| GET | `/api/v1/agents/memory` | What the mesh has learned across runs |

## Database schema (PostGIS)

**road_diagnostics** — `id, lat, lng, geom (geography), severity_score (1–5), image_url, source_type ['BUS_DASHCAM','CITIZEN_UPLOAD'], status ['PENDING','DISPATCHED','REPAIRED'], created_at, sla_due_at (24 h)` + audit escalation trigger.

**traffic_signals** — `signal_id, junction_name, current_phase ['GREEN_WAVE','TRANSIT_PRIORITY','EMERGENCY_OVERRIDE'], vehicle_count, avg_speed_kmh, green_wave_offset_s, updated_at` + emergency-override audit table.

**transit_fleet** — `bus_id, route_code, bus_type ['COLLEGE_BUS','PUBLIC_EV'], current_lat/lng, occupancy_percentage, is_green_lane_authorized, status, battery_pct`.

Supporting tables: `transit_violations` (₹2,000 notices + evidence clips), `footage_clips` + `clip_access_log` (30-day custody chain with SHA-256 integrity and role-based access audit), `sla_escalations`.

## Vision model integration

`server/src/services/visionService.js` exposes:

```js
analyzeRoadDamage(imageBuffer, mimeType)
// → { hasPothole: boolean,
//     severityScore: 1-5,
//     damageType: string,
//     recommendedAction: string,
//     estimatedSizeCm: number,
//     confidence: 0-1,
//     model: 'pulsegrid-vision-v1' }
```

- Calls `pulsegrid-vision-v1` with `responseMimeType: 'application/json'` and a strict municipal-inspector prompt.
- Response is validated and clamped before it ever touches the database.
- Without `VISION_API_KEY` the service degrades to a clearly-flagged heuristic fallback so the prototype never hard-fails.

## Design notes

- **Dashboard theme**: `#070B14` base, frosted-glass cards (`backdrop-blur` + `bg-white/[0.04]`), Neon Cyan `#00F0FF`, Emerald `#00FF66`, Red `#FF3366`.
- **All controls are live**: emergency override flips every junction to `EMERGENCY_OVERRIDE` (with a stand-down), reset reseeds all module state, extend-green/cycle-phase hit the signals store, sweeps mint new ₹2,000 notices, and the SLA ledger escalates on breach.
- **Footage custody**: capture → edge gate (< 60 km/h) → Vision AI → PostGIS + object store (30-day retention, SHA-256) → CCMC portal, with an append-only access audit log demonstrated in the UI.
- Coordinates, junctions, routes and institutions are representative of the real corridors (Hope College, Peelamedu/PSG Tech, Codissia, KMCH, Neelambur/PSG iTech, Kalapatti, KGISPT, Saravanampatti 4-Roads) at prototype precision.

## Production hardening checklist (beyond prototype scope)

- JWT/mTLS between edge nodes and API; rate limiting; request signing for camera feeds
- Move uploads to S3/MinIO with signed URLs; queue Vision AI calls (SQS/BullMQ) with retries
- WebSocket/SSE for live signal push instead of polling; Redis cache for junction status
- Signal-control authority via a hardened controller gateway with dead-man timers
- Row-level security for CCMC roles; e-invoicing integration for fine collection

---

*Prototype for demonstration. All feeds, detections, violations and statistics are simulated and labelled as such. The vision model is pluggable: point `VISION_API_URL` at any JSON endpoint, or run the deterministic fallback with no configuration at all.*

# BharatAgentic Hackathon (powered by aiKart) — PulseGrid submission pack

**Category:** Logistics & Mobility
**Submission methods supported:** both — Method 1 (Dockerfile + YAML Agent Manifest) and Method 2 (hosted API endpoint)

> **Is Docker compulsory?** Only for Method 1. The brief says you submit through *either* method; the
> Dockerfile requirement sits under Method 1, while Method 2 asks only that the agent be hosted and
> reachable at an API endpoint. This repo ships **three** deployment paths:
> `render.yaml` (Docker — Render builds the image in the cloud, so you never install Docker locally),
> `render-native.yaml` (native Node — no Docker anywhere), and plain `npm start` (local).
> Docker Desktop is only needed if you want to verify the container on your own machine.
**Build window:** 9:00 AM – 9:00 PM · **Submission window:** 8:00 PM – 10:00 PM

> Note: `SUBMISSION.md` in this repo is the pack for the *other* event (Code for India's
> "Code for a Billion"). This file is the pack for **BharatAgentic by aiKart**. The product is the
> same; the packaging differs.

---

## 1. Problem statement (copy-paste for the form)

> **Problem.** India's road-freight and mobility corridors kill and waste at scale. In 2024 there
> were 4,87,707 road accidents and 1,77,175 deaths — roughly 20 deaths every hour — with
> over-speeding behind 70.3% of fatalities and potholes, curves and steep grades behind 13.8% of
> all accidents. At the same time, 6.02–15.05% of fruit and 4.87–11.61% of vegetables are lost
> before anyone buys them, and transport is the single largest loss stage; 97.4% of that produce
> moves by road. Logistics costs India ₹24 lakh crore a year — 7.97% of GDP.
>
> **Users.** Commercial drivers and two-wheeler riders (the people dying), farmers and FPOs (the
> people losing produce), exporters and consignees (the people losing contracts), municipal road
> authorities with an unfunded repair backlog, and emergency services that need a clear corridor.
>
> **Why it matters.** These are not edge cases; they are the daily operating conditions of Indian
> logistics. The interventions that help are the ones that need no new infrastructure — because the
> fleets, phones and signals already exist.

## 2. What makes it agentic (not a chatbot)

PulseGrid does not answer questions. It **decides and acts**:

- **Reasons over costed options.** Reroute prices a diversion against the hazard it avoids; ColdGuard
  prices a pre-cooling stop against the value of the cargo at risk.
- **Uses 23 tools.** Route solver, shelf-life model, fatigue scorer, carbon calculator, hotspot
  scorer, signal pre-emption, slot booking, evidence anchoring, contract execution, and more.
- **Automates multi-step workflows.** One request triggers a chain: reroute → re-check shelf life
  against the new ETA → schedule the driver's rest → cost the carbon → anchor the evidence.
- **Coordinates specialists.** A GRIDMASTER orchestrator dispatches eight specialist agents in
  dependency order and feeds each result into the next.
- **Stops for humans.** Public-facing and above-threshold actions raise an approval gate; the
  operator's decision is written to the audit trail.
- **Learns.** Episodic memory carries defect priors, flood-diversion preferences and recurring
  door-event patterns across runs.

## 3. Agent workflow: input → reasoning → tool/data → outcome

The agent has **one real entry point**, `POST /api/v1/agent`, which takes a free-form request:

```bash
curl -X POST https://<your-host>/api/v1/agent \
  -H 'content-type: application/json' \
  -d '{"request":"A vaccine truck is heading to Kochi and there is a flood on NH-544",
       "context":{"driverId":"D-3310","language":"ml-IN"}}'
```

**Step 1 — Input.** A free-form request plus optional context.

**Step 2 — Reasoning (the router plans).** A deterministic rule-based router classifies the request
into intents and produces an execution plan with a stated confidence:

```
matched: spoilage, reroute  →  dispatch reroute + coldguard + trustledger   (confidence 0.80)
```

It reports `needsClarification: true` and falls back to a safety-first default when it cannot tell
what is being asked — rather than guessing.

**Step 3 — Tools and data.** Each agent runs the same loop — perceive → fuse → reason → plan →
act (scoped) → verify → learn — and acts only through registered tools. Every call is recorded with
its arguments, result and latency.

**Step 4 — Outcome.** The response carries the plan, the full replayable trace, the actions taken,
any approval gate, and the evidence hash:

```json
{ "plan": { "intents": [...], "rationale": "...", "confidence": 0.8 },
  "outcome": { "status": "completed",
               "decisions": [{ "agent": "reroute", "summary": "Rerouted via NH-209 → SH-21 …" }],
               "actionsTaken": ["weather_flood_alert","route_solver","notify_party", …],
               "evidence": ["df42ad0c2d58c288"] },
  "trace": { "steps": 17, "toolCalls": 7, "agents": [ … ] } }
```

The same workflow is visible in the dashboard's **"ask the mesh"** box — type a problem, watch the
plan appear, then the reasoning stream, then the outcome.

## 4. Impact (time saved · cost reduced · accessibility improved)

| Dimension | Measured / modelled | How it is verified |
|---|---|---|
| **Time saved** | Emergency pre-emption saves ~55 s per signalised junction; 8 junctions ≈ **7 minutes per emergency run** | Computed live in scenario C; verifiable against AVL timestamps |
| **Cost reduced** | One prevented cold-chain rejection ≈ **₹3.4 lakh of cargo preserved** (scenario B computes it from tonnes × value × rejection probability) | Live metric in the run outcome |
| **Waste reduced** | Fruit/vegetable loss is 6–15%; transport is the largest loss stage. Cutting transport-stage loss 20% on covered lanes preserves thousands of tonnes a year | Shipment-level rejection logs vs control lanes |
| **Accessibility** | Driver alerts in the driver's own language — English plus **22 Indian languages**, with speech output | Language picker in the dashboard; 66 translated strings |
| **Safety** | Defect-related crashes are 13.8% of all accidents; a 10% reduction on covered corridors is the modelled target | Treated-vs-control corridor comparison |
| **Cost of adoption** | Runs on existing fleets, phones and signals — **no new capital expenditure** | Deployment is a container and a static site |

**Honesty note.** Baselines above are published Indian data (MoRTH 2024; DPIIT–NCAER; MoFPI/NABCONS).
Deltas are modelled with stated assumptions, not measured results. The dashboard labels every
simulated tool `simulated` in the trace.

## 5. Run the working prototype

```bash
# One command
docker compose up --build          # then open http://localhost:4000/health

# Or without Docker
cd server && npm install && npm start
cd client && npm install && npm run dev        # dashboard at :5173

# Or with no install at all
open pulsegrid-agentic.html        # the whole dashboard, self-contained
```

Verify the agent in 10 seconds:

```bash
curl -s localhost:4000/api/v1/agent/schema | head -20
curl -s -X POST localhost:4000/api/v1/agent -H 'content-type: application/json' \
  -d '{"request":"The ambulance needs a clear corridor to KMCH"}'
```

## 6. Submission — Method 1 (Dockerfile + YAML Agent Manifest)

This is a two-part deliverable: a **publicly pullable container image** and a **manifest in aiKart's
own schema**. aiKart's guide specifies the "Try Me Now" sandbox, and its runtime contract is not an
HTTP call — it is a file handshake:

| Step | What aiKart does |
|---|---|
| 1 | Starts a fresh, isolated container from your published image |
| 2 | Writes the buyer's answers to `/aikart/input.json` (also `$AIKART_INPUT`) |
| 3 | Waits for your process to exit |
| 4 | Reads `/aikart/output.json`, shaped exactly `{ "format": "markdown", "response": "<output>" }` |
| 5 | Expects exit code 0 — any non-zero exit is a failure |

Storage is fully ephemeral, and the hard wall-clock cap is 280 s.

`server/src/sandbox.js` implements this contract around the agent mesh — verified locally:

```
exit code : 0
output.json keys : ['format', 'response']   format: markdown
response  : 3,211 chars of markdown (plan + reasoning trace + actions + outcome + evidence)
```

### Steps

1. **Build and push a public image** (Docker Hub or GHCR — private registries are not supported):
   ```bash
   docker build -t <your-user>/pulsegrid-agent:2.0.0 .
   docker push <your-user>/pulsegrid-agent:2.0.0
   ```
2. **Point the manifest at it** — edit `runtime.image` in `agent.manifest.yaml`.
3. **Validate** (checks required fields, the resource caps, and the input/output/security shapes):
   ```bash
   node scripts/validate-manifest.mjs
   ```
   Fix the `WARN` about the placeholder image before you upload.
4. **Upload** in the aiKart listing wizard → **"Try / Run My Agent"** → *"Yes, enable it"* → attach
   the `.yaml` file. aiKart reviews the manifest (resource limits, any requested network egress) as
   part of your listing approval.

### Why this one is clean to review

`security.networkEgress: none` — PulseGrid needs **no outbound network access**. Every tool is local
and the simulators are deterministic, so the agent runs correctly in a fully isolated sandbox with no
egress review, no API keys, and no vendor calls. Resources are modest too: 1 vCPU, 1024 MB, 120 s
(all well inside the caps).

### One image, both submission methods

The image's default `CMD` serves the HTTP API (Method 2). The manifest's `runtime.command` overrides
it with the sandbox entrypoint (Method 1). Same image, both routes.

## 7. Submission — Method 2 (hosted API endpoint)

**Read this before choosing Method 2.** The walkthrough video for this method is titled *"API
Endpoints Listing"*, and it describes something more than hosting: you **submit your marketplace
listing programmatically** through aiKart's API — prepare the agent information (product details,
description, category, target industries, pricing, team information), upload media assets (logo,
cover image, tutorial video, supporting documents) and reference them by URL, then POST everything to
the agent-listing endpoint, which validates it, creates the listing, and returns an `agent_id` and a
listing URL.

So Method 2 has **four** steps, not one:

| # | Step | What you need |
|---|---|---|
| 1 | **Host the agent** at a public endpoint | A deploy (Render/Vercel) — no Docker |
| 2 | **Get aiKart API access** | A seller account + an API token from the aiKart dashboard |
| 3 | **Fill the listing payload** | `aikart-listing.json` — already written |
| 4 | **POST it** | `node scripts/submit-listing.mjs --send` |

### 1. Host the agent

Deploy with `render-native.yaml` (native Node — no Docker anywhere). Confirm:

```bash
curl https://<your-host>/health
curl https://<your-host>/api/v1/agent/schema
curl -X POST https://<your-host>/api/v1/agent \
  -H 'content-type: application/json' \
  -d '{"request":"The ambulance needs a clear corridor to KMCH"}'
```

The endpoint accepts **both** calling conventions, so you cannot get this wrong:

```jsonc
// our documented shape
{ "request": "...", "context": { "driver_id": "D-3310", "driver_language": "ml-IN" } }

// the flat aiKart-style shape
{ "request": "...", "driver_id": "D-3310", "driver_language": "ta-IN", "speed_kmh": 48 }
```

Both return the plan, the reasoning trace, the actions taken, the outcome, any approval gate and the
evidence hashes. An empty body returns **422**.

### 2–4. Build and send the listing

`aikart-listing.json` already carries the product details, description, category
(**Logistics & Mobility**), target industries, pricing, team block, media URLs, capabilities, impact
and compliance disclosure. Placeholders (`{{AGENT_ENDPOINT}}`, `{{REPO_URL}}`, …) are filled from
the environment so no secrets or URLs live in the file.

```bash
# preview only — sends nothing, prints the payload and the equivalent curl
AGENT_ENDPOINT=https://<your-host>/api/v1/agent \
REPO_URL=https://github.com/<you>/pulsegrid \
DASHBOARD_URL=https://<your-dashboard> \
node scripts/submit-listing.mjs

# once the endpoint is live and you hold an API token
AIKART_API_URL=<the agent-listing endpoint> AIKART_API_KEY=<your token> \
AGENT_ENDPOINT=https://<your-host>/api/v1/agent ... \
node scripts/submit-listing.mjs --send
```

It refuses to run `--send` without an endpoint, and it never posts in dry-run mode.

> ⚠️ **Confirm the exact endpoint URL and field names** against the aiKart API docs or your seller
> dashboard once you have API access. The walkthrough names the *fields* it sends but not the
> endpoint path. `aikart-listing.json` is a single JSON file, so remapping a field name is a
> find-and-replace.

### Method 2 also needs a marketplace account

The second walkthrough video covers creating an aiKart account and completing your **seller profile**
before you can list. Do that first — it is what gives you API credentials. Start it early; it is the
one step here that depends on someone else.

---

## 8. 12-hour execution plan (9 AM → 9 PM)

You are not building from scratch — the prototype is done. The 12 hours are for packaging,
deployment and the demo. Timeboxes assume one or two people.

| Time | Task | Output |
|---|---|---|
| **09:00–09:30** | Read the brief. Pick category **Logistics & Mobility**. Read the aiKart Agent Manifest Guide (aikart.co/docs/aikart-agent-manifest-guide.pdf). | — |
| **09:30–10:30** | Build the image, push it to Docker Hub, put your image reference in `agent.manifest.yaml`, run `node scripts/validate-manifest.mjs` until it passes. | Image on Docker Hub + validated manifest |
| **10:30–11:30** | Deploy the API (Render, native Node — no Docker). Confirm `/health` and `POST /agent` respond. **In parallel: create the aiKart seller account** (needed for Method 2 credentials). | Live API URL + account |
| **11:30–12:00** | Deploy the dashboard (Vercel). Confirm it loads on a phone. | Live dashboard URL |
| **12:00–13:00** | *Lunch + smoke test the whole flow from the deployed URLs.* | Two working URLs |
| **13:00–14:30** | Record the demo video off the **deployed** links (`DEMO.md` has the script). Show the free-form input first. | 2–3 min video, take 1 |
| **14:30–15:30** | Re-record with fixes. Cut the final take. | Final video |
| **15:30–16:30** | Write the GitHub README for judges: problem, workflow, run instructions, what is simulated. | Public repo |
| **16:30–17:30** | Run the self-eval panel on camera-ready state; confirm 17/17 and 33/33 in CI. | Evidence screenshots |
| **17:30–18:30** | Buffer: fix whatever broke. Re-run `node scripts/validate-manifest.mjs`, re-test `POST /agent`, and confirm the sandbox contract (`/aikart/input.json` → `/aikart/output.json`, exit 0). | Green everywhere |
| **18:30–19:30** | Fill `aikart-listing.json`, dry-run `scripts/submit-listing.mjs`, then `--send`. Then fill the Google Form. | Listing created (`agent_id` returned) + draft submission |
| **19:30–20:00** | **Stop building.** Final read-through of every field. | — |
| **20:00–21:00** | Submit via Method 1 (or 2), then the Google Form. Keep the confirmation. | **Submitted** |

**If you only have one hour:** deploy the API, deploy the dashboard, submit the form with the
existing video-less repo and a note — then record the video and update the form if it allows edits.

## 9. Before you submit — checklist

- [ ] Category selected: **Logistics & Mobility**
- [ ] `agent.manifest.yaml` passes `node scripts/validate-manifest.mjs` (no placeholder image)
- [ ] Image built, pushed publicly, and pullable by a third party
- [ ] Sandbox contract verified: input.json in → output.json out → exit 0
- [ ] `POST /api/v1/agent` returns a plan + trace + outcome for a request the judge might type
- [ ] Dashboard deployed and opened on a phone
- [ ] 2–3 minute demo video, recorded against the deployed system
- [ ] Repo public, `LICENSE` present, README covers problem → workflow → impact → how to run
- [ ] Honesty table (real vs simulated) in the README
- [ ] Listing submitted via `scripts/submit-listing.mjs --send` (Method 2) and/or the manifest uploaded (Method 1)
- [ ] Google Form completed with both URLs
- [ ] Submitted inside the 8:00–10:00 PM window

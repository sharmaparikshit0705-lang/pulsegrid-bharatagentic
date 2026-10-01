# Demo script — 2 to 3 minutes, recorded against the deployed system

The video is the highest-leverage thing you have left. Judges review deployed projects; the video
is how they understand what they are looking at. Record it against the **deployed** link, not
localhost, and keep the browser console closed.

**Before you record**

- [ ] API deployed, `/health` green
- [ ] Dashboard deployed, loads in a private window (no cache)
- [ ] Set animation speed to **demo** (the control in the Agentic Control Plane header)
- [ ] Hard-refresh once, then leave it alone for 10 seconds so the ticker and background settle
- [ ] Screen recorder at 1080p, cursor visible, notifications silenced

---

## Shot list

### 0:00–0:15 — The stakes (no clicking)

Open on the dashboard. Let the **live KPI ticker** scroll while you talk.

> "In 2024, 1,77,175 people died on Indian roads — about twenty every hour. In the same year,
> India lost six to fifteen percent of its fruit and vegetables before anyone bought them.
> PulseGrid is an agentic layer that attacks both, using the buses, trucks and phones we already
> have. Nothing here is a mock-up of a mock-up: the agents run."

### 0:15–0:45 — The mesh (still no clicking)

Pan slowly over the **Agent mesh** panel and the eight agent cards.

> "Eight specialist agents under one orchestrator. CorridorSense watches the road surface.
> Reroute handles disruptions. ColdGuard protects shelf life. Saarthi protects drivers.
> SafetySentinel protects the corridor. HubSync, GreenLane and TrustLedger handle handovers,
> carbon and evidence. Each has scoped tools and hard guardrails — and every action is
> replayable."

### 0:45–1:35 — Scenario A: the flood reroute (the orchestration shot)

Click **"A · Pharma reefer vs flash flood"**. Let it stream. Point at the trace as it fills.

> "A vaccine load is heading for Kochi. IMD flags a flash flood on NH-544. Watch the trace:
> Reroute prices the options — the direct route crosses the flood; the diversion adds seventy-eight
> kilometres and a hundred and ten minutes. It takes the diversion, and the new ETA is handed
> straight to ColdGuard, which re-checks shelf life against it. Saarthi schedules the driver's
> break. Then — this is the part most agent demos skip — the spend is above policy, so the mesh
> **stops**."

Point at the **Human oversight** card and click **Approve**.

> "A human decides. The decision is written to the audit trail."

Point at the **Vernacular driver alerts** card. Tap two or three of the language chips — Hindi,
then Tamil, then Kashmiri — so the script changes on screen.

> "And the driver was told in his own language. English plus all twenty-two Indian languages —
> Hindi, Tamil, Bengali, Telugu, Odia, Assamese, Kashmiri — because a driver who cannot read the
> alert cannot act on it."

Hit the **🔊 speak** button so the alert is read aloud in that language.

### 1:35–2:10 — Scenario B: the spoilage save (the money shot)

Click **"B · Spoilage stopped mid-journey"**.

> "A hill-vegetable export load. The reefer drifts out of band — ColdGuard attributes it to a door
> left ajar, not a compressor fault, quantifies the exposure, and diverts to a pre-cooling node.
> This time the cost is below the policy threshold, so the agent acts on its own — no human in the
> loop. The buyer is notified, the contract clause fires, the temperature trace is anchored as
> evidence. Three lakh rupees of cargo saved in forty minutes."

### 2:10–2:22 — It proves itself (optional but strong)

Click **▶ Run self-eval** in the *Trust & evals* card. Let the results land.

> "Seventeen outcome assertions across the three scenarios, run live against the same agent core.
> All seventeen pass, in about a tenth of a second. That is the same suite in CI, and the same
> evals loaded into AgentFoundry."

### 2:22–2:45 — Scenario C: safety and the emergency corridor

Click **"C · Defect → SLA, then emergency corridor"**.

> "A bus dashcam catches a severity-five defect next to a school crossing — a municipal ticket
> opens with a twenty-four hour SLA. Then an ambulance needs the corridor: eight junctions cleared,
> roughly seven minutes saved. That is the same corridor, the same agents."

### 2:35–2:55 — Why it is a public good (close on the repo)

Cut to the GitHub page: LICENSE, README, `agents/` folder.

> "It is MIT-licensed, it runs on infrastructure India already has, and every number it uses is
> sourced or clearly labelled as a modelled assumption. A municipal corporation can deploy this.
> That is the point."

---

## Timing discipline

| Beat | Budget |
|---|---|
| Stakes | 15 s |
| Mesh | 30 s |
| Scenario A + approval + vernacular | 50 s |
| Scenario B | 35 s |
| Scenario C | 23 s |
| Self-eval | 12 s |
| Close | 20 s |
| **Total** | **~2:55** (trim the mesh walkthrough if the self-eval pushes you over) |

If you run long, cut the mesh walkthrough to 15 seconds. Never cut scenario B — it is the clearest
demonstration of autonomous action.

---

## Click-by-click rehearsal (do this twice before recording)

1. Load the deployed dashboard. Wait for the ticker.
2. Click **A · Pharma reefer vs flash flood** → wait for `RUN-001` to appear in *Run history*.
3. Point at the trace's `REASON` lines; then **Approve** the pending gate.
4. Point at *Vernacular driver alerts* — confirm the Malayalam line is rendered.
5. Click **B · Spoilage stopped mid-journey** → confirm the outcome card shows the pre-cooling node.
6. Click **C · Defect → SLA, then emergency corridor** → confirm the 8-junction pre-emption line.
7. Note the *Episodic memory* panel now shows `defect_prior` and `door_event_halt` — mention that
   the mesh learns across runs.

## Common recording mistakes

- Recording on localhost — the deployed link is what is being judged.
- Talking over the trace instead of letting the steps land; pause on `REASON` and `ACT`.
- Skipping the human-gate moment. It is your strongest trust signal, not a weakness.
- Forgetting to mention that simulators are labelled. Say it in one line and move on.

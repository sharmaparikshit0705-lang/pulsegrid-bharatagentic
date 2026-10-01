# Blue Carbon Registry & MRV System — SIH25038

**Smart India Hackathon 2026 · Problem Statement SIH25038**
**Blockchain-Based Blue Carbon Registry and MRV System**
**Team: Taskforce Titans**

A fully functional working prototype that integrates field evidence collection, Sarvam AI processing, PostGIS spatial-overlap checks, VM0033 carbon credit estimation, human-in-the-loop verification, and a B2B marketplace for retiring blue carbon credits.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND (index.html)                     │
│          Tailwind CSS · 6-tab dashboard interface            │
└──────────────────────────┬──────────────────────────────────┘
                           │ REST API (JSON)
┌──────────────────────────▼──────────────────────────────────┐
│                  BACKEND (main.py · FastAPI)                 │
│                                                              │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │  Sarvam AI  │  │   PostGIS     │  │   Marketplace      │  │
│  │  Saaras v3   │  │   Spatial     │  │   Buy & Retire     │  │
│  │  Sarvam Vis. │  │   Overlap     │  │   ESG Compliance   │  │
│  │  Sarvam-105B │  │   Check       │  │                    │  │
│  └─────────────┘  └──────────────┘  └────────────────────┘  │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │         Human-in-the-Loop Verification Gate             │ │
│  │   AI flags anomalies → Verifier reviews → Credits issued│ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│              PostgreSQL + PostGIS (Docker)                    │
│   projects (GEOMETRY) · carbon_credits · audit_events         │
└─────────────────────────────────────────────────────────────┘
```

---

## Two Modes of Operation

The prototype runs in **two modes** — it auto-detects which based on your environment:

| Mode | When | Behavior |
|------|------|----------|
| **LIVE** | `DATABASE_URL` is set, `SARVAM_API_KEY` is set, `MOCK_MODE=0` | Real PostGIS spatial queries, real Sarvam AI API calls |
| **MOCK** | No DB URL, no API key, or `MOCK_MODE=1` | In-memory fallback with realistic sample data — **zero infrastructure needed** |

This means you can `python main.py` immediately and the entire prototype works for demo purposes, then switch to live mode by adding a DB and API key.

---

## Quick Start (Mock Mode — Zero Setup)

```bash
# 1. Install Python dependencies
pip install -r requirements.txt

# 2. Copy environment config (leave defaults for mock mode)
cp .env.example .env

# 3. Run the server
python main.py
# OR: uvicorn main:app --reload --port 8000

# 4. Open the frontend
#    http://localhost:8000
```

The dashboard loads with a mode badge showing "Mock Mode". All 7 endpoints work with realistic sample data.

---

## Full Setup (Live Mode — PostGIS + Sarvam AI)

### Step 1: Start PostGIS via Docker

```bash
# Start the PostGIS database container
docker compose up -d

# Verify it's running
docker ps | grep bluecarbon_db

# Wait for healthcheck to pass (~10 seconds)
docker compose logs -f postgis
# You should see: "database system is ready to accept connections"
```

The `docker-compose.yml` auto-loads `schema.sql` on first startup, so all tables and indexes are created automatically.

### Step 2: Configure Sarvam API Key

```bash
# Get your API key from https://sarvam.ai → Dashboard → API Keys
cp .env.example .env

# Edit .env and set:
#   SARVAM_API_KEY=your_actual_key_here
#   DATABASE_URL=postgresql://bcuser:bluecarbon@localhost:5432/bluecarbon
#   MOCK_MODE=0
```

### Step 3: Run the Backend

```bash
pip install -r requirements.txt
python main.py
```

You should see:
```
============================================================
  Blue Carbon Registry & MRV System — SIH25038
  Team: Taskforce Titans
  Database: LIVE_DB
  Sarvam AI: LIVE
============================================================
```

### Step 4: Open the Frontend

Navigate to **http://localhost:8000** — the dashboard loads with a green "Live DB + Sarvam AI" badge.

---

## API Endpoints

### Sarvam AI Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/sarvam/speech-to-text` | POST | Saaras v3 — transcribe Indic field audio (Tamil, Hindi, Bengali, etc.) |
| `/api/sarvam/ocr-document` | POST | Sarvam Vision — extract land survey details from PDF land records |

### NGO & MRV Registry Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/project/register` | POST | Register GPS polygon + PostGIS ST_Intersects overlap check |
| `/api/projects` | GET | List all registered projects |
| `/api/mrv/predict-credits` | POST | Sarvam-105B VM0033 credit estimation (~10 tCO2e/ha/yr) |
| `/api/mrv/anomaly-check` | POST | AI anomaly flagging — vegetation drop, data mismatch (human review only) |

### Verification & Marketplace Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/verifier/approve` | POST | Human verifier approves/rejects — **only action that issues credits** |
| `/api/factory/buy-and-retire` | POST | Factory buys credits and permanently retires them for ESG |
| `/api/credits` | GET | List all carbon credits (filter by `?status=AVAILABLE`) |
| `/api/stats` | GET | Dashboard statistics |
| `/api/audit` | GET | Immutable hash-chained audit trail |

---

## Testing the Full Pipeline

### Option A: Via the Frontend Dashboard (recommended)

1. **Tab 1 — NGO Registration**: Fill in project details, paste GPS polygon coords, click "Register Project". Try registering a second project with the same NGO + Region to see the spatial-overlap rejection.

2. **Tab 2 — Sarvam AI**: Upload an audio file (any `.wav`) for Saaras v3 transcription. Upload a PDF for Sarvam Vision OCR.

3. **Tab 3 — MRV**: Enter a project ID and area, click "Estimate Credits" for the VM0033 / Sarvam-105B estimate. Then run "Anomaly Check" to see AI flag vegetation drops.

4. **Tab 4 — Verifier**: Enter a project ID and verifier name, click "Approve & Issue Credits". This is the **only** action that creates credits.

5. **Tab 5 — Marketplace**: Enter the credit ID from step 4, enter a factory name, click "Buy & Retire". The credit status changes to RETIRED.

6. **Tab 6 — Audit Trail**: View the hash-chained event log of all actions.

### Option B: Via curl / API testing

```bash
# 1. Register a project
curl -X POST http://localhost:8000/api/project/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Sundarbans Plot C",
    "ngo_name": "Sundarbans Eco Trust",
    "panchayat": "Gosaba",
    "region": "Sundarbans",
    "state": "West Bengal",
    "polygon_coords": [[88.90,21.70],[88.95,21.70],[88.95,21.75],[88.90,21.75],[88.90,21.70]],
    "ndvi_baseline": 0.75,
    "ndvi_current": 0.60
  }'

# 2. Predict credits (VM0033 + Sarvam-105B)
curl -X POST http://localhost:8000/api/mrv/predict-credits \
  -H "Content-Type: application/json" \
  -d '{"project_id": 1, "area_hectares": 55.3, "ndvi_baseline": 0.75, "ndvi_current": 0.73}'

# 3. Run anomaly check
curl -X POST http://localhost:8000/api/mrv/anomaly-check \
  -H "Content-Type: application/json" \
  -d '{"project_id": 1}'

# 4. Verifier approves & issues credits
curl -X POST http://localhost:8000/api/verifier/approve \
  -H "Content-Type: application/json" \
  -d '{"project_id": 1, "verifier_name": "Dr. Anil Kumar", "approved": true}'

# 5. Factory buys & retires credit
curl -X POST http://localhost:8000/api/factory/buy-and-retire \
  -H "Content-Type: application/json" \
  -d '{"credit_id": 1, "factory_name": "Tata Steel Jamshedpur"}'

# 6. View audit trail
curl http://localhost:8000/api/audit

# 7. Dashboard stats
curl http://localhost:8000/api/stats
```

### Option C: Speech-to-text and OCR (file uploads)

```bash
# Saaras v3 speech-to-text
curl -X POST http://localhost:8000/api/sarvam/speech-to-text \
  -F "audio=@field_recording.wav" \
  -F "language=ta-IN"

# Sarvam Vision OCR
curl -X POST http://localhost:8000/api/sarvam/ocr-document \
  -F "document=@land_survey.pdf"
```

---

## File Structure

```
.
├── main.py              # FastAPI backend — all 7+ endpoints, mock + live modes
├── schema.sql           # PostGIS schema: projects, carbon_credits, audit_events
├── index.html           # Tailwind CSS frontend dashboard (6 tabs)
├── docker-compose.yml   # PostGIS 16 container with auto-schema loading
├── requirements.txt     # Python dependencies
├── .env.example         # Environment configuration template
└── README.md            # This file
```

---

## Key Design Principles (from the SIH proposal)

1. **Spatial-overlap checks block duplicate land claims** — PostGIS `ST_Intersects` rejects overlapping GPS polygons before any project is accepted.

2. **AI only flags anomalies for a human verifier — it never issues credits.** The `/api/mrv/anomaly-check` endpoint produces advisory flags; only `/api/verifier/approve` (a human action) can issue credits.

3. **VM0033 methodology** — Carbon estimation follows the Verra VM0033 Tidal Wetland and Seagrass Restoration methodology, using ~10 tCO2e/hectare/year for mature mangroves as the baseline rate, adjusted by NDVI change factor.

4. **Tamper-evident audit trail** — Every lifecycle event (register, verify, issue, buy, retire) is hash-chained in the `audit_events` table, mirroring the on-chain Hyperledger ledger.

5. **Indic-first** — Saaras v3 handles Tamil, Hindi, Bengali, Telugu, Marathi, Gujarati, Kannada, Malayalam, Odia, Punjabi, Assamese, and English.

---

## Sarvam AI Integration Details

| Sarvam Service | Model | Endpoint Used | Purpose |
|----------------|-------|---------------|---------|
| Speech-to-Text | Saaras v3 (`saaras:v3`) | `/ai/speech-to-text` | Transcribe Indic field voice logs |
| Vision OCR | Sarvam Vision | `/ai/vision/ocr` | Extract land survey details from PDF records |
| LLM | Sarvam-105B (`sarvam-1`) | `/ai/chat/completions` | VM0033 credit estimation justification |

All Sarvam API calls include the `api-subscription-key` header. If the API key is not set, the system gracefully falls back to realistic mock responses so the prototype remains fully demonstrable.

---

## Database Schema Summary

### `projects` table
- GPS polygon boundary stored as `GEOMETRY(POLYGON, 4326)` with a GiST spatial index
- Tracks status: PENDING → VERIFIED / REJECTED / FLAGGED
- Stores Sarvam AI outputs (voice transcript, OCR data), MRV estimates, NDVI values, anomaly flags

### `carbon_credits` table
- Lifecycle: AVAILABLE → RETIRED
- Each credit has a unique serial, vintage year, quantity, price, and tx_hash
- `retired_by` and `retired_at` track permanent ESG retirement

### `audit_events` table
- Hash-chained event log (each event's hash includes the previous event's hash)
- Mirrors the Hyperledger Fabric on-chain ledger
- Entity types: PROJECT, CREDIT | Events: REGISTER, VERIFY, ISSUE, BUY, RETIRE, ANOMALY

---

## Troubleshooting

**"ModuleNotFoundError: No module named 'psycopg2'"**
→ `pip install psycopg2-binary`

**"connection refused" on port 5432**
→ `docker compose up -d` and wait for healthcheck: `docker compose ps`

**Frontend shows "Mock Mode" but I set my API key**
→ Ensure `MOCK_MODE=0` in `.env` and restart the server. Check the startup console output for the mode banner.

**Spatial overlap check always passes in mock mode**
→ Mock mode checks NGO name + Region match. In live DB mode, it uses real PostGIS `ST_Intersects` geometry intersection.

---

## Tech Stack

- **Backend**: Python 3.12, FastAPI 0.115, Pydantic v2
- **Database**: PostgreSQL 16 + PostGIS 3.4 (Docker)
- **AI**: Sarvam AI SDK (Saaras v3, Sarvam Vision, Sarvam-105B)
- **Frontend**: HTML5 + Tailwind CSS (CDN), vanilla JavaScript
- **Geospatial**: Shapely (polygon area computation), PostGIS (spatial queries)
- **Containerization**: Docker Compose

---

## References

- Verra. "VM0033 — Methodology for Tidal Wetland and Seagrass Restoration," Verified Carbon Standard, v2.1, 2015.
- Howard, J., et al. (2014). Coastal Blue Carbon: Methods for Assessing Carbon Stocks and Emissions Factors in Mangroves, Tidal Marshes and Seagrass Meadows. Conservation International / IOC-UNESCO / IUCN.
- IPCC. "2013 Supplement to the 2006 IPCC Guidelines for National GHG Inventories: Wetlands," IPCC, 2014.
- National Centre for Sustainable Coastal Management (NCCR), MoEFCC — Blue Carbon & MISHTI Mangrove Initiative guidelines.

---

*Built for Smart India Hackathon 2026 — Team Taskforce Titans*

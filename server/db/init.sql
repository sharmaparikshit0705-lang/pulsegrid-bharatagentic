-- ============================================================================
-- PulseGrid — PostgreSQL / PostGIS schema
-- Run as:  psql -U pulsegrid -d pulsegrid -f server/db/init.sql
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS postgis;

-- ---------------------------------------------------------------------------
-- 1. road_diagnostics — unified defect ledger (bus dashcams, pole sensors,
--    citizen uploads). Every row starts a 24 h municipal SLA clock.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS road_diagnostics (
  id             BIGSERIAL PRIMARY KEY,
  lat            DOUBLE PRECISION NOT NULL,
  lng            DOUBLE PRECISION NOT NULL,
  geom           GEOGRAPHY(POINT, 4326) GENERATED ALWAYS AS
                   (ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography) STORED,
  severity_score SMALLINT NOT NULL CHECK (severity_score BETWEEN 1 AND 5),
  damage_type    TEXT,
  size_cm        INT,
  image_url      TEXT,
  source_type    TEXT NOT NULL CHECK (source_type IN ('BUS_DASHCAM', 'CITIZEN_UPLOAD')),
  status         TEXT NOT NULL DEFAULT 'PENDING'
                   CHECK (status IN ('PENDING', 'DISPATCHED', 'REPAIRED')),
  dispatch_ticket TEXT,
  ai_confidence  DOUBLE PRECISION,
  reporter_name  TEXT,
  reporter_phone TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  sla_due_at     TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '24 hours',
  repaired_at    TIMESTAMPTZ
);

-- GiST index for "defects within X m of corridor" queries
CREATE INDEX IF NOT EXISTS idx_diagnostics_geom ON road_diagnostics USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_diagnostics_status ON road_diagnostics (status);
CREATE INDEX IF NOT EXISTS idx_diagnostics_sla ON road_diagnostics (sla_due_at) WHERE status <> 'REPAIRED';

-- Escalate breached SLAs to the zonal officer (audit table)
CREATE TABLE IF NOT EXISTS sla_escalations (
  id            BIGSERIAL PRIMARY KEY,
  diagnostic_id BIGINT NOT NULL REFERENCES road_diagnostics(id),
  escalated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason        TEXT
);

-- ---------------------------------------------------------------------------
-- 2. traffic_signals — adaptive corridor controllers
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS traffic_signals (
  signal_id           TEXT PRIMARY KEY,
  junction_name       TEXT NOT NULL,
  corridor            TEXT NOT NULL,
  lat                 DOUBLE PRECISION NOT NULL,
  lng                 DOUBLE PRECISION NOT NULL,
  geom                GEOGRAPHY(POINT, 4326) GENERATED ALWAYS AS
                        (ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography) STORED,
  current_phase       TEXT NOT NULL DEFAULT 'GREEN_WAVE'
                        CHECK (current_phase IN ('GREEN_WAVE', 'TRANSIT_PRIORITY', 'EMERGENCY_OVERRIDE')),
  vehicle_count       INT NOT NULL DEFAULT 0,
  avg_speed_kmh       DOUBLE PRECISION NOT NULL DEFAULT 0,
  green_extension_s   INT NOT NULL DEFAULT 0,
  green_wave_offset_s INT NOT NULL DEFAULT 0,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_signals_geom ON traffic_signals USING GIST (geom);

-- Emergency override audit log
CREATE TABLE IF NOT EXISTS emergency_overrides (
  id           BIGSERIAL PRIMARY KEY,
  signal_ids   TEXT[] NOT NULL,
  reason       TEXT,
  activated_by TEXT NOT NULL DEFAULT 'operator',
  activated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  stood_down_at TIMESTAMPTZ
);

-- ---------------------------------------------------------------------------
-- 3. transit_fleet — college buses & public EVs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS transit_fleet (
  bus_id                    TEXT PRIMARY KEY,
  route_code                TEXT NOT NULL,
  bus_type                  TEXT NOT NULL CHECK (bus_type IN ('COLLEGE_BUS', 'PUBLIC_EV')),
  current_lat               DOUBLE PRECISION NOT NULL,
  current_lng               DOUBLE PRECISION NOT NULL,
  geom                      GEOGRAPHY(POINT, 4326) GENERATED ALWAYS AS
                              (ST_SetSRID(ST_MakePoint(current_lng, current_lat), 4326)::geography) STORED,
  occupancy_percentage      INT NOT NULL DEFAULT 0
                              CHECK (occupancy_percentage BETWEEN 0 AND 100),
  is_green_lane_authorized  BOOLEAN NOT NULL DEFAULT FALSE,
  status                    TEXT NOT NULL DEFAULT 'AT DEPOT',
  battery_pct               INT,
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fleet_geom ON transit_fleet USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_fleet_type ON transit_fleet (bus_type);

-- Green-lane violations (side-mounted AI cameras), ₹2,000 statutory fine
CREATE TABLE IF NOT EXISTS transit_violations (
  id            BIGSERIAL PRIMARY KEY,
  vehicle_reg   TEXT NOT NULL,
  vehicle_type  TEXT,
  camera_id     TEXT NOT NULL,
  lat           DOUBLE PRECISION NOT NULL,
  lng           DOUBLE PRECISION NOT NULL,
  detected_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  lane          TEXT NOT NULL DEFAULT 'GREEN LANE',
  fine_amount   INT NOT NULL DEFAULT 2000,
  status        TEXT NOT NULL DEFAULT 'NOTICE ISSUED',
  evidence_clip TEXT
);

CREATE INDEX IF NOT EXISTS idx_violations_time ON transit_violations (detected_at);

-- ---------------------------------------------------------------------------
-- 4. footage_clips — custody chain for dashcam evidence (object-store refs)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS footage_clips (
  id          TEXT PRIMARY KEY,            -- e.g. EDG-07-2024-0831-1042
  camera_id   TEXT NOT NULL,
  lat         DOUBLE PRECISION NOT NULL,
  lng         DOUBLE PRECISION NOT NULL,
  started_at  TIMESTAMPTZ NOT NULL,
  duration_s  INT NOT NULL,
  storage_url TEXT NOT NULL,                -- s3://… or MinIO equivalent
  sha256      TEXT NOT NULL,               -- integrity hash for later verification
  retention_until TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '30 days'
);

-- Municipal clip-access audit (append-only)
CREATE TABLE IF NOT EXISTS clip_access_log (
  id          BIGSERIAL PRIMARY KEY,
  clip_id     TEXT NOT NULL REFERENCES footage_clips(id),
  accessor    TEXT NOT NULL,                -- role / officer id
  purpose     TEXT,
  accessed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- updated_at trigger for traffic_signals / transit_fleet
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_signals_updated ON traffic_signals;
CREATE TRIGGER trg_signals_updated BEFORE UPDATE ON traffic_signals
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS trg_fleet_updated ON transit_fleet;
CREATE TRIGGER trg_fleet_updated BEFORE UPDATE ON transit_fleet
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Auto-open an SLA escalation when a defect crosses 24 h unrepaired
CREATE OR REPLACE FUNCTION escalate_breached_sla() RETURNS trigger AS $$
BEGIN
  IF NEW.status <> 'REPAIRED' AND NEW.sla_due_at < now() THEN
    INSERT INTO sla_escalations (diagnostic_id, reason)
    VALUES (NEW.id, 'SLA breached — escalated to zonal officer')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_diagnostics_sla ON road_diagnostics;
CREATE TRIGGER trg_diagnostics_sla BEFORE UPDATE ON road_diagnostics
  FOR EACH ROW EXECUTE FUNCTION escalate_breached_sla();

-- ---------------------------------------------------------------------------
-- Seed data — Coimbatore corridors (Avinashi Rd & Saravanampatti)
-- ---------------------------------------------------------------------------
INSERT INTO traffic_signals
  (signal_id, junction_name, corridor, lat, lng, current_phase, vehicle_count, avg_speed_kmh, green_wave_offset_s)
VALUES
  ('J-HOPE', 'Hope College Junction',  'Avinashi Rd',      11.0126, 76.9643, 'GREEN_WAVE', 62, 22.4, 0),
  ('J-PEEL', 'Peelamedu (PSG Tech)',    'Avinashi Rd',      11.0168, 76.9558, 'GREEN_WAVE', 88, 16.8, 12),
  ('J-CODI', 'Codissia Junction',       'Avinashi Rd',      11.0256, 76.9467, 'GREEN_WAVE', 47, 27.1, 24),
  ('J-KMCH', 'KMCH Junction',           'Avinashi Rd',      11.0311, 76.9386, 'GREEN_WAVE', 53, 24.9, 36),
  ('J-NEEL', 'Neelambur Junction',      'Avinashi Rd',      11.0523, 76.9204, 'GREEN_WAVE', 39, 31.2, 48),
  ('J-KALA', 'Kalapatti Junction',      'Saravanampatti Rd',11.0462, 76.9855, 'GREEN_WAVE', 71, 18.6, 0),
  ('J-KGIS', 'KGISPT IT Park',          'Saravanampatti Rd',11.0868, 76.9989, 'GREEN_WAVE', 44, 29.3, 12),
  ('J-SARA', 'Saravanampatti 4-Roads',  'Saravanampatti Rd',11.0965, 77.0013, 'GREEN_WAVE', 84, 15.2, 24)
ON CONFLICT (signal_id) DO NOTHING;

INSERT INTO transit_fleet
  (bus_id, route_code, bus_type, current_lat, current_lng, occupancy_percentage, is_green_lane_authorized, status, battery_pct)
VALUES
  ('PG-CB-101', 'PSG-AVN',   'COLLEGE_BUS', 11.0168, 76.9558, 72, TRUE,  'EN ROUTE',  NULL),
  ('PG-CB-102', 'CIT-AVN',   'COLLEGE_BUS', 11.0149, 76.9597, 64, TRUE,  'AT CAMPUS', NULL),
  ('PG-CB-103', 'PSGI-SVP',  'COLLEGE_BUS', 11.0523, 76.9204, 58, TRUE,  'EN ROUTE',  NULL),
  ('PG-CB-104', 'KG-SVP',    'COLLEGE_BUS', 11.0868, 76.9989, 41, TRUE,  'AT DEPOT',  NULL),
  ('PG-EV-201', 'PG-EV-LOOP','PUBLIC_EV',   11.0311, 76.9386, 33, FALSE, 'EN ROUTE',  78),
  ('PG-EV-202', 'PG-EV-LOOP','PUBLIC_EV',   11.0168, 76.9558, 61, FALSE, 'EN ROUTE',  52),
  ('PG-EV-203', 'PG-EV-LOOP','PUBLIC_EV',   11.0462, 76.9855, 47, FALSE, 'EN ROUTE',  89),
  ('PG-EV-204', 'PG-EV-LOOP','PUBLIC_EV',   11.0868, 76.9989, 22, FALSE, 'AT DEPOT',  96)
ON CONFLICT (bus_id) DO NOTHING;

INSERT INTO road_diagnostics
  (lat, lng, severity_score, damage_type, size_cm, image_url, source_type, status, dispatch_ticket, ai_confidence, created_at)
VALUES
  (11.0168, 76.9558, 4, 'Pothole',            58, 's3://pulsegrid-media/diagnostics/edge-1001.jpg', 'BUS_DASHCAM',  'DISPATCHED', 'CCMC-WRD-4821', 0.94, now() - INTERVAL '2 hours'),
  (11.0462, 76.9855, 3, 'Alligator Cracking', 74, 's3://pulsegrid-media/diagnostics/citizen-1002.jpg','CITIZEN_UPLOAD','PENDING',     NULL,            0.88, now() - INTERVAL '5 hours'),
  (11.0256, 76.9467, 2, 'Edge Break',         31, 's3://pulsegrid-media/diagnostics/edge-1003.jpg', 'BUS_DASHCAM',  'REPAIRED',    'CCMC-WRD-4710', 0.91, now() - INTERVAL '30 hours')
ON CONFLICT DO NOTHING;

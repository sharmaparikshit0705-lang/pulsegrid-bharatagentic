import React, { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api/mockApi.js';
import {
  GlassCard,
  SectionHeader,
  Badge,
  StatusBadge,
  SeverityMeter,
  CountdownTimer,
  formatTime,
  timeAgo,
} from './shared.jsx';

/* ==================================================================== */
/*  MODULE 1 — GERMANY PMS (Pavement Management System)                 */
/*  Bus dashcam + laser scanBeam defect detection, citizen reports,    */
/*  24h municipal SLA workflow, footage custody chain.                 */
/* ==================================================================== */

const rand = (min, max) => Math.random() * (max - min) + min;
const randInt = (min, max) => Math.floor(rand(min, max + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/* ------------------------- Dashcam simulation ------------------------- */

const TRIP = { lat0: 11.0126, lng0: 76.9643, lat1: 11.0523, lng1: 76.9204, km: 5.6 };

/**
 * Canvas-rendered bus dashcam: Avinashi Road forward view, lane dashes
 * scrolling at the live speed (kept under 60 km/h), potholes spawning in the
 * detection zone, and a sweeping cyan laser scanBeam. When the beam crosses
 * a defect inside the zone it locks a red bounding box, labels the crack
 * size and severity, and fires onDetect().
 */
function DashcamFeed({ onDetect }) {
  const canvasRef = useRef(null);
  const onDetectRef = useRef(onDetect);
  const [hud, setHud] = useState({ speed: 44, lat: TRIP.lat0, lng: TRIP.lng0, km: 0 });

  useEffect(() => {
    onDetectRef.current = onDetect;
  }, [onDetect]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let raf;
    let last = performance.now();

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const S = {
      t: 0,
      km: 0,
      beamX: 40,
      beamDir: 1,
      dashes: [],
      potholes: [],
      nextPotholeIn: 2.2,
      hudT: 0,
      clouds: [
        { x: 0.12, y: 0.10, s: 1.0, v: 0.006 },
        { x: 0.48, y: 0.06, s: 0.7, v: 0.004 },
        { x: 0.78, y: 0.14, s: 1.2, v: 0.005 },
      ],
      // the bus ahead in our own lane (rear view) — we follow it
      leadBus: { z: 0.52, gap: 0.52, wobble: 0 },
      // oncoming traffic in the opposite lane (front view)
      oncoming: { z: 0.06, kind: 'truck', speed: 0.19 },
      poles: [],
    };
    for (const laneX of [0.36, 0.5, 0.64]) {
      for (let i = 0; i < 9; i++) S.dashes.push({ laneX, z: i / 9 });
    }
    for (let i = 0; i < 8; i++) S.poles.push({ side: i % 2 === 0 ? -1 : 1, z: i / 8 });

    /* ---------- small drawing helpers ---------- */
    const roundRect = (x, y, w, h, r) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    };

    /** Rear view of the bus we are following (same direction). */
    const drawLeadBus = (cx, y, wpx) => {
      const h = wpx * 1.5;
      const top = y - h;
      // shadow on the road
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(cx, y + h * 0.03, wpx * 0.55, h * 0.07, 0, 0, Math.PI * 2);
      ctx.fill();
      // body
      const grad = ctx.createLinearGradient(cx - wpx / 2, top, cx + wpx / 2, y);
      grad.addColorStop(0, '#f0b429');
      grad.addColorStop(0.45, '#f8c74a');
      grad.addColorStop(1, '#c98a12');
      ctx.fillStyle = grad;
      roundRect(cx - wpx / 2, top, wpx, h * 0.86, wpx * 0.06);
      ctx.fill();
      // livery band + rear window
      ctx.fillStyle = '#1b1b1b';
      ctx.fillRect(cx - wpx / 2, top + h * 0.30, wpx, h * 0.07);
      ctx.fillStyle = 'rgba(20,42,60,0.92)';
      roundRect(cx - wpx * 0.38, top + h * 0.10, wpx * 0.76, h * 0.17, wpx * 0.03);
      ctx.fill();
      // tail lights
      ctx.fillStyle = '#ff3b30';
      roundRect(cx - wpx * 0.44, top + h * 0.50, wpx * 0.13, h * 0.07, 2);
      ctx.fill();
      roundRect(cx + wpx * 0.31, top + h * 0.50, wpx * 0.13, h * 0.07, 2);
      ctx.fill();
      // number plate
      ctx.fillStyle = '#f5f5f5';
      ctx.fillRect(cx - wpx * 0.11, top + h * 0.62, wpx * 0.22, h * 0.05);
      // wheels
      ctx.fillStyle = '#0b0b0b';
      roundRect(cx - wpx * 0.46, y - h * 0.10, wpx * 0.16, h * 0.12, 3);
      ctx.fill();
      roundRect(cx + wpx * 0.30, y - h * 0.10, wpx * 0.16, h * 0.12, 3);
      ctx.fill();
      // roof marker lights
      ctx.fillStyle = '#ffd166';
      for (let i = -2; i <= 2; i++) ctx.fillRect(cx + i * wpx * 0.11 - 1.5, top + 2, 3, 3);
    };

    /** Front view of an oncoming vehicle (opposite lane). */
    const drawOncoming = (cx, y, wpx, kind) => {
      const tall = kind === 'bus' ? 1.55 : 1.25;
      const h = wpx * tall;
      const top = y - h;
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(cx, y + h * 0.03, wpx * 0.52, h * 0.06, 0, 0, Math.PI * 2);
      ctx.fill();
      const grad = ctx.createLinearGradient(cx - wpx / 2, top, cx + wpx / 2, y);
      grad.addColorStop(0, kind === 'bus' ? '#e8e8ea' : '#2f6fbf');
      grad.addColorStop(1, kind === 'bus' ? '#b9bec4' : '#1f4d86');
      ctx.fillStyle = grad;
      roundRect(cx - wpx / 2, top, wpx, h * 0.86, wpx * 0.07);
      ctx.fill();
      // windshield
      ctx.fillStyle = 'rgba(24,48,66,0.9)';
      roundRect(cx - wpx * 0.40, top + h * 0.09, wpx * 0.80, h * 0.24, wpx * 0.04);
      ctx.fill();
      // destination board for a bus
      if (kind === 'bus') {
        ctx.fillStyle = '#111';
        ctx.fillRect(cx - wpx * 0.22, top + h * 0.38, wpx * 0.44, h * 0.06);
        ctx.fillStyle = '#7fd4ff';
        ctx.fillRect(cx - wpx * 0.19, top + h * 0.40, wpx * 0.38, h * 0.025);
      }
      // headlights + grille
      ctx.fillStyle = '#fff6cf';
      roundRect(cx - wpx * 0.42, top + h * 0.56, wpx * 0.14, h * 0.08, 2);
      ctx.fill();
      roundRect(cx + wpx * 0.28, top + h * 0.56, wpx * 0.14, h * 0.08, 2);
      ctx.fill();
      ctx.fillStyle = '#22262b';
      ctx.fillRect(cx - wpx * 0.16, top + h * 0.55, wpx * 0.32, h * 0.07);
      // wheels
      ctx.fillStyle = '#0b0b0b';
      roundRect(cx - wpx * 0.46, y - h * 0.10, wpx * 0.15, h * 0.12, 3);
      ctx.fill();
      roundRect(cx + wpx * 0.31, y - h * 0.10, wpx * 0.15, h * 0.12, 3);
      ctx.fill();
    };

    const draw = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      S.t += dt;

      const speed = Math.min(58, 44 + 12 * Math.sin(S.t * 0.35));
      S.km = (S.km + (speed * dt) / 3600) % TRIP.km;
      const frac = S.km / TRIP.km;
      const lat = TRIP.lat0 + (TRIP.lat1 - TRIP.lat0) * frac;
      const lng = TRIP.lng0 + (TRIP.lng1 - TRIP.lng0) * frac;

      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const horizonY = h * 0.40;

      /* ---------- sky ---------- */
      const sky = ctx.createLinearGradient(0, 0, 0, horizonY);
      sky.addColorStop(0, '#0a1226');
      sky.addColorStop(0.55, '#16233f');
      sky.addColorStop(1, '#2b3a56');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, horizonY);

      // low sun glow
      const sun = ctx.createRadialGradient(w * 0.72, horizonY * 0.72, 4, w * 0.72, horizonY * 0.72, w * 0.28);
      sun.addColorStop(0, 'rgba(255,196,120,0.35)');
      sun.addColorStop(1, 'rgba(255,196,120,0)');
      ctx.fillStyle = sun;
      ctx.fillRect(0, 0, w, horizonY);

      // drifting clouds
      for (const c of S.clouds) {
        c.x += c.v * dt;
        if (c.x > 1.15) c.x = -0.15;
        const cx = c.x * w;
        const cy = c.y * horizonY;
        ctx.fillStyle = 'rgba(190,205,225,0.10)';
        ctx.beginPath();
        ctx.ellipse(cx, cy, 46 * c.s, 13 * c.s, 0, 0, Math.PI * 2);
        ctx.ellipse(cx + 30 * c.s, cy + 4, 32 * c.s, 10 * c.s, 0, 0, Math.PI * 2);
        ctx.ellipse(cx - 28 * c.s, cy + 5, 26 * c.s, 9 * c.s, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      /* ---------- distant skyline + treeline ---------- */
      ctx.fillStyle = 'rgba(9,15,29,0.96)';
      [3, 7, 2, 5, 9, 4, 6, 3, 8, 5, 2, 7, 4, 6].forEach((v, i) => {
        const bw = w / 14;
        ctx.fillRect(i * bw + 2, horizonY - (10 + v * 6), bw - 5, 12 + v * 6);
      });
      ctx.fillStyle = 'rgba(12,24,20,0.9)';
      for (let i = 0; i < 22; i++) {
        const tx = (i / 22) * w + 6;
        ctx.beginPath();
        ctx.ellipse(tx, horizonY + 1, 9, 5 + (i % 3), 0, Math.PI, Math.PI * 2);
        ctx.fill();
      }

      /* ---------- road ---------- */
      const topW = w * 0.14;
      const bottomW = w * 0.96;
      const roadHalfAt = (y) => (((y - horizonY) / (h - horizonY)) ** 1.35 * (bottomW - topW) + topW) / 2;
      const yAt = (z) => horizonY + (h - horizonY) * z ** 2.1;

      // shoulder / kerb
      ctx.fillStyle = '#2a2f38';
      ctx.beginPath();
      ctx.moveTo((w - topW) / 2 - 26, horizonY);
      ctx.lineTo((w + topW) / 2 + 26, horizonY);
      ctx.lineTo((w + bottomW) / 2 + 70, h);
      ctx.lineTo((w - bottomW) / 2 - 70, h);
      ctx.closePath();
      ctx.fill();

      // asphalt
      const road = ctx.createLinearGradient(0, horizonY, 0, h);
      road.addColorStop(0, '#191f2b');
      road.addColorStop(0.5, '#222a38');
      road.addColorStop(1, '#2a3342');
      ctx.fillStyle = road;
      ctx.beginPath();
      ctx.moveTo((w - topW) / 2, horizonY);
      ctx.lineTo((w + topW) / 2, horizonY);
      ctx.lineTo((w + bottomW) / 2, h);
      ctx.lineTo((w - bottomW) / 2, h);
      ctx.closePath();
      ctx.fill();

      // asphalt grain streaks
      ctx.strokeStyle = 'rgba(255,255,255,0.028)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 26; i++) {
        const f = i / 26;
        const yy = horizonY + (h - horizonY) * f;
        const hw = roadHalfAt(yy);
        ctx.beginPath();
        ctx.moveTo(w / 2 - hw + f * hw * 0.4, yy);
        ctx.lineTo(w / 2 + hw - f * hw * 0.4, yy);
        ctx.stroke();
      }

      // edge lines
      ctx.strokeStyle = 'rgba(232,238,246,0.75)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo((w - topW) / 2 + 6, horizonY);
      ctx.lineTo((w - bottomW) / 2 + 12, h);
      ctx.moveTo((w + topW) / 2 - 6, horizonY);
      ctx.lineTo((w + bottomW) / 2 - 12, h);
      ctx.stroke();

      // centre divider — double line separating oncoming traffic
      ctx.strokeStyle = 'rgba(240,200,80,0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(w / 2 - 3, horizonY);
      ctx.lineTo(w / 2 - 6, h);
      ctx.moveTo(w / 2 + 3, horizonY);
      ctx.lineTo(w / 2 + 6, h);
      ctx.stroke();

      // scrolling lane dashes
      for (const d of S.dashes) {
        d.z += dt * speed * 0.0085;
        if (d.z > 1) d.z -= 1;
        const y = yAt(d.z);
        if (y <= horizonY + 3) continue;
        const half = roadHalfAt(y);
        const x = w / 2 + (d.laneX - 0.5) * 2 * half;
        ctx.fillStyle = `rgba(232,238,246,${0.20 + d.z * 0.55})`;
        ctx.fillRect(x - 1.5 - d.z * 2, y, 3 + d.z * 5, 5 + d.z * 34);
      }

      // roadside lamp posts
      for (const p of S.poles) {
        p.z += dt * speed * 0.0085;
        if (p.z > 1) p.z -= 1;
        const y = yAt(p.z);
        if (y <= horizonY + 6) continue;
        const half = roadHalfAt(y);
        const x = w / 2 + p.side * (half + 16 + p.z * 54);
        const ph = 26 + p.z * 120;
        ctx.strokeStyle = 'rgba(120,132,148,0.75)';
        ctx.lineWidth = 1 + p.z * 2.5;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y - ph);
        ctx.lineTo(x - p.side * (8 + p.z * 16), y - ph);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,214,140,0.85)';
        ctx.beginPath();
        ctx.arc(x - p.side * (8 + p.z * 16), y - ph + 2, 1.4 + p.z * 3.4, 0, Math.PI * 2);
        ctx.fill();
      }

      /* ---------- traffic ---------- */
      // the bus we are following (same lane, rear view)
      S.leadBus.wobble = Math.sin(S.t * 0.6) * 0.012;
      const leadZ = S.leadBus.gap + S.leadBus.wobble;
      const leadY = yAt(leadZ);
      if (leadY > horizonY + 10) {
        const half = roadHalfAt(leadY);
        drawLeadBus(w / 2 + half * 0.34, leadY, Math.max(26, 74 * leadZ + 26));
      }

      // oncoming vehicle in the opposite lane
      S.oncoming.z += dt * S.oncoming.speed;
      if (S.oncoming.z > 1.02) {
        S.oncoming.z = 0.04;
        S.oncoming.kind = Math.random() > 0.5 ? 'bus' : 'truck';
      }
      const onY = yAt(S.oncoming.z);
      if (onY > horizonY + 8) {
        const half = roadHalfAt(onY);
        drawOncoming(w / 2 - half * 0.42, onY, Math.max(20, 62 * S.oncoming.z + 22), S.oncoming.kind);
      }

      /* ---------- defects ---------- */
      S.nextPotholeIn -= dt;
      if (S.nextPotholeIn <= 0) {
        S.nextPotholeIn = rand(2.6, 5.2);
        S.potholes.push({
          laneX: pick([0.3, 0.5, 0.7]),
          z: 0.02,
          sizeCm: randInt(18, 80),
          severity: randInt(2, 5),
          detected: false,
          detectFlash: 0,
        });
      }

      S.beamPrev = S.beamX;
      S.beamX += S.beamDir * dt * w * 0.55;
      if (S.beamX > w - 6) { S.beamX = w - 6; S.beamDir = -1; }
      if (S.beamX < 6) { S.beamX = 6; S.beamDir = 1; }

      for (const p of S.potholes) {
        p.z += dt * speed * 0.0085;
        const y = yAt(p.z);
        const half = roadHalfAt(y);
        const x = w / 2 + (p.laneX - 0.5) * 2 * half;
        const rx = 3 + p.z * 26;
        const ry = rx * 0.38;

        if (y > horizonY + 4) {
          ctx.save();
          ctx.translate(x, y);
          // broken asphalt crater
          ctx.fillStyle = 'rgba(6,9,16,0.9)';
          ctx.beginPath();
          ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(70,78,92,0.55)';
          ctx.beginPath();
          ctx.ellipse(0, -ry * 0.35, rx * 0.72, ry * 0.4, 0, 0, Math.PI * 2);
          ctx.fill();
          // radiating cracks
          ctx.strokeStyle = 'rgba(6,9,16,0.75)';
          ctx.lineWidth = 1 + p.z * 1.2;
          for (let i = 0; i < 5; i++) {
            const a = i * 1.28 + 0.4;
            ctx.beginPath();
            ctx.moveTo(Math.cos(a) * rx * 0.85, Math.sin(a) * ry * 0.85);
            ctx.lineTo(
              Math.cos(a + 0.25) * rx * (1.7 + (i % 2) * 0.5),
              Math.sin(a + 0.25) * ry * (1.9 + (i % 2) * 0.4)
            );
            ctx.stroke();
          }
          ctx.restore();
        }

        const beamLo = Math.min(S.beamPrev ?? S.beamX, S.beamX) - 10;
        const beamHi = Math.max(S.beamPrev ?? S.beamX, S.beamX) + 10;
        if (!p.detected && p.z > 0.35 && p.z < 0.8 && x >= beamLo && x <= beamHi) {
          p.detected = true;
          p.detectFlash = S.t;
          onDetectRef.current?.({
            lat: +(lat + (Math.random() - 0.5) * 0.002).toFixed(5),
            lng: +(lng + (Math.random() - 0.5) * 0.002).toFixed(5),
            severity: p.severity,
            sizeCm: p.sizeCm,
            speedKmh: Math.round(speed),
            cameraId: 'EDGE-07',
          });
        }

        if (p.detected && S.t - p.detectFlash < 2.4) {
          const pad = Math.max(16, rx * 1.6);
          ctx.strokeStyle = '#FF3366';
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 4]);
          ctx.strokeRect(x - pad, y - pad * 0.55, pad * 2, pad * 1.1);
          ctx.setLineDash([]);
          ctx.fillStyle = 'rgba(255,51,102,0.95)';
          ctx.font = 'bold 11px JetBrains Mono, monospace';
          ctx.fillText(`DEFECT s${p.severity} · ${p.sizeCm}cm`, x - pad, Math.max(12, y - pad * 0.55 - 6));
        }
      }
      S.potholes = S.potholes.filter((p) => p.z < 1.05);

      /* ---------- laser scanBeam ---------- */
      const beamGrad = ctx.createLinearGradient(0, horizonY, 0, h);
      beamGrad.addColorStop(0, 'rgba(0,240,255,0.04)');
      beamGrad.addColorStop(1, 'rgba(0,240,255,0.45)');
      ctx.fillStyle = beamGrad;
      ctx.fillRect(S.beamX - 7, horizonY, 14, h - horizonY);
      ctx.shadowColor = '#00F0FF';
      ctx.shadowBlur = 16;
      ctx.fillStyle = 'rgba(0,240,255,0.95)';
      ctx.fillRect(S.beamX - 1, horizonY, 2, h - horizonY);
      ctx.shadowBlur = 0;

      // scan-zone brackets
      const zy0 = yAt(0.35);
      const zy1 = yAt(0.8);
      ctx.strokeStyle = 'rgba(0,240,255,0.35)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(10, zy0); ctx.lineTo(10, zy1); ctx.lineTo(26, zy1);
      ctx.moveTo(w - 10, zy0); ctx.lineTo(w - 10, zy1); ctx.lineTo(w - 26, zy1);
      ctx.stroke();
      ctx.fillStyle = 'rgba(0,240,255,0.6)';
      ctx.font = 'bold 9px JetBrains Mono, monospace';
      ctx.fillText('SCAN ZONE 35-80 m', 28, zy1 + 3);
      ctx.textAlign = 'right';
      ctx.fillText('AI VISION ACTIVE', w - 28, zy1 + 3);
      ctx.textAlign = 'left';

      /* ---------- our own bus: bonnet + windscreen ---------- */
      const dashH = h * 0.15;
      const dash = ctx.createLinearGradient(0, h - dashH, 0, h);
      dash.addColorStop(0, '#1c2534');
      dash.addColorStop(0.35, '#0f1622');
      dash.addColorStop(1, '#080c14');
      ctx.fillStyle = dash;
      ctx.beginPath();
      ctx.moveTo(w * 0.06, h - dashH);
      ctx.quadraticCurveTo(w * 0.5, h - dashH * 1.5, w * 0.94, h - dashH);
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fill();
      // chrome trim
      ctx.strokeStyle = 'rgba(150,170,190,0.35)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(w * 0.06, h - dashH);
      ctx.quadraticCurveTo(w * 0.5, h - dashH * 1.5, w * 0.94, h - dashH);
      ctx.stroke();
      // windscreen wiper
      ctx.strokeStyle = 'rgba(10,14,22,0.9)';
      ctx.lineWidth = 3;
      const wiperA = -0.5 + Math.sin(S.t * 0.5) * 0.42;
      ctx.beginPath();
      ctx.moveTo(w * 0.30, h - dashH * 1.15);
      ctx.lineTo(w * 0.30 + Math.cos(wiperA) * w * 0.20, h - dashH * 1.15 + Math.sin(wiperA) * h * 0.10);
      ctx.stroke();
      // windscreen reflection streak
      ctx.save();
      ctx.globalAlpha = 0.05;
      ctx.fillStyle = '#cfe6ff';
      ctx.beginPath();
      ctx.moveTo(w * 0.12, h);
      ctx.lineTo(w * 0.42, 0);
      ctx.lineTo(w * 0.56, 0);
      ctx.lineTo(w * 0.26, h);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      // bus identity plate on the bonnet
      ctx.fillStyle = 'rgba(220,230,240,0.55)';
      ctx.font = 'bold 10px JetBrains Mono, monospace';
      ctx.fillText('TN 37 · CITY BUS · EDGE-07', w * 0.06, h - dashH * 0.35);

      /* ---------- HUD publish ---------- */
      S.hudT += dt;
      if (S.hudT > 0.25) {
        S.hudT = 0;
        setHud({ speed: Math.round(speed), lat: lat.toFixed(5), lng: lng.toFixed(5), km: S.km.toFixed(2) });
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-white/10 bg-black">
      <canvas ref={canvasRef} className="h-full w-full" />

      {/* DOM HUD overlays */}
      <div className="pointer-events-none absolute inset-0 p-3 font-mono text-[11px] leading-relaxed text-cyan-100/90">
        <div className="flex items-start justify-between">
          <div className="rounded bg-black/50 px-2 py-1 backdrop-blur-sm">
            <span className="mr-2 inline-flex items-center gap-1.5 font-bold text-rose-400">
              <span className="h-2 w-2 animate-pulse rounded-full bg-rose-500" /> REC
            </span>
            EDGE-07 · TN 37 CITY BUS · AVINASHI RD
          </div>
          <div className="rounded bg-black/50 px-2 py-1 text-right backdrop-blur-sm">
            <span className={`text-lg font-bold ${hud.speed > 55 ? 'text-amber-300' : 'text-emerald-300'}`}>
              {hud.speed}
            </span>{' '}
            km/h {hud.speed < 60 ? <span className="text-emerald-400">✓ capture-eligible</span> : null}
          </div>
        </div>
        <div className="absolute bottom-3 left-3 rounded bg-black/50 px-2 py-1 backdrop-blur-sm">
          GPS {hud.lat}° N, {hud.lng}° E · chainage {hud.km} km
        </div>
        <div className="absolute bottom-3 right-3 rounded bg-black/50 px-2 py-1 backdrop-blur-sm">
          1080p · 30 fps · H.264 · geofence: CBE-AVINASHI
        </div>
      </div>
    </div>
  );
}

/* ------------------------ Pole-mounted sensors ------------------------ */

function PoleSensorNetwork() {
  return (
    <div className="glass-inset flex items-center gap-4 p-3">
      <svg viewBox="0 0 60 120" className="h-24 w-14 shrink-0">
        <rect x="27" y="20" width="6" height="100" fill="#334155" />
        <rect x="20" y="14" width="20" height="10" rx="2" fill="#475569" />
        <circle cx="30" cy="19" r="3" fill="#00F0FF" />
        <rect x="18" y="34" width="24" height="9" rx="2" fill="#1e293b" stroke="#334155" />
        <circle cx="24" cy="38.5" r="2.4" fill="#00F0FF" />
        <circle cx="36" cy="38.5" r="2.4" fill="#00FF66" />
        {/* LiDAR FOV */}
        <path d="M24 41 L2 74 M24 41 L24 78 M24 41 L40 76" stroke="#00F0FF" strokeOpacity="0.5" strokeWidth="1" fill="none" />
        <rect x="8" y="108" width="44" height="5" rx="2" fill="#334155" />
      </svg>
      <div className="min-w-0 text-xs leading-relaxed text-slate-300">
        <p className="mb-1 font-bold text-slate-100">Pole-mounted sensor nodes · every 500 m</p>
        <p className="text-slate-400">
          360° camera + LiDAR crack profilometer. Measures crack length/width to ±2 cm, feeds the
          same <span className="text-cyan-300">road_diagnostics</span> table as dashcams and citizen uploads —
          a unified defect ledger for CCMC (Coimbatore City Municipal Corporation).
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Badge tone="cyan">LiDAR ±2 cm</Badge>
          <Badge tone="green">solar + grid backup</Badge>
          <Badge tone="slate">edge pre-filter</Badge>
        </div>
      </div>
    </div>
  );
}

/* -------------------------- Citizen report ---------------------------- */

function CitizenReportForm({ onSubmitted, onToast }) {
  const [form, setForm] = useState({
    reporter: '',
    phone: '',
    notes: '',
    lat: 11.0168,
    lng: 76.9558,
    damageTypeHint: 'auto',
  });
  const [photo, setPhoto] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [vision, setVision] = useState(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const useGps = () => {
    if (!navigator.geolocation) {
      onToast('Geolocation unavailable — using Peelamedu default', 'red');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setForm((f) => ({
          ...f,
          lat: +pos.coords.latitude.toFixed(5),
          lng: +pos.coords.longitude.toFixed(5),
        })),
      () => onToast('GPS permission denied — using Peelamedu default', 'red')
    );
  };

  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPhoto({ name: file.name, sizeKb: Math.round(file.size / 1024), dataUrl: reader.result });
    };
    reader.readAsDataURL(file);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!photo) {
      onToast('Attach a geotagged photo to submit (required by CCMC intake)', 'red');
      return;
    }
    setSubmitting(true);
    setVision(null);
    try {
      const res = await api.citizenReport({
        reporter: form.reporter || 'Anonymous',
        phone: form.phone,
        notes: form.notes,
        lat: +form.lat,
        lng: +form.lng,
        damageTypeHint: form.damageTypeHint === 'auto' ? undefined : form.damageTypeHint,
        hasPhoto: true,
      });
      setVision(res.vision_analysis);
      onSubmitted(res.diagnostic);
      onToast(`Report #${res.diagnostic.id} logged — 24h SLA clock started`, 'green');
    } catch (err) {
      onToast(`Submit failed: ${err.message}`, 'red');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="label-mono">Name</span>
          <input
            value={form.reporter}
            onChange={set('reporter')}
            placeholder="Optional"
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-slate-100 outline-none focus:border-cyan-400/50"
          />
        </label>
        <label className="block">
          <span className="label-mono">Phone</span>
          <input
            value={form.phone}
            onChange={set('phone')}
            placeholder="+91 …"
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-slate-100 outline-none focus:border-cyan-400/50"
          />
        </label>
      </div>

      <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
        <label className="block">
          <span className="label-mono">Latitude</span>
          <input
            type="number"
            step="0.00001"
            value={form.lat}
            onChange={set('lat')}
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 font-mono text-xs text-slate-100 outline-none focus:border-cyan-400/50"
          />
        </label>
        <label className="block">
          <span className="label-mono">Longitude</span>
          <input
            type="number"
            step="0.00001"
            value={form.lng}
            onChange={set('lng')}
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 font-mono text-xs text-slate-100 outline-none focus:border-cyan-400/50"
          />
        </label>
        <button type="button" onClick={useGps} className="btn-cyan">
          📍 Use my GPS
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="label-mono">Observed damage (hint)</span>
          <select
            value={form.damageTypeHint}
            onChange={set('damageTypeHint')}
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-slate-100 outline-none focus:border-cyan-400/50"
          >
            <option value="auto">Let Vision AI decide</option>
            <option>Pothole</option>
            <option>Alligator Cracking</option>
            <option>Longitudinal Cracking</option>
            <option>Edge Break</option>
            <option>Rutting</option>
          </select>
        </label>
        <label className="block">
          <span className="label-mono">Notes</span>
          <input
            value={form.notes}
            onChange={set('notes')}
            placeholder="e.g. opposite Fun Mall, left lane"
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-slate-100 outline-none focus:border-cyan-400/50"
          />
        </label>
      </div>

      <div className="glass-inset flex items-center gap-3 p-3">
        {photo ? (
          <img src={photo.dataUrl} alt="report preview" className="h-16 w-24 rounded-md border border-cyan-400/30 object-cover" />
        ) : (
          <div className="flex h-16 w-24 items-center justify-center rounded-md border border-dashed border-white/15 text-[10px] text-slate-500">
            no photo
          </div>
        )}
        <div className="min-w-0 flex-1 text-xs">
          <p className="truncate text-slate-300">{photo ? photo.name : 'Attach geotagged road photo (JPG/PNG)'}</p>
          <p className="text-slate-500">
            {photo ? `${photo.sizeKb} KB · EXIF GPS auto-extracted server-side` : 'EXIF GPS extracted by the API when present'}
          </p>
        </div>
        <label className="btn-cyan cursor-pointer">
          📷 Choose
          <input type="file" accept="image/*" onChange={onFile} className="hidden" />
        </label>
      </div>

      <button type="submit" disabled={submitting} className="btn-green w-full justify-center py-2.5 text-sm">
        {submitting ? '⟳ Uploading — Vision AI analyzing…' : 'Submit Citizen Report'}
      </button>

      {vision && (
        <div className="rounded-xl border border-cyan-400/30 bg-cyan-400/[0.06] p-3 text-xs">
          <p className="label-mono mb-2 text-cyan-300">Vision AI Analysis · {vision.model}</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-slate-300">
            <span>hasPothole: <b className={vision.hasPothole ? 'text-rose-300' : 'text-emerald-300'}>{String(vision.hasPothole)}</b></span>
            <span>severityScore: <b className="neon-text-cyan">{vision.severityScore} / 5</b></span>
            <span className="col-span-2">damageType: <b className="text-slate-100">{vision.damageType}</b></span>
            <span className="col-span-2">
              recommendedAction: <b className="text-slate-100">{vision.recommendedAction}</b>
            </span>
            <span className="col-span-2 text-slate-500">
              confidence {vision.confidence} · {vision.estimatedSizeCm ? `estimated size ${vision.estimatedSizeCm} cm` : ''}
            </span>
          </div>
        </div>
      )}
    </form>
  );
}

/* --------------------------- Diagnostics list -------------------------- */

function DiagnosticRow({ d, onAction, acting }) {
  const advance =
    d.status === 'PENDING' ? 'DISPATCHED' : d.status === 'DISPATCHED' ? 'REPAIRED' : null;
  return (
    <div className="glass-inset flex flex-wrap items-center gap-x-4 gap-y-2 p-3 text-xs">
      <div className="min-w-[190px] flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-slate-500">#{d.id}</span>
          <StatusBadge status={d.status} />
          <Badge tone={d.source_type === 'BUS_DASHCAM' ? 'cyan' : 'green'}>
            {d.source_type === 'BUS_DASHCAM' ? 'bus cam' : 'citizen'}
          </Badge>
        </div>
        <p className="mt-1 truncate text-slate-300">{d.label}</p>
        <p className="text-[10px] text-slate-500">
          {timeAgo(d.created_at)} · {d.size_cm} cm · conf {d.ai_confidence}
          {d.dispatch_ticket ? ` · ticket ${d.dispatch_ticket}` : ''}
        </p>
      </div>
      <SeverityMeter score={d.severity_score} compact />
      <div className="text-right">
        <p className="label-mono">SLA remaining</p>
        <CountdownTimer dueAt={d.sla_due_at} />
      </div>
      {advance && (
        <button
          type="button"
          disabled={acting}
          onClick={() => onAction(d.id, advance)}
          className={advance === 'REPAIRED' ? 'btn-green' : 'btn-cyan'}
        >
          {advance === 'REPAIRED' ? 'Mark Repaired' : 'Dispatch Crew'}
        </button>
      )}
    </div>
  );
}

/* ------------------------ Footage custody chain ------------------------ */

function FootagePipeline() {
  const steps = [
    { icon: '🚌', title: 'Bus dashcam', sub: '1080p H.264 · 30 fps · loop buffer 72 h', tone: 'cyan' },
    { icon: '⏱️', title: 'Edge gate', sub: 'frames sampled only below 60 km/h · 5 fps to AI', tone: 'slate' },
    { icon: '🧠', title: 'Vision AI', sub: 'pulsegrid-vision-v1 defect inference + severity', tone: 'cyan' },
    { icon: '🗄️', title: 'PostGIS + object store', sub: 's3://pulsegrid-media · 30-day retention · immutable hash chain', tone: 'slate' },
    { icon: '🏛️', title: 'CCMC portal', sub: 'ward engineer opens ticket · 24 h SLA clock', tone: 'green' },
  ];
  return (
    <div>
      <div className="flex flex-col gap-2 md:flex-row md:items-stretch">
        {steps.map((s, i) => (
          <React.Fragment key={s.title}>
            <div className="glass-inset relative min-w-[150px] flex-1 overflow-hidden p-3">
              <div className="text-lg">{s.icon}</div>
              <p className="mt-1 text-xs font-bold text-slate-100">{s.title}</p>
              <p className={`mt-0.5 text-[10px] leading-snug ${s.tone === 'cyan' ? 'text-cyan-300/80' : s.tone === 'green' ? 'text-emerald-300/80' : 'text-slate-500'}`}>
                {s.sub}
              </p>
            </div>
            {i < steps.length - 1 && (
              <div className="relative hidden w-8 items-center md:flex">
                <div className="h-px w-full bg-gradient-to-r from-cyan-400/50 to-emerald-400/50" />
                <span className="flow-dot bg-cyan-400" style={{ animationDelay: `${i * 0.45}s` }} />
                <span className="flow-dot bg-emerald-400" style={{ animationDelay: `${i * 0.45 + 0.2}s` }} />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
      <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
        Every frame is hashed on ingest (SHA-256) so a municipal engineer can later verify that the
        clip produced as evidence is byte-identical to what the bus recorded.
      </p>
    </div>
  );
}

/* ----------------------- Municipal feed access ------------------------- */

const SEED_CLIPS = [
  { id: 'EDG-07-2024-0831-1042', cam: 'EDGE-07', spot: 'Avinashi Rd · Peelamedu', at: '07:42:11', dur: '00:12', size: '38 MB' },
  { id: 'EDG-03-2024-0831-1031', cam: 'EDGE-03', spot: 'Avinashi Rd · KMCH', at: '07:31:04', dur: '00:08', size: '26 MB' },
  { id: 'EDG-11-2024-0830-1755', cam: 'EDGE-11', spot: 'Saravanampatti 4-Roads', at: '17:55:40', dur: '00:15', size: '44 MB' },
];

function MunicipalAccess() {
  const [clips, setClips] = useState(SEED_CLIPS);
  const [audit, setAudit] = useState([
    { t: '08:12', who: 'Ward Engineer #4211', what: 'accessed EDG-07-2024-0831-1042 · reason: SLA verification' },
    { t: '08:15', who: 'Zonal Officer (Zone-II)', what: 'exported evidence pack · ticket CCMC-WRD-4821' },
  ]);
  const [preview, setPreview] = useState(null);
  const [role, setRole] = useState('Ward Engineer');

  const requestAccess = () => {
    const t = new Date();
    const hhmm = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
    const clip = pick(clips);
    setAudit((a) => [
      { t: hhmm, who: role, what: `accessed ${clip.id} · reason: ${role === 'Auditor' ? 'retention audit' : 'SLA verification'}` },
      ...a,
    ]);
    setPreview(clip);
  };

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div>
        <div className="mb-2 flex items-center gap-2">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-slate-200 outline-none"
          >
            <option>Ward Engineer</option>
            <option>Zonal Officer (Zone-II)</option>
            <option>Auditor</option>
          </select>
          <button type="button" onClick={requestAccess} className="btn-cyan">
            Request clip access
          </button>
        </div>
        <div className="overflow-hidden rounded-xl border border-white/10">
          <table className="w-full text-left text-[11px]">
            <thead className="bg-white/[0.04] text-slate-400">
              <tr>
                <th className="px-2 py-1.5 font-semibold">Clip ID</th>
                <th className="px-2 py-1.5 font-semibold">Camera / spot</th>
                <th className="px-2 py-1.5 font-semibold">Time</th>
                <th className="px-2 py-1.5 font-semibold">Size</th>
              </tr>
            </thead>
            <tbody>
              {clips.map((c) => (
                <tr key={c.id} className="border-t border-white/5 font-mono text-slate-300">
                  <td className="px-2 py-1.5">{c.id}</td>
                  <td className="px-2 py-1.5 font-sans">{c.cam} · {c.spot}</td>
                  <td className="px-2 py-1.5">{c.at}</td>
                  <td className="px-2 py-1.5">{c.size}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {preview && (
          <div className="feed-shimmer feed-scanlines relative mt-2 aspect-video overflow-hidden rounded-lg border border-emerald-400/30 bg-gradient-to-b from-[#0b1220] to-[#1a2338]">
            <div className="absolute inset-x-0 top-0 flex justify-between p-2 font-mono text-[10px] text-emerald-200">
              <span>▶ PLAYBACK · {preview.cam} · {preview.id}</span>
              <span>{preview.dur}</span>
            </div>
            <div className="absolute bottom-2 left-2 font-mono text-[10px] text-emerald-300">
              RBAC: {role} · ACCESS GRANTED · logged to audit trail
            </div>
          </div>
        )}
      </div>
      <div className="glass-inset max-h-[260px] overflow-y-auto p-3 font-mono text-[11px] leading-relaxed">
        <p className="label-mono mb-2 text-slate-500">Access audit trail (append-only)</p>
        {audit.map((a, i) => (
          <p key={i} className={i === 0 ? 'text-emerald-300' : 'text-slate-400'}>
            [{a.t}] {a.who} {a.what}
          </p>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------- Module ------------------------------- */

export default function Module1PMS({ onToast }) {
  const [diagnostics, setDiagnostics] = useState([]);
  const [acting, setActing] = useState(false);
  const [scanning, setScanning] = useState(0);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    api.getDiagnostics().then((res) => setDiagnostics(res.diagnostics));
  }, []);

  const handleDetect = useCallback(
    async (detection) => {
      setScanning((n) => n + 1);
      try {
        const res = await api.edgeScan({
          camera_id: detection.cameraId,
          bus_id: 'TN-37-BUS-2214',
          lat: detection.lat,
          lng: detection.lng,
          speed_kmh: detection.speedKmh,
          severity_hint: detection.severity,
          size_cm: detection.sizeCm,
        });
        setDiagnostics((list) => [res.diagnostic, ...list]);
        if (res.diagnostic.status === 'DISPATCHED') {
          onToast(
            `Defect #${res.diagnostic.id} (s${res.diagnostic.severity_score}) auto-dispatched → ${res.diagnostic.auto_dispatch.repair_crew}, ETA ${res.diagnostic.auto_dispatch.eta_min} min`,
            'green'
          );
        }
      } catch (e) {
        onToast(`Edge scan failed: ${e.message}`, 'red');
      }
    },
    [onToast]
  );

  const handleAction = async (id, status) => {
    setActing(true);
    try {
      const res = await api.updateDiagnosticStatus(id, status);
      setDiagnostics((list) => list.map((d) => (d.id === id ? res.diagnostic : d)));
    } catch (e) {
      onToast(`Update failed: ${e.message}`, 'red');
    } finally {
      setActing(false);
    }
  };

  const prepend = (d) => setDiagnostics((list) => [d, ...list]);

  const open = diagnostics.filter((d) => d.status !== 'REPAIRED').length;

  return (
    <section className="space-y-4">
      <SectionHeader
        index={1}
        title="Pavement Management System"
        subtitle="Bus-fleet-as-inspector: dashcam + LiDAR defect detection with 24 h municipal SLA"
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <GlassCard
          title="Bus Dashcam · Live Edge Scan"
          subtitle="Front-facing camera, Avinashi Road service lane — laser scanBeam sweeping for surface defects"
          right={
            <div className="flex items-center gap-2">
              <Badge tone="cyan">scanBeam v2</Badge>
              <Badge tone={scanning > 0 ? 'green' : 'slate'}>{scanning} detections this session</Badge>
            </div>
          }
        >
          <DashcamFeed onDetect={handleDetect} />
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <PoleSensorNetwork />
            <div className="glass-inset p-3 text-xs leading-relaxed text-slate-400">
              <p className="mb-1 font-bold text-slate-100">How capture works</p>
              Frames are grabbed at 5 fps only while the bus holds below{' '}
              <b className="text-cyan-300">60 km/h</b> (above it, motion blur defeats measurement). The
              on-edge gate runs a cheap quality filter, then Vision AI scores the frame; anything
              severity ≥ 3 raises a repair ticket automatically. Watch the console for the
              POST /diagnostics/edge-scan payload each time the beam locks a defect.
            </div>
          </div>
        </GlassCard>

        <GlassCard
          title="Citizen Reporting · Geotagged Photo Intake"
          subtitle="Residents photograph damage — Vision AI grades severity, CCMC gets the ticket"
          accent="green"
        >
          <CitizenReportForm onSubmitted={prepend} onToast={onToast} />
        </GlassCard>
      </div>

      <GlassCard
        title="Defect Ledger & SLA Countdowns (24 h municipal repair window)"
        subtitle={`${open} open defects · timers escalate to the zonal officer on breach`}
        right={<Badge tone="amber">SLA 24 h</Badge>}
      >
        <div className="space-y-2">
          {diagnostics.length === 0 && (
            <p className="p-3 text-center text-xs text-slate-500">Loading diagnostics…</p>
          )}
          {diagnostics.slice(0, 8).map((d) => (
            <DiagnosticRow key={d.id} d={d} onAction={handleAction} acting={acting} />
          ))}
        </div>
      </GlassCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <GlassCard
          title="Footage Custody Chain"
          subtitle="From tyre to courtroom: how a 12-second clip becomes a verified repair ticket"
        >
          <FootagePipeline />
        </GlassCard>
        <GlassCard
          title="CCMC Municipal Feed Access"
          subtitle="Role-based clip retrieval with append-only audit trail — no anonymous viewing"
          accent="green"
        >
          <MunicipalAccess />
        </GlassCard>
      </div>
    </section>
  );
}

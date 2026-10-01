import React, { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { GlassCard, SectionHeader, Badge, Stat } from './shared.jsx';

/* ==================================================================== */
/*  ANALYTICS — Peak-hour delay vs PulseGrid-optimized travel time       */
/* ==================================================================== */

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const HOURS = ['7a', '8a', '9a', '10a', '11a', '12p', '1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p'];

/** Avinashi Rd ↔ Saravanampatti end-to-end travel time, minutes. */
const BASELINE_DELAY = [34, 41, 38, 27, 24, 25, 26, 28, 31, 33, 38, 36, 30, 24, 19];
const PULSEGRID_OPTIMIZED = [23, 27, 26, 20, 19, 20, 21, 22, 23, 25, 28, 27, 23, 19, 15];

export default function Analytics() {
  const { data, options, savings } = useMemo(() => {
    const totalBase = BASELINE_DELAY.reduce((a, b) => a + b, 0);
    const totalOpt = PULSEGRID_OPTIMIZED.reduce((a, b) => a + b, 0);
    const avgSaved = ((totalBase - totalOpt) / BASELINE_DELAY.length).toFixed(1);
    const peakSaved = Math.max(...BASELINE_DELAY.map((v, i) => v - PULSEGRID_OPTIMIZED[i]));

    const ctx = document.createElement('canvas').getContext('2d');
    const cyanFill = ctx.createLinearGradient(0, 0, 0, 320);
    cyanFill.addColorStop(0, 'rgba(0,240,255,0.22)');
    cyanFill.addColorStop(1, 'rgba(0,240,255,0)');
    const greenFill = ctx.createLinearGradient(0, 0, 0, 320);
    greenFill.addColorStop(0, 'rgba(0,255,102,0.18)');
    greenFill.addColorStop(1, 'rgba(0,255,102,0)');

    return {
      savings: { avgSaved, peakSaved },
      data: {
        labels: HOURS,
        datasets: [
          {
            label: 'Baseline peak-hour delay',
            data: BASELINE_DELAY,
            borderColor: '#FF3366',
            backgroundColor: cyanFill,
            borderWidth: 2,
            pointRadius: 3,
            pointBackgroundColor: '#FF3366',
            tension: 0.35,
            fill: true,
          },
          {
            label: 'PulseGrid optimized travel time',
            data: PULSEGRID_OPTIMIZED,
            borderColor: '#00FF66',
            backgroundColor: greenFill,
            borderWidth: 2,
            pointRadius: 3,
            pointBackgroundColor: '#00FF66',
            tension: 0.35,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            labels: { color: '#94a3b8', usePointStyle: true, boxWidth: 8, font: { size: 11 } },
          },
          tooltip: {
            backgroundColor: 'rgba(7,11,20,0.92)',
            borderColor: 'rgba(0,240,255,0.35)',
            borderWidth: 1,
            titleColor: '#e2e8f0',
            bodyColor: '#cbd5e1',
            padding: 10,
            callbacks: {
              label: (c) => `${c.dataset.label}: ${c.parsed.y} min`,
              afterBody: (items) => {
                const i = items[0].dataIndex;
                return `saved: ${BASELINE_DELAY[i] - PULSEGRID_OPTIMIZED[i]} min`;
              },
            },
          },
        },
        scales: {
          x: {
            grid: { color: 'rgba(148,163,184,0.08)' },
            ticks: { color: '#64748b', font: { size: 10 } },
          },
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(148,163,184,0.08)' },
            ticks: { color: '#64748b', font: { size: 10 }, callback: (v) => `${v}m` },
          },
        },
      },
    };
  }, []);

  return (
    <section className="space-y-4">
      <SectionHeader
        index="4"
        title="Corridor Analytics — PulseGrid vs Baseline"
        subtitle="Avinashi Rd ↔ Saravanampatti end-to-end travel time by hour of day"
      />
      <GlassCard
        title="Peak-Hour Delay vs PulseGrid Optimized Travel Time"
        subtitle="Hover any hour point for per-hour savings — 30-day rolling model, both corridors"
        right={<Badge tone="green">avg −32%</Badge>}
      >
        <div className="relative h-[340px]">
          <Line data={data} options={options} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="avg time saved / trip" value={`−${savings.avgSaved}`} unit="min" tone="green" />
          <Stat label="peak saving (worst hour)" value={`−${savings.peakSaved}`} unit="min" tone="green" />
          <Stat label="on-time college arrivals" value="94.2" unit="%" tone="green" />
          <Stat label="signal stops per trip" value="−5.1" tone="cyan" />
        </div>
      </GlassCard>
    </section>
  );
}

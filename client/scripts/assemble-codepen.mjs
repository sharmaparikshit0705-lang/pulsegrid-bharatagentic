/**
 * Assembles pulsegrid-codepen.html — a single, readable file that runs the
 * entire PulseGrid dashboard on CodePen (or any plain HTML page) using CDN
 * React 18, Chart.js 4, Tailwind Play CDN and Babel Standalone.
 *
 * Run from /scratch/work:  node assemble-codepen.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const SRC = "src";
const read = (p) => fs.readFileSync(path.join(SRC, p), 'utf8');
const stripImports = (s) => s.replace(/^import[^;]*;\s*\n/gm, '');
const unexport = (s) => s.replace(/^export default /gm, '').replace(/^export /gm, '');

/* ---- mock API (private helpers wrapped in an IIFE so they can't collide
   with the same-named helpers inside Module1PMS) ---- */
const mockApi = unexport(
  stripImports(read('api/mockApi.js'))
    .replace(
      /const API_BASE = import\.meta\.env\.VITE_API_BASE \|\| '\/api\/v1';/,
      "const API_BASE = '/api/v1';"
    )
    .replace(
      /const USE_MOCKS = \(import\.meta\.env\.VITE_USE_MOCKS \?\? 'true'\) !== 'false';/,
      'const USE_MOCKS = true;'
    )
);
const mockApiWrapped = `
const { api, isGreenLaneWindow } = (() => {
${mockApi}
  return { api, isGreenLaneWindow, resetMockStores };
})();
`;

/* ---- Analytics rewritten against the global Chart.js UMD (react-chartjs-2
   has no CDN build) — identical data, options and stat cards ---- */
const analyticsCDN = read('codepen-analytics.jsx');

/* ---- every component except Analytics (which is replaced above) ---- */
const components = [
  read('components/shared.jsx'),
  read('components/Header.jsx'),
  read('agents/corridor.js'),
  read('agents/tools.js'),
  read('agents/router.js'),
  read('agents/agents.js'),
  read('agents/scenarios.js'),
  read('agents/gridmaster.js'),
  read('agents/evals.js'),
  read('agents/voice.js'),
  read('components/AgenticPlane.jsx'),
  read('components/Module1PMS.jsx'),
  read('components/Module2ITS.jsx'),
  read('components/Module3DRT.jsx'),
  analyticsCDN,
  read('App.jsx'),
]
  .map((s) => unexport(stripImports(s)))
  .join('\n');

const bootstrap = 'const { useState, useEffect, useRef, useCallback, useMemo } = React;';

/* The agents/index.js barrel is skipped in the single-file build (its re-exports
   don't survive concatenation), so its browser helper is defined inline here. */
const runtimeHelper = `
function createSubscribableRuntime({ speed = 1 } = {}) {
  const listeners = new Set();
  const rt = createRuntime({ speed, onEvent: (e) => listeners.forEach((fn) => fn(e)) });
  return {
    ...rt,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
}
`;
const render = `ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`;

/* ---- index.css minus @tailwind directives (Play CDN provides them) ---- */
const css = read('index.css').replace(/@tailwind (base|components|utilities);\n/g, '').trim();

const tailwindConfig = `tailwind.config = {
  theme: {
    extend: {
      colors: {
        base: '#070B14',
        neon: { cyan: '#00F0FF', green: '#00FF66', red: '#FF3366' },
      },
      fontFamily: {
        display: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        'neon-cyan': '0 0 18px rgba(0,240,255,0.28), 0 0 60px rgba(0,240,255,0.12)',
        'neon-green': '0 0 18px rgba(0,255,102,0.28), 0 0 60px rgba(0,255,102,0.10)',
        'neon-red': '0 0 18px rgba(255,51,102,0.30), 0 0 60px rgba(255,51,102,0.12)',
      },
      keyframes: {
        'pulse-dot': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.35', transform: 'scale(0.8)' },
        },
      },
      animation: { 'pulse-dot': 'pulse-dot 1.6s ease-in-out infinite' },
    },
  },
};`;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>PulseGrid — Agentic Mobility & Logistics Intelligence for Bharat</title>
<meta name="description" content="PulseGrid — Agentic Mobility & Logistics Intelligence for Bharat. Built for the Bharat Agentic-AI Hackathon 2026." />

<!-- Google Fonts -->
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet" />

<!-- React 18 + Chart.js 4 + Babel (UMD builds) -->
<script crossorigin src="https://unpkg.com/react@18.3.1/umd/react.production.min.js"></script>
<script crossorigin src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.6/dist/chart.umd.min.js"></script>
<script src="https://unpkg.com/@babel/standalone@7.26.4/babel.min.js"></script>

<!-- Tailwind Play CDN -->
<script src="https://cdn.tailwindcss.com"></script>
<script>
${tailwindConfig}
</script>

<!-- Theme: #070B14 base, glassmorphism, neon cyan/emerald/red -->
<style type="text/tailwindcss">
${css}
</style>
</head>
<body>
<div id="root"></div>

<script type="text/babel" data-presets="react">
/*__APP_START__*/
/* ================================================================
   PULSEGRID — single-file CodePen build
   React 18 + Chart.js 4 + Tailwind (Play CDN) + Babel Standalone
   Mock API included — open the console to watch payload exchanges.
   ================================================================ */

${bootstrap}
${runtimeHelper}

/* ---------- in-browser mock API (mirrors the Express /server contract) ---------- */
${mockApiWrapped}
${components}

${render}
/*__APP_END__*/
</script>
</body>
</html>
`;

/* output goes to the repo root */
const out = "../pulsegrid-codepen.html";
fs.writeFileSync(out, html);
console.log(`wrote ${out} (${(fs.statSync(out).size / 1024).toFixed(1)} KB)`);

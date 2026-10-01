/**
 * PulseGrid static/standalone build.
 *
 * The standard pipeline is `npm run build` (Vite). This script is a fully
 * reproducible alternative that uses only esbuild + the Tailwind CLI, and
 * produces:
 *
 *   dist/                       — deployable static build (index.html + assets)
 *   pulsegrid-dashboard.html    — single self-contained file; open it directly
 *                                 in any browser for a zero-install preview
 *
 * Usage:  npm run build:static
 */
import { build } from 'esbuild';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());
const outDir = path.join(root, 'dist');

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(path.join(outDir, 'assets'), { recursive: true });

/* 1. JavaScript bundle (IIFE so it runs from file:// too) */
await build({
  entryPoints: ['src/main.jsx'],
  bundle: true,
  minify: true,
  format: 'iife',
  jsx: 'automatic',
  outfile: 'dist/assets/main.js',
  loader: { '.jsx': 'jsx' },
  define: {
    'import.meta.env.VITE_USE_MOCKS': JSON.stringify(process.env.VITE_USE_MOCKS ?? 'true'),
    'import.meta.env.VITE_API_BASE': JSON.stringify(process.env.VITE_API_BASE ?? '/api/v1'),
  },
  logLevel: 'warning',
});

/* 2. Tailwind CSS */
execSync(
  'npx tailwindcss -i src/index.css -o dist/assets/style.css ' +
    '--content "./index.html,./src/**/*.{js,jsx}" --minify',
  { stdio: 'inherit' }
);

/* 3. esbuild also emits an unprocessed copy of index.css (from the JS import
      used by Vite dev) — remove it; Tailwind's output is the real stylesheet. */
fs.rmSync(path.join(outDir, 'assets/main.css'), { force: true });

/* 4. HTML shells */
const shell = (styleTag, scriptTag, title) => `<!doctype html>
<html lang="en" class="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="PulseGrid — Agentic Mobility & Logistics Intelligence for Bharat. A mesh of AI agents for road safety, cold-chain integrity, disruption-aware freight routing and emergency corridors. Built for the Bharat Agentic-AI Hackathon 2026." />
    <title>${title}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet" />
    ${styleTag}
  </head>
  <body>
    <div id="root"></div>
    ${scriptTag}
  </body>
</html>
`;

fs.writeFileSync(
  path.join(outDir, 'index.html'),
  shell(
    '<link rel="stylesheet" href="./assets/style.css" />',
    '<script defer src="./assets/main.js"></script>',
    'PulseGrid — Agentic Mobility & Logistics Intelligence for Bharat'
  )
);

/* 4. Single-file standalone dashboard */
const css = fs.readFileSync(path.join(outDir, 'assets/style.css'), 'utf8');
let js = fs.readFileSync(path.join(outDir, 'assets/main.js'), 'utf8');
if (js.includes('</script')) js = js.replaceAll('</script', '<\\/script');
fs.writeFileSync(
  path.join(root, '..', 'pulsegrid-agentic.html'),
  shell(`<style>\n${css}\n</style>`, `<script>\n${js}\n</script>`, 'PulseGrid — Live Dashboard')
);

console.log('✅ dist/ built');
console.log('✅ ../pulsegrid-agentic.html written (single-file preview)');

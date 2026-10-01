/**
 * PulseGrid agent core — public entry point.
 *
 * Import this anywhere (browser or Node):
 *   import { createRuntime } from './agents/index.js';
 *   const rt = createRuntime({ onEvent: e => console.log(e) });
 *   const run = await rt.runScenario('B');
 */
export { createRuntime } from './gridmaster.js';
export { AGENTS, AGENTS_BY_ID } from './agents.js';
export { SCENARIOS, SCENARIOS_BY_ID } from './scenarios.js';
export { TOOLS, toolCatalog, VERNACULAR, LANGUAGES, LANGUAGE_LABELS } from './tools.js';
export { runEvals, evalCount } from './evals.js';
export { planRequest, inputsFor, INTENTS } from './router.js';
export { speak, stopSpeaking, speechSupported } from './voice.js';
export * from './corridor.js';

import { createRuntime } from './gridmaster.js';

/** Browser-friendly singleton with an event subscription list. */
export function createSubscribableRuntime({ speed = 1 } = {}) {
  const listeners = new Set();
  const rt = createRuntime({
    speed,
    onEvent: (e) => listeners.forEach((fn) => fn(e)),
  });
  return {
    ...rt,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

import { Router } from 'express';
import diagnosticsRoutes from './diagnostics.routes.js';
import signalsRoutes from './signals.routes.js';
import transitRoutes from './transit.routes.js';
import agentsRoutes from './agents.routes.js';
import { runAgent, agentIntents, agentSchema } from '../controllers/agentsController.js';

const router = Router();

router.use('/diagnostics', diagnosticsRoutes);
router.use('/signals', signalsRoutes);
router.use('/transit', transitRoutes);
router.use('/agents', agentsRoutes);

// The single agent entry point a judge or API client calls:
router.post('/agent', runAgent);
router.get('/agent/intents', agentIntents);
router.get('/agent/schema', agentSchema);

// API surface summary
router.get('/', (_req, res) => {
  res.json({
    service: 'PulseGrid API',
    version: 'v1',
    endpoints: {
      diagnostics: [
        'POST /diagnostics/citizen-report',
        'POST /diagnostics/edge-scan',
        'GET  /diagnostics',
        'PATCH /diagnostics/:id/status',
      ],
      signals: [
        'GET  /signals',
        'GET  /signals/adaptive-status/:junctionId',
        'POST /signals/:junctionId/extend-green',
        'POST /signals/:junctionId/cycle-phase',
        'POST /signals/emergency-override',
      ],
      transit: [
        'GET  /transit/fleet',
        'GET  /transit/green-lane-violations',
        'POST /transit/green-lane-sweep',
        'POST /transit/fleet/:busId/recalculate-capacity',
        'POST /transit/fleet/:busId/dispatch',
      ],
      agent: [
        'POST /agent            <- THE entry point: free-form request -> plan -> reasoning -> tools -> outcome',
        'GET  /agent/schema',
        'GET  /agent/intents',
      ],
      agents: [
        'GET  /agents/catalog',
        'POST /agents/run',
        'GET  /agents/runs',
        'GET  /agents/runs/:runId',
        'GET  /agents/approvals',
        'POST /agents/approvals/:id/resolve',
        'GET  /agents/memory',
      ],
    },
  });
});

export default router;
